import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { api, apiError } from "../services/api";
import { useCart } from "../context/CartContext";
import { Empty, Header, ProductCard } from "../components/UI";
import { screen } from "../utils/screenHelpers";

export function ProductListScreen({ route, navigation }) {
  const { categoryId, title } = route.params || {};
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { add, items } = useCart();
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);

      const params = {};

      // Only send category_id when
      // a category was actually selected.
      if (
        categoryId !== undefined &&
        categoryId !== null &&
        categoryId !== ""
      ) {
        params.category_id = categoryId;
      }

      const response = await api.get("/products", { params });
      const data = Array.isArray(response.data) ? response.data : [];

      // Remove invalid product records.
      const validProducts = data.filter(
        (product) => product && product.id !== undefined && product.id !== null,
      );

      setProducts(validProducts);
    } catch (error) {
      Alert.alert("Error", apiError(error));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const getProductSize = (product) => {
    if (!product) {
      return 1;
    }

    const unit = String(product.unit_type || "")
      .trim()
      .toLowerCase();

    // Dozen is counted as 1 dozen.
    if (unit === "dozen") {
      return 1;
    }

    // If backend provides size_ml,
    // use it.
    const apiSize = Number(product.size_ml);

    if (Number.isFinite(apiSize) && apiSize > 0) {
      return apiSize;
    }

    // kg and liter default to 1000.
    if (unit === "kg" || unit === "liter") {
      return 1000;
    }

    // Safe fallback.
    return 1;
  };

  const handleAdd = useCallback(
    async (product, size) => {
      // Protect against undefined product.
      if (!product || product.id === undefined || product.id === null) {
        console.warn("Cannot add product: product is undefined", product);

        return;
      }

      const productId = Number(product.id);

      if (!Number.isFinite(productId) || productId <= 0) {
        console.warn("Invalid product ID:", product);

        return;
      }

      // If ProductCard gives us a size,
      // use it. Otherwise calculate it here.
      const finalSize =
        Number(size) > 0 ? Number(size) : getProductSize(product);

      if (!Number.isFinite(finalSize) || finalSize <= 0) {
        console.warn("Invalid product size:", {
          productId,
          size,
          calculatedSize: getProductSize(product),
          unitType: product.unit_type,
        });

        return;
      }

      try {
        // IMPORTANT:
        // CartContext receives:
        // add(product, size)
        await add(product, finalSize);
      } catch (error) {
        console.warn("Add to cart failed:", error);

        Alert.alert(
          "Unable to add",
          error?.message || "This product could not be added to your cart.",
        );
      }
    },
    [add],
  );

  const renderProduct = ({ item }) => {
    if (!item) {
      return null;
    }

    return (
      <ProductCard
        product={item}
        cartItems={items}
        onPress={() =>
          navigation.navigate("Product Details", {
            productId: item.id,
          })
        }
        onAdd={handleAdd}
      />
    );
  };

  const emptyComponent = (
    <Empty
      text={
        loading ? "Loading products..." : "No products found in this category."
      }
      icon={loading ? "🥬" : "🥬"}
    />
  );

  return (
    <View style={screen}>
      <Header
        title={title || "Products"}
        subtitle={
          loading ? "Loading products..." : `${products.length} fresh products`
        }
      />

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={s.listPad}
        columnWrapperStyle={s.columnWrapper}
        renderItem={renderProduct}
        ListEmptyComponent={emptyComponent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  listPad: {
    padding: 16,
    paddingBottom: 30,
    gap: 12,
  },

  columnWrapper: {
    gap: 12,
  },
});
