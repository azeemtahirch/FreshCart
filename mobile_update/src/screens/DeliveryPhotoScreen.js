import React, { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { Button, Card, Header } from "../components/UI";
import {
  screen,
  pad,
} from "../utils/screenHelpers";

export function DeliveryPhotoScreen({ route, navigation }) {
  const [uri, setUri] = useState(null),
    [busy, setBusy] = useState(false);
  const pick = async () => {
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!r.canceled) setUri(r.assets[0].uri);
  };
  const upload = async () => {
    if (!uri)
      return Alert.alert("Delivery proof", "Take a delivery photo first.");
    try {
      setBusy(true);
      const f = new FormData();
      f.append("photo", {
        uri,
        name: "delivery-proof.jpg",
        type: "image/jpeg",
      });
      await api.post(`/rider/orders/${route.params.orderId}/photo`, f, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.post(`/rider/orders/${route.params.orderId}/complete`);
      Alert.alert(
        "Delivered ✓",
        "Delivery proof saved and order marked delivered.",
        [{ text: "Done", onPress: () => navigation.popToTop() }],
      );
    } catch (e) {
      Alert.alert("Delivery proof", apiError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={screen}>
      <Header
        title="Delivery proof"
        subtitle="Required before completion"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={pad}>
        <Card accent>
          <Text style={s.name}>📸 Take a clear photo at the doorstep</Text>
          <Text style={s.muted}>
            The photo is securely uploaded to the FreshCart backend and attached
            to this order.
          </Text>
        </Card>
        {uri ? (
          <Image source={{ uri }} style={s.proofImage} />
        ) : (
          <View style={s.cameraPlaceholder}>
            <Text style={s.cameraIcon}>📷</Text>
            <Text style={s.name}>No photo captured</Text>
            <Text style={s.muted}>Delivery proof photo is required.</Text>
          </View>
        )}
        <Button secondary title="Take photo" onPress={pick} />
        <Button
          title="Upload & complete delivery"
          onPress={upload}
          loading={busy}
          disabled={!uri}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  cameraIcon: { fontSize: 52, marginBottom: 10 },
  cameraPlaceholder: {
    height: 360,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    backgroundColor: "#fff",
  },
  proofImage: { width: "100%", height: 360, borderRadius: 20, marginTop: 14 },
});
