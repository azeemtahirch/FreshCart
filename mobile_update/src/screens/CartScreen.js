
import React, { useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useCart } from "../context/CartContext";
import { theme } from "../theme/theme";
import { money, sizeLabel } from "../utils/format";

import {
  Button,
  Card,
  Divider,
  Empty,
  Header,
  Qty,
  SummaryRow,
} from "../components/UI";

import Toast from "react-native-toast-message";

import {
  screen,
  pad,
} from "../utils/screenHelpers";

export function CartScreen({ navigation }) {
  const {
    items,
    change,
    remove,
    subtotal,
    shipping,
    total,
    shippingInfo,
    refreshShipping,
    getItemPrice,
  } = useCart();

  const minimum = Number(
    shippingInfo?.minimum_order ?? 0,
  );

  const threshold = Number(
    shippingInfo?.free_shipping_threshold ?? 0,
  );

  const currency =
    shippingInfo?.currency || "PKR";

  const remaining = Math.max(
    0,
    minimum - subtotal,
  );

  const shippingTiers =
    shippingInfo?.shipping_tiers || [];

  const feeAt = (amount) =>
    Number(
      shippingTiers.find(
        (tier) =>
          amount >= Number(tier.min_amount) &&
          (!Number(tier.max_amount) ||
            amount < Number(tier.max_amount)),
      )?.fee ??
        shippingInfo?.shipping_fee ??
        shipping,
    );

  const deliveryStages = [
    {
      amount: 250,
      fee: feeAt(250),
      color: "#F59E0B",
    },
    {
      amount: 500,
      fee: feeAt(500),
      color: "#3B82F6",
    },
    {
      amount: 1000,
      fee: feeAt(1000),
      color: "#20A464",
    },
  ];

  const activeStage = deliveryStages.reduce(
    (current, stage, index) =>
      subtotal >= stage.amount
        ? index
        : current,
    -1,
  );

  const nextStage =
    deliveryStages[activeStage + 1];

  const freeShipping =
    shipping === 0 &&
    shippingInfo?.free_shipping_enabled &&
    subtotal >= threshold;

  const deliveryMessage =
    remaining > 0
      ? `Add ${money(
          remaining,
          currency,
        )} more to place your order.`
      : freeShipping
        ? "🎉 You unlocked FREE shipping"
        : nextStage
          ? `Add ${money(
              nextStage.amount -
                subtotal,
              currency,
            )} more to get ${money(
              nextStage.fee,
              currency,
            )} shipping`
          : `🎉 You unlocked ${money(
              deliveryStages[2].fee,
              currency,
            )} shipping`;

  useFocusEffect(
    useMemo(
      () => () => {
        refreshShipping().catch(() => {});
      },
      [refreshShipping],
    ),
  );

  return (
    <View style={screen}>
      <Header
        title="My Cart"
        subtitle={`${items.length} item${
          items.length === 1 ? "" : "s"
        }`}
      />

      {items.length === 0 ? (
        <Empty
          text="Your cart is empty. Add something fresh!"
          icon="🛒"
        />
      ) : (
        <ScrollView contentContainerStyle={pad}>
          {/* Delivery Charges */}
          <Card style={s.shippingCard}>
            <View style={s.shippingHead}>
              <Text style={s.deliveryTitle}>
                Delivery Charges
              </Text>

              <View style={s.deliveryInfo}>
                <Text
                  style={s.deliveryInfoText}
                >
                  i
                </Text>
              </View>
            </View>

            <View style={s.deliveryStages}>
              {deliveryStages.map(
                (stage, index) => {
                  const reached =
                    index <= activeStage;

                  return (
                    <View
                      key={stage.amount}
                      style={
                        s.deliveryStage
                      }
                    >
                      <View
                        style={[
                          s.deliveryStageLine,
                          {
                            backgroundColor:
                              stage.color,
                            opacity:
                              reached
                                ? 1
                                : 0.22,
                          },
                        ]}
                      />

                      <View
                        style={[
                          s.deliveryMarker,
                          {
                            borderColor:
                              stage.color,
                            backgroundColor:
                              reached
                                ? stage.color
                                : "#FFFFFF",
                          },
                        ]}
                      >
                        {reached && (
                          <Text
                            style={
                              s.deliveryCheck
                            }
                          >
                            ✓
                          </Text>
                        )}
                      </View>

                      <Text
                        style={[
                          s.deliveryStageAmount,
                          reached && {
                            color:
                              stage.color,
                          },
                        ]}
                      >
                        {money(
                          stage.amount,
                          currency,
                        )}
                        {index === 2
                          ? "+"
                          : ""}
                      </Text>

                      <Text
                        style={
                          s.deliveryStageFee
                        }
                      >
                        Delivery{" "}
                        {money(
                          stage.fee,
                          currency,
                        )}
                      </Text>
                    </View>
                  );
                },
              )}
            </View>

            <View
              style={
                s.deliveryMessageRow
              }
            >
              <Text
                style={
                  s.deliveryMessage
                }
              >
                {deliveryMessage}
              </Text>

              <Text
                style={
                  s.deliveryMessageIcon
                }
              >
                🛒
              </Text>
            </View>
          </Card>

          {/* Cart Items */}
          {items.map((x) => {
            const unitPrice =
              getItemPrice(x);

            const itemTotal =
              unitPrice *
              Number(x.quantity || 0);

            // Display label
            const itemSize =
              x.unit_type === "dozen"
                ? `${x.quantity > 1 ? x.quantity : 1} dozen`
                : x.size_label || sizeLabel(
                    x.size_ml,
                    x.unit_type,
                  );

            return (
              <Card
                key={`${x.product_id}-${x.size_ml}`}
                style={s.cartItem}
              >
                <Image
                  source={{
                    uri: x.image_url,
                  }}
                  style={s.cartImg}
                />

                <View
                  style={{ flex: 1 }}
                >
                  <Text style={s.name}>
                    {x.name}
                  </Text>

                  <Text style={s.muted}>
                    {itemSize} •{" "}
                    {money(
                      unitPrice,
                      currency,
                    )}{" "}
                    each
                  </Text>

                  <Text
                    style={
                      s.itemTotal
                    }
                  >
                    {money(
                      itemTotal,
                      currency,
                    )}
                  </Text>

                  <View
                    style={
                      s.cartActions
                    }
                  >
                    <Qty
                      value={x.quantity}
                      onMinus={() =>
                        change(
                          x.product_id,
                          x.size_ml,
                          -1,
                        )
                      }
                      onPlus={() => {
                        if (
                          x.quantity >= 5
                        ) {
                          Toast.show({
                            type: "error",
                            text1:
                              "Maximum Quantity",
                            text2:
                              "Only 5 units of this product can be added.",
                            position:
                              "bottom",
                          });

                          return;
                        }

                        change(
                          x.product_id,
                          x.size_ml,
                          1,
                        );
                      }}
                    />

                    <Pressable
                      onPress={() =>
                        remove(
                          x.product_id,
                          x.size_ml,
                        )
                      }
                    >
                      <Text
                        style={
                          s.remove
                        }
                      >
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          })}

          {/* Order Summary */}
          <Card style={s.summary}>
            <Text
              style={s.summaryTitle}
            >
              Order summary
            </Text>

            <SummaryRow
              label="Subtotal"
              value={subtotal}
              currency={currency}
            />

            <SummaryRow
              label="Shipping"
              value={
                shipping === 0 &&
                shippingInfo?.free_shipping_enabled
                  ? "FREE"
                  : shipping
              }
              currency={currency}
            />

            <Divider />

            <SummaryRow
              label="Total amount"
              value={total}
              strong
              green
              currency={currency}
            />

            <Button
              title={
                remaining > 0
                  ? `Add ${money(
                      remaining,
                      currency,
                    )} more`
                  : "Proceed to checkout"
              }
              disabled={
                remaining > 0
              }
              onPress={() =>
                navigation.navigate(
                  "Checkout",
                )
              }
            />
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cartActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginTop: 9,
  },

  cartImg: {
    width: 82,
    height: 82,
    borderRadius: 15,
    backgroundColor:
      theme.colors.primarySoft,
  },

  cartItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },

  deliveryCheck: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  deliveryInfo: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor:
      "#E0F2E7",
    alignItems: "center",
    justifyContent:
      "center",
  },

  deliveryInfoText: {
    color:
      theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },

  deliveryMarker: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 3,
    alignItems: "center",
    justifyContent:
      "center",
    zIndex: 1,
  },

  deliveryMessage: {
    color:
      theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
    lineHeight: 17,
  },

  deliveryMessageIcon: {
    fontSize: 17,
    marginLeft: 8,
  },

  deliveryMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    backgroundColor:
      "#EAF7EE",
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 9,
    marginTop: 15,
  },

  deliveryStage: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },

  deliveryStageAmount: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 7,
  },

  deliveryStageFee: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center",
  },

  deliveryStageLine: {
    position: "absolute",
    height: 5,
    borderRadius: 4,
    left: 0,
    right: 0,
    top: 8,
  },

  deliveryStages: {
    flexDirection: "row",
    marginTop: 18,
  },

  deliveryTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
  },

  itemTotal: {
    fontSize: 15,
    fontWeight: "900",
    color:
      theme.colors.primaryDark,
    marginTop: 4,
  },

  remove: {
    fontSize: 12,
    color: theme.colors.danger,
    fontWeight: "800",
  },

  shippingCard: {
    backgroundColor: "#F8FCF9",
    borderColor: "#E2F0E6",
    marginBottom: 12,
    shadowColor: "#174C2A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 2,
  },

  shippingHead: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  summary: {
    marginTop: 6,
    marginBottom: 20,
  },

  summaryTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },
});