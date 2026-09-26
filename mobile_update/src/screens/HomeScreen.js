import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api, apiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { theme } from "../theme/theme";
import { money } from "../utils/format";
import { Card, IconButton, Loader, SectionTitle } from "../components/UI";
import { screen, safe } from "../utils/screenHelpers";
import { AppIcon } from "../components/AppIcon";
import {
  horizontalPadding,
  contentGap,
  isSmallDevice,
} from "../utils/responsive";

const HomeProductCard = ({
  product,
  onPress,
  onAdd,
  alreadyInCart = false,
}) => {
  const available = Number(product.stock_quantity || 0) > 0;

  return (
    <View style={s.homeProductCard}>
      <Pressable onPress={onPress} style={s.homeProductBody}>
        <View style={s.homeProductImageWrap}>
          <Image
            source={{ uri: product.image_url }}
            style={s.homeProductImage}
            resizeMode="contain"
          />

          {!available && (
            <View style={s.homeOutBadge}>
              <Text style={s.homeOutBadgeText}>OUT OF STOCK</Text>
            </View>
          )}
        </View>

        <Text style={s.homeProductName} numberOfLines={2}>
          {product.name}
        </Text>

        <Text style={s.homeProductPrice}>
          {money(product.base_price)}{" "}
          <Text style={s.homeProductUnit}>/ {product.unit_type}</Text>
        </Text>

        <Text style={[s.homeStock, !available && s.homeStockUnavailable]}>
          {available ? "✓ In stock" : "Unavailable"}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${product.name} to basket`}
        disabled={!available || alreadyInCart}
        onPress={onAdd}
        style={({ pressed }) => [
          s.homeAddButton,
          (!available || alreadyInCart) && s.homeAddButtonDisabled,
          pressed && available && !alreadyInCart && s.homeAddButtonPressed,
        ]}
      >
        <Text style={s.homeAddButtonText}>
          {!available
            ? "Out of stock"
            : alreadyInCart
              ? "✓ Added to Cart"
              : "+  Add to Cart"}
        </Text>
      </Pressable>
    </View>
  );
};

export function HomeScreen({ navigation }) {
  const { user } = useAuth();

  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { add, items, shippingInfo } = useCart();

  // Load categories and products
  const loadHomeData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [categoriesResponse, productsResponse] = await Promise.all([
        api.get("/categories"),
        api.get("/products"),
      ]);

      setCats(categoriesResponse.data || []);
      setProducts(productsResponse.data || []);
    } catch (e) {
      Alert.alert("Unable to load FreshCart", apiError(e));
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Initial Home loading
  useEffect(() => {
    loadHomeData();

    return () => {};
  }, []);

  // Pull-to-refresh
  const onRefresh = () => {
    loadHomeData(true);
  };

  const openDeliveryLocation = () => navigation.navigate("Address Management");

  // Full screen loading only during initial Home load
  if (loading) {
    return (
      <View style={s.fullScreenLoader}>
        <Loader label="Finding fresh products..." />
      </View>
    );
  }

  return (
    <ScrollView
      style={screen}
      contentContainerStyle={s.homeContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          title="Refreshing FreshCart..."
          titleColor={theme.colors.muted}
        />
      }
    >
      <View style={s.topBar}>
        <Pressable style={s.locationPill} onPress={openDeliveryLocation}>
          <AppIcon name="📍" size={18} color={theme.colors.primary} />

          <Text style={s.locationPillText}>Set delivery location</Text>

          <AppIcon name="›" size={20} color={theme.colors.muted} />
        </Pressable>

        <View style={s.topActions}>
          <IconButton
            icon="🔔"
            accessibilityLabel="Notifications"
            onPress={() => navigation.navigate("Notifications")}
          />

          <IconButton
            icon="🛒"
            accessibilityLabel="Basket"
            onPress={() => navigation.navigate("Cart")}
            badge={items.reduce((count, item) => count + item.quantity, 0)}
          />
        </View>
      </View>

      <View style={s.greetingBlock}>
        <Text style={s.locationText}>FreshCart delivery</Text>

        <Text style={s.greeting}>Hello, {safe(user?.name, "Ahmed")}</Text>
      </View>

      <View style={s.homePromoBanner}>
        <View style={s.homePromoGlow} />

        <View style={s.homePromoCopy}>
          <Text style={s.homePromoTitle}>
            <Text style={s.homePromoTitleAccent}>Fresh groceries,</Text>
            {`\n`}
            delivered to your door
          </Text>

          <Text style={s.homePromoDescription}>
            Get fresh products at{`\n`}
            great prices.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Shop now"
            onPress={() => navigation.navigate("Search")}
            style={({ pressed }) => [
              s.homePromoButton,
              pressed && s.homePromoButtonPressed,
            ]}
          >
            <Text style={s.homePromoButtonText}>Shop Now →</Text>
          </Pressable>
        </View>

        <View style={s.homePromoVisual} pointerEvents="none">
          <Text style={s.homePromoLeafTop}>🌿</Text>

          <View style={s.homePromoProduceTop}>
            <Text style={s.homePromoProduce}>🥬 🥦</Text>

            <Text style={s.homePromoProduce}>🍅 🫑</Text>
          </View>

          <View style={s.homePromoBasket}>
            {products.length ? (
              products.slice(0, 4).map((product, index) => (
                <Image
                  key={product.id}
                  source={{
                    uri: product.image_url,
                  }}
                  style={[
                    s.homePromoBasketImage,
                    [
                      s.homePromoBasketImageOne,
                      s.homePromoBasketImageTwo,
                      s.homePromoBasketImageThree,
                      s.homePromoBasketImageFour,
                    ][index],
                  ]}
                  resizeMode="cover"
                />
              ))
            ) : (
              <>
                <Text style={s.homePromoBasketProduce}>🍌 🍎</Text>

                <Text style={s.homePromoBasketProduce}>🥒 🥛</Text>
              </>
            )}
          </View>

          <Text style={s.homePromoLeafBottom}>🍃</Text>
        </View>

        <View style={s.homePromoDots}>
          <View style={s.homePromoDotActive} />
          <View style={s.homePromoDot} />
          <View style={s.homePromoDot} />
        </View>
      </View>

      <Pressable
        style={s.searchBar}
        onPress={() => navigation.navigate("Search")}
      >
        <Text style={s.searchIcon}>⌕</Text>

        <Text style={s.searchPlaceholder}>
          Search vegetables, fruits, meat, milk...
        </Text>
      </Pressable>

      <SectionTitle
        title="Shop by category"
        action="See all"
        onPress={() => navigation.navigate("Categories")}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categoryScrollContent}
      >
        {cats.map((c) => (
          <Pressable
            key={c.id}
            style={s.homeCategoryCard}
            onPress={() =>
              navigation.navigate(c.name, {
                categoryId: c.id,
                title: c.name,
              })
            }
          >
            <View style={s.homeCategoryIcon}>
              <Text style={s.homeCategoryIconText}>{c.icon}</Text>
            </View>

            <Text style={s.categoryMiniText}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionTitle
        title="Today's fresh picks"
        action="View all"
        onPress={() => navigation.navigate("Search")}
      />

      <View style={s.homeProductGrid}>
        {products.slice(0, 8).map((p) => (
          <HomeProductCard
            key={p.id}
            product={p}
            alreadyInCart={items.some(
              (item) => Number(item.product_id) === Number(p.id),
            )}
            onPress={() =>
              navigation.navigate("Product Details", {
                productId: p.id,
              })
            }
            onAdd={() => add(p, 1000)}
          />
        ))}
      </View>

      <Card style={s.homeDeliveryCard}>
        <View style={s.deliveryRow}>
          <Text style={s.deliveryTruck}>🚚</Text>

          <View style={{ flex: 1 }}>
            <Text style={s.name}>
              Minimum order{" "}
              {money(
                shippingInfo?.minimum_order ?? 0,
                shippingInfo?.currency || "PKR",
              )}
            </Text>

            <Text style={s.muted}>
              Fast doorstep delivery across supported areas.
            </Text>
          </View>

          <Text style={s.arrow}>›</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // Full-screen API loader
  fullScreenLoader: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  arrow: {
    fontSize: 28,
    color: theme.colors.muted,
  },

  categoryMiniText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 7,
    textAlign: "center",
  },

  categoryScrollContent: {
    gap: 10,
    paddingVertical: 2,
    paddingRight: 4,
  },

  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  deliveryTruck: {
    fontSize: 30,
    marginRight: 12,
  },

  greeting: {
    fontSize: 23,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 5,
  },

  greetingBlock: {
    marginBottom: 16,
  },

  homeAddButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 6,
    marginTop: 10,
  },

  homeAddButtonDisabled: {
    backgroundColor: theme.colors.border,
  },

  homeAddButtonPressed: {
    opacity: 0.82,
  },

  homeAddButtonText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: "900",
  },

  homeCategoryCard: {
    width: 82,
    alignItems: "center",
  },

  homeCategoryIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow,
  },

  homeCategoryIconText: {
    fontSize: 31,
  },

  homeContent: {
    paddingHorizontal: horizontalPadding,
    paddingTop: isSmallDevice ? 28 : 44,
    paddingBottom: 10,
  },

  homeDeliveryCard: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: "#CDEDD9",
    borderRadius: 20,
    marginTop: 20,
    padding: 16,
  },

  homeOutBadge: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    backgroundColor: "rgba(23, 33, 27, 0.76)",
    borderRadius: 8,
    paddingVertical: 5,
  },

  homeOutBadgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
  },

  homeProductBody: {
    flex: 1,
  },

  homeProductCard: {
    width: "48.2%",
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: isSmallDevice ? 0 : 292,
    ...theme.shadow,
  },

  homeProductGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: contentGap,
  },

  homeProductImage: {
    width: "100%",
    height: "100%",
  },

  homeProductImageWrap: {
    width: "100%",
    aspectRatio: 1.08,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: theme.colors.primarySoft,
    position: "relative",
  },

  homeProductName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 10,
    minHeight: 38,
  },

  homeProductPrice: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  homeProductUnit: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },

  homePromoBanner: {
    minHeight: 212,
    borderRadius: 23,
    backgroundColor: "#EAF8F0",
    borderWidth: 1,
    borderColor: "#D6EFDF",
    overflow: "hidden",
    position: "relative",
    marginBottom: 16,
    ...theme.shadow,
  },

  homePromoBasket: {
    position: "absolute",
    right: 11,
    bottom: 10,
    width: 116,
    height: 92,
    borderRadius: 22,
    backgroundColor: "#B9783E",
    borderWidth: 5,
    borderColor: "#965A2D",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "5deg" }],
    ...theme.shadow,
  },

  homePromoBasketImage: {
    position: "absolute",
    width: 43,
    height: 43,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#F8E6D2",
    backgroundColor: theme.colors.primarySoft,
  },

  homePromoBasketImageFour: {
    right: 18,
    bottom: 4,
    transform: [{ rotate: "-8deg" }],
  },

  homePromoBasketImageOne: {
    left: 9,
    top: 8,
    transform: [{ rotate: "-12deg" }],
  },

  homePromoBasketImageThree: {
    left: 18,
    bottom: 5,
    transform: [{ rotate: "8deg" }],
  },

  homePromoBasketImageTwo: {
    right: 8,
    top: 6,
    transform: [{ rotate: "10deg" }],
  },

  homePromoBasketProduce: {
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -5,
  },

  homePromoButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 13,
    ...theme.shadow,
  },

  homePromoButtonPressed: {
    opacity: 0.82,
  },

  homePromoButtonText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: "900",
  },

  homePromoCopy: {
    width: "62%",
    paddingLeft: 17,
    paddingTop: 20,
    zIndex: 2,
  },

  homePromoDescription: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 9,
  },

  homePromoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#A9D8B9",
  },

  homePromoDotActive: {
    width: 16,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },

  homePromoDots: {
    position: "absolute",
    bottom: 9,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },

  homePromoGlow: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -54,
    top: -34,
    backgroundColor: "#D7F2E1",
    opacity: 0.72,
  },

  homePromoLeafBottom: {
    position: "absolute",
    left: 0,
    bottom: 16,
    fontSize: 21,
    transform: [{ rotate: "-25deg" }],
  },

  homePromoLeafTop: {
    position: "absolute",
    right: 9,
    top: 4,
    fontSize: 24,
    transform: [{ rotate: "22deg" }],
  },

  homePromoProduce: {
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -4,
  },

  homePromoProduceTop: {
    position: "absolute",
    right: 16,
    top: 26,
    alignItems: "center",
    transform: [{ rotate: "-8deg" }],
  },

  homePromoTitle: {
    color: theme.colors.text,
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 25,
  },

  homePromoTitleAccent: {
    color: theme.colors.primaryDark,
  },

  homePromoVisual: {
    position: "absolute",
    right: 2,
    top: 3,
    width: "43%",
    height: 183,
  },

  homeStock: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7,
  },

  homeStockUnavailable: {
    color: theme.colors.muted,
  },

  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexShrink: 1,
    ...theme.shadow,
  },

  locationPillArrow: {
    color: theme.colors.white,
    fontSize: 20,
    lineHeight: 18,
    marginLeft: 5,
  },

  locationPillIcon: {
    fontSize: 15,
    marginRight: 5,
  },

  locationPillText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: "800",
    flexShrink: 1,
  },

  locationText: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  searchBar: {
    minHeight: 56,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    marginBottom: 4,
    ...theme.shadow,
  },

  searchIcon: {
    fontSize: 27,
    color: theme.colors.primaryDark,
    marginRight: 10,
  },

  searchPlaceholder: {
    color: theme.colors.muted,
    fontSize: 13,
    flex: 1,
  },

  topActions: {
    flexDirection: "row",
    marginLeft: 10,
  },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    minHeight: 42,
  },
});
