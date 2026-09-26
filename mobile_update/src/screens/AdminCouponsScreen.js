import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { api, apiError } from "../services/api";
import { Button, Card, Header, Input, SectionTitle } from "../components/UI";
import { money } from "../utils/format";

export function AdminCouponsScreen() {
  const [coupons, setCoupons] = useState([]);
  const [code, setCode] = useState("");
  const [type, setType] = useState("percentage");
  const [value, setValue] = useState("10");
  const [minOrder, setMinOrder] = useState("1000");
  const [maxDiscount, setMaxDiscount] = useState("500");
  const [usageLimit, setUsageLimit] = useState("1000");
  const [expiry, setExpiry] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get("/admin/coupons")
      .then((r) => setCoupons(r.data || []))
      .catch((e) => Alert.alert("Coupons", apiError(e)));
  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    if (
      Number(value) <= 0 ||
      Number(minOrder) < 0 ||
      Number(maxDiscount) < 0 ||
      Number(usageLimit) < 0
    ) {
      Alert.alert("Invalid coupon", "Please enter valid coupon values.");
      return;
    }
    try {
      setBusy(true);
      const starts = new Date().toISOString();
      const expires = new Date(`${expiry}T23:59:59`).toISOString();
      const r = await api.post("/admin/coupons", {
        code: code.trim().toUpperCase(),
        discount_type: type,
        discount_value: Number(value),
        min_order_amount: Number(minOrder),
        max_discount: Number(maxDiscount),
        usage_limit: Number(usageLimit),
        starts_at: starts,
        expires_at: expires,
        is_active: true,
      });
      Alert.alert("Coupon generated", `${r.data.code} is ready to use.`);
      setCode("");
      load();
    } catch (e) {
      Alert.alert("Generate coupon", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item) => {
    try {
      await api.put(`/admin/coupons/${item.id}`, {
        is_active: !item.is_active,
      });
      load();
    } catch (e) {
      Alert.alert("Update coupon", apiError(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F7FAF8" }}>
      <Header title="Coupon Generator" subtitle="Create and manage discounts" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card accent>
          <Text style={{ fontSize: 21, fontWeight: "900", color: "#087A3A" }}>
            🎟 Create Discount Coupon
          </Text>
          <Text style={{ marginTop: 5, color: "#607066", lineHeight: 19 }}>
            Coupons are applied to the product subtotal only. Delivery charges
            are never discounted.
          </Text>
        </Card>

        <SectionTitle title="Generate coupon" />
        <Card>
          <Input
            label="Coupon code (optional)"
            placeholder="FRESH10"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              marginBottom: 8,
              color: "#17201B",
            }}
          >
            Discount type
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <Pressable
              onPress={() => setType("percentage")}
              style={[
                styles.choice,
                type === "percentage" && styles.choiceSelected,
              ]}
            >
              <Text
                style={
                  type === "percentage"
                    ? styles.choiceTextSelected
                    : styles.choiceText
                }
              >
                Percentage
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setType("fixed")}
              style={[styles.choice, type === "fixed" && styles.choiceSelected]}
            >
              <Text
                style={
                  type === "fixed"
                    ? styles.choiceTextSelected
                    : styles.choiceText
                }
              >
                Fixed Amount
              </Text>
            </Pressable>
          </View>
          <Input
            label="Discount value"
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
          />
          <Input
            label="Minimum order subtotal"
            value={minOrder}
            onChangeText={setMinOrder}
            keyboardType="decimal-pad"
          />
          <Input
            label="Maximum discount (0 = no cap)"
            value={maxDiscount}
            onChangeText={setMaxDiscount}
            keyboardType="decimal-pad"
          />
          <Input
            label="Usage limit (0 = unlimited)"
            value={usageLimit}
            onChangeText={setUsageLimit}
            keyboardType="number-pad"
          />
          <Input
            label="Expiry date (YYYY-MM-DD)"
            value={expiry}
            onChangeText={setExpiry}
          />
          <Button
            title="Generate Coupon"
            icon="🎟"
            onPress={generate}
            loading={busy}
          />
        </Card>

        <SectionTitle title="Manage coupons" />
        {coupons.map((item) => (
          <Card key={item.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 15,
                  backgroundColor: "#E7F7ED",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 23 }}>🏷️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 17, fontWeight: "900", color: "#17201B" }}
                >
                  {item.code}
                </Text>
                <Text
                  style={{ color: "#087A3A", fontWeight: "800", marginTop: 2 }}
                >
                  {item.discount_type === "percentage"
                    ? `${item.discount_value}% OFF`
                    : `${money(item.discount_value)} OFF`}
                </Text>
                <Text style={{ color: "#607066", fontSize: 11, marginTop: 3 }}>
                  Min. subtotal {money(item.min_order_amount)} • Used{" "}
                  {item.used_count}
                  {item.usage_limit ? `/${item.usage_limit}` : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => toggle(item)}
                style={[styles.toggle, item.is_active && styles.toggleOn]}
              >
                <View
                  style={[
                    styles.toggleDot,
                    item.is_active && styles.toggleDotOn,
                  ]}
                />
              </Pressable>
            </View>
          </Card>
        ))}
        {coupons.length === 0 && (
          <Text style={{ color: "#607066", textAlign: "center", padding: 30 }}>
            No coupons yet.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = {
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DCE5DF",
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  choiceSelected: { borderColor: "#0B9F4D", backgroundColor: "#EAF8EF" },
  choiceText: { fontWeight: "800", color: "#607066" },
  choiceTextSelected: { fontWeight: "900", color: "#087A3A" },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 15,
    backgroundColor: "#DCE5DF",
    padding: 3,
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: "#0B9F4D" },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  toggleDotOn: { alignSelf: "flex-end" },
};
