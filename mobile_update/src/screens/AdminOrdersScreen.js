import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Print from "expo-print";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { money, sizeLabel } from "../utils/format";
import { Card, Header, StatusPill } from "../components/UI";
import { screen, timeLabel } from "../utils/screenHelpers";

export function AdminOrdersScreen() {
  const [o, setO] = useState([]);
  const [eligible, setEligible] = useState({});
  const [assigning, setAssigning] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("pending");

  const load = async () => {
    try {
      setLoading(true);

      const response = await api.get("/admin/orders");

      setO(response.data || []);
    } catch (e) {
      Alert.alert("Orders", apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (id, status) => {
    try {
      await api.put(`/admin/orders/${id}/status`, { status });
      load();
    } catch (e) {
      Alert.alert("Order status", apiError(e));
    }
  };

  const loadEligible = async (id) => {
    try {
      setAssigning(id);

      const response = await api.get(`/admin/orders/${id}/eligible-riders`);

      setEligible((current) => ({
        ...current,
        [id]: response.data || [],
      }));
    } catch (e) {
      Alert.alert("Eligible riders", apiError(e));
    } finally {
      setAssigning(null);
    }
  };

  const assign = async (orderId, riderId) => {
    try {
      await api.post(`/admin/orders/${orderId}/assign-rider`, {
        rider_id: riderId,
      });

      Alert.alert("Rider assigned", "The rider has been notified.");

      load();
    } catch (e) {
      Alert.alert("Assign rider", apiError(e));
    }
  };

  const printOrder = async (id) => {
    try {
      const { data } = await api.get(`/orders/${id}`);

      const escapeHtml = (value) =>
        String(value ?? "—")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      const rows = (data.items || [])
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.product_name)}</td>
            <td>${escapeHtml(item.size_label || sizeLabel(item.size_ml, item.unit_type))}</td>
            <td>${item.quantity}</td>
            <td>${escapeHtml(money(item.unit_price))}</td>
            <td>${escapeHtml(money(item.item_total))}</td>
          </tr>`,
        )
        .join("");

      const discount = Number(data.discount || 0);

      await Print.printAsync({
        html: `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{
  font-family:Arial,sans-serif;
  color:#17211b;
  padding:24px
}
h1{
  text-align:center;
  color:#0b3d26;
  margin:0
}
h2{
  text-align:center;
  font-size:14px;
  font-weight:400;
  margin:4px 0 20px
}
h3{
  border-bottom:1px solid #dfe7e1;
  padding-bottom:8px
}
.info{
  line-height:1.8;
  border-bottom:1px solid #dfe7e1;
  padding-bottom:16px
}
table{
  width:100%;
  border-collapse:collapse;
  margin-top:18px
}
th,td{
  text-align:left;
  border-bottom:1px solid #e4ebe6;
  padding:9px 5px;
  font-size:12px
}
th{
  background:#f5faf7
}
.summary{
  margin:20px 0 0 auto;
  width:240px;
  line-height:1.9
}
.total{
  border-top:2px solid #0b3d26;
  margin-top:6px;
  padding-top:6px;
  font-size:18px;
  font-weight:700
}
</style>
</head>

<body>

<h1>FRESHCART</h1>

<h2>
GROCERY DELIVERY<br>
ORDER SLIP
</h2>

<h3>Order Information</h3>

<div class="info">

<b>Customer:</b>
${escapeHtml(data.customer_name || `Customer #${data.user_id}`)}
<br>

<b>Order ID:</b>
${data.id}
<br>

<b>Order Number:</b>
${escapeHtml(data.order_number)}
<br>

<b>Delivery Location:</b>
${escapeHtml(data.delivery_address)}
<br>

<b>Delivery Slot:</b>
${escapeHtml(timeLabel(data.slot_start_time))}
-
${escapeHtml(timeLabel(data.slot_end_time))}
<br>

<b>Payment:</b>
${data.payment_method === "jazzcash" ? "JazzCash" : "COD"}

</div>

<table>

<thead>
<tr>
<th>Product</th>
<th>Size</th>
<th>Qty</th>
<th>Unit Price</th>
<th>Total</th>
</tr>
</thead>

<tbody>
${rows}
</tbody>

</table>

<div class="summary">

<div>
Subtotal:
<b>${escapeHtml(money(data.subtotal))}</b>
</div>

<div>
Shipping:
<b>${escapeHtml(money(data.shipping))}</b>
</div>

${
  discount > 0
    ? `<div>
        Discount:
        <b>${escapeHtml(money(discount))}</b>
      </div>`
    : ""
}

<div class="total">
Total Bill:
${escapeHtml(money(data.total))}
</div>

</div>

</body>
</html>`,
      });
    } catch (error) {
      Alert.alert("Print order", apiError(error));
    }
  };

  /*
   * Get order date
   */
  const getOrderDate = (item) => {
    return (
      item.delivery_date ||
      item.slot_start_time ||
      item.slot_end_time ||
      item.order_date ||
      item.created_at ||
      item.createdAt
    );
  };

  /*
   * Date key
   */
  const getDateKey = (item) => {
    const value = getOrderDate(item);

    if (!value) {
      return "unknown";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "unknown";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  /*
   * Date heading
   */
  const formatDateHeading = (item) => {
    const value = getOrderDate(item);

    if (!value) {
      return "Date not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Date not available";
    }

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  /*
   * ============================================================
   * TAB FILTER
   * ============================================================
   *
   * Pending:
   * everything except delivered
   *
   * Delivered:
   * only delivered
   */
  const filteredOrders = useMemo(() => {
    return o.filter((item) => {
      const isDelivered = String(item.status).toLowerCase() === "delivered";

      if (activeTab === "delivered") {
        return isDelivered;
      }

      return !isDelivered;
    });
  }, [o, activeTab]);

  /*
   * TAB COUNTS
   */
  const pendingCount = useMemo(() => {
    return o.filter((item) => String(item.status).toLowerCase() !== "delivered")
      .length;
  }, [o]);

  const deliveredCount = useMemo(() => {
    return o.filter((item) => String(item.status).toLowerCase() === "delivered")
      .length;
  }, [o]);

  /*
   * GROUP FILTERED ORDERS BY DATE
   */
  const groupedOrders = useMemo(() => {
    const sorted = [...filteredOrders].sort((a, b) => {
      const dateA = new Date(getOrderDate(a) || 0).getTime();

      const dateB = new Date(getOrderDate(b) || 0).getTime();

      const dateDifference = dateB - dateA;

      if (dateDifference !== 0) {
        return dateDifference;
      }

      const idA = Number(a.id) || 0;
      const idB = Number(b.id) || 0;

      return idB - idA;
    });

    const groups = [];

    sorted.forEach((item) => {
      const dateKey = getDateKey(item);

      let group = groups.find((x) => x.dateKey === dateKey);

      if (!group) {
        group = {
          dateKey,
          dateLabel: formatDateHeading(item),
          orders: [],
        };

        groups.push(group);
      }

      group.orders.push(item);
    });

    return groups;
  }, [filteredOrders]);

  return (
    <View style={screen}>
      <Header title="Orders" subtitle="Operations & fulfilment" />

      {/* =====================================================
          PENDING / DELIVERED TABS
          ===================================================== */}
      <View style={s.tabsContainer}>
        {/* PENDING TAB */}
        <Pressable
          style={[s.tab, activeTab === "pending" && s.activeTab]}
          onPress={() => setActiveTab("pending")}
        >
          <View style={s.tabContent}>
            <Text
              style={[s.tabText, activeTab === "pending" && s.activeTabText]}
            >
              Pending Orders
            </Text>

            <View
              style={[s.tabCount, activeTab === "pending" && s.activeTabCount]}
            >
              <Text
                style={[
                  s.tabCountText,
                  activeTab === "pending" && s.activeTabCountText,
                ]}
              >
                {pendingCount}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* DELIVERED TAB */}
        <Pressable
          style={[s.tab, activeTab === "delivered" && s.activeTab]}
          onPress={() => setActiveTab("delivered")}
        >
          <View style={s.tabContent}>
            <Text
              style={[s.tabText, activeTab === "delivered" && s.activeTabText]}
            >
              Delivered Orders
            </Text>

            <View
              style={[
                s.tabCount,
                activeTab === "delivered" && s.activeTabCount,
              ]}
            >
              <Text
                style={[
                  s.tabCountText,
                  activeTab === "delivered" && s.activeTabCountText,
                ]}
              >
                {deliveredCount}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryDark} />

          <Text style={s.loadingText}>Loading orders...</Text>
        </View>
      ) : groupedOrders.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyTitle}>
            {activeTab === "pending"
              ? "No pending orders"
              : "No delivered orders"}
          </Text>

          <Text style={s.emptyText}>
            {activeTab === "pending"
              ? "All orders have been delivered."
              : "Delivered orders will appear here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedOrders}
          keyExtractor={(group) => group.dateKey}
          contentContainerStyle={s.listPad}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: group }) => (
            <View>
              {/* DATE HEADER */}
              <View style={s.dateHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.dateTitle}>{group.dateLabel}</Text>

                  <Text style={s.dateSubtitle}>
                    {activeTab === "pending"
                      ? "Pending delivery orders"
                      : "Delivered orders"}
                  </Text>
                </View>

                <View style={s.orderCountBox}>
                  <Text style={s.orderCount}>{group.orders.length}</Text>

                  <Text style={s.orderCountLabel}>
                    {group.orders.length === 1 ? "Order" : "Orders"}
                  </Text>
                </View>
              </View>

              {/* ORDERS */}
              {group.orders.map((item) => {
                const isDelivered =
                  String(item.status).toLowerCase() === "delivered";

                return (
                  <Card
                    key={String(item.id)}
                    style={[s.adminOrder, isDelivered && s.deliveredOrder]}
                  >
                    {/* DELIVERED LABEL */}
                    {isDelivered && (
                      <View style={s.deliveredBanner}>
                        <Text style={s.deliveredBannerText}>
                          ✓ ORDER DELIVERED
                        </Text>
                      </View>
                    )}

                    {/* ORDER HEADER */}
                    <View style={s.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.name}>{item.order_number}</Text>

                        <Text style={s.muted}>Customer #{item.user_id}</Text>
                      </View>

                      <StatusPill status={item.status} />
                    </View>

                    {/* ADDRESS */}
                    <Text style={s.addressPreview}>
                      📍 {item.delivery_address}
                    </Text>

                    {/* DELIVERY TIME */}
                    <View
                      style={[
                        s.deliveryTimeBox,
                        isDelivered && s.deliveredTimeBox,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.deliveryTimeLabel}>DELIVERY TIME</Text>

                        <Text style={s.deliveryTime}>
                          {timeLabel(item.slot_start_time)}
                          {" - "}
                          {timeLabel(item.slot_end_time)}
                        </Text>
                      </View>

                      {isDelivered && (
                        <Text style={s.completedText}>Completed</Text>
                      )}
                    </View>

                    {/* PAYMENT + TOTAL */}
                    <View style={s.row}>
                      <Text style={s.muted}>
                        {item.payment_method === "cod"
                          ? "Cash on delivery"
                          : "JazzCash"}
                      </Text>

                      <Text style={s.orderTotal}>{money(item.total)}</Text>
                    </View>

                    {/* ACTIONS */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      {[
                        "confirmed",
                        "preparing",
                        "assigned",
                        "out_for_delivery",
                        "delivered",
                      ].map((st) => (
                        <Pressable
                          key={st}
                          style={[
                            s.statusAction,
                            st === "delivered" && s.deliveredAction,
                          ]}
                          onPress={() => update(item.id, st)}
                        >
                          <Text
                            style={
                              st === "delivered"
                                ? s.deliveredActionText
                                : undefined
                            }
                          >
                            {st === "out_for_delivery"
                              ? "Out for delivery"
                              : st}
                          </Text>
                        </Pressable>
                      ))}

                      {/* PRINT */}
                      <Pressable
                        style={s.statusAction}
                        onPress={() => printOrder(item.id)}
                      >
                        <Text>Print</Text>
                      </Pressable>

                      {/* ASSIGN RIDER */}
                      <Pressable
                        style={s.statusAction}
                        onPress={() => loadEligible(item.id)}
                        disabled={assigning === item.id}
                      >
                        <Text>
                          {assigning === item.id
                            ? "Loading..."
                            : "Assign rider"}
                        </Text>
                      </Pressable>
                    </ScrollView>

                    {/* ASSIGNED RIDER */}
                    {item.rider_name ? (
                      <Text style={s.muted}>
                        Assigned rider: {item.rider_name}
                      </Text>
                    ) : null}

                    {/* ELIGIBLE RIDERS */}
                    {eligible[item.id]?.length > 0 && (
                      <View
                        style={{
                          marginTop: 10,
                        }}
                      >
                        <Text style={s.label}>
                          Eligible riders for {timeLabel(item.slot_start_time)}{" "}
                          - {timeLabel(item.slot_end_time)}
                        </Text>

                        {eligible[item.id].map((rider) => (
                          <Pressable
                            key={rider.id}
                            style={s.adminAction}
                            onPress={() => assign(item.id, rider.id)}
                          >
                            <View
                              style={{
                                flex: 1,
                              }}
                            >
                              <Text style={s.name}>{rider.name}</Text>

                              <Text style={s.muted}>
                                {rider.phone || "No phone"} •{" "}
                                {rider.vehicle_type || "Vehicle"}{" "}
                                {rider.vehicle_number || ""}
                              </Text>
                            </View>

                            <Text style={s.muted}>
                              {rider.active_orders} active
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}

                    {/* NO RIDER */}
                    {eligible[item.id] && eligible[item.id].length === 0 && (
                      <Text style={s.muted}>
                        No active, available rider is allocated to this slot.
                      </Text>
                    )}
                  </Card>
                );
              })}
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },

  /*
   * ==========================================================
   * TABS
   * ==========================================================
   */

  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: "#EEF5F0",
    borderRadius: 14,
    padding: 4,
  },

  tab: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },

  activeTab: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  tabText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.muted || "#66736b",
  },

  activeTabText: {
    color: theme.colors.primaryDark,
  },

  tabCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDE8E0",
    paddingHorizontal: 5,
  },

  activeTabCount: {
    backgroundColor: theme.colors.primaryDark,
  },

  tabCountText: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.text,
  },

  activeTabCountText: {
    color: "#fff",
  },

  /*
   * EMPTY STATE
   */

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 80,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.text,
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
    color: theme.colors.muted || "#66736b",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  listPad: {
    padding: 16,
    gap: 12,
  },

  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 4,
    marginBottom: 10,
  },

  dateTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  dateSubtitle: {
    fontSize: 11,
    color: theme.colors.text,
    marginTop: 2,
  },

  orderCountBox: {
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },

  orderCount: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  orderCountLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: theme.colors.text,
  },

  adminOrder: {
    marginBottom: 10,
  },

  deliveredOrder: {
    backgroundColor: "#EAF7EE",
    borderWidth: 1,
    borderColor: "#8BC99A",
  },

  deliveredBanner: {
    backgroundColor: "#D4F0DC",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 11,
    alignSelf: "flex-start",
  },

  deliveredBannerText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#237A3B",
    letterSpacing: 0.4,
  },

  name: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
  },

  muted: {
    fontSize: 12,
    color: theme.colors.muted || "#66736b",
    marginTop: 3,
  },

  addressPreview: {
    color: theme.colors.text,
    fontSize: 12,
    marginTop: 13,
    lineHeight: 18,
  },

  deliveryTimeBox: {
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: "#F5FAF7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  deliveredTimeBox: {
    backgroundColor: "#DDF2E2",
  },

  deliveryTimeLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: theme.colors.primaryDark,
    marginBottom: 2,
  },

  deliveryTime: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.text,
  },

  completedText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#237A3B",
  },

  orderTotal: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  statusAction: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  deliveredAction: {
    backgroundColor: "#D4F0DC",
  },

  deliveredActionText: {
    color: "#237A3B",
    fontWeight: "800",
  },

  adminAction: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  label: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
    marginBottom: 8,
  },
});
