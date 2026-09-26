import { AppIcon } from "../components/AppIcon";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { Button, Card, Header, Input, SectionTitle } from "../components/UI";
import { screen, pad } from "../utils/screenHelpers";

function Picker({ label, value, items, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>

      <Pressable style={s.picker} onPress={() => setOpen(true)}>
        <Text style={value ? s.value : s.placeholder}>
          {value || placeholder}
        </Text>

        <Text style={s.chev}>⌄</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Select {label}</Text>

            <ScrollView>
              {items.map((x) => (
                <Pressable
                  key={x.id}
                  style={s.option}
                  onPress={() => {
                    onSelect(x);
                    setOpen(false);
                  }}
                >
                  <Text style={s.optionText}>{x.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function AddressManagementScreen({ navigation }) {
  const [addresses, setAddresses] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);

  const [label, setLabel] = useState("Home");
  const [line, setLine] = useState("");
  const [city, setCity] = useState(null);
  const [area, setArea] = useState(null);

  const [lat, setLat] = useState("0");
  const [lng, setLng] = useState("0");

  const [editing, setEditing] = useState(null);

  const load = async () => {
    try {
      const [a, c] = await Promise.all([
        api.get("/addresses"),
        api.get("/shipping/cities"),
      ]);

      setAddresses(a.data || []);
      setCities(c.data || []);
    } catch (e) {
      Alert.alert("Addresses", apiError(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const chooseCity = async (x) => {
    setCity(x);
    setArea(null);

    try {
      const r = await api.get(`/shipping/cities/${x.id}/areas`);
      setAreas(r.data || []);
    } catch (e) {
      Alert.alert("Areas", apiError(e));
    }
  };

  const edit = async (x) => {
    setEditing(x.id);

    setLabel(x.label || "");
    setLine(x.address_line || "");

    setLat(String(x.latitude || 0));
    setLng(String(x.longitude || 0));

    const c = cities.find((v) => v.id === x.city_id) || {
      id: x.city_id,
      name: x.city,
    };

    setCity(c);

    try {
      const r = await api.get(`/shipping/cities/${x.city_id}/areas`);

      setAreas(r.data || []);

      setArea(
        (r.data || []).find((v) => v.id === x.area_id) || {
          id: x.area_id,
          name: x.area,
        },
      );
    } catch (e) {
      Alert.alert("Areas", apiError(e));
    }
  };

  const deleteAddress = (address) => {
    Alert.alert(
      "Delete address",
      `Are you sure you want to delete "${address.label || "Home"}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/addresses/${address.id}`);

              if (editing === address.id) {
                cancelEdit();
              }

              await load();

              Alert.alert("Address", "Address deleted successfully.");
            } catch (e) {
              Alert.alert("Address", apiError(e));
            }
          },
        },
      ],
    );
  };

  const save = async () => {
    const missingFields = [];

    if (!label.trim()) {
      missingFields.push("Address label");
    }

    if (!line.trim()) {
      missingFields.push("Home address");
    }

    if (!city) {
      missingFields.push("City");
    }

    if (!area) {
      missingFields.push("Area");
    }

    if (missingFields.length > 0) {
      Alert.alert(
        "Address",
        `${missingFields.join(", ")} ${
          missingFields.length === 1 ? "is" : "are"
        } required.`,
      );

      return;
    }

    const body = {
      label: label.trim(),
      address_line: line.trim(),
      city_id: Number(city.id),
      area_id: Number(area.id),
      latitude: Number(lat) || 0,
      longitude: Number(lng) || 0,
      is_default: editing
        ? addresses.find((x) => x.id === editing)?.is_default || false
        : addresses.length === 0,
    };

    try {
      if (editing) {
        await api.put(`/addresses/${editing}`, body);

        Alert.alert("Address", "Address updated successfully.");
      } else {
        await api.post("/addresses", body);

        Alert.alert("Address", "Address added successfully.");
      }

      setLine("");
      setEditing(null);
      setLabel("Home");
      setCity(null);
      setArea(null);
      setAreas([]);
      setLat("0");
      setLng("0");

      await load();
    } catch (e) {
      Alert.alert("Address", apiError(e));
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setLabel("Home");
    setLine("");
    setCity(null);
    setArea(null);
    setAreas([]);
    setLat("0");
    setLng("0");
  };

  return (
    <View style={screen}>
      <Header
        title="Delivery addresses"
        subtitle="Choose a valid FreshCart delivery area"
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
          {addresses.map((x) => (
            <Card key={x.id} style={{ marginBottom: 10 }}>
              <View style={s.addressRow}>
                <View style={s.icon}>
                  <AppIcon name="⌂" size={20} color={theme.colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.name}>
                    {x.label || "Home"} {x.is_default ? "• DEFAULT" : ""}
                  </Text>

                  <Text style={s.muted}>{x.address_line}</Text>

                  <Text style={s.muted}>
                    {x.area || "Area"} • {x.city || "City"}
                  </Text>
                </View>
              </View>

              {/* Edit + Delete buttons */}
              <View style={s.actionRow}>
                <View style={s.actionButton}>
                  <Button secondary title="Edit" onPress={() => edit(x)} />
                </View>

                <View style={s.actionButton}></View>
              </View>
            </Card>
          ))}

          <SectionTitle title={editing ? "Edit address" : "Add new address"} />

          <Input
            label="Address label"
            value={label}
            onChangeText={setLabel}
            placeholder="House"
          />

          <Input
            label="Home address"
            value={line}
            onChangeText={setLine}
            placeholder="House xxx W, Street x"
            multiline
            textAlignVertical="top"
          />

          <Picker
            label="City"
            value={city?.name}
            items={cities.filter((x) => x.is_active)}
            onSelect={chooseCity}
            placeholder="Select city"
          />

          <Picker
            label="Area"
            value={area?.name}
            items={areas.filter((x) => x.is_active)}
            onSelect={setArea}
            placeholder={city ? "Select area" : "Select city first"}
          />

          <Button
            title={editing ? "Update address" : "Save address"}
            onPress={save}
          />

          {editing && <Button secondary title="Cancel" onPress={cancelEdit} />}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },

  label: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 7,
  },

  picker: {
    height: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  value: {
    fontSize: 15,
    color: theme.colors.text,
  },

  placeholder: {
    fontSize: 15,
    color: theme.colors.muted,
  },

  chev: {
    fontSize: 20,
    color: theme.colors.muted,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.35)",
    justifyContent: "center",
    padding: 24,
  },

  modal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    maxHeight: "70%",
    padding: 18,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 10,
  },

  option: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  optionText: {
    fontSize: 16,
    color: theme.colors.text,
  },

  addressRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  name: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
  },

  muted: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 3,
  },

  actionRow: {
    flexDirection: "row",
    marginTop: 10,
  },

  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});
