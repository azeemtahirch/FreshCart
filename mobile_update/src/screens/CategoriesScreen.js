import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { Header } from "../components/UI";
import { screen, pad } from "../utils/screenHelpers";
import { AppIcon } from "../components/AppIcon";

export function CategoriesScreen({ navigation }) {
  const [c, setC] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const response = await api.get("/categories");
        setC(response.data || []);
      } catch (e) {
        Alert.alert("Error", apiError(e));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <View style={screen}>
      <Header title="Categories" subtitle="Freshness for every meal" />

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={theme.colors.primaryDark}
          />
          <Text style={s.loadingText}>Loading categories...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={pad}>
          {c.map((x) => (
            <Pressable
              key={x.id}
              style={s.categoryWide}
              onPress={() =>
                navigation.navigate(x.name, {
                  categoryId: x.id,
                  title: x.name,
                })
              }
            >
              <View style={s.categoryWideIcon}>
                <Text>{x.icon}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.categoryTitle}>{x.name}</Text>
                <Text style={s.muted}>{x.description}</Text>
              </View>

              <AppIcon name="›" size={24} color={theme.colors.muted} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  arrow: {
    fontSize: 28,
    color: theme.colors.muted,
  },

  categoryTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.text,
  },

  categoryWide: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },

  categoryWideIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  muted: {
    color: theme.colors.muted,
    fontSize: 13,
    marginTop: 3,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
});