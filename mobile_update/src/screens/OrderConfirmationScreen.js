import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCart } from "../context/CartContext";
import { theme } from "../theme/theme";
import { Button, Card, SummaryRow } from "../components/UI";

export function OrderConfirmationScreen({ route, navigation }) {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, []);
  return (
    <View style={s.center}>
      <View style={s.successCircle}>
        <Text style={s.successCheck}>✓</Text>
      </View>
      <Text style={s.kicker}>ORDER CONFIRMED</Text>
      <Text style={s.h1}>Thanks for your order!</Text>
      <Text style={s.p}>
        Your order <Text style={s.greenText}>{route.params?.orderNumber}</Text>{" "}
        has been received and is being prepared.
      </Text>
      <Card style={s.confirmCard}>
        <SummaryRow
          label="Order total"
          value={route.params?.total || 0}
          strong
          green
        />
        <Text style={s.muted}>
          We'll deliver it in your selected time slot.
        </Text>
      </Card>
      <Button
        title="Track my order"
        onPress={() =>
          navigation.replace("Order Tracking", {
            orderId: route.params?.orderId,
          })
        }
      />
      <Button
        secondary
        title="Continue shopping"
        onPress={() => navigation.popToTop()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: { width: "100%", marginVertical: 18 },
  greenText: { color: theme.colors.primaryDark, fontWeight: "900" },
  h1: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 35,
    color: theme.colors.text,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: theme.colors.primary,
    marginBottom: 8,
  },
  p: {
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.muted,
    marginBottom: 14,
  },
  successCheck: { fontSize: 52, color: "#fff", fontWeight: "900" },
  successCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
});
