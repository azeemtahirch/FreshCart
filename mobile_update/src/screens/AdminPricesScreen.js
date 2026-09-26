import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { money, sizes } from "../utils/format";
import { Button, Card, Header, Input } from "../components/UI";
import {
  screen,
  pad,
} from "../utils/screenHelpers";

export function AdminPricesScreen() {
  const [p, setP] = useState([]),
    [v, setV] = useState({});
  useEffect(() => {
    api
      .get("/products")
      .then((r) => setP(r.data || []))
      .catch((e) => Alert.alert("Prices", apiError(e)));
  }, []);
  return (
    <ScrollView style={screen} contentContainerStyle={pad}>
      <Header title="Base prices" subtitle="Server-calculated sizes" />
      {p.map((x) => (
        <Card key={x.id} style={s.priceAdmin}>
          <View style={s.row}>
            <View>
              <Text style={s.name}>{x.name}</Text>
              <Text style={s.muted}>
                Current {money(x.base_price)} / {x.unit_type}
              </Text>
            </View>
            <Text style={s.priceTag}>{x.unit_type}</Text>
          </View>
          <Input
            label={`New base price / ${x.unit_type}`}
            value={v[x.id]?.price ?? String(x.base_price)}
            onChangeText={(z) =>
              setV((prev) => ({
                ...prev,
                [x.id]: { ...(prev[x.id] || {}), price: z },
              }))
            }
            keyboardType="decimal-pad"
          />
          <Input
            label="Notification message (optional)"
            placeholder="🔥 Fresh deal — grab this product now!"
            value={v[x.id]?.message ?? ""}
            onChangeText={(z) =>
              setV((prev) => ({
                ...prev,
                [x.id]: { ...(prev[x.id] || {}), message: z },
              }))
            }
          />
          <Button
            secondary
            title="Save price & notify customers"
            onPress={async () => {
              try {
                const val = v[x.id] || {};
                const response = await api.post("/admin/prices", {
                  product_id: x.id,
                  base_price: Number(val.price ?? x.base_price),
                  notification_message: val.message || "",
                });
                const sent = response.data?.sent ?? 0;
                const failed = response.data?.failed ?? 0;
                Alert.alert(
                  "Saved ✓",
                  failed > 0
                    ? `Price updated. ${sent} push notification(s) sent; ${failed} failed. Customers can still see the update in Notifications.`
                    : `Price updated and ${sent} push notification(s) sent.`,
                );
              } catch (e) {
                Alert.alert("Save price", apiError(e));
              }
            }}
          />
        </Card>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  priceAdmin: { marginBottom: 10 },
  priceTag: {
    backgroundColor: theme.colors.primarySoft,
    color: theme.colors.primaryDark,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: "900",
  },
});
