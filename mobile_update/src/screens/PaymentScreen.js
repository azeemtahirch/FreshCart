import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api, apiError } from "../services/api";
import { useCart } from "../context/CartContext";
import { theme } from "../theme/theme";
import { money } from "../utils/format";

import { Button, Card, Header, StatusPill } from "../components/UI";

import { screen, pad } from "../utils/screenHelpers";

export function PaymentScreen({ route, navigation }) {
  const { clear } = useCart();

  const checkout = route.params?.checkout;

  const [busy, setBusy] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const [ref, setRef] = useState(null);
  const [status, setStatus] = useState("pending");

  const total = Number(checkout?.total || 0);

  // ==================================================
  // CREATE ORDER AFTER JAZZCASH SUCCESS
  // ==================================================
  const createOrderAfterPayment = async (txnRef) => {
    try {
      setCreatingOrder(true);

      const r = await api.post("/orders", {
        ...checkout,

        payment_method: "jazzcash",

        payment_txn_ref: txnRef,
      });

      await clear();

      navigation.replace("Order Confirmation", {
        orderId: r.data.order_id,
        orderNumber: r.data.order_number,
        total: r.data.total ?? total,
      });
    } catch (e) {
      Alert.alert(
        "Order creation failed",
        apiError(e) ||
          "Payment was successful, but the order could not be created. Please contact support.",
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  // ==================================================
  // START JAZZCASH
  // ==================================================
  const initiate = async () => {
    if (!checkout) {
      Alert.alert(
        "Payment error",
        "Checkout information is missing. Please return to checkout.",
      );
      return;
    }

    try {
      setBusy(true);

      setStatus("pending");
      setRef(null);

      const r = await api.post("/payments/jazzcash/initiate", {
        amount: total,
      });

      const txnRef = r.data.txn_ref;
      const paymentStatus = r.data.status || "pending";

      setRef(txnRef);
      setStatus(paymentStatus);

      // Gateway immediately returned successful
      if (paymentStatus === "paid") {
        await createOrderAfterPayment(txnRef);
      }

      if (
        paymentStatus === "failed" ||
        paymentStatus === "cancelled" ||
        paymentStatus === "expired"
      ) {
        showPaymentFailed();
      }
    } catch (e) {
      setStatus("failed");

      Alert.alert(
        "JazzCash payment failed",
        `${apiError(e)}\n\nNo order has been created. Please try JazzCash again or use Cash on Delivery.`,
        [
          {
            text: "Retry",
            onPress: () => {
              setRef(null);
              setStatus("pending");
            },
          },
          {
            text: "Use Cash On Delivery",
            onPress: () => navigation.replace("Checkout"),
          },
        ],
      );
    } finally {
      setBusy(false);
    }
  };

  // ==================================================
  // CHECK PAYMENT
  // ==================================================
  const checkPaymentStatus = async () => {
    if (!ref) return;

    try {
      setBusy(true);

      const r = await api.get(`/payments/${encodeURIComponent(ref)}/status`);

      const newStatus = r.data.status || "pending";

      setStatus(newStatus);

      // ==================================================
      // SUCCESS → CREATE ORDER
      // ==================================================
      if (newStatus === "paid") {
        await createOrderAfterPayment(ref);
        return;
      }

      // ==================================================
      // FAILED → NO ORDER
      // ==================================================
      if (
        newStatus === "failed" ||
        newStatus === "cancelled" ||
        newStatus === "expired"
      ) {
        showPaymentFailed();
      }
    } catch (e) {
      Alert.alert("Payment status", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  // ==================================================
  // PAYMENT FAILED MESSAGE
  // ==================================================
  const showPaymentFailed = () => {
    Alert.alert(
      "Payment not successful",
      "JazzCash payment was not completed. No order has been created.",
      [
        {
          text: "Retry JazzCash",
          onPress: () => {
            setRef(null);
            setStatus("pending");
          },
        },
        {
          text: "Use Cash On Delivery",
          onPress: () => {
            navigation.replace("Checkout");
          },
        },
      ],
    );
  };

  // ==================================================
  // BACK
  // ==================================================
  const goBack = () => {
    if (creatingOrder) return;

    navigation.replace("Checkout");
  };

  return (
    <View style={screen}>
      <Header title="JazzCash Payment" onBack={goBack} />

      <ScrollView contentContainerStyle={pad}>
        <View style={s.jazzHero}>
          <Text style={s.jazzLogo}>JazzCash</Text>

          <Text style={s.jazzSecure}>
            ✓ Secure payment via FreshCart backend
          </Text>
        </View>

        <Card>
          <Text style={s.label}>Amount to pay</Text>

          <Text style={s.payAmount}>{money(total)}</Text>

          <Text style={s.muted}>
            Your merchant credentials remain securely on the server.
          </Text>
        </Card>

        {ref ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={s.name}>Transaction reference</Text>

            <Text style={s.ref}>{ref}</Text>

            <StatusPill status={status} />

            {status === "pending" ? (
              <Text style={s.pendingText}>
                Complete your JazzCash payment and then check the payment
                status.
              </Text>
            ) : null}

            {status === "failed" ||
            status === "cancelled" ||
            status === "expired" ? (
              <Text style={s.failedText}>
                Payment was not completed. No order has been created.
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Button
          title={
            creatingOrder
              ? "Creating order..."
              : ref
                ? "Check payment status"
                : "Pay with JazzCash"
          }
          onPress={ref ? checkPaymentStatus : initiate}
          loading={busy || creatingOrder}
          disabled={creatingOrder}
        />

        {ref &&
        (status === "failed" ||
          status === "cancelled" ||
          status === "expired") ? (
          <View style={{ marginTop: 10 }}>
            <Button
              title="Use Cash on Delivery"
              secondary
              onPress={() => navigation.replace("Checkout")}
              disabled={creatingOrder}
            />
          </View>
        ) : null}

        <Text style={s.secureNote}>
          🔒 100% secure payment • Never share your OTP
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  jazzHero: {
    backgroundColor: "#FFF2C7",
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },

  jazzLogo: {
    fontSize: 30,
    fontWeight: "900",
    color: "#E22B22",
  },

  jazzSecure: {
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },

  payAmount: {
    fontSize: 34,
    fontWeight: "900",
    color: theme.colors.primary,
    marginVertical: 8,
  },

  name: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },

  ref: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",

    fontSize: 15,
    marginVertical: 8,
    color: theme.colors.text,
  },

  muted: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },

  pendingText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "700",
    marginTop: 10,
  },

  failedText: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: "700",
    marginTop: 10,
  },

  secureNote: {
    textAlign: "center",
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 15,
  },
});
