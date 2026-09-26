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

import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { Button, Header, Input, Loader } from "../components/UI";
import { screen, pad } from "../utils/screenHelpers";

export function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const request = async () => {
    if (!email.trim()) {
      Alert.alert("Reset password", "Enter your email.");
      return;
    }

    try {
      setBusy(true);

      await api.post("/auth/forgot-password", {
        email: email.trim(),
      });

      setStep(2);

      Alert.alert(
        "Verification code",
        "Check your email for the 6-digit code.",
      );
    } catch (e) {
      const message =
        e?.response?.data?.message || "Unable to process your request.";

      Alert.alert("Reset password", message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (otp.length !== 6) {
      Alert.alert("Reset password", "Enter the 6-digit code.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Reset password", "Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      Alert.alert("Reset password", "Passwords do not match.");
      return;
    }

    try {
      setBusy(true);

      await api.post("/auth/reset-password", {
        email: email.trim(),
        otp: otp.trim(),
        password,
      });

      Alert.alert(
        "Password reset",
        "Your password has been reset successfully.",
        [
          {
            text: "Sign in",
            onPress: () => navigation.navigate("Login"),
          },
        ],
      );
    } catch (e) {
      Alert.alert("Reset password", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={screen}>
      <Header
        title="Forgot password"
        subtitle="Reset your FreshCart password"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={pad}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.title}>
            {step === 1 ? "Forgot your password?" : "Enter verification code"}
          </Text>

          <Text style={s.p}>
            {step === 1
              ? "Enter your account email and we will send a 6-digit verification code."
              : "Enter the code sent to your email, then choose a new password."}
          </Text>

          <Input
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={step === 1}
          />

          {step === 2 && (
            <>
              <Input
                label="Verification code"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
              />

              {/* New password */}
              <View style={s.passwordWrap}>
                <Input
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  secureTextEntry={!showPassword}
                />

                <Pressable
                  style={s.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={theme.colors.muted}
                  />
                </Pressable>
              </View>

              {/* Confirm password */}
              <View style={s.passwordWrap}>
                <Input
                  label="Confirm password"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Repeat password"
                  secureTextEntry={!showConfirm}
                />

                <Pressable
                  style={s.eyeButton}
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={10}
                >
                  <Ionicons
                    name={showConfirm ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={theme.colors.muted}
                  />
                </Pressable>
              </View>
            </>
          )}

          {busy ? (
            <Loader
              label={step === 1 ? "Sending code..." : "Resetting password..."}
            />
          ) : (
            <Button
              title={step === 1 ? "Send verification code" : "Reset password"}
              onPress={step === 1 ? request : reset}
            />
          )}

          {step === 2 && (
            <Button
              secondary
              title="Use another email"
              onPress={() => {
                setStep(1);
                setOtp("");
                setPassword("");
                setConfirm("");
                setShowPassword(false);
                setShowConfirm(false);
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },

  p: {
    fontSize: 15,
    lineHeight: 23,
    color: theme.colors.muted,
    marginBottom: 20,
  },

  passwordWrap: {
    position: "relative",
  },

  eyeButton: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
