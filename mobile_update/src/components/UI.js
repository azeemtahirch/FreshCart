import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "../theme/theme";
import { money } from "../utils/format";
import { AppIcon } from "./AppIcon";

// ---------------------------------------------------------
// Button
// ---------------------------------------------------------

export const Button = ({
  title,
  onPress,
  disabled = false,
  secondary = false,
  danger = false,
  loading = false,
  icon = null,
}) => {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        secondary && s.btnSecondary,
        danger && s.btnDanger,
        (disabled || loading) && s.disabled,
        pressed && s.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? theme.colors.primary : "#fff"} />
      ) : (
        <Text
          style={[
            s.btnText,
            secondary && s.btnSecondaryText,
            danger && s.btnDangerText,
          ]}
        >
          {icon ? <AppIcon name={icon} size={16} color={secondary ? theme.colors.primaryDark : "#fff"} /> : null}
          {icon ? " " : ""}
          {title}
        </Text>
      )}
    </Pressable>
  );
};

// ---------------------------------------------------------
// Input
// ---------------------------------------------------------

export const Input = ({
  label,
  error,
  style,
  rightIcon,
  onRightIconPress,
  ...props
}) => {
  return (
    <View style={s.inputWrap}>
      {label && <Text style={s.inputLabel}>{label}</Text>}

      <View style={[s.inputContainer, error && s.inputError]}>
        <TextInput
          placeholderTextColor={theme.colors.muted}
          style={[s.input, style]}
          {...props}
        />

        {rightIcon && onRightIconPress && (
          <Pressable
            onPress={onRightIconPress}
            style={({ pressed }) => [
              s.inputRightButton,
              pressed && s.inputRightPressed,
            ]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Toggle password visibility"
          >
            <Text style={s.inputRightIcon}>{rightIcon}</Text>
          </Pressable>
        )}
      </View>

      {error && <Text style={s.error}>{error}</Text>}
    </View>
  );
};

// ---------------------------------------------------------
// Card
// ---------------------------------------------------------

export const Card = ({ children, style, accent = false }) => {
  return (
    <View style={[s.card, accent && s.accentCard, style]}>{children}</View>
  );
};

// ---------------------------------------------------------
// Section Title
// ---------------------------------------------------------

export const SectionTitle = ({ title, action, onPress }) => {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>

      {action && (
        <Pressable onPress={onPress}>
          <Text style={s.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
};

// ---------------------------------------------------------
// Loader
// ---------------------------------------------------------

export const Loader = ({ label = "Loading..." }) => {
  return (
    <View style={s.loader}>
      <ActivityIndicator size="large" color={theme.colors.primary} />

      <Text style={s.loaderText}>{label}</Text>
    </View>
  );
};

// ---------------------------------------------------------
// Empty
// ---------------------------------------------------------

export const Empty = ({ text, icon = "🛒" }) => {
  return (
    <View style={s.empty}>
      <AppIcon name={icon} size={42} color={theme.colors.primary} style={s.emptyIcon} />

      <Text style={s.emptyTitle}>{text}</Text>
    </View>
  );
};

// ---------------------------------------------------------
// Icon Button
// ---------------------------------------------------------

export const IconButton = ({ icon, onPress, badge, accessibilityLabel }) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={s.iconButton}
    >
      <AppIcon name={icon} size={22} color={theme.colors.text} />

      {Number(badge) > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
};

// ---------------------------------------------------------
// Header
// ---------------------------------------------------------

export const Header = ({ title, subtitle, onBack, right }) => {
  return (
    <View style={s.header}>
      <View style={s.headerLeft}>
        {onBack && (
          <IconButton icon="‹" onPress={onBack} accessibilityLabel="Go back" />
        )}

        <View>
          <Text style={s.headerTitle}>{title}</Text>

          {subtitle && <Text style={s.headerSub}>{subtitle}</Text>}
        </View>
      </View>

      {right}
    </View>
  );
};

// ---------------------------------------------------------
// Pill
// ---------------------------------------------------------

export const Pill = ({ children, tone = "green" }) => {
  return (
    <View
      style={[
        s.pill,
        tone === "red" && s.pillRed,
        tone === "amber" && s.pillAmber,
      ]}
    >
      <Text
        style={[
          s.pillText,
          tone === "red" && s.pillRedText,
          tone === "amber" && s.pillAmberText,
        ]}
      >
        {children}
      </Text>
    </View>
  );
};

// ---------------------------------------------------------
// Product Card
// ---------------------------------------------------------
// showAddButton:
// true  = normal product card with Add button
// false = recommendation card without Add button
// ---------------------------------------------------------

export const ProductCard = ({
  product,
  onPress,
  onAdd,
  cartItems = [],
  showAddButton = true,
}) => {
  const toastAnim = useRef(new Animated.Value(0)).current;

  if (!product || product.id == null) {
    return null;
  }

  const productId = Number(product.id);

  // -------------------------------------------------------
  // Get product cart size
  // -------------------------------------------------------

  const getProductCartSize = () => {
    const unit = String(product.unit_type || "")
      .trim()
      .toLowerCase();

    // Dozen is represented as size = 1
    if (unit === "dozen") {
      return 1;
    }

    const apiSize = Number(product.size_ml);

    if (Number.isFinite(apiSize) && apiSize > 0) {
      return apiSize;
    }

    // Default for kg/liter
    if (unit === "kg" || unit === "liter") {
      return 1000;
    }

    return 1;
  };

  const cartSize = getProductCartSize();

  // -------------------------------------------------------
  // Cart check
  // -------------------------------------------------------

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];

  const alreadyInCart = safeCartItems.some((item) => {
    if (!item) {
      return false;
    }

    const itemProductId = Number(item.product_id ?? item.productId ?? item.id);

    const itemSize = Number(item.size_ml ?? item.size ?? item.sizeMl ?? 0);

    return itemProductId === productId && itemSize === cartSize;
  });

  // -------------------------------------------------------
  // Stock
  // -------------------------------------------------------

  const stockQuantity = Number(product.stock_quantity ?? 0);

  const outOfStock = stockQuantity <= 0;

  const addDisabled = outOfStock || alreadyInCart;

  // -------------------------------------------------------
  // Add to cart
  // -------------------------------------------------------

  const addToCart = async () => {
    if (addDisabled) {
      return;
    }

    if (!productId) {
      return;
    }

    if (!Number.isFinite(cartSize) || cartSize <= 0) {
      return;
    }

    try {
      await onAdd?.(product, cartSize);

      toastAnim.stopAnimation();
      toastAnim.setValue(0);

      Animated.sequence([
        Animated.timing(toastAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),

        Animated.delay(1300),

        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.warn("ProductCard add error:", error);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.product, pressed && s.pressed]}
    >
      {/* Product Image */}
      <View style={s.productImageWrap}>
        {product.image_url ? (
          <Image
            source={{
              uri: product.image_url,
            }}
            style={s.productImage}
          />
        ) : (
          <View style={s.imagePlaceholder}>
            <Text style={s.imagePlaceholderText}>🥬</Text>
          </View>
        )}

        {outOfStock && (
          <View style={s.outBadge}>
            <Text style={s.outBadgeText}>OUT OF STOCK</Text>
          </View>
        )}
      </View>

      {/* Product Name */}
      <Text style={s.productName} numberOfLines={1}>
        {product.name || "Product"}
      </Text>

      {/* Product Price */}
      <Text style={s.productUnit}>
        {money(Number(product.base_price || 0))} / {product.unit_type || "unit"}
      </Text>

      {/* Bottom */}
      <View style={s.productBottom}>
        <Text
          style={[
            s.inStock,
            alreadyInCart && s.alreadyAddedText,
            outOfStock && s.unavailableText,
          ]}
        >
          {outOfStock
            ? "Unavailable"
            : alreadyInCart
              ? "Added to cart"
              : "In stock"}
        </Text>

        {/* --------------------------------------------- */}
        {/* Add Button                                     */}
        {/* --------------------------------------------- */}
        {showAddButton && (
          <Pressable
            disabled={addDisabled}
            onPress={addToCart}
            accessibilityRole="button"
            accessibilityLabel={
              alreadyInCart
                ? "Product already in cart"
                : outOfStock
                  ? "Product unavailable"
                  : "Add product to cart"
            }
            style={[
              s.addButton,
              outOfStock && s.addButtonDisabled,
              alreadyInCart && s.addButtonAdded,
            ]}
          >
            <Text style={[s.addText, addDisabled && s.addTextDisabled]}>
              {alreadyInCart ? "✓" : "+"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* --------------------------------------------- */}
      {/* Add-to-cart Toast                              */}
      {/* Only shown for normal product cards            */}
      {/* --------------------------------------------- */}
      {showAddButton && !alreadyInCart && !outOfStock && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.cartToast,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={s.cartToastText}>✓ Product added to cart</Text>
        </Animated.View>
      )}
    </Pressable>
  );
};

// ---------------------------------------------------------
// Quantity
// ---------------------------------------------------------

export const Qty = ({ value, onMinus, onPlus }) => {
  return (
    <View style={s.qty}>
      <Pressable onPress={onMinus} style={s.qtyBtn}>
        <Text style={s.qtyBtnText}>−</Text>
      </Pressable>

      <Text style={s.qtyValue}>{value}</Text>

      <Pressable onPress={onPlus} style={s.qtyBtn}>
        <Text style={s.qtyBtnText}>+</Text>
      </Pressable>
    </View>
  );
};

// ---------------------------------------------------------
// Summary Row
// ---------------------------------------------------------

export const SummaryRow = ({
  label,
  value,
  strong = false,
  green = false,
  currency = "Rs.",
}) => {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.summaryLabel, strong && s.strong]}>{label}</Text>

      <Text style={[s.summaryValue, strong && s.strong, green && s.green]}>
        {typeof value === "number" ? money(value, currency) : value}
      </Text>
    </View>
  );
};

// ---------------------------------------------------------
// Status Pill
// ---------------------------------------------------------

export const StatusPill = ({ status }) => {
  const text = String(status || "").replace(/_/g, " ");

  const tone =
    status === "cancelled"
      ? "red"
      : status === "delivered"
        ? "green"
        : status === "out_for_delivery"
          ? "amber"
          : "green";

  return <Pill tone={tone}>{text.toUpperCase()}</Pill>;
};

// ---------------------------------------------------------
// Divider
// ---------------------------------------------------------

export const Divider = () => <View style={s.divider} />;

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

const s = StyleSheet.create({
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    minHeight: 52,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    ...theme.shadow,
  },

  btnSecondary: {
    backgroundColor: theme.colors.primarySoft,
    shadowOpacity: 0,
  },

  btnDanger: {
    backgroundColor: theme.colors.danger,
    shadowOpacity: 0,
  },

  disabled: {
    opacity: 0.45,
  },

  pressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  btnSecondaryText: {
    color: theme.colors.primaryDark,
  },

  btnDangerText: {
    color: "#fff",
  },

  inputWrap: {
    marginBottom: 10,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 7,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 52,
  },

  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 15,
    fontSize: 15,
    color: theme.colors.text,
  },

  inputError: {
    borderColor: theme.colors.danger,
  },

  inputRightButton: {
    width: 48,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  inputRightPressed: {
    opacity: 0.5,
  },

  inputRightIcon: {
    fontSize: 20,
  },

  error: {
    fontSize: 12,
    color: theme.colors.danger,
    marginTop: 4,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow,
  },

  accentCard: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: "#CDEDD9",
  },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: theme.colors.text,
  },

  action: {
    color: theme.colors.primary,
    fontWeight: "800",
  },

  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  loaderText: {
    color: theme.colors.muted,
    marginTop: 10,
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 50,
  },

  emptyIcon: {
    marginBottom: 10,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  iconText: {
    alignItems: "center",
    justifyContent: "center",
  },

  badge: {
    position: "absolute",
    right: -2,
    top: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },

  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },

  header: {
    height: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    backgroundColor: theme.colors.background,
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  headerTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: theme.colors.text,
  },

  headerSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },

  pill: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  pillRed: {
    backgroundColor: theme.colors.dangerSoft,
  },

  pillAmber: {
    backgroundColor: theme.colors.warningSoft,
  },

  pillText: {
    color: theme.colors.primaryDark,
    fontWeight: "900",
    fontSize: 10,
  },

  pillRedText: {
    color: theme.colors.danger,
  },

  pillAmberText: {
    color: "#9A6500",
  },

  product: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flex: 1,
    minWidth: 0,
    ...theme.shadow,
  },

  productImageWrap: {
    aspectRatio: 1,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: theme.colors.primarySoft,
    position: "relative",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
  },

  imagePlaceholderText: {
    fontSize: 42,
  },

  outBadge: {
    position: "absolute",
    bottom: 7,
    left: 7,
    right: 7,
    backgroundColor: "rgba(217,45,32,.9)",
    borderRadius: 8,
    padding: 5,
  },

  outBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
  },

  productName: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 9,
  },

  productUnit: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 3,
  },

  productBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },

  inStock: {
    fontSize: 11,
    color: theme.colors.success,
    fontWeight: "700",
  },

  alreadyAddedText: {
    color: theme.colors.muted,
  },

  unavailableText: {
    color: theme.colors.danger,
  },

  addButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.7,
  },

  addButtonAdded: {
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },

  addText: {
    fontSize: 15,
    color: "#fff",
    lineHeight: 26,
    fontWeight: "900",
  },

  addTextDisabled: {
    color: theme.colors.muted,
  },

  cartToast: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: "#202522",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    zIndex: 10,
    elevation: 10,
  },

  cartToastText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },

  qty: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 13,
    backgroundColor: "#fff",
  },

  qtyBtn: {
    width: 36,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  qtyBtnText: {
    fontSize: 20,
    color: theme.colors.text,
  },

  qtyValue: {
    minWidth: 28,
    textAlign: "center",
    fontWeight: "900",
    color: theme.colors.text,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
  },

  summaryLabel: {
    fontSize: 14,
    color: theme.colors.muted,
  },

  summaryValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: "700",
  },

  strong: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.text,
  },

  green: {
    color: theme.colors.primaryDark,
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
});
