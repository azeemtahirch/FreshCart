import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/theme";
import { Button, Card } from "../components/UI";

export const ServiceUnavailableScreen = ({ navigation }) => (
  <View style={s.onboard}>
    <View style={s.warningArt}>
      <Text style={s.warningIcon}>📍</Text>
    </View>
    <Text style={s.h1}>Location is optional</Text>
    <Text style={s.p}>
      FreshCart does not require device location permission. Add a delivery address manually to continue with checkout.
    </Text>
    <Card accent>
      <Text style={s.name}>Delivery support</Text>
      <Text style={s.muted}>
        You can continue shopping and add a delivery address later.
      </Text>
    </Card>
    <Button title="Back to login" onPress={() => navigation.replace("Login")} />
  </View>
);

const s = StyleSheet.create({
  h1: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 35,
    color: theme.colors.text,
    marginBottom: 8,
  },
  onboard: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 24,
    justifyContent: "center",
  },
  p: {
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.muted,
    marginBottom: 14,
  },
  warningArt: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: theme.colors.warningSoft,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  warningIcon: { fontSize: 48 },
});
