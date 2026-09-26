import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/theme";
import { Button } from "../components/UI";

export function LocationPermissionScreen({ navigation }) {
  return (
    <View style={s.onboard}>
      <View style={s.locationArt}><Text style={s.locationPin}>⌖</Text></View>
      <Text style={s.kicker}>WELCOME TO FRESHCART</Text>
      <Text style={s.h1}>Fresh groceries,{`\n`}right at your doorstep.</Text>
      <Text style={s.p}>FreshCart does not require device location permission. Add your delivery address manually when you are ready to place an order.</Text>
      <View style={s.infoRow}>
        <View style={s.infoIcon}><Text>📍</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>Delivery location</Text>
          <Text style={s.muted}>Enter your street, house, area, city, and country.</Text>
        </View>
      </View>
      <Button title="Continue to FreshCart" onPress={() => navigation.replace("Login")} />
    </View>
  );
}

const s = StyleSheet.create({
  onboard: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: theme.colors.background },
  locationArt: { alignSelf: "center", width: 110, height: 110, borderRadius: 55, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primarySoft, marginBottom: 24 },
  locationPin: { fontSize: 62, color: theme.colors.primary },
  kicker: { fontSize: 11, fontWeight: "900", color: theme.colors.primary, letterSpacing: 1.5, textAlign: "center", marginBottom: 10 },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: "900", color: theme.colors.text, textAlign: "center", marginBottom: 14 },
  p: { fontSize: 15, lineHeight: 22, color: theme.colors.muted, textAlign: "center", marginBottom: 20 },
  infoRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, backgroundColor: "#fff", marginBottom: 18 },
  infoIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", marginRight: 12 },
  name: { fontSize: 14, fontWeight: "800", color: theme.colors.text },
  muted: { fontSize: 12, lineHeight: 18, color: theme.colors.muted, marginTop: 3 },
});
