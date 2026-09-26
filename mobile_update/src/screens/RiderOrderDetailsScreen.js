import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { money, sizeLabel } from "../utils/format";

import {
  Button,
  Card,
  Header,
  Loader,
  SectionTitle,
  SummaryRow,
} from "../components/UI";

import {
  screen,
  pad,
  fmtStatus,
  useOrderSync,
  timeLabel,
} from "../utils/screenHelpers";

export function RiderOrderDetailsScreen({ route, navigation }) {
  const [o, setO] = useState(null);

  const load = React.useCallback(
    (silent = false) =>
      api
        .get(`/orders/${route.params.orderId}`)
        .then((r) => {
          setO(r.data);
        })
        .catch((e) => {
          if (!silent) {
            Alert.alert("Order", apiError(e));
          }
        }),
    [route.params.orderId],
  );

  useOrderSync(load);

  if (!o) {
    return <Loader />;
  }

  const updateStatus = async (status) => {
    try {
      await api.put(`/rider/orders/${o.id}/status`, {
        status,
      });

      setO((current) => ({
        ...current,
        status,
      }));
    } catch (e) {
      Alert.alert("Update delivery status", apiError(e));
    }
  };

  const locationParts = [o.delivery_area, o.delivery_city].filter(Boolean);

  return (
    <View style={screen}>
      <Header
        title={o.order_number}
        subtitle="Delivery details"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={pad}>
        {/* CUSTOMER */}
        <Card accent>
          <Text style={s.kicker}>CUSTOMER</Text>

          <Text style={s.name}>{o.customer_name || "Customer"}</Text>

          {o.customer_phone ? (
            <Text style={s.muted}>☎ {o.customer_phone}</Text>
          ) : null}

          {/* ADDRESS */}
          <Text style={[s.kicker, { marginTop: 14 }]}>CUSTOMER ADDRESS</Text>

          <Text style={s.address}>
            {o.delivery_address || "Address not available"}
          </Text>

          {locationParts.length > 0 ? (
            <Text style={s.location}>📍 {locationParts.join(" • ")}</Text>
          ) : null}
        </Card>

        {/* DELIVERY SLOT */}
        <Card style={{ marginTop: 14 }}>
          <Text style={s.label}>Delivery slot</Text>

          <Text style={s.name}>{o.delivery_date || "Date not available"}</Text>

          <Text style={s.muted}>
            {timeLabel(o.slot_start_time)} - {timeLabel(o.slot_end_time)}
          </Text>

          <Text style={[s.muted, { marginTop: 8 }]}>
            Status: {fmtStatus(o.status)}
          </Text>
        </Card>

        {/* ORDER ITEMS */}
        <SectionTitle title="Order items" />

        {o.items?.map((x) => {
          const itemSize =
            x.unit_type === "dozen"
              ? "1 dozen"
              : x.size_label || sizeLabel(x.size_ml, x.unit_type);

          return (
            <View key={x.id} style={s.riderItem}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{x.product_name}</Text>

                <Text style={s.muted}>
                  {itemSize} × {x.quantity}
                </Text>
              </View>

              <Text style={s.itemTotal}>{money(x.item_total)}</Text>
            </View>
          );
        })}

        {/* PAYMENT */}
        <Card style={{ marginTop: 14 }}>
          <SummaryRow label="Total" value={o.total} strong green />

          <Text style={s.muted}>
            Payment:{" "}
            {o.payment_method === "cod" ? "Cash on Delivery" : "JazzCash"}
          </Text>
        </Card>

        {/* RIDER ACTIONS */}
        {o.status === "assigned" ? (
          <Button
            title="Accept delivery"
            onPress={() => updateStatus("accepted")}
            icon="✓"
          />
        ) : o.status === "accepted" ? (
          <Button
            title="Mark picked up"
            onPress={() => updateStatus("preparing")}
            icon="📦"
          />
        ) : o.status === "preparing" ? (
          <Button
            title="Start delivery"
            onPress={() => updateStatus("out_for_delivery")}
            icon="🚴"
          />
        ) : o.status === "out_for_delivery" ? (
          <Button
            title="Take delivery photo"
            onPress={() =>
              navigation.navigate("Delivery Photo", {
                orderId: o.id,
              })
            }
            icon="📸"
          />
        ) : o.status === "delivered" ? (
          <Button title="Delivered ✓" disabled />
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  itemTotal: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    marginTop: 4,
    marginLeft: 12,
  },

  kicker: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: theme.colors.primary,
    marginBottom: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },

  name: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },

  address: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: theme.colors.text,
  },

  location: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: theme.colors.primaryDark,
    marginTop: 6,
  },

  muted: {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.muted,
    marginTop: 4,
  },

  riderItem: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
