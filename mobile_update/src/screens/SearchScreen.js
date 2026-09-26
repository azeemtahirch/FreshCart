import React, { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";

import { api, apiError } from "../services/api";
import { useCart } from "../context/CartContext";
import { Empty, Header, Input, ProductCard } from "../components/UI";
import { screen } from "../utils/screenHelpers";

// ---------------------------------------------------------
// Get the correct cart size for a product
// ---------------------------------------------------------

function getCartSize(product) {
  const unit = String(product?.unit_type || "")
    .trim()
    .toLowerCase();

  // Dozen products always use size = 1.
  if (unit === "dozen") {
    return 1;
  }

  // Use API-provided size when available.
  const size = Number(product?.size_ml);

  if (Number.isFinite(size) && size > 0) {
    return size;
  }

  // Default size when API does not provide one.
  if (unit === "kg") {
    return 1000; // 1 kg
  }

  if (unit === "liter") {
    return 1000; // 1 liter
  }

  return 1;
}

// ---------------------------------------------------------
// Search Screen
// ---------------------------------------------------------

export function SearchScreen({ navigation }) {
  const [q, setQ] = useState("");
  const [products, setProducts] = useState([]);

  const { items, add } = useCart();

  // -------------------------------------------------------
  // Load products
  // -------------------------------------------------------

  useEffect(() => {
    api
      .get("/products")
      .then((r) => {
        setProducts(r.data || []);
      })
      .catch((e) => {
        Alert.alert("Error", apiError(e));
      });
  }, []);

  // -------------------------------------------------------
  // Search/filter
  // -------------------------------------------------------

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((p) =>
      `${p.name || ""} ${p.description || ""}`.toLowerCase().includes(query),
    );
  }, [products, q]);

  // -------------------------------------------------------
  // Check if exact product + size is already in cart
  // -------------------------------------------------------

  const isProductInCart = (product) => {
    const productId = Number(product?.id);
    const size = getCartSize(product);

    return items.some(
      (cartItem) =>
        Number(cartItem.product_id) === productId &&
        Number(cartItem.size_ml) === Number(size),
    );
  };

  // -------------------------------------------------------
  // Add product to cart
  // -------------------------------------------------------

  const handleAdd = (product) => {
    const productId = Number(product?.id);

    const unit = String(product?.unit_type || "")
      .trim()
      .toLowerCase();

    if (!productId || productId <= 0) {
      console.error("Invalid product:", product);
      return;
    }

    const size = getCartSize(product);

    if (!Number.isFinite(size) || size <= 0) {
      console.error("Invalid product weight/size:", {
        product_id: productId,
        size_ml: product?.size_ml,
        unit: product?.unit_type,
      });

      return;
    }

    // Do not add again if already in cart.
    if (isProductInCart(product)) {
      return;
    }

    let sizeLabel;

    if (unit === "dozen") {
      sizeLabel = "1 dozen";
    } else if (unit === "kg") {
      sizeLabel = size >= 1000 ? `${size / 1000} kg` : `${size} g`;
    } else if (unit === "liter") {
      sizeLabel = size >= 1000 ? `${size / 1000} L` : `${size} ml`;
    } else {
      sizeLabel = String(size);
    }

    add(product, size, sizeLabel);
  };

  return (
    <View style={screen}>
      <Header title="Search" onBack={() => navigation.goBack()} />

      <View style={{ paddingHorizontal: 16 }}>
        <Input
          placeholder="Search fresh groceries..."
          value={q}
          onChangeText={setQ}
          autoFocus
        />
      </View>

      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={s.listPad}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => {
          const addedToCart = isProductInCart(item);

          return (
            <ProductCard
              product={item}
              onPress={() =>
                navigation.navigate("Product Details", {
                  productId: item.id,
                })
              }
              onAdd={addedToCart ? undefined : () => handleAdd(item)}
              addedToCart={addedToCart}
              disabled={addedToCart}
              showAddButton={false}
            />
          );
        }}
        ListEmptyComponent={<Empty text="No matching products." icon="⌕" />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  listPad: {
    padding: 16,
    gap: 12,
  },
});
