import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { Button, Header, Input } from "../components/UI";
import { screen, pad } from "../utils/screenHelpers";

export function AdminProductEditorScreen({ route, navigation }) {
  const p = route.params?.product;

  const [n, setN] = useState(p?.name || "");
  const [desc, setDesc] = useState(p?.description || "");
  const [img, setImg] = useState(p?.image_url || "");
  const [cat, setCat] = useState(String(p?.category_id || ""));
  const [price, setPrice] = useState(String(p?.base_price || ""));
  const [stock, setStock] = useState(String(p?.stock_quantity || ""));
  const [unit, setUnit] = useState(p?.unit_type || "kg");
  const [sizeOptions, setSizeOptions] = useState(
    Array.isArray(p?.size_options) && p.size_options.length
      ? p.size_options
      : (p?.unit_type === "dozen" ? [{ value: 1, label: "1 dozen" }] : [{ value: 250, label: "1 pao" }, { value: 500, label: "500 g" }, { value: 1000, label: "1 kg" }])
  );

  const [cats, setCats] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/categories")
      .then((r) => setCats(r.data || []))
      .catch((e) => {
        Alert.alert("Categories", apiError(e));
      });
  }, []);

  const selectedCategory = cats.find(
    (item) => Number(item.id) === Number(cat),
  );

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (r.canceled) return;

    const u = r.assets[0].uri;

    if (p) {
      try {
        const f = new FormData();

        f.append("image", {
          uri: u,
          name: "product.jpg",
          type: "image/jpeg",
        });

        const z = await api.post(
          `/admin/products/${p.id}/image`,
          f,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        setImg(z.data.image_url);
      } catch (e) {
        Alert.alert("Image upload", apiError(e));
      }
    } else {
      setImg(u);
    }
  };

  const save = async () => {
    if (!n.trim()) {
      Alert.alert("Product name", "Please enter product name.");
      return;
    }

    if (!cat) {
      Alert.alert("Category", "Please select a category.");
      return;
    }

    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      Alert.alert(
        "Invalid price",
        "Please enter a positive base price.",
      );
      return;
    }

    if (!Number.isFinite(numericStock) || numericStock < 0) {
      Alert.alert(
        "Invalid stock",
        "Please enter a valid stock quantity.",
      );
      return;
    }

    try {
      setBusy(true);

      const body = {
        category_id: Number(cat),
        name: n.trim(),
        description: desc.trim(),
        image_url: img,
        base_price: numericPrice,
        stock_quantity: numericStock,
        unit_type: unit,
        size_options: unit === "dozen" ? [{ value: 1, label: "1 dozen" }] : sizeOptions.map((x) => ({ value: Number(x.value), label: String(x.label || "").trim() })),
        is_active: true,
      };

      let response;

      if (p) {
        response = await api.put(
          `/admin/products/${p.id}`,
          body,
        );
      } else {
        response = await api.post(
          "/admin/products",
          body,
        );
      }

      if (p && Number(price) !== Number(p.base_price)) {
        const sent = response.data?.sent ?? 0;
        const failed = response.data?.failed ?? 0;

        Alert.alert(
          "Product saved",
          failed > 0
            ? `Price updated. ${sent} push notification(s) sent; ${failed} failed.`
            : `Price updated and ${sent} push notification(s) sent.`,
        );
      }

      route.params?.reload?.();
      navigation.goBack();
    } catch (e) {
      Alert.alert("Save product", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const getPriceLabel = () => {
    if (unit === "dozen") return "Base price / dozen";
    if (unit === "liter") return "Base price / liter";
    return "Base price / kg";
  };

  const getStockLabel = () => {
    if (unit === "dozen") return "Stock (dozen)";
    return `Stock (${unit})`;
  };

  const getPricePlaceholder = () => {
    if (unit === "dozen") return "350";
    if (unit === "liter") return "250";
    return "200";
  };

  const getStockPlaceholder = () => {
    if (unit === "dozen") return "20";
    return "50";
  };

  return (
    <KeyboardAvoidingView
      style={screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={pad}
        keyboardShouldPersistTaps="handled"
      >
        <Header
          title={p ? "Edit product" : "Add product"}
          onBack={() => navigation.goBack()}
        />

        {img ? (
          <Image
            source={{ uri: img }}
            style={s.editorImage}
          />
        ) : (
          <View style={s.editorPlaceholder}>
            <Text style={{ fontSize: 40 }}>🥬</Text>
          </View>
        )}

        <Button
          secondary
          title="Choose product image"
          icon="📷"
          onPress={pick}
        />

        <Input
          label="Product name"
          placeholder="Banana"
          value={n}
          onChangeText={setN}
        />

        <Input
          label="Description"
          placeholder="Fresh and organic..."
          value={desc}
          onChangeText={setDesc}
          multiline
        />

        {/* Category Selector */}
        <View style={s.categoryContainer}>
          <Text style={s.categoryLabel}>Category</Text>

          <Pressable
            onPress={() =>
              setCategoryOpen((value) => !value)
            }
            style={s.categorySelector}
          >
            <View style={s.categorySelectedContent}>
              {selectedCategory?.icon ? (
                <Text style={s.categorySelectedIcon}>
                  {selectedCategory.icon}
                </Text>
              ) : null}

              <Text
                style={[
                  s.categorySelectorText,
                  !selectedCategory &&
                    s.categoryPlaceholder,
                ]}
              >
                {selectedCategory?.name ||
                  "Select category"}
              </Text>
            </View>

            <Text style={s.categoryArrow}>
              {categoryOpen ? "▲" : "▼"}
            </Text>
          </Pressable>

          {categoryOpen && (
            <View style={s.categoryDropdown}>
              {cats.length === 0 ? (
                <View style={s.noCategories}>
                  <Text style={s.noCategoriesText}>
                    No categories available
                  </Text>
                </View>
              ) : (
                cats.map((item) => {
                  const isSelected =
                    Number(cat) === Number(item.id);

                  return (
                    <Pressable
                      key={String(item.id)}
                      onPress={() => {
                        setCat(String(item.id));
                        setCategoryOpen(false);
                      }}
                      style={[
                        s.categoryOption,
                        isSelected &&
                          s.categoryOptionSelected,
                      ]}
                    >
                      <View
                        style={s.categoryOptionContent}
                      >
                        {item.icon ? (
                          <Text style={s.categoryIcon}>
                            {item.icon}
                          </Text>
                        ) : null}

                        <Text
                          style={[
                            s.categoryOptionText,
                            isSelected &&
                              s.categoryOptionTextSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                      </View>

                      {isSelected && (
                        <Text style={s.categoryCheck}>
                          ✓
                        </Text>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* Unit selector */}
        <View style={s.unitToggle}>
          <Pressable
            onPress={() => { setUnit("kg"); if (unit === "dozen") setSizeOptions([{ value: 250, label: "1 pao" }, { value: 500, label: "500 g" }, { value: 1000, label: "1 kg" }]); }}
            style={[
              s.unitButton,
              unit === "kg" && s.unitSelected,
            ]}
          >
            <Text style={s.unitName}>Kg</Text>

            <Text
              style={[
                s.unitSubText,
                unit === "kg" && s.unitSelectedText,
              ]}
            >
              Kilogram
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setUnit("liter"); if (unit === "dozen") setSizeOptions([{ value: 250, label: "250 ml" }, { value: 500, label: "500 ml" }, { value: 1000, label: "1 L" }]); }}
            style={[
              s.unitButton,
              unit === "liter" && s.unitSelected,
            ]}
          >
            <Text style={s.unitName}>L</Text>

            <Text
              style={[
                s.unitSubText,
                unit === "liter" &&
                  s.unitSelectedText,
              ]}
            >
              Liter
            </Text>
          </Pressable>

          <Pressable
            onPress={() => { setUnit("dozen"); setSizeOptions([{ value: 1, label: "1 dozen" }]); }}
            style={[
              s.unitButton,
              unit === "dozen" && s.unitSelected,
            ]}
          >
            <Text style={s.unitName}>12</Text>

            <Text
              style={[
                s.unitSubText,
                unit === "dozen" &&
                  s.unitSelectedText,
              ]}
            >
              Dozen
            </Text>
          </Pressable>
        </View>

        {unit !== "dozen" && (
          <View style={s.customSizesBox}>
            <Text style={s.customSizesTitle}>Customer weight / size options</Text>
            <Text style={s.customSizesHint}>Add exactly what customers can buy. Example: 250 g = 1 pao.</Text>
            {sizeOptions.map((option, index) => (
              <View key={`${index}-${option.value}`} style={s.customSizeRow}>
                <Input
                  label="Weight (g/ml)"
                  value={String(option.value)}
                  onChangeText={(v) => setSizeOptions((prev) => prev.map((x, i) => i === index ? { ...x, value: v } : x))}
                  keyboardType="numeric"
                />
                <Input
                  label="Customer label"
                  placeholder={unit === "kg" ? "1 pao" : "250 ml"}
                  value={option.label}
                  onChangeText={(v) => setSizeOptions((prev) => prev.map((x, i) => i === index ? { ...x, label: v } : x))}
                />
                {sizeOptions.length > 1 && (
                  <Pressable style={s.removeSize} onPress={() => setSizeOptions((prev) => prev.filter((_, i) => i !== index))}>
                    <Text style={s.removeSizeText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            ))}
            <Button secondary title="+ Add custom weight" onPress={() => setSizeOptions((prev) => [...prev, { value: 250, label: unit === "kg" ? "1 pao" : "250 ml" }])} />
          </View>
        )}

        <Input
          label={getPriceLabel()}
          placeholder={getPricePlaceholder()}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />

        <Text style={s.formHint}>
          {unit === "dozen"
            ? "Enter the price for one dozen (12 pieces). Example: Banana = PKR 350 / dozen."
            : "You enter one base price. FreshCart calculates 250g/ml through 5kg/L automatically."}
        </Text>

        <Input
          label={getStockLabel()}
          placeholder={getStockPlaceholder()}
          value={stock}
          onChangeText={setStock}
          keyboardType="decimal-pad"
        />

        <Button
          title="Save product"
          onPress={save}
          loading={busy}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  editorImage: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    marginBottom: 4,
  },

  editorPlaceholder: {
    height: 220,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  formHint: {
    fontSize: 11,
    color: theme.colors.muted,
    lineHeight: 16,
    marginTop: -3,
    marginBottom: 12,
  },

  /* Category */

  categoryContainer: {
    marginBottom: 12,
    zIndex: 20,
  },

  categoryLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.muted,
    marginBottom: 6,
  },

  categorySelector: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  categorySelectedContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  categorySelectedIcon: {
    fontSize: 18,
    marginRight: 8,
  },

  categorySelectorText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "800",
  },

  categoryPlaceholder: {
    color: theme.colors.muted,
    fontWeight: "600",
  },

  categoryArrow: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },

  categoryDropdown: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: theme.colors.white,
    overflow: "hidden",
    elevation: 6,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  categoryOption: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },

  categoryOptionSelected: {
    backgroundColor: theme.colors.primarySoft,
  },

  categoryOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  categoryIcon: {
    fontSize: 18,
    marginRight: 9,
  },

  categoryOptionText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },

  categoryOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: "900",
  },

  categoryCheck: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: "900",
  },

  noCategories: {
    padding: 16,
    alignItems: "center",
  },

  noCategoriesText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  /* Units */

  unitToggle: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 12,
  },

  unitButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  unitSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },

  unitName: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.text,
  },

  unitSubText: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 3,
  },

  unitSelectedText: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
});