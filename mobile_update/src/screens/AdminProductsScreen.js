import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { money } from "../utils/format";
import { Button, Card, Header } from "../components/UI";
import {
  screen,
  pad,
} from "../utils/screenHelpers";

export function AdminProductsScreen({ navigation }) {
  const [p, setP] = useState([]);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [savingPriceId, setSavingPriceId] = useState(null);
  const load = () =>
    api
      .get("/products")
      .then((r) => setP(r.data || []))
      .catch((e) => Alert.alert("Products", apiError(e)));
  useEffect(() => {
    load();
  }, []);
  const remove = async (x) => {
    try {
      await api.delete(`/admin/products/${x.id}`);
      load();
    } catch (e) {
      Alert.alert("Delete", apiError(e));
    }
  };
  const beginPriceEdit = (item) => {
    if (
      savingPriceId ||
      (editingPriceId !== null && editingPriceId !== item.id)
    )
      return;
    setEditingPriceId(item.id);
    setPriceDraft(String(item.base_price));
  };
  const cancelPriceEdit = () => {
    if (savingPriceId) return;
    setEditingPriceId(null);
    setPriceDraft("");
  };
  const savePrice = async (item) => {
    const price = Number(priceDraft.trim());
    if (!priceDraft.trim() || !Number.isFinite(price) || price <= 0) {
      Alert.alert("Invalid price", "Enter a positive price.");
      return;
    }

    try {
      setSavingPriceId(item.id);
      const response = await api.put(`/admin/products/${item.id}`, {
        category_id: Number(item.category_id),
        name: item.name,
        description: item.description || "",
        image_url: item.image_url || "",
        base_price: price,
        stock_quantity: Number(item.stock_quantity || 0),
        unit_type: item.unit_type,
        is_active: item.is_active !== false,
      });
      setP((current) =>
        current.map((product) =>
          product.id === item.id ? { ...product, base_price: price } : product,
        ),
      );
      setEditingPriceId(null);
      setPriceDraft("");
      Alert.alert("Price updated", "Price updated successfully.");
      return response;
    } catch (e) {
      Alert.alert("Price update failed", apiError(e));
    } finally {
      setSavingPriceId(null);
    }
  };
  return (
    <View style={screen}>
      <Header
        title="Products"
        subtitle={`${p.length} catalogue items`}
        right={
          <Button
            title="+ Add"
            onPress={() =>
              navigation.navigate("Admin Product Editor", { reload: load })
            }
          />
        }
      />
      <FlatList
        data={p}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={s.listPad}
        renderItem={({ item }) => (
          <Card style={s.adminProduct}>
            <Image source={{ uri: item.image_url }} style={s.adminThumb} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.name}</Text>
              {editingPriceId === item.id ? (
                <View style={s.inlinePriceEditor}>
                  <View style={s.inlinePriceInputWrap}>
                    <Text style={s.inlinePricePrefix}>Rs.</Text>
                    <TextInput
                      autoFocus
                      selectTextOnFocus
                      value={priceDraft}
                      onChangeText={setPriceDraft}
                      keyboardType="decimal-pad"
                      style={s.inlinePriceInput}
                      editable={savingPriceId !== item.id}
                      accessibilityLabel={`Price for ${item.name}`}
                    />
                    <Text style={s.inlinePriceSuffix}>/ {item.unit_type}</Text>
                  </View>
                  <View style={s.inlinePriceActions}>
                    <Pressable
                      disabled={savingPriceId === item.id}
                      onPress={() => savePrice(item)}
                      style={s.inlinePriceSave}
                    >
                      {savingPriceId === item.id ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.white}
                        />
                      ) : (
                        <Text style={s.inlinePriceSaveText}>✓ Save</Text>
                      )}
                    </Pressable>
                    <Pressable
                      disabled={savingPriceId === item.id}
                      onPress={cancelPriceEdit}
                      style={s.inlinePriceCancel}
                    >
                      <Text style={s.inlinePriceCancelText}>✕ Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit price for ${item.name}`}
                  onPress={() => beginPriceEdit(item)}
                  style={s.inlinePriceDisplay}
                >
                  <Text style={s.muted}>
                    {money(item.base_price)} / {item.unit_type}
                  </Text>
                  <Text style={s.inlinePriceEditIcon}>✎</Text>
                </Pressable>
              )}
              <Text style={item.stock_quantity > 0 ? s.stockGood : s.red}>
                {item.stock_quantity > 0
                  ? `${item.stock_quantity} ${item.unit_type} in stock`
                  : "Out of stock"}
              </Text>
            </View>
            <View>
              <Pressable
                onPress={() =>
                  navigation.navigate("Admin Product Editor", {
                    product: item,
                    reload: load,
                  })
                }
              >
                <Text style={s.adminLink}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => remove(item)}>
                <Text style={s.remove}>Disable</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  adminLink: {
    color: theme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 13,
  },
  adminProduct: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  adminThumb: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: theme.colors.primarySoft,
  },
  inlinePriceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 7,
  },
  inlinePriceCancel: {
    minHeight: 30,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  inlinePriceCancelText: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  inlinePriceDisplay: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 3,
    paddingVertical: 2,
  },
  inlinePriceEditIcon: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 6,
  },
  inlinePriceEditor: { marginTop: 5 },
  inlinePriceInput: {
    minWidth: 48,
    maxWidth: 76,
    paddingVertical: 4,
    paddingHorizontal: 4,
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  inlinePriceInputWrap: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 11,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 8,
  },
  inlinePricePrefix: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },
  inlinePriceSave: {
    minWidth: 62,
    minHeight: 30,
    borderRadius: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  inlinePriceSaveText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: "900",
  },
  inlinePriceSuffix: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  listPad: { padding: 16, gap: 12 },
  red: { color: theme.colors.danger, fontSize: 11, fontWeight: "800" },
  remove: { fontSize: 12, color: theme.colors.danger, fontWeight: "800" },
  stockGood: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 5,
  },
});
