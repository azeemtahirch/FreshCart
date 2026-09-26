import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme/theme";
import { Button, Header, Input } from "../components/UI";
import { screen } from "../utils/screenHelpers";

export function RegisterScreen({ navigation }) {
  const { register } = useAuth();

  const [n, setN] = useState("");
  const [e, setE] = useState("");
  const [p, setP] = useState("");
  const [pw, setPw] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!n.trim() || !e.trim() || !p.trim() || pw.length < 8) {
      return Alert.alert(
        "Check details",
        "Please enter your name, phone, email and an 8+ character password.",
      );
    }

    try {
      setBusy(true);

      await register({
        name: n.trim(),
        email: e.trim(),
        phone: p.trim(),
        password: pw,
      });
    } catch (x) {
      Alert.alert("Registration failed", apiError(x));
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
          <Header title="Create account" onBack={() => navigation.goBack()} />

          <View style={styles.form}>
            <Text style={styles.h1}>Let's get started</Text>

            <Text style={styles.p}>
              Create your FreshCart account in a few seconds.
            </Text>

            {/* Full Name */}
            <View style={styles.field}>
              <Input
                label="Full name"
                placeholder="Enter Your Name"
                value={n}
                onChangeText={setN}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <Input
                label="Phone number"
                placeholder="0300 1234567"
                value={p}
                onChangeText={setP}
                keyboardType="phone-pad"
                returnKeyType="next"
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Input
                label="Email address"
                placeholder="you@example.com"
                value={e}
                onChangeText={setE}
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
                placeholder="At least 8 characters"
                value={pw}
                onChangeText={setPw}
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

            {/* Create Account */}
            <View style={styles.buttonContainer}>
              <Button title="Create account" onPress={submit} loading={busy} />
            </View>
          </View>

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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },

  form: {
    flexGrow: 1,
    justifyContent: "center",
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

  buttonContainer: {
    marginTop: 12,
  },

  bottomSpace: {
    height: 100,
  },
});
