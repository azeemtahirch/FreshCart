import React from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme/theme";
import { Button, Card, Header, SectionTitle } from "../components/UI";
import { screen, pad, initials } from "../utils/screenHelpers";

export function AccountScreen({ navigation }) {
  const { user, logout } = useAuth();

  // Check whether logged-in user is a rider
  const isRider =
    String(user?.role || user?.userType || "")
      .toLowerCase()
      .trim() === "rider";

  return (
    <View style={screen}>
      <Header
        title="Account"
        subtitle={
          isRider
            ? "Manage your FreshCart rider profile"
            : "Manage your FreshCart profile"
        }
      />

      <ScrollView contentContainerStyle={pad}>
        {/* Profile */}
        <Card style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(user?.name)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{user?.name}</Text>
            <Text style={s.muted}>{user?.email}</Text>
            <Text style={s.muted}>
              {isRider ? "Rider" : user?.phone || "Customer"}
            </Text>
          </View>
        </Card>

        {/* Customer-only account options */}
        {!isRider && (
          <>
            <SectionTitle title="Account" />

            <Pressable
              style={s.menuRow}
              onPress={() => navigation.navigate("Address Management")}
            >
              <Text style={s.menuIcon}>📍</Text>

              <View style={{ flex: 1 }}>
                <Text style={s.name}>Delivery addresses</Text>
                <Text style={s.muted}>
                  Manage your saved delivery addresses
                </Text>
              </View>

              <Text style={s.arrow}>›</Text>
            </Pressable>

            <Pressable
              style={s.menuRow}
              onPress={() => navigation.navigate("Notifications")}
            >
              <Text style={s.menuIcon}>🔔</Text>

              <View style={{ flex: 1 }}>
                <Text style={s.name}>Notifications</Text>
                <Text style={s.muted}>Orders, price updates and offers</Text>
              </View>

              <Text style={s.arrow}>›</Text>
            </Pressable>
          </>
        )}

        {/* Support */}
        <SectionTitle title="Support" />

        <Card style={s.supportCard}>
          <Text style={s.supportTitle}>Need help?</Text>

          <Text style={s.supportDescription}>
            Our team is here to help with your FreshCart order.
          </Text>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Email FreshCart support"
            onPress={() => Linking.openURL("mailto:freshcart@gmail.com")}
            style={s.supportLink}
          >
            <Text style={s.supportLinkText}>✉️ freshcart@gmail.com</Text>
          </Pressable>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Call FreshCart support"
            onPress={() => Linking.openURL("tel:0312-4497159")}
            style={s.supportLink}
          >
            <Text style={s.supportLinkText}>📞 0312-4497159</Text>
          </Pressable>
        </Card>

        {/* Sign out */}
        <Button
          danger
          title="Sign out"
          onPress={() =>
            Alert.alert("Sign out?", "You can sign back in anytime.", [
              { text: "Cancel" },
              {
                text: "Sign out",
                style: "destructive",
                onPress: logout,
              },
            ])
          }
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  arrow: {
    fontSize: 28,
    color: theme.colors.muted,
  },

  avatar: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 21,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  menuIcon: {
    fontSize: 24,
    width: 38,
  },

  menuRow: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  profileName: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
  },

  supportCard: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 30,
    borderColor: "#CDEDD9",
    padding: 22,
    ...theme.shadow,
  },

  supportDescription: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
    maxWidth: 420,
  },

  supportLink: {
    alignSelf: "flex-start",
    marginTop: 16,
    maxWidth: "100%",
  },

  supportLinkText: {
    color: theme.colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    flexShrink: 1,
  },

  supportTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
});
