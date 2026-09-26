import React, { useState } from "react";

import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { money, sizeLabel } from "../utils/format";

import {
  Button,
  Card,
  Divider,
  Header,
  Loader,
  StatusPill,
  SummaryRow,
} from "../components/UI";

import { screen, pad, useOrderSync, timeLabel } from "../utils/screenHelpers";

export function OrderDetailsScreen({ route, navigation }) {
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

  const locationParts = [o.delivery_area, o.delivery_city].filter(Boolean);

  return (
    <View style={screen}>
      <Header
        title={o.order_number}
        subtitle="Order details"
        onBack={() => navigation.goBack()}
        right={<StatusPill status={o.status} />}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 50,
        }}
      >
        {/* ORDER ITEMS */}
        {o.items?.map((x) => {
          const itemSize =
            x.unit_type === "dozen"
              ? "1 dozen"
              : x.size_label || sizeLabel(x.size_ml, x.unit_type);

          return (
            <Card key={x.id} style={s.detailItem}>
              <Image
                source={{
                  uri: x.image_url,
                }}
                style={s.detailItemImg}
              />

              <View style={{ flex: 1 }}>
                <Text style={s.name}>{x.product_name}</Text>

                <Text style={s.muted}>
                  {itemSize} × {x.quantity}
                </Text>

                <Text style={s.itemTotal}>{money(x.item_total)}</Text>
              </View>
            </Card>
          );
        })}

        {/* PAYMENT SUMMARY */}
        <Card style={s.summary}>
          <Text style={s.summaryTitle}>Payment summary</Text>

          <SummaryRow label="Subtotal" value={o.subtotal} />

          <SummaryRow
            label="Shipping"
            value={Number(o.shipping) === 0 ? "FREE" : o.shipping}
          />

          <Divider />

          <SummaryRow label="Total" value={o.total} strong green />
        </Card>

        {/* DELIVERY */}
        <Card style={s.deliveryCard}>
          <Text style={s.label}>Delivery</Text>

          <Text style={s.address}>
            {o.delivery_address || "Address not available"}
          </Text>

          {/* CITY + AREA */}
          {locationParts.length > 0 ? (
            <Text style={s.location}>📍 {locationParts.join(" • ")}</Text>
          ) : null}

          {/* DELIVERY DATE / TIME */}
          <Text style={s.muted}>
            {o.delivery_date || "Date not available"} •{" "}
            {timeLabel(o.slot_start_time)} - {timeLabel(o.slot_end_time)}
          </Text>

          {/* PAYMENT METHOD */}
          <Text style={s.muted}>
            Payment:{" "}
            {o.payment_method === "jazzcash" ? "JazzCash" : "Cash on Delivery"}
          </Text>
        </Card>

        {/* DELIVERY PROOF */}
        {o.status === "delivered" && o.delivery_proof?.file_url && (
          <Card accent style={{ marginTop: 14 }}>
            <Text style={s.name}>Order Delivered ✓</Text>

            <Text style={s.label}>Delivery Proof</Text>

            <Image
              source={{
                uri: o.delivery_proof.file_url,
              }}
              style={s.proofImage}
            />

            <Text style={s.muted}>
              Delivered on{" "}
              {new Date(o.delivery_proof.captured_at).toLocaleString()}
            </Text>
          </Card>
        )}

        {/* TRACK ORDER */}
        <Button
          title="Track order"
          onPress={() =>
            navigation.navigate("Order Tracking", {
              orderId: o.id,
            })
          }
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  detailItemImg: {
    width: 65,
    height: 65,
    borderRadius: 14,
    marginRight: 12,
    backgroundColor: theme.colors.primarySoft,
  },

  itemTotal: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    marginTop: 4,
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
    marginTop: 5,
  },

  proofImage: {
    width: "100%",
    height: 360,
    borderRadius: 20,
    marginTop: 14,
  },

  summary: {
    marginTop: 6,
    marginBottom: 20,
  },

  summaryTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },

  deliveryCard: {
    marginTop: 0,
  },
});
