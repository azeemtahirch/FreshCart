import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api, apiError } from "../services/api";
import { useCart } from "../context/CartContext";
import { theme } from "../theme/theme";
import { money } from "../utils/format";

import {
  Button,
  Card,
  Divider,
  Header,
  Input,
  SectionTitle,
  SummaryRow,
} from "../components/UI";

import CheckoutRecommendations from "../components/CheckoutRecommendations";

import {
  screen,
  pad,
  getKarachiNow,
  useKarachiClock,
  isSelectableSlot,
  timeLabel,
} from "../utils/screenHelpers";

export function CheckoutScreen({ navigation }) {
  const { items, add, subtotal, shipping, shippingInfo, refreshShipping } =
    useCart();

  const now = useKarachiClock();
  const date = now.date;

  const [addresses, setAddresses] = useState([]);
  const [slots, setSlots] = useState([]);
  const [products, setProducts] = useState([]);
  const [availableCoupons, setAvailableCoupons] = useState([]);

  const [slot, setSlot] = useState(null);
  const [address, setAddress] = useState(null);
  const [method, setMethod] = useState("cod");
  const [busy, setBusy] = useState(false);

  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponExpanded, setCouponExpanded] = useState(false);

  const load = async () => {
    try {
      const [a, t, p, c] = await Promise.all([
        api.get("/addresses"),
        api.get("/time-slots", {
          params: { date },
        }),
        api.get("/products"),
        api.get("/coupons"),
        refreshShipping(),
      ]);

      setAddresses(a.data || []);
      setSlots(t.data || []);
      setProducts(p.data || []);
      setAvailableCoupons(c.data || []);

      if (!address && a.data?.length) {
        setAddress(a.data.find((x) => x.is_default) || a.data[0]);
      }
    } catch (e) {
      Alert.alert("Checkout error", apiError(e));
    }
  };

  useEffect(() => {
    load();
  }, [date]);

  const discount = appliedCoupon?.amount || 0;

  const minimum = Number(shippingInfo?.minimum_order ?? 0);

  const currency = shippingInfo?.currency || "PKR";

  const payableTotal = Math.max(0, subtotal - discount) + shipping;

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();

    if (!code) {
      Alert.alert("Coupon", "Enter a coupon code first.");
      return;
    }

    try {
      const r = await api.post("/coupons/validate", {
        code,
        subtotal,
      });

      const discountAmount = Number(r.data.discount || 0);

      setAppliedCoupon({
        code: r.data.code,
        amount: discountAmount,
      });

      setCouponExpanded(false);

      Alert.alert(
        "Coupon applied",
        `You saved ${money(discountAmount)} on products subtotal.`,
      );
    } catch (e) {
      Alert.alert("Coupon not available", apiError(e));
    }
  };

  useEffect(() => {
    if (!appliedCoupon?.code) return;

    let live = true;

    api
      .post("/coupons/validate", {
        code: appliedCoupon.code,
        subtotal,
      })
      .then((r) => {
        if (!live) return;

        setAppliedCoupon((prev) =>
          prev
            ? {
                ...prev,
                amount: Number(r.data.discount || 0),
              }
            : prev,
        );
      })
      .catch(() => {
        if (live) {
          setAppliedCoupon(null);
          setCoupon("");
        }
      });

    return () => {
      live = false;
    };
  }, [subtotal]);

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCoupon("");
    setCouponExpanded(false);
  };

  const selectCoupon = (selectedCoupon) => {
    setCoupon(String(selectedCoupon.code || "").toUpperCase());
    setCouponExpanded(true);
  };

  const place = async () => {
    if (shippingInfo && !shippingInfo.allowed) {
      return Alert.alert(
        "Minimum order",
        `Minimum order amount is ${currency} ${minimum}. Please add ${currency} ${(
          minimum - subtotal
        ).toFixed(0)} more to your cart.`,
      );
    }

    if (!address) {
      return Alert.alert(
        "Delivery address",
        "Please select or add a delivery address.",
      );
    }

    if (!slot) {
      return Alert.alert(
        "Delivery slot",
        "Please select a delivery time slot.",
      );
    }

    if (!isSelectableSlot(slot, getKarachiNow())) {
      return Alert.alert(
        "Delivery slot",
        "This delivery slot is no longer available. Please select a future slot for today.",
      );
    }

    const checkout = {
      address_id: address.id,
      delivery_lat: Number(address.latitude || 0),
      delivery_lng: Number(address.longitude || 0),
      delivery_date: date,
      time_slot_id: slot.id,

      items: items.map((x) => ({
        product_id: x.product_id,
        size_ml: x.size_ml,
        size_label: x.size_label,
        quantity: x.quantity,
      })),

      coupon_code: appliedCoupon?.code || "",
      total: payableTotal,
    };

    try {
      setBusy(true);

      // ==================================================
      // JAZZCASH
      // DO NOT CREATE ORDER HERE
      // ==================================================
      if (method === "jazzcash") {
        navigation.navigate("Payment", {
          checkout,
        });

        return;
      }

      // ==================================================
      // CASH ON DELIVERY
      // CREATE ORDER IMMEDIATELY
      // ==================================================
      const r = await api.post("/orders", {
        ...checkout,
        payment_method: "cod",
      });

      navigation.replace("Order Confirmation", {
        orderId: r.data.order_id,
        orderNumber: r.data.order_number,
        total: r.data.total ?? payableTotal,
      });
    } catch (e) {
      Alert.alert("Could not place order", apiError(e));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={screen}>
      <Header title="Checkout" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={pad}>
        {/* DELIVERY ADDRESS */}
        <SectionTitle
          title="Delivery address"
          action="Manage"
          onPress={() => navigation.navigate("Address Management")}
        />

        {addresses.length === 0 ? (
          <Card accent>
            <Text style={s.name}>No saved address</Text>

            <Text style={s.muted}>Add a delivery address to continue.</Text>

            <Button
              secondary
              title="+ Add address"
              onPress={() => navigation.navigate("Address Management")}
            />
          </Card>
        ) : (
          addresses.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAddress(a)}
              style={[s.option, a.id === address?.id && s.optionSelected]}
            >
              <View style={s.radio}>
                {a.id === address?.id ? <View style={s.radioDot} /> : null}
              </View>

              <View style={{ flex: 1 }}>
                <View style={s.row}>
                  <Text style={s.name}>{a.label || "Home"}</Text>

                  {a.is_default ? (
                    <Text style={s.defaultText}>DEFAULT</Text>
                  ) : null}
                </View>

                <Text style={s.muted}>{a.address_line}</Text>

                <Text style={s.cityText}>{a.city || "City"}</Text>
              </View>
            </Pressable>
          ))
        )}

        {/* DELIVERY DATE */}
        <SectionTitle title="Delivery date" />

        <Input value={date} editable={false} placeholder="YYYY-MM-DD" />

        {/* DELIVERY TIME */}
        <SectionTitle
          title="Delivery time"
          action="See all"
          onPress={() =>
            navigation.navigate("Time Slot Selection", {
              date,
              onSelect: (x) => setSlot(x),
            })
          }
        />

        {slots.length === 0 ? (
          <Card>
            <Text style={s.muted}>No slots available for today.</Text>
          </Card>
        ) : (
          slots.map((x) => {
            const disabled = !isSelectableSlot(x, now);

            return (
              <Pressable
                key={x.id}
                onPress={() => !disabled && setSlot(x)}
                disabled={disabled}
                style={[
                  s.slot,
                  x.id === slot?.id && s.optionSelected,
                  disabled && {
                    opacity: 0.45,
                  },
                ]}
              >
                <View>
                  <Text style={s.name}>
                    {timeLabel(x.start_time)} – {timeLabel(x.end_time)}
                  </Text>

                  <Text style={s.muted}>
                    {disabled ? "UNAVAILABLE" : "Available"}
                  </Text>
                </View>

                {x.id === slot?.id ? (
                  <Text style={s.checkCircle}>✓</Text>
                ) : (
                  <Text style={s.arrow}>›</Text>
                )}
              </Pressable>
            );
          })
        )}

        {/* PAYMENT */}
        <SectionTitle title="Payment method" />

        {/* <Pressable
          onPress={() => setMethod("jazzcash")}
          style={[s.paymentOption, method === "jazzcash" && s.optionSelected]}
        >
          <Text style={s.paymentIcon}>💳</Text>

          <View style={{ flex: 1 }}>
            <Text style={s.name}>JazzCash</Text>

            <Text style={s.muted}>Secure online payment</Text>
          </View>

          <View style={s.radio}>
            {method === "jazzcash" ? <View style={s.radioDot} /> : null}
          </View>
        </Pressable> */}

        <Pressable
          onPress={() => setMethod("cod")}
          style={[s.paymentOption, method === "cod" && s.optionSelected]}
        >
          <Text style={s.paymentIcon}>💵</Text>

          <View style={{ flex: 1 }}>
            <Text style={s.name}>Cash on Delivery</Text>

            <Text style={s.muted}>Pay when your groceries arrive</Text>
          </View>

          <View style={s.radio}>
            {method === "cod" ? <View style={s.radioDot} /> : null}
          </View>
        </Pressable>

        {/* COUPON */}
        <Card style={{ marginTop: 18 }}>
          {appliedCoupon ? (
            /* ACTIVE COUPON */
            <View style={s.activeCouponCard}>
              <View style={s.activeCouponIcon}>
                <Text style={s.activeCouponIconText}>✓</Text>
              </View>

              <View style={s.activeCouponContent}>
                <Text style={s.activeCouponTitle}>Coupon applied</Text>

                <Text style={s.activeCouponCode}>{appliedCoupon.code}</Text>

                <Text style={s.activeCouponSaving}>
                  You saved {money(appliedCoupon.amount)}
                </Text>
              </View>

              <Pressable onPress={removeCoupon} style={s.removeCouponButton}>
                <Text style={s.remove}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* COLLAPSED COUPON HEADER */}
              <Pressable
                onPress={() => setCouponExpanded((prev) => !prev)}
                style={s.couponHeader}
              >
                <View style={s.couponHeaderIcon}>
                  <Text style={s.couponHeaderIconText}>%</Text>
                </View>

                <View style={s.couponHeaderContent}>
                  <Text style={s.couponTitle}>Have a promo code?</Text>

                  <Text style={s.couponSubtitle}>
                    Tap to enter or view available offers
                  </Text>
                </View>

                <Text style={s.couponChevron}>{couponExpanded ? "" : ""}</Text>
              </Pressable>

              {/* EXPANDED COUPON */}
              {couponExpanded ? (
                <View style={s.couponExpandedArea}>
                  <View style={s.couponInputRow}>
                    <View style={{ flex: 1 }}>
                      <Input
                        placeholder="Enter coupon code"
                        value={coupon}
                        onChangeText={setCoupon}
                        autoCapitalize="characters"
                      />
                    </View>

                    <Pressable
                      style={s.couponApplyButton}
                      onPress={applyCoupon}
                    >
                      <Text style={s.couponApplyText}>Apply</Text>
                    </Pressable>
                  </View>

                  <Text style={s.muted}>
                    Coupon discounts apply to products subtotal only. Delivery
                    charges are not discounted.
                  </Text>

                  {availableCoupons.length > 0 ? (
                    <View>
                      <View style={s.availableHeader}>
                        <Text style={s.availableTitle}>Available offers</Text>

                        <Text style={s.availableCount}>
                          {availableCoupons.length} available
                        </Text>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.couponList}
                      >
                        {availableCoupons.slice(0, 5).map((x) => (
                          <Pressable
                            key={x.id}
                            onPress={() => selectCoupon(x)}
                            style={s.couponMini}
                          >
                            <View style={s.couponMiniTop}>
                              <Text style={s.couponMiniCode}>{x.code}</Text>

                              <Text style={s.couponMiniArrow}>›</Text>
                            </View>

                            <Text style={s.couponMiniValue}>
                              {x.discount_type === "percentage"
                                ? `${x.discount_value}% OFF`
                                : `${money(x.discount_value)} OFF`}
                            </Text>

                            <Text style={s.couponMiniMin}>
                              Min. {money(x.min_order_amount)}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <Text style={s.noCoupons}>
                      No special offers available right now.
                    </Text>
                  )}
                </View>
              ) : null}
            </>
          )}
        </Card>

        {/* RECOMMENDATIONS */}
        <CheckoutRecommendations
          products={products}
          cartItems={items}
          onProductPress={(product) =>
            navigation.navigate("Product Details", { productId: product.id })
          }
          onSeeAll={() => navigation.navigate("Search")}
        />

        {/* ORDER SUMMARY */}
        <Card style={{ marginTop: 18 }}>
          <Text style={s.summaryTitle}>Order summary</Text>

          <SummaryRow label="Subtotal" value={subtotal} currency={currency} />

          <SummaryRow
            label="Shipping"
            value={
              shipping === 0 && shippingInfo?.free_shipping_enabled
                ? "FREE"
                : shipping
            }
            currency={currency}
          />

          {discount > 0 ? (
            <SummaryRow
              label={`Discount (${appliedCoupon.code})`}
              value={-discount}
              currency={currency}
              green
            />
          ) : null}

          <Divider />

          <SummaryRow
            label="Total amount"
            value={payableTotal}
            strong
            green
            currency={currency}
          />
        </Card>

        {/* MINIMUM ORDER */}
        {shippingInfo && !shippingInfo.allowed ? (
          <Card accent>
            <Text style={s.name}>
              Minimum order: {currency} {minimum}
            </Text>

            <Text style={s.muted}>
              You need {currency} {(minimum - subtotal).toFixed(0)} more to
              place your order.
            </Text>
          </Card>
        ) : null}

        {/* PLACE ORDER */}
        <Button
          title={
            method === "jazzcash"
              ? "Continue to JazzCash"
              : `Place order • ${money(payableTotal)}`
          }
          onPress={place}
          loading={busy}
          disabled={Boolean(shippingInfo && !shippingInfo.allowed)}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  arrow: {
    fontSize: 28,
    color: theme.colors.muted,
  },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    color: "#fff",
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
  },

  cityText: {
    fontSize: 11,
    color: theme.colors.primaryDark,
    fontWeight: "700",
    marginTop: 3,
  },

  /* ACTIVE COUPON */
  activeCouponCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },

  activeCouponIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  activeCouponIconText: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.primary,
  },

  activeCouponContent: {
    flex: 1,
  },

  activeCouponTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.primary,
  },

  activeCouponCode: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 2,
  },

  activeCouponSaving: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: "700",
    marginTop: 2,
  },

  removeCouponButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  /* COUPON HEADER */
  couponHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
  },

  couponHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  couponHeaderIconText: {
    fontSize: 19,
    fontWeight: "900",
    color: theme.colors.primary,
  },

  couponHeaderContent: {
    flex: 1,
  },

  couponTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
  },

  couponSubtitle: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 3,
  },

  couponChevron: {
    fontSize: 26,
    color: theme.colors.muted,
    marginLeft: 8,
  },

  couponExpandedArea: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  /* COUPON INPUT */
  couponInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  couponApplyButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  couponApplyText: {
    color: "#fff",
    fontWeight: "900",
  },

  /* AVAILABLE COUPONS */
  availableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },

  availableTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
  },

  availableCount: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: "900",
  },

  couponList: {
    gap: 8,
    paddingBottom: 4,
  },

  couponMini: {
    width: 145,
    minHeight: 88,
    padding: 11,
    borderRadius: 13,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: "#CDEDD9",
  },

  couponMiniTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  couponMiniCode: {
    fontWeight: "900",
    color: theme.colors.primaryDark,
    fontSize: 13,
  },

  couponMiniArrow: {
    fontSize: 20,
    color: theme.colors.primary,
    fontWeight: "900",
  },

  couponMiniValue: {
    fontWeight: "900",
    color: theme.colors.primary,
    fontSize: 12,
    marginTop: 6,
  },

  couponMiniMin: {
    fontSize: 10,
    color: theme.colors.muted,
    marginTop: 3,
  },

  noCoupons: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 14,
  },

  /* COMMON */
  defaultText: {
    fontSize: 9,
    color: theme.colors.primary,
    fontWeight: "900",
  },

  option: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
  },

  optionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },

  paymentIcon: {
    fontSize: 24,
    marginRight: 12,
  },

  paymentOption: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: theme.colors.primary,
  },

  remove: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: "800",
  },

  slot: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  name: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },

  muted: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },

  summaryTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },
});
