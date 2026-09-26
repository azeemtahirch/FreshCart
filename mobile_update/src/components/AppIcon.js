import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "../theme/theme";

const MAP = {
  "⌂": ["Ionicons", "home-outline"],
  "▦": ["Ionicons", "grid-outline"],
  "🛒": ["Ionicons", "cart-outline"],
  "▣": ["Ionicons", "receipt-outline"],
  "♙": ["Ionicons", "person-outline"],
  "🚴": ["MaterialCommunityIcons", "motorbike"],
  "🥬": ["MaterialCommunityIcons", "food-apple-outline"],
  "◷": ["Ionicons", "time-outline"],
  "🔔": ["Ionicons", "notifications-outline"],
  "📍": ["Ionicons", "location-outline"],
  "‹": ["Ionicons", "arrow-back"],
  "›": ["Ionicons", "chevron-forward"],
  "+": ["Ionicons", "add"],
  "✓": ["Ionicons", "checkmark"],
  "✕": ["Ionicons", "close"],
  "✎": ["Ionicons", "create-outline"],
  "🗑": ["Ionicons", "trash-outline"],
  "↻": ["Ionicons", "refresh-outline"],
  "🔍": ["Ionicons", "search-outline"],
  "⚙": ["Ionicons", "settings-outline"],
  "📦": ["Ionicons", "cube-outline"],
  "💳": ["Ionicons", "card-outline"],
  "📅": ["Ionicons", "calendar-outline"],
  "🚚": ["MaterialCommunityIcons", "truck-delivery-outline"],
  "⚠": ["Ionicons", "warning-outline"],
  "ℹ": ["Ionicons", "information-circle-outline"],
  "👤": ["Ionicons", "person-circle-outline"],
  "eye": ["Ionicons", "eye-outline"],
  "eye-off": ["Ionicons", "eye-off-outline"],
};

export const AppIcon = ({ name, size = 22, color = theme.colors.text, style }) => {
  const mapped = MAP[name];
  if (!mapped) {
    return <Ionicons name={name || "help-outline"} size={size} color={color} style={style} />;
  }

  const [family, iconName] = mapped;
  const Icon = family === "MaterialCommunityIcons" ? MaterialCommunityIcons : Ionicons;
  return <Icon name={iconName} size={size} color={color} style={style} />;
};

export const iconName = (value, fallback = "help-outline") => {
  const mapped = MAP[value];
  return mapped ? mapped[1] : value || fallback;
};
