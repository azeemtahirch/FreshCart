import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { Card, Header, Loader, StatusPill } from "../components/UI";
import { screen, pad, useOrderSync, timeLabel } from "../utils/screenHelpers";

export function OrderTrackingScreen({ route, navigation }) {
  const [o, setO] = useState(null);
  const load = React.useCallback(
    (silent = false) =>
      api
        .get(`/orders/${route.params.orderId}`)
        .then((r) => setO(r.data))
        .catch((e) => {
          if (!silent) Alert.alert("Tracking", apiError(e));
        }),
    [route.params.orderId],
  );
  useOrderSync(load);
  if (!o) return <Loader />;
  const steps = [
    "pending",
    "confirmed",
    "preparing",
    "out_for_delivery",
    "delivered",
  ];
  const current = Math.max(0, steps.indexOf(o.status));
  return (
    <View style={screen}>
      <Header
        title="Order tracking"
        subtitle={o.order_number}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 50,
        }}
      >
        <Card accent>
          <View style={s.trackHeader}>
            <Text style={s.trackOrder}>#{o.order_number}</Text>
            <StatusPill status={o.status} />
          </View>
          <Text style={s.muted}>Your groceries are on their way.</Text>
        </Card>
        <Card style={{ marginTop: 14 }}>
          {steps.map((st, i) => (
            <View key={st} style={s.timelineRow}>
              <View style={s.timelineRail}>
                {i <= current ? (
                  <View style={s.timelineDone}>
                    <Text style={s.timelineCheck}>✓</Text>
                  </View>
                ) : (
                  <View style={s.timelineDot} />
                )}
                {i < steps.length - 1 && (
                  <View
                    style={[s.timelineLine, i < current && s.timelineLineDone]}
                  />
                )}
              </View>
              <View style={s.timelineCopy}>
                <Text
                  style={[s.timelineTitle, i <= current && s.timelineActive]}
                >
                  {st === "out_for_delivery"
                    ? "Out for delivery"
                    : st[0].toUpperCase() + st.slice(1)}
                </Text>
                <Text style={s.muted}>
                  {i < current
                    ? "Completed"
                    : i === current
                      ? "Current status"
                      : "Waiting"}
                </Text>
              </View>
            </View>
          ))}
        </Card>
        <Card style={{ marginTop: 14 }}>
          <Text style={s.label}>Delivery Address</Text>
          <Text style={s.name}>{o.delivery_address}</Text>
          <Text style={s.muted}>
            {o.delivery_date} • {timeLabel(o.slot_start_time)} -{" "}
            {timeLabel(o.slot_end_time)}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },
  timelineActive: { color: theme.colors.text },
  timelineCheck: { color: "#fff", fontWeight: "900" },
  timelineCopy: { paddingLeft: 10, paddingTop: 3 },
  timelineDone: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: "#fff",
  },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.colors.border },
  timelineLineDone: { backgroundColor: theme.colors.primary },
  timelineRail: { width: 38, alignItems: "center" },
  timelineRow: { flexDirection: "row", minHeight: 74 },
  timelineTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.muted },
  trackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trackOrder: { fontSize: 18, fontWeight: "900", color: theme.colors.text },
});
