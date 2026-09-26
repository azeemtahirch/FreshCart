import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import {
  Button,
  Card,
  Header,
  Input,
  SectionTitle,
} from "../components/UI";
import {
  screen,
  pad,
} from "../utils/screenHelpers";

export function AdminCategoriesScreen() {
  const [c, setC] = useState([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🛒");
  const [desc, setDesc] = useState("");

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      setLoading(true);

      const response = await api.get("/categories");

      setC(response.data || []);
    } catch (e) {
      Alert.alert("Categories", apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addCategory = async () => {
    if (!name.trim()) {
      Alert.alert("Add category", "Please enter category name.");
      return;
    }

    try {
      setAdding(true);

      await api.post("/admin/categories", {
        name: name.trim(),
        icon,
        description: desc,
        is_active: true,
      });

      setName("");
      setIcon("🛒");
      setDesc("");

      await load();
    } catch (e) {
      Alert.alert("Add category", apiError(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <ScrollView
      style={screen}
      contentContainerStyle={pad}
    >
      <Header
        title="Categories"
        subtitle="Catalogue departments"
      />

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={theme.colors.primaryDark}
          />

          <Text style={s.loadingText}>
            Loading categories...
          </Text>
        </View>
      ) : (
        <>
          {c.map((x) => (
            <Card
              key={x.id}
              style={{ marginBottom: 10 }}
            >
              <View style={s.row}>
                <Text style={s.catAdminIcon}>
                  {x.icon}
                </Text>

                <View style={{ flex: 1 }}>
                  <Text style={s.name}>
                    {x.name}
                  </Text>

                  <Text style={s.muted}>
                    {x.description}
                  </Text>
                </View>

                <Text
                  style={
                    x.is_active
                      ? s.stockGood
                      : s.red
                  }
                >
                  {x.is_active ? "ACTIVE" : "OFF"}
                </Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {!loading && (
        <>
          <SectionTitle title="Add category" />

          <Input
            label="Name"
            placeholder="Vegetables"
            value={name}
            onChangeText={setName}
          />

          <Input
            label="Icon"
            placeholder="🥬"
            value={icon}
            onChangeText={setIcon}
          />

          <Input
            label="Description"
            placeholder="Fresh & organic"
            value={desc}
            onChangeText={setDesc}
          />

          <Button
            title={
              adding
                ? "Adding category..."
                : "Add category"
            }
            onPress={addCategory}
            disabled={adding}
          />

          {adding && (
            <View style={s.addingContainer}>
              <ActivityIndicator
                size="small"
                color={theme.colors.primaryDark}
              />

              <Text style={s.addingText}>
                Adding category...
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  loadingContainer: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },

  addingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
  },

  addingText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted || "#66736b",
  },

  catAdminIcon: {
    fontSize: 32,
    width: 50,
  },

  name: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
  },

  muted: {
    fontSize: 12,
    color: theme.colors.muted || "#66736b",
    marginTop: 3,
  },

  red: {
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: "800",
  },

  stockGood: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 5,
  },
});
