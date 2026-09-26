import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { money } from "../utils/format";
import {
  Card,
  Divider,
  Empty,
  Header,
} from "../components/UI";
import {
  screen,
  useOrderSync,
  timeLabel,
} from "../utils/screenHelpers";

export function RiderOrdersScreen({ navigation }) {
  const [o, setO] = useState([]);
  const [selectedTab, setSelectedTab] = useState("today");
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(
    (silent = false) => {
      // Initial load shows loader
      if (!silent) {
        setLoading(true);
      }

      return api
        .get("/rider/orders")
        .then((r) => {
          setO(r.data || []);
        })
        .catch((e) => {
          if (!silent) {
            Alert.alert(
              "Rider orders",
              apiError(e),
            );
          }
        })
        .finally(() => {
          if (!silent) {
            setLoading(false);
          }
        });
    },
    [],
  );

  useOrderSync(load);

  // Get Karachi date in YYYY-MM-DD format
  const getKarachiDate = (offset = 0) => {
    const now = new Date();

    const parts = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(now);

    const year = Number(
      parts.find(
        (x) => x.type === "year",
      )?.value,
    );

    const month = Number(
      parts.find(
        (x) => x.type === "month",
      )?.value,
    );

    const day = Number(
      parts.find(
        (x) => x.type === "day",
      )?.value,
    );

    const date = new Date(
      Date.UTC(
        year,
        month - 1,
        day + offset,
      ),
    );

    return date
      .toISOString()
      .slice(0, 10);
  };

  const today = getKarachiDate(0);

  // Today's remaining / undelivered order count
  const todayCount = useMemo(() => {
    return o.filter(
      (item) =>
        item.delivery_date === today &&
        String(item.status).toLowerCase() !==
          "delivered",
    ).length;
  }, [o, today]);

  // Filter orders according to selected tab
  const filteredOrders = useMemo(() => {
    if (selectedTab === "today") {
      return o.filter(
        (item) =>
          item.delivery_date === today,
      );
    }

    return o;
  }, [o, selectedTab, today]);

  /*
   * GROUP + SORT ORDERS
   *
   * 1. Delivery date DESCENDING
   * 2. Active orders first
   * 3. Delivered orders last
   * 4. Order ID DESCENDING
   */
  const groupedOrders = useMemo(() => {
    const groups = {};

    filteredOrders.forEach((item) => {
      const date =
        item.delivery_date ||
        "unknown";

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(item);
    });

    return Object.entries(groups)
      // DATE DESCENDING
      .sort(([dateA], [dateB]) => {
        if (dateA === "unknown") {
          return 1;
        }

        if (dateB === "unknown") {
          return -1;
        }

        return dateB.localeCompare(
          dateA,
        );
      })
      .map(([date, orders]) => {
        const sortedOrders = [
          ...orders,
        ].sort((a, b) => {
          const aDelivered =
            String(
              a.status,
            ).toLowerCase() ===
            "delivered";

          const bDelivered =
            String(
              b.status,
            ).toLowerCase() ===
            "delivered";

          // Active first
          if (
            aDelivered &&
            !bDelivered
          ) {
            return 1;
          }

          if (
            !aDelivered &&
            bDelivered
          ) {
            return -1;
          }

          // Order ID descending
          const idA =
            Number(a.id) || 0;

          const idB =
            Number(b.id) || 0;

          return idB - idA;
        });

        return [
          date,
          sortedOrders,
        ];
      });
  }, [filteredOrders]);

  // Format:
  // Monday, 14-09-2026
  const formatDateHeading = (
    dateString,
  ) => {
    if (
      !dateString ||
      dateString === "unknown"
    ) {
      return "Date not available";
    }

    const [
      year,
      month,
      day,
    ] = dateString
      .split("-")
      .map(Number);

    const date = new Date(
      year,
      month - 1,
      day,
    );

    const weekday =
      date.toLocaleDateString(
        "en-US",
        {
          weekday: "long",
        },
      );

    return `${weekday}, ${String(
      day,
    ).padStart(
      2,
      "0",
    )}-${String(
      month,
    ).padStart(
      2,
      "0",
    )}-${year}`;
  };

  return (
    <View style={screen}>
      <Header
        title="Rider dashboard"
        subtitle="Orders by delivery day"
      />

      {/* DATE TABS */}
      <View
        style={s.tabsContainer}
      >
        {[
          {
            key: "today",
            label: `Today (${todayCount})`,
          },
          {
            key: "all",
            label: "All",
          },
        ].map((tab) => {
          const active =
            selectedTab ===
            tab.key;

          return (
            <Pressable
              key={tab.key}
              onPress={() =>
                setSelectedTab(
                  tab.key,
                )
              }
              style={[
                s.tab,
                active &&
                  s.activeTab,
              ]}
            >
              <Text
                style={[
                  s.tabText,
                  active &&
                    s.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* LOADING */}
      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#16803C"
          />

          <Text style={s.loadingText}>
            Loading orders...
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedOrders}
          keyExtractor={([date]) =>
            date
          }
          contentContainerStyle={
            s.listPad
          }
          showsVerticalScrollIndicator={
            false
          }
          renderItem={({
            item: [
              date,
              orders,
            ],
          }) => (
            <View
              style={
                s.dateGroup
              }
            >
              {/* DATE HEADER */}
              <View
                style={
                  s.dateHeader
                }
              >
                <Text
                  style={
                    s.dateTitle
                  }
                >
                  {formatDateHeading(
                    date,
                  )}
                </Text>

                <View
                  style={
                    s.dateCountBox
                  }
                >
                  <Text
                    style={
                      s.dateCount
                    }
                  >
                    {
                      orders.length
                    }
                  </Text>
                </View>
              </View>

              {/* ORDERS */}
              {orders.map(
                (item) => {
                  const isDelivered =
                    String(
                      item.status,
                    ).toLowerCase() ===
                    "delivered";

                  return (
                    <Pressable
                      key={String(
                        item.id,
                      )}
                      disabled={
                        isDelivered
                      }
                      onPress={() =>
                        navigation.navigate(
                          "Rider Order Details",
                          {
                            orderId:
                              item.id,
                          },
                        )
                      }
                    >
                      <Card
                        style={[
                          s.orderCard,
                          isDelivered &&
                            s.deliveredCard,
                        ]}
                      >
                        {/* ORDER INFORMATION */}
                        <View
                          style={
                            s.row
                          }
                        >
                          <View
                            style={{
                              flex: 1,
                            }}
                          >
                            <Text
                              style={[
                                s.name,
                                isDelivered &&
                                  s.deliveredName,
                              ]}
                            >
                              {
                                item.order_number
                              }
                            </Text>

                            <Text
                              style={[
                                s.muted,
                                isDelivered &&
                                  s.deliveredMuted,
                              ]}
                            >
                              {timeLabel(
                                item.slot_start_time,
                              )}{" "}
                              -{" "}
                              {timeLabel(
                                item.slot_end_time,
                              )}
                            </Text>

                            <Text
                              style={[
                                s.muted,
                                isDelivered &&
                                  s.deliveredMuted,
                              ]}
                            >
                              {item.payment_method ===
                              "cod"
                                ? "COD"
                                : "JazzCash"}
                            </Text>
                          </View>
                        </View>

                        <Divider />

                        {/* TOTAL */}
                        <View
                          style={
                            s.row
                          }
                        >
                          <Text
                            style={[
                              s.muted,
                              isDelivered &&
                                s.deliveredMuted,
                            ]}
                          >
                            Total
                          </Text>

                          <Text
                            style={[
                              s.orderTotal,
                              isDelivered &&
                                s.deliveredTotal,
                            ]}
                          >
                            {money(
                              item.total,
                            )}
                          </Text>
                        </View>

                        {/* STATUS */}
                        <Text
                          style={[
                            s.statusText,
                            isDelivered
                              ? s.deliveredStatus
                              : s.activeStatus,
                          ]}
                        >
                          {isDelivered
                            ? "✓ Delivered"
                            : `✓ ${item.status}`}
                        </Text>
                      </Card>
                    </Pressable>
                  );
                },
              )}
            </View>
          )}
          ListEmptyComponent={
            <Empty
              text={
                selectedTab ===
                "today"
                  ? "No deliveries for today."
                  : "No deliveries assigned."
              }
              icon="🚴"
            />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  /*
   * TABS
   */
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },

  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dfe7e1",
    backgroundColor: "#ffffff",
  },

  activeTab: {
    backgroundColor: "#16803C",
    borderColor: "#16803C",
  },

  tabText: {
    fontWeight: "700",
    color: "#16803C",
  },

  activeTabText: {
    color: "#ffffff",
  },

  /*
   * LOADING
   */
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
   * LIST
   */
  listPad: {
    padding: 16,
    paddingTop: 4,
    gap: 12,
  },

  dateGroup: {
    marginBottom: 8,
  },

  /*
   * DATE HEADER
   */
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  dateTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.text,
  },

  dateCountBox: {
    minWidth: 32,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      theme.colors.primarySoft,
  },

  dateCount: {
    fontSize: 13,
    fontWeight: "900",
    color:
      theme.colors.primaryDark,
  },

  /*
   * ORDER CARD
   */
  orderCard: {
    marginBottom: 10,
  },

  deliveredCard: {
    backgroundColor: "#f1f3f2",
    borderColor: "#d5d9d7",
    opacity: 0.92,
  },

  /*
   * ROW
   */
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  /*
   * TEXT
   */
  name: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
  },

  deliveredName: {
    color: "#6b7280",
  },

  muted: {
    fontSize: 12,
    color:
      theme.colors.muted ||
      "#66736b",
    marginTop: 3,
  },

  deliveredMuted: {
    color: "#8a918d",
  },

  /*
   * TOTAL
   */
  orderTotal: {
    fontSize: 17,
    fontWeight: "900",
    color:
      theme.colors.primaryDark,
  },

  deliveredTotal: {
    color: "#16803C",
  },

  /*
   * STATUS
   */
  statusText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },

  activeStatus: {
    color: "#D97706",
  },

  deliveredStatus: {
    color: "#16803C",
  },

  /*
   * KEPT FOR COMPATIBILITY
   */
  addressPreview: {
    color: theme.colors.text,
    fontSize: 12,
    marginTop: 13,
    lineHeight: 18,
  },
});