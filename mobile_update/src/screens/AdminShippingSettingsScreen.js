import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api, apiError } from "../services/api";
import { Button, Card, Header, Input, Loader } from "../components/UI";
import { theme } from "../theme/theme";

const defaultTiers = [
  { min_amount: "250", max_amount: "500", fee: "70" },
  { min_amount: "500", max_amount: "700", fee: "60" },
  { min_amount: "700", max_amount: "1000", fee: "50" },
  { min_amount: "1000", max_amount: "0", fee: "30" },
];
const blank = {
  minimum_order_amount: "250",
  shipping_tiers: defaultTiers,
  free_shipping_threshold: "1500",
  currency: "PKR",
  free_shipping_enabled: false,
};

export function AdminShippingSettingsScreen({ navigation }) {
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/settings/shipping");
      setForm({
        minimum_order_amount: String(data.minimum_order_amount ?? ""),
        shipping_tiers: (data.shipping_tiers?.length
          ? data.shipping_tiers
          : defaultTiers
        ).map((tier) => ({
          ...tier,
          min_amount: String(tier.min_amount),
          max_amount: String(tier.max_amount),
          fee: String(tier.fee),
        })),
        free_shipping_threshold: String(data.free_shipping_threshold ?? ""),
        currency: data.currency || "PKR",
        free_shipping_enabled: Boolean(data.free_shipping_enabled),
      });
    } catch (e) {
      Alert.alert("Shipping settings", apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const payload = {
      minimum_order_amount: Number(form.minimum_order_amount),
      shipping_fee: Number(form.shipping_tiers[0]?.fee),
      shipping_tiers: form.shipping_tiers.map((tier) => ({
        min_amount: Number(tier.min_amount),
        max_amount: Number(tier.max_amount),
        fee: Number(tier.fee),
      })),
      free_shipping_threshold: Number(form.free_shipping_threshold),
      currency: form.currency.trim().toUpperCase(),
      free_shipping_enabled: form.free_shipping_enabled,
    };
    if (
      !payload.currency ||
      Object.values(payload).some(
        (value) =>
          typeof value === "number" && (!Number.isFinite(value) || value < 0),
      ) ||
      payload.shipping_tiers.some(
        (tier) =>
          !Number.isFinite(tier.min_amount) ||
          !Number.isFinite(tier.max_amount) ||
          !Number.isFinite(tier.fee) ||
          tier.fee < 0,
      )
    ) {
      return Alert.alert(
        "Shipping settings",
        "Enter valid, non-negative amounts and a currency.",
      );
    }
    try {
      setSaving(true);
      const { data } = await api.put("/admin/settings/shipping", payload);
      Alert.alert(
        "Success",
        data.message || "Shipping settings updated successfully.",
      );
      await load();
    } catch (e) {
      Alert.alert("Shipping settings", apiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading shipping settings..." />;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Header
        title="Shipping & Order Settings"
        subtitle="Controls applied to every new order"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <Text style={styles.heading}>Shipping & Order Settings</Text>
          <Text style={styles.description}>
            Changes take effect immediately for new checkout requests. Existing
            orders retain their recorded shipping charge.
          </Text>
          <Input
            label="Minimum Order Amount"
            value={form.minimum_order_amount}
            onChangeText={(value) => set("minimum_order_amount", value)}
            keyboardType="decimal-pad"
            placeholder="250"
          />
          <Text style={styles.sectionTitle}>Tiered shipping rates</Text>
          <Text style={styles.description}>
            These fees apply when the free-shipping offer is off, or the cart is
            below its threshold.
          </Text>
          {form.shipping_tiers.map((tier, index) => (
            <Input
              key={`${tier.min_amount}-${tier.max_amount}`}
              label={`Rs. ${tier.min_amount} - ${tier.max_amount === "0" ? "and above" : Number(tier.max_amount) - 0.01}`}
              value={tier.fee}
              onChangeText={(value) =>
                set(
                  "shipping_tiers",
                  form.shipping_tiers.map((item, i) =>
                    i === index ? { ...item, fee: value } : item,
                  ),
                )
              }
              keyboardType="decimal-pad"
              placeholder="0"
            />
          ))}
          <Input
            label="Free Shipping Minimum Order"
            value={form.free_shipping_threshold}
            onChangeText={(value) => set("free_shipping_threshold", value)}
            keyboardType="decimal-pad"
            placeholder="1500"
          />
          <Input
            label="Currency"
            value={form.currency}
            onChangeText={(value) => set("currency", value)}
            autoCapitalize="characters"
            maxLength={8}
            placeholder="PKR"
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.free_shipping_enabled }}
            onPress={() =>
              set("free_shipping_enabled", !form.free_shipping_enabled)
            }
            style={styles.toggleRow}
          >
            <View
              style={[
                styles.checkbox,
                form.free_shipping_enabled && styles.checkboxChecked,
              ]}
            >
              {form.free_shipping_enabled && (
                <Text style={styles.check}>✓</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Enable Free Shipping</Text>
              <Text style={styles.toggleDescription}>
                OFF by default. When ON, shipping is free at or above the
                minimum order entered above.
              </Text>
            </View>
          </Pressable>
          <Button title="Save Settings" onPress={save} loading={saving} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = {
  heading: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.muted,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 4,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 4,
    paddingTop: 16,
    paddingBottom: 6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  check: { color: "#fff", fontWeight: "900" },
  toggleTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  toggleDescription: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
};
