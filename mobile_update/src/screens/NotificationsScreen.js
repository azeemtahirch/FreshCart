import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, apiError } from "../services/api";
import { useCart } from "../context/CartContext";
import { theme } from "../theme/theme";
import { Button, Header } from "../components/UI";

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false);
  const { add } = useCart();
  const load = async () => {
    try {
      const r = await api.get("/notifications");
      setItems(r.data || []);
    } catch (e) {
      Alert.alert("Notifications", apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const mark = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setItems((x) =>
        x.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {}
  };
  const orderNow = async (n) => {
    let d = {};
    try {
      d = typeof n.data === "string" ? JSON.parse(n.data) : n.data || {};
    } catch {}
    if (!d.product_id) return;
    try {
      const r = await api.get(`/products/${d.product_id}`);
      const p = r.data;
      if (!p?.is_active || Number(p.stock_quantity) <= 0) {
        Alert.alert(
          "Product unavailable",
          "This product is currently out of stock.",
        );
        return;
      }
      add(p, 500);
      await mark(n.id);
      navigation.navigate("Main", { screen: "Cart" });
    } catch (e) {
      Alert.alert("Unable to add product", apiError(e));
    }
  };
  const couponNow = async (n) => {
    await mark(n.id);
    navigation.navigate("Checkout");
  };
  return (
    <View style={s.screen}>
      <Header title="Notifications" subtitle="FreshCart updates & offers" />
      <ScrollView
        contentContainerStyle={s.wrap}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {!loading && !items.length && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>You're all caught up</Text>
            <Text style={s.muted}>New FreshCart updates will appear here.</Text>
          </View>
        )}
        {items.map((n) => {
          let d = {};
          try {
            d = typeof n.data === "string" ? JSON.parse(n.data) : n.data || {};
          } catch {}
          const price = n.type === "price_update";
          const coupon = n.type === "coupon";
          return (
            <View key={n.id} style={[s.card, !n.is_read && s.unread]}>
              <Pressable onPress={() => mark(n.id)}>
                <View style={s.head}>
                  <Text style={s.emoji}>
                    {price
                      ? "💰"
                      : coupon
                        ? "🎁"
                        : n.type === "order_delivered"
                          ? "📦"
                          : n.type === "new_order"
                            ? "🛒"
                            : "🔔"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.title}>{n.title}</Text>
                    <Text style={s.time}>
                      {n.created_at
                        ? new Date(n.created_at).toLocaleString()
                        : ""}
                    </Text>
                  </View>
                  {!n.is_read && <Text style={s.new}>NEW</Text>}
                </View>
              </Pressable>
              {price && d.product_image ? (
                <Image
                  source={{ uri: d.product_image }}
                  style={s.productImage}
                />
              ) : null}
              {price && (
                <View>
                  <Text style={s.productName}>{d.product_name}</Text>
                  <View style={s.priceRow}>
                    <Text style={s.old}>
                      Rs. {Number(d.old_price || 0).toFixed(0)}
                    </Text>
                    <Text style={s.arrow}>→</Text>
                    <Text style={s.newPrice}>
                      Rs. {Number(d.new_price || 0).toFixed(0)}/
                      {d.unit_type || "kg"}
                    </Text>
                  </View>
                  <Text style={s.save}>
                    🔥 Fresh price update — grab it while stock lasts!
                  </Text>
                  <Button title="🛒 ORDER NOW" onPress={() => orderNow(n)} />
                </View>
              )}
              {coupon && (
                <View>
                  <Text style={s.couponCode}>{d.code || "FRESH OFFER"}</Text>
                  <Text style={s.message}>{n.message}</Text>
                  <Button title="🛍️ SHOP NOW" onPress={() => couponNow(n)} />
                </View>
              )}
              {!price && !coupon && <Text style={s.message}>{n.message}</Text>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  wrap: { padding: 16, paddingBottom: 30 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  unread: { borderColor: "#B8DDBF" },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  emoji: { fontSize: 25 },
  title: { fontSize: 16, fontWeight: "900", color: theme.colors.text },
  time: { fontSize: 11, color: "#89958D", marginTop: 2 },
  new: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.primary,
    backgroundColor: "#E9F7EC",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  productImage: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    marginTop: 12,
    backgroundColor: "#F3F6F3",
  },
  productName: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  old: { textDecorationLine: "line-through", color: "#9AA39E", fontSize: 15 },
  arrow: { fontSize: 18, color: theme.colors.primary },
  newPrice: { fontSize: 22, fontWeight: "900", color: theme.colors.primary },
  save: { fontSize: 13, color: "#637069", marginVertical: 10 },
  couponCode: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.primary,
    letterSpacing: 1,
    marginTop: 12,
  },
  message: { fontSize: 14, color: "#55615A", lineHeight: 21, marginTop: 8 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: "900", marginTop: 10 },
  muted: { color: "#7A857E", marginTop: 5 },
});
