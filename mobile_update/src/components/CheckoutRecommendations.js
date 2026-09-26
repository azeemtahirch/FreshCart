import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ProductCard, SectionTitle } from "./UI";
import { theme } from "../theme/theme";

// =========================================================
// Helpers
// =========================================================

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getWords = (value) =>
  normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const productName = (product) => normalize(product?.name);

const productCategory = (product) => normalize(product?.category_name);

const productDescription = (product) => normalize(product?.description);

const getProductId = (item) =>
  Number(item?.product_id ?? item?.productId ?? item?.id ?? 0);

const getCartProducts = (products, cartItems) => {
  return cartItems
    .map((item) =>
      products.find((product) => Number(product.id) === getProductId(item)),
    )
    .filter(Boolean);
};

// =========================================================
// Product text
// =========================================================

function getProductText(product) {
  return [
    product?.name,
    product?.category_name,
    product?.description,
    product?.unit_type,
  ]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
}

// =========================================================
// Category normalization
// =========================================================

function normalizeCategory(category) {
  const value = normalize(category);

  if (!value) {
    return "";
  }

  // Common category variations
  if (value.includes("dairy") || value.includes("milk")) {
    return "dairy";
  }

  if (value.includes("vegetable") || value.includes("veg")) {
    return "vegetables";
  }

  if (value.includes("fruit")) {
    return "fruits";
  }

  if (
    value.includes("meat") ||
    value.includes("chicken") ||
    value.includes("beef") ||
    value.includes("mutton")
  ) {
    return "meat";
  }

  if (value.includes("bakery") || value.includes("bread")) {
    return "bakery";
  }

  if (value.includes("grocery") || value.includes("groceries")) {
    return "grocery";
  }

  return value;
}

// =========================================================
// Category relationship scoring
//
// This is generic. It does NOT contain product names.
// =========================================================

function categoryRelationshipScore(cartCategory, recommendationCategory) {
  if (!cartCategory || !recommendationCategory) {
    return 0;
  }

  if (cartCategory === recommendationCategory) {
    return 15;
  }

  const relationships = {
    meat: {
      dairy: 55,
      vegetables: 45,
      grocery: 20,
      bakery: 10,
      fruits: 10,
    },

    vegetables: {
      meat: 45,
      dairy: 45,
      vegetables: 10,
      grocery: 20,
      bakery: 5,
      fruits: 10,
    },

    dairy: {
      bakery: 45,
      vegetables: 35,
      fruits: 25,
      grocery: 20,
      meat: 20,
    },

    bakery: {
      dairy: 50,
      meat: 10,
      fruits: 20,
      vegetables: 10,
      grocery: 20,
    },

    fruits: {
      fruits: 50,
      dairy: 20,
      bakery: 15,
      vegetables: 5,
      grocery: 10,
    },

    grocery: {
      vegetables: 20,
      meat: 20,
      dairy: 20,
      bakery: 20,
      fruits: 15,
    },
  };

  return relationships?.[cartCategory]?.[recommendationCategory] || 0;
}

// =========================================================
// Word similarity
//
// Uses actual product names/descriptions.
// No product names are hard-coded.
// =========================================================

function getWordOverlapScore(cartProduct, recommendationProduct) {
  const cartWords = new Set([
    ...getWords(cartProduct?.name),
    ...getWords(cartProduct?.description),
  ]);

  const recommendationWords = new Set([
    ...getWords(recommendationProduct?.name),
    ...getWords(recommendationProduct?.description),
  ]);

  let matches = 0;

  cartWords.forEach((word) => {
    if (word.length >= 4 && recommendationWords.has(word)) {
      matches += 1;
    }
  });

  return matches * 20;
}

// =========================================================
// Category diversity
// =========================================================

function getCategoryDiversityScore(cartCategories, recommendationCategory) {
  if (!recommendationCategory) {
    return 0;
  }

  if (cartCategories.has(recommendationCategory)) {
    return 10;
  }

  return 25;
}

// =========================================================
// Product recommendation score
// =========================================================

function calculateRecommendationScore(product, cartProducts, cartCategories) {
  let score = 0;

  const recommendationCategory = normalizeCategory(product?.category_name);

  // -------------------------------------------------------
  // Compare with every product in cart
  // -------------------------------------------------------

  cartProducts.forEach((cartProduct) => {
    const cartCategory = normalizeCategory(cartProduct?.category_name);

    // Category relationship
    score += categoryRelationshipScore(cartCategory, recommendationCategory);

    // Product name / description similarity
    score += getWordOverlapScore(cartProduct, product);
  });

  // -------------------------------------------------------
  // Category diversity
  // -------------------------------------------------------

  score += getCategoryDiversityScore(cartCategories, recommendationCategory);

  // -------------------------------------------------------
  // Description relevance
  // -------------------------------------------------------

  const description = productDescription(product);

  if (description) {
    score += 5;
  }

  // -------------------------------------------------------
  // Product has image
  // -------------------------------------------------------

  if (product?.image_url) {
    score += 2;
  }

  return score;
}

// =========================================================
// Dynamic title
// =========================================================

