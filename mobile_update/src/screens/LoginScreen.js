import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme/theme";
import { Button, Input, Loader } from "../components/UI";
import { screen } from "../utils/screenHelpers";

export function LoginScreen({ navigation }) {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      Alert.alert("Login", "Please enter your email address.");
      return;
    }

    if (!password) {
      Alert.alert("Login", "Please enter your password.");
      return;
    }

    try {
      setBusy(true);
      await login(email.trim(), password);
    } catch (e) {
      Alert.alert("Login failed", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.authLogo}>
            <View style={styles.logoMarkSmall}>
              <Ionicons name="leaf" size={25} color="#fff" />
            </View>

            <Text style={styles.brand}>FreshCart</Text>
          </View>

          {/* Heading */}
          <Text style={styles.h1}>Welcome back</Text>

          <Text style={styles.p}>Sign in to continue shopping fresh.</Text>

          {/* Email */}
          <View style={styles.field}>
            <Input
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              rightIcon={
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={theme.colors.muted}
                />
              }
              onRightIconPress={() => setShowPassword((prev) => !prev)}
            />
          </View>

          {/* Forgot password */}
          <Pressable
            style={styles.forgotLink}
            onPress={() => navigation.navigate("Forgot Password")}
            hitSlop={8}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {/* Login */}
          <View style={styles.buttonSpacing}>
            {busy ? (
              <Loader label="Signing you in..." />
            ) : (
              <Button title="Sign in" onPress={submit} />
            )}
          </View>

          {/* Register */}
          <Button
            secondary
            title="Create a new account"
            onPress={() => navigation.navigate("Register")}
          />

          <View style={styles.bottomSpace} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 30,
  },

  authLogo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },

  logoMarkSmall: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  brand: {
    fontSize: 30,
    fontWeight: "900",
    color: theme.colors.primary,
  },

  h1: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 35,
    color: theme.colors.text,
    marginBottom: 8,
  },

  p: {
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.muted,
    marginBottom: 20,
  },

  field: {
    marginBottom: 4,
  },

  forgotLink: {
    alignSelf: "flex-end",
    marginTop: 2,
    marginBottom: 4,
  },

  forgotText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  buttonSpacing: {
    marginTop: 10,
    marginBottom: 10,
  },

  bottomSpace: {
    height: 80,
  },
});
