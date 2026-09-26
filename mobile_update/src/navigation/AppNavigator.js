import React from "react";
import { Text, View } from "react-native";
import { AppIcon } from "../components/AppIcon";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import * as S from "../screens";
import { theme } from "../theme/theme";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const icon = (x, color) => <AppIcon name={x} size={22} color={color || theme.colors.text} />;
const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: "#8A958E",
  tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginBottom: 2 },
  tabBarStyle: {
    height: 68,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: "#fff",
    elevation: 8,
    shadowColor: "#153321",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  tabBarHideOnKeyboard: true,
};
const useInsetTabOptions = () => {
  const { bottom } = useSafeAreaInsets();
  return React.useMemo(
    () => ({
      ...tabOptions,
      tabBarStyle: {
        ...tabOptions.tabBarStyle,
        height: 68 + bottom,
        paddingBottom: 6 + bottom,
      },
    }),
    [bottom],
  );
};

function CustomerTabs() {
  const { items } = useCart();
  const insetTabOptions = useInsetTabOptions();
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);
  return (
    <Tabs.Navigator screenOptions={insetTabOptions}>
      <Tabs.Screen
        name="Home"
        component={S.HomeScreen}
        options={{ tabBarIcon: () => icon("⌂") }}
      />
      <Tabs.Screen
        name="Categories"
        component={S.CategoriesScreen}
        options={{ tabBarIcon: () => icon("▦") }}
      />
      <Tabs.Screen
        name="Cart"
        component={S.CartScreen}
        options={{
          title: "Basket",
          tabBarBadge: cartCount || undefined,
          tabBarIcon: () => icon("🛒"),
        }}
      />
      <Tabs.Screen
        name="Orders"
        component={S.OrdersScreen}
        options={{ tabBarIcon: () => icon("▣") }}
      />
      <Tabs.Screen
        name="Account"
        component={S.AccountScreen}
        options={{ title: "Profile", tabBarIcon: () => icon("♙") }}
      />
    </Tabs.Navigator>
  );
}
function RiderTabs() {
  const insetTabOptions = useInsetTabOptions();
  return (
    <Tabs.Navigator screenOptions={insetTabOptions}>
      <Tabs.Screen
        name="Rider Orders"
        component={S.RiderOrdersScreen}
        options={{ tabBarIcon: () => icon("🚴"), title: "Deliveries" }}
      />
      <Tabs.Screen
        name="Account"
        component={S.AccountScreen}
        options={{ tabBarIcon: () => icon("♙") }}
      />
    </Tabs.Navigator>
  );
}
function AdminTabs() {
  const insetTabOptions = useInsetTabOptions();
  return (
    <Tabs.Navigator screenOptions={insetTabOptions}>
      <Tabs.Screen
        name="Dashboard"
        component={S.AdminDashboardScreen}
        options={{ tabBarIcon: () => icon("⌂") }}
      />
      <Tabs.Screen
        name="Products"
        component={S.AdminProductsScreen}
        options={{ tabBarIcon: () => icon("🥬") }}
      />
      <Tabs.Screen
        name="Orders"
        component={S.AdminOrdersScreen}
        options={{ tabBarIcon: () => icon("▣") }}
      />
      <Tabs.Screen
        name="Riders"
        component={S.AdminRidersScreen}
        options={{ tabBarIcon: () => icon("🚴") }}
      />
      <Tabs.Screen
        name="Slots"
        component={S.AdminTimeSlotsScreen}
        options={{ tabBarIcon: () => icon("◷") }}
      />
    </Tabs.Navigator>
  );
}

const stackOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: theme.colors.background },
};
export default function AppNavigator() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = React.useState(true);
  React.useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setShowSplash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [loading]);
  if (loading || showSplash) return <S.SplashScreen />;
  if (!user)
    return (
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login" screenOptions={stackOptions}>
          <Stack.Screen name="Login" component={S.LoginScreen} />
          <Stack.Screen name="Forgot Password" component={S.ForgotPasswordScreen} />
          <Stack.Screen name="Register" component={S.RegisterScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  if (user.role === "customer")
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={stackOptions}>
          <Stack.Screen name="Main" component={CustomerTabs} />
          <Stack.Screen
            name="Notifications"
            component={S.NotificationsScreen}
          />
          <Stack.Screen name="Vegetables" component={S.ProductListScreen} />
          <Stack.Screen name="Fruits" component={S.ProductListScreen} />
          <Stack.Screen name="Meat" component={S.ProductListScreen} />
          <Stack.Screen name="Milk & Dairy" component={S.ProductListScreen} />
          <Stack.Screen
            name="Product Details"
            component={S.ProductDetailsScreen}
          />
          <Stack.Screen name="Search" component={S.SearchScreen} />
          <Stack.Screen name="Checkout" component={S.CheckoutScreen} />
          <Stack.Screen name="Payment" component={S.PaymentScreen} />
          <Stack.Screen
            name="Order Confirmation"
            component={S.OrderConfirmationScreen}
          />
          <Stack.Screen name="Order Details" component={S.OrderDetailsScreen} />
          <Stack.Screen
            name="Order Tracking"
            component={S.OrderTrackingScreen}
          />
          <Stack.Screen
            name="Address Management"
            component={S.AddressManagementScreen}
          />
          <Stack.Screen
            name="Time Slot Selection"
            component={S.TimeSlotSelectionScreen}
          />
          <Stack.Screen
            name="Service Unavailable"
            component={S.ServiceUnavailableScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  if (user.role === "rider")
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={stackOptions}>
          <Stack.Screen name="Main" component={RiderTabs} />
          <Stack.Screen
            name="Rider Order Details"
            component={S.RiderOrderDetailsScreen}
          />
          <Stack.Screen
            name="Delivery Photo"
            component={S.DeliveryPhotoScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={stackOptions}>
        <Stack.Screen name="Main" component={AdminTabs} />
        <Stack.Screen
          name="Admin Product Editor"
          component={S.AdminProductEditorScreen}
        />
        <Stack.Screen name="Admin Prices" component={S.AdminPricesScreen} />
        <Stack.Screen
          name="Admin Categories"
          component={S.AdminCategoriesScreen}
        />
        <Stack.Screen name="Admin Coupons" component={S.AdminCouponsScreen} />
        <Stack.Screen
          name="Admin Shipping Settings"
          component={S.AdminShippingSettingsScreen}
        />
        <Stack.Screen
          name="Admin Delivery Areas"
          component={S.AdminShippingAreasScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