function buildRecommendationTitle(cartProducts) {
  const categories = new Set(
    cartProducts
      .map((product) => normalizeCategory(product?.category_name))
      .filter(Boolean),
  );

  const names = cartProducts.map(productName);

  // -------------------------------------------------------
  // Meat + vegetables
  // -------------------------------------------------------

  if (categories.has("meat") && categories.has("vegetables")) {
    return {
      title: "Complete Your Meal",
      subtitle: "Fresh ingredients that pair well with your order",
    };
  }

  // -------------------------------------------------------
  // Meat
  // -------------------------------------------------------

  if (categories.has("meat")) {
    return {
      title: "Goes Great With Your Order",
      subtitle: "Fresh ingredients that pair well with your meat",
    };
  }

  // -------------------------------------------------------
  // Fruits
  // -------------------------------------------------------

  if (categories.has("fruits")) {
    return {
      title: "More Fresh Fruits",
      subtitle: "Fresh fruit picks for your basket",
    };
  }

  // -------------------------------------------------------
  // Vegetables
  // -------------------------------------------------------

  if (categories.has("vegetables")) {
    return {
      title: "Complete Your Meal",
      subtitle: "Fresh ingredients and favorites for your basket",
    };
  }

  // -------------------------------------------------------
  // Dairy
  // -------------------------------------------------------

  if (categories.has("dairy")) {
    return {
      title: "Complete Your Breakfast",
      subtitle: "Easy breakfast favorites for your basket",
    };
  }

  // -------------------------------------------------------
  // Bakery
  // -------------------------------------------------------

  if (categories.has("bakery")) {
    return {
      title: "Complete Your Basket",
      subtitle: "Fresh favorites that go well with your order",
    };
  }

  // -------------------------------------------------------
  // Default
  // -------------------------------------------------------

  return {
    title: "You Might Also Like",
    subtitle: "Fresh picks that go well with your basket",
  };
}

// =========================================================
// Component
// =========================================================

export default function CheckoutRecommendations({
  products = [],
  cartItems = [],
  onProductPress,
  onSeeAll,
}) {
  const { recommendations, titleInfo } = useMemo(() => {
    if (
      !Array.isArray(products) ||
      !products.length ||
      !Array.isArray(cartItems) ||
      !cartItems.length
    ) {
      return {
        recommendations: [],
        titleInfo: null,
      };
    }

    // -------------------------------------------------------
    // Products actually in cart
    // -------------------------------------------------------

    const cartProducts = getCartProducts(products, cartItems);

    if (!cartProducts.length) {
      return {
        recommendations: [],
        titleInfo: null,
      };
    }

    // -------------------------------------------------------
    // Cart IDs
    // -------------------------------------------------------

    const cartIds = new Set(cartItems.map(getProductId).filter((id) => id > 0));

    // -------------------------------------------------------
    // Cart categories
    // -------------------------------------------------------

    const cartCategories = new Set(
      cartProducts
        .map((product) => normalizeCategory(product?.category_name))
        .filter(Boolean),
    );

    // -------------------------------------------------------
    // Available products
    //
    // Do not recommend:
    // - Cart products
    // - Out-of-stock products
    // - Invalid products
    // -------------------------------------------------------

    const available = products.filter((product) => {
      const id = Number(product?.id || 0);

      const stock = Number(product?.stock_quantity ?? 0);

      return id > 0 && stock > 0 && !cartIds.has(id);
    });

    // -------------------------------------------------------
    // Score products dynamically
    // -------------------------------------------------------

    const ranked = available
      .map((product) => {
        const score = calculateRecommendationScore(
          product,
          cartProducts,
          cartCategories,
        );

        return {
          ...product,
          _recommendationScore: score,
        };
      })
      .filter((product) => product._recommendationScore > 0)
      .sort((a, b) => {
        if (b._recommendationScore !== a._recommendationScore) {
          return b._recommendationScore - a._recommendationScore;
        }

        return String(a?.name || "").localeCompare(String(b?.name || ""));
      })
      .slice(0, 6);

    return {
      recommendations: ranked,
      titleInfo: buildRecommendationTitle(cartProducts),
    };
  }, [products, cartItems]);

  // =========================================================
  // Don't render when nothing is available
  // =========================================================

  if (!titleInfo || !recommendations.length) {
    return null;
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <View style={styles.section}>
      <SectionTitle
        title={titleInfo.title}
        action="View All"
        onPress={onSeeAll}
      />

      <View style={styles.headerRow}>
        <View style={styles.iconBubble}>
          <Text style={styles.icon}>✨</Text>
        </View>

        <Text style={styles.subtitle}>{titleInfo.subtitle}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {recommendations.map((product) => (
          <View key={product.id} style={styles.card}>
            <ProductCard
              product={product}
              onPress={() => onProductPress?.(product)}
              showAddButton={false}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// =========================================================
// Styles
// =========================================================

const styles = StyleSheet.create({
  section: {
    marginTop: 2,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -7,
    marginBottom: 10,
  },

  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  icon: {
    fontSize: 14,
  },

  subtitle: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.muted,
  },

  row: {
    gap: 10,
    paddingBottom: 4,
  },

  card: {
    width: 178,
  },
});
