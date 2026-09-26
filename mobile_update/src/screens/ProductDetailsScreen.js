import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api, apiError } from "../services/api";
import { useCart } from "../context/CartContext";
import { theme } from "../theme/theme";
import { money, sizeLabel, sizes } from "../utils/format";

import { Button, Card, Divider, IconButton, Loader } from "../components/UI";

import { screen } from "../utils/screenHelpers";

export function ProductDetailsScreen({ route, navigation }) {
  const [p, setP] = useState(null);

  // Default size for kg/liter products
  const [size, setSize] = useState(1000);

  // Used to immediately update the button after adding
  const [addedToCart, setAddedToCart] = useState(false);

  const { add, items } = useCart();

  useEffect(() => {
    setAddedToCart(false);

    api
      .get(`/products/${route.params.productId}`)
      .then((r) => {
        const product = r.data;

        setP(product);

        // Dozen products don't use ml sizes.
        // Keep a simple internal value for cart uniqueness.
        if (product.unit_type === "dozen") {
          setSize(1);
        } else {
          setSize(1000);
        }
      })
      .catch((e) => {
        Alert.alert("Error", apiError(e));
      });
  }, [route.params.productId]);

  if (!p) return <Loader />;

  const isDozen = p.unit_type === "dozen";

  const sizeOptions = isDozen
    ? [{ value: 1, label: "1 dozen" }]
    : Array.isArray(p.size_options) && p.size_options.length
      ? p.size_options
      : sizes.map((value) => ({
          value,
          label: sizeLabel(value, p.unit_type),
        }));

  const price = isDozen
    ? Number(p.base_price || 0)
    : (Number(p.base_price || 0) * Number(size || 0)) / 1000;

  const outOfStock = !p.stock_quantity;

  /*
   * Check whether this product is already in the cart.
   *
   * Supports both:
   *   item.product_id
   *   item.id
   *
   * This keeps the screen compatible with different CartContext
   * item structures.
   */
  const alreadyInCart =
    Array.isArray(items) &&
    items.some((item) => Number(item.product_id ?? item.id) === Number(p.id));

  const isCartDisabled = outOfStock || alreadyInCart || addedToCart;

  const handleAddToCart = () => {
    if (isCartDisabled) return;

    const selectedOption = sizeOptions.find(
      (x) => Number(x.value) === Number(size),
    );

    add(p, size, selectedOption?.label);

    setAddedToCart(true);
  };

  return (
    <View style={screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 50,
        }}
      >
        {/* Product Image */}
        <View style={s.detailImageWrap}>
          <Image source={{ uri: p.image_url }} style={s.detailImage} />

          <View style={s.detailBack}>
            <IconButton icon="‹" onPress={() => navigation.goBack()} />
          </View>
        </View>

        <View style={s.detailBody}>
          {/* Category */}
          <Text style={s.detailCategory}>
            {p.unit_type === "liter"
              ? "MILK & DAIRY"
              : p.unit_type === "dozen"
                ? "EGGS & PACKED ITEMS"
                : "FRESH PRODUCE"}
          </Text>

          {/* Product name */}
          <Text style={s.detailTitle}>
            {p.name}
            {p.name_ur ? ` — ${p.name_ur}` : ""}
          </Text>

          {/* Description */}
          <Text style={s.detailDesc}>{p.description}</Text>

          {/* Price */}
          <View style={s.detailPriceRow}>
            <Text style={s.detailPrice}>{money(price)}</Text>

            <Text style={s.perLabel}>
              {" / "}
              {isDozen
                ? "dozen"
                : sizeOptions.find((x) => Number(x.value) === Number(size))
                    ?.label || sizeLabel(size, p.unit_type)}
            </Text>

            <Text style={s.rating}>★ 4.8</Text>
          </View>

          <Divider />

          {/* Quantity / Size Selection */}
          <Text style={s.label}>Select quantity</Text>

          {isDozen ? (
            /*
             * Dozen product:
             * No 250ml / 500ml / 1L options.
             * One dozen is one cart unit.
             */
            <View style={s.sizeGrid}>
              <Pressable
                onPress={() => {
                  if (!isCartDisabled) {
                    setSize(1);
                  }
                }}
                disabled={isCartDisabled}
                style={[
                  s.sizeBox,
                  size === 1 && s.sizeSelected,
                  isCartDisabled && s.sizeDisabled,
                ]}
              >
                <Text style={[s.sizeMain, size === 1 && s.sizeMainSelected]}>
                  1 dozen
                </Text>

                <Text style={s.sizePrice}>
                  {money(Number(p.base_price || 0))}
                </Text>

                {size === 1 && <Text style={s.check}>✓</Text>}
              </Pressable>
            </View>
          ) : (
            /*
             * KG / Liter products:
             * Keep the existing size selection.
             */
            <View style={s.sizeGrid}>
              {sizeOptions.map((option) => {
                const x = Number(option.value);

                const optionPrice =
                  (Number(p.base_price || 0) * Number(x)) / 1000;

                const label = option.label || sizeLabel(x, p.unit_type);

                return (
                  <Pressable
                    key={`${x}-${label}`}
                    onPress={() => {
                      if (!isCartDisabled) {
                        setSize(x);
                      }
                    }}
                    disabled={isCartDisabled}
                    style={[
                      s.sizeBox,
                      x === size && s.sizeSelected,
                      isCartDisabled && s.sizeDisabled,
                    ]}
                  >
                    <Text
                      style={[s.sizeMain, x === size && s.sizeMainSelected]}
                    >
                      {label}
                    </Text>

                    <Text style={s.sizePrice}>{money(optionPrice)}</Text>

                    {x === size && <Text style={s.check}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Stock */}
          <Card style={{ marginTop: 16 }}>
            <View style={s.stockRow}>
              <Text
                style={[
                  s.stockDot,
                  {
                    color: outOfStock
                      ? theme.colors.danger
                      : theme.colors.success,
                  },
                ]}
              >
                ●
              </Text>

              <View>
                <Text style={s.name}>
                  {outOfStock
                    ? "Out of stock"
                    : alreadyInCart || addedToCart
                      ? "Add in cart"
                      : "In stock"}
                </Text>

                <Text style={s.muted}>
                  Base price {money(p.base_price)} /{" "}
                  {isDozen ? "dozen" : p.unit_type}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Sticky Add To Cart */}
      <View style={s.stickyBar}>
        <View>
          <Text style={s.muted}>Selected</Text>

          <Text style={s.stickyPrice}>{money(price)}</Text>
        </View>

        <Button
          title={
            outOfStock
              ? "Out of stock"
              : alreadyInCart || addedToCart
                ? "Add in cart"
                : "Add to cart"
          }
          icon={outOfStock ? "×" : alreadyInCart || addedToCart ? "✓" : "+"}
          onPress={handleAddToCart}
          disabled={isCartDisabled}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  check: {
    position: "absolute",
    right: 7,
    top: 7,
    color: theme.colors.primary,
    fontWeight: "900",
  },

  detailBack: {
    position: "absolute",
    left: 14,
    top: 16,
  },

  detailBody: {
    padding: 20,
    paddingBottom: 100,
  },

  detailCategory: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  detailDesc: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 21,
    marginTop: 7,
  },

  detailHeart: {
    position: "absolute",
    right: 14,
    top: 16,
  },

  detailImage: {
    width: "100%",
    height: "100%",
  },

  detailImageWrap: {
    height: 360,
    backgroundColor: theme.colors.primarySoft,
    position: "relative",
  },

  detailPrice: {
    fontSize: 25,
    fontWeight: "900",
    color: theme.colors.primary,
  },

  detailPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 15,
  },

  detailTitle: {
    fontSize: 31,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 5,
  },

  label: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },

  perLabel: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: "700",
  },

  rating: {
    marginLeft: "auto",
    fontWeight: "900",
    color: theme.colors.warning,
  },

  sizeBox: {
    width: "31.8%",
    minHeight: 73,
    padding: 11,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 15,
    backgroundColor: "#fff",
    position: "relative",
  },

  sizeDisabled: {
    opacity: 0.6,
  },

  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  sizeMain: {
    fontWeight: "900",
    fontSize: 13,
    color: theme.colors.text,
  },

  sizeMainSelected: {
    color: theme.colors.primaryDark,
  },

  sizePrice: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 4,
  },

  sizeSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },

  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,

    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 55,

    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: theme.colors.border,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  stickyPrice: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
  },

  stockDot: {
    fontSize: 13,
    marginRight: 9,
  },

  stockRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  name: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.text,
  },

  muted: {
    fontSize: 12,
    color: theme.colors.muted,
  },
});
