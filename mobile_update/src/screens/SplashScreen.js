import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/theme";

export const SplashScreen = () => (
  <View style={s.splash}>
    <View style={s.logoMark}>
      <Text style={s.logoLeaf}>✓</Text>
    </View>
    <Text style={s.logo}>FreshCart</Text>
    <Text style={s.splashSub}>Fresh groceries. Fast delivery.</Text>
  </View>
);

const s = StyleSheet.create({
  logo: { fontSize: 42, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  logoLeaf: { fontSize: 48, fontWeight: "900", color: theme.colors.primary },
  logoMark: {
    width: 78,
    height: 78,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  splash: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  splashSub: { color: "#DFF6E8", fontSize: 15, marginTop: 8 },
});
