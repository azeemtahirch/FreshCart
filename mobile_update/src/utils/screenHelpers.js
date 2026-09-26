import React, { useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "../theme/theme";

export const screen = { backgroundColor: theme.colors.background, flex: 1 };
export const pad = { padding: 16 };

export const fmtStatus = (s) => String(s || "pending").replaceAll("_", " ");
export const safe = (v, f = "") => (v === undefined || v === null ? f : v);

export const getKarachiNow = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const value = (type) => parts.find((x) => x.type === type)?.value || "00";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
};

export const dateISO = () => getKarachiNow().date;

// Only poll while an order screen is visible. This keeps assignments and status
// changes synchronized across separate customer, rider, and admin devices.
export const useOrderSync = (load) => {
  useFocusEffect(
    React.useCallback(() => {
      load(false);
      const timer = setInterval(() => load(true), 3000);
      return () => clearInterval(timer);
    }, [load]),
  );
};

export const useKarachiClock = () => {
  const [now, setNow] = useState(getKarachiNow());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getKarachiNow());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  return now;
};

export const slotStartMinutes = (slot) => {
  const [hour, minute] = String(slot?.start_time || "").split(":");
  return Number(hour) * 60 + Number(minute);
};

export const isSelectableSlot = (slot, now) =>
  !!slot &&
  slot.slot_date === now.date &&
  slot.is_active !== false &&
  Number(slot.booked_orders || 0) < Number(slot.max_orders || 0) &&
  slotStartMinutes(slot) > now.minutes;

export const initials = (name) =>
  String(name || "F")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const timeLabel = (t) => {
  const value = String(t || "").slice(0, 5);
  const [hour, minute] = value.split(":").map(Number);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
};
