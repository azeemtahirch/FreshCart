import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, apiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme/theme";
import { money } from "../utils/format";
import { Button, Card, Header, SectionTitle } from "../components/UI";
import {
  screen,
  pad,
} from "../utils/screenHelpers";

export function AdminDashboardScreen({ navigation }) {
  const { logout } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    api
      .get("/admin/dashboard")
      .then((r) => setD(r.data))
      .catch((e) => Alert.alert("Dashboard", apiError(e)));
  }, []);
  const actions = [
    ["Products", "Manage catalogue", "🥬", "Products"],
    ["Categories", "Organize departments", "📂", "Admin Categories"],
    ["Prices", "Base prices / kg / L", "💰", "Admin Prices"],
    ["Orders", "Update order status", "📦", "Orders"],
    ["Riders", "Manage delivery team", "🚴", "Riders"],
    ["Time slots", "Capacity & schedules", "🕐", "Slots"],
    ["Coupons", "Generate discounts", "🎟", "Admin Coupons"],
    [
      "Shipping & orders",
      "Checkout rules and delivery fees",
      "🚚",
      "Admin Shipping Settings",
    ],,
    ["Delivery areas", "Manage shipping cities and areas", "📍", "Admin Delivery Areas"],
  ];
  return (
    <View style={screen}>
      <Header
        title="FreshCart Admin"
        subtitle="Operations overview"
        right={
          <Button
            title="Log out"
            danger
            onPress={() =>
              Alert.alert("Log out", "Are you sure you want to log out?", [
                { text: "Cancel", style: "cancel" },
                { text: "Log out", style: "destructive", onPress: logout },
              ])
            }
          />
        }
      />
      <ScrollView contentContainerStyle={pad}>
        <View style={s.adminWelcome}>
          <Text style={s.adminEyebrow}>TODAY'S OVERVIEW</Text>
          <Text style={s.adminTitle}>Good day, Admin</Text>
          <Text style={s.muted}>Keep the FreshCart operation moving.</Text>
        </View>
        <View style={s.statsGrid}>
          {[
            ["Orders", d?.orders ?? 0, "📦"],
            ["Revenue", money(d?.revenue ?? 0), "💰"],
            ["Customers", d?.customers ?? 0, "👥"],
            ["Products", d?.products ?? 0, "🥬"],
          ].map(([label, val, ico]) => (
            <Card key={label} style={s.statCard}>
              <Text style={s.statIcon}>{ico}</Text>
              <Text style={s.statValue}>{val}</Text>
              <Text style={s.muted}>{label}</Text>
            </Card>
          ))}
        </View>
        <SectionTitle title="Quick management" />
        {actions.map(([t, sub, ico, target]) => (
          <Pressable
            key={t}
            style={s.adminAction}
            onPress={() => navigation.navigate(target)}
          >
            <View style={s.adminActionIcon}>
              <Text>{ico}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{t}</Text>
              <Text style={s.muted}>{sub}</Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  adminAction: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  adminActionIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  adminEyebrow: {
    fontSize: 10,
    color: "#A9C7B4",
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  adminTitle: { fontSize: 26, fontWeight: "900", color: "#fff", marginTop: 7 },
  adminWelcome: {
    backgroundColor: theme.colors.black,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },
  arrow: { fontSize: 28, color: theme.colors.muted },
  statCard: { width: "48%", minHeight: 112 },
  statIcon: { fontSize: 20 },
  statValue: {
    fontSize: 25,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 8,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
