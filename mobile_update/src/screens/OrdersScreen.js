import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
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
  Loader,
  StatusPill,
} from "../components/UI";

import {
  screen,
  fmtStatus,
  useOrderSync,
  timeLabel,
} from "../utils/screenHelpers";

export function OrdersScreen({ navigation }) {
  const [o, setO] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /*
   * Load orders
   *
   * silent = false
   * Shows the full-screen loader.
   *
   * silent = true
   * Used by useOrderSync() so polling doesn't
   * interrupt the user's screen.
   */
  const load = useCallback((silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    return api
      .get("/orders")
      .then((r) => {
        setO(r.data || []);
      })
      .catch((e) => {
        if (!silent) {
          Alert.alert("Orders", apiError(e));
        }
      })
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  }, []);

  /*
   * Existing automatic order polling.
   * This continues to work while the user is
   * viewing the Orders screen.
   */
  useOrderSync(load);

  /*
   * Pull down to refresh
   */
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      await api
        .get("/orders")
        .then((r) => {
          setO(r.data || []);
        })
        .catch((e) => {
          Alert.alert("Orders", apiError(e));
        });
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Format date with day name
  // Example: Sunday, September 13, 2026
  const formatOrderDay = (date) => {
    if (!date) return "Unknown date";

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Group orders by delivery date
  const groupedOrders = useMemo(() => {
    const groups = {};

    o.forEach((order) => {
      const date = order.delivery_date || "Unknown date";

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(order);
    });

    return Object.entries(groups).sort(([dateA], [dateB]) => {
      if (dateA === "Unknown date") return 1;
      if (dateB === "Unknown date") return -1;

      return new Date(`${dateB}T00:00:00`) - new Date(`${dateA}T00:00:00`);
    });
  }, [o]);

  return (
    <View style={screen}>
      <Header title="My Orders" subtitle="Track every FreshCart delivery" />

      {loading ? (
        <View style={s.loaderContainer}>
          <Loader label="Loading orders..." />
        </View>
      ) : (
        <FlatList
          data={groupedOrders}
          keyExtractor={([date]) => String(date)}
          contentContainerStyle={s.listPad}
          showsVerticalScrollIndicator={false}
          /*
           * Pull down from the top of the Orders page
           * to manually refresh orders.
           */
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              title="Refreshing orders..."
              titleColor={theme.colors.muted}
            />
          }
          renderItem={({ item: [date, orders] }) => (
            <View>
              {/* Day / Date Header */}
              <Text style={s.dayHeader}>{formatOrderDay(date)}</Text>

              {orders.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    navigation.navigate("Order Details", {
                      orderId: item.id,
                    })
                  }
                >
                  <Card style={s.orderCard}>
                    <View style={s.row}>
                      <View>
                        <Text style={s.name}>{item.order_number}</Text>

                        <Text style={s.muted}>
                          {timeLabel(item.slot_start_time)} -{" "}
                          {timeLabel(item.slot_end_time)}
                        </Text>

                        <Text style={s.muted}>
                          {fmtStatus(item.payment_method)}
                        </Text>
                      </View>

                      <StatusPill status={item.status} />
                    </View>

                    <Divider />

                    <View style={s.row}>
                      <Text style={s.muted}>Order total</Text>

                      <Text style={s.orderTotal}>{money(item.total)}</Text>
                    </View>

                    <Text style={s.viewDetails}>View details ›</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <Empty text="You haven't placed any orders yet." icon="📦" />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  dayHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    color: "#222",
  },

  listPad: {
    padding: 16,
    gap: 12,
    paddingBottom: 110,
  },

  orderCard: {
    marginBottom: 10,
  },

  orderTotal: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  viewDetails: {
    color: theme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 10,
  },
});
