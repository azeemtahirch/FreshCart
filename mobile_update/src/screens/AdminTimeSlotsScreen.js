import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api, apiError } from "../services/api";
import { theme } from "../theme/theme";
import { Button, Card, Header, Input } from "../components/UI";

import { screen, pad, dateISO } from "../utils/screenHelpers";

/* =========================
   TIME HELPERS
========================= */

// 24-hour => 12-hour display
// 13:00 => 01:00 PM
// 00:00 => 12:00 AM
function formatTime12(value) {
  if (!value) return "";

  const cleanValue = String(value).slice(0, 5);
  const parts = cleanValue.split(":");

  if (parts.length !== 2) {
    return value;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return value;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${String(hour12).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )} ${period}`;
}

/*
 * Convert 12-hour input to API-friendly 24-hour value.
 *
 * 01:00 PM -> 13:00
 * 1:00 PM  -> 13:00
 * 12:00 AM -> 00:00
 * 12:00 PM -> 12:00
 */
function convertTo24Hour(value) {
  if (!value) return "";

  const cleanValue = String(value).trim().toUpperCase().replace(/\s+/g, " ");

  const match = cleanValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);

  if (!match) {
    return "";
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3];

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return "";
  }

  if (period === "AM") {
    if (hour === 12) {
      hour = 0;
    }
  } else if (hour !== 12) {
    hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/*
 * Convert HH:mm into total minutes.
 *
 * 13:00 -> 780
 * 00:00 -> 0
 */
function minutesFromTime(value) {
  if (!value) return null;

  const cleanValue = String(value).slice(0, 5);

  const match = cleanValue.match(/^(\d{2}):(\d{2})$/);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

/*
 * Add configurable number of hours.
 *
 * 13:00 + 1 hour = 14:00
 * 13:00 + 2 hours = 15:00
 * 13:00 + 3 hours = 16:00
 *
 * Also handles midnight:
 *
 * 23:00 + 1 hour = 00:00
 * 23:00 + 2 hours = 01:00
 */
function addHours(value, hoursToAdd = 1) {
  const totalMinutes = minutesFromTime(value);

  if (totalMinutes === null) {
    return "";
  }

  const minutesToAdd = Number(hoursToAdd) * 60;

  const nextMinutes = (totalMinutes + minutesToAdd) % (24 * 60);

  const hour = Math.floor(nextMinutes / 60);
  const minute = nextMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/*
 * Check slot duration.
 *
 * Supports midnight correctly.
 *
 * 13:00 -> 14:00 = 1 hour
 * 13:00 -> 15:00 = 2 hours
 * 13:00 -> 16:00 = 3 hours
 * 23:00 -> 00:00 = 1 hour
 */
function isCorrectDuration(startTime, endTime, durationHours) {
  const startMinutes = minutesFromTime(startTime);
  const endMinutes = minutesFromTime(endTime);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  let duration = endMinutes - startMinutes;

  if (duration < 0) {
    duration += 24 * 60;
  }

  return duration === Number(durationHours) * 60;
}

/*
 * Detect duration from an existing slot.
 */
function getDurationHours(startTime, endTime) {
  const startMinutes = minutesFromTime(startTime);
  const endMinutes = minutesFromTime(endTime);

  if (startMinutes === null || endMinutes === null) {
    return 1;
  }

  let duration = endMinutes - startMinutes;

  if (duration < 0) {
    duration += 24 * 60;
  }

  const hours = duration / 60;

  if (hours === 1 || hours === 2 || hours === 3) {
    return hours;
  }

  return 1;
}

/* =========================
   SCREEN
========================= */

export function AdminTimeSlotsScreen() {
  const [date, setDate] = useState(dateISO());
  const [slots, setSlots] = useState([]);

  const [editingId, setEditingId] = useState(null);

  // API values are always HH:mm.
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("14:00");

  // Display value shown to admin.
  const [startInput, setStartInput] = useState("01:00 PM");

  // NEW:
  // Admin can select 1, 2 or 3 hours.
  const [durationHours, setDurationHours] = useState(1);

  const [maxOrders, setMaxOrders] = useState("10");
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /* =========================
     LOAD
  ========================= */

  const load = async () => {
    try {
      setLoading(true);

      const response = await api.get("/admin/time-slots");

      setSlots(
        (response.data || []).filter((slot) => !date || slot.date === date),
      );
    } catch (e) {
      Alert.alert("Time slots", apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [date]);

  /* =========================
     STATS
  ========================= */

  const stats = useMemo(() => {
    const total = slots.length;

    const full = slots.filter(
      (slot) => Number(slot.booked_orders || 0) >= Number(slot.max_orders || 0),
    ).length;

    const open = total - full;

    return {
      total,
      open,
      full,
    };
  }, [slots]);

  /* =========================
     EDIT
  ========================= */

  const editSlot = (slot) => {
    const slotStart = slot.start_time?.slice(0, 5) || "13:00";

    const slotEnd = slot.end_time?.slice(0, 5) || addHours(slotStart, 1);

    const detectedDuration = getDurationHours(slotStart, slotEnd);

    setEditingId(slot.id);

    setStart(slotStart);
    setEnd(slotEnd);

    setStartInput(formatTime12(slotStart));

    setDurationHours(detectedDuration);

    setMaxOrders(String(slot.max_orders || 10));

    setIsActive(slot.is_active !== false);
  };

  /* =========================
     RESET
  ========================= */

  const resetForm = () => {
    setEditingId(null);

    setDurationHours(1);

    setStart("13:00");
    setEnd("14:00");

    setStartInput("01:00 PM");

    setMaxOrders("10");
    setIsActive(true);
  };

  /* =========================
     DELETE
  ========================= */

  const deleteSlot = (slot) => {
    Alert.alert(
      "Delete time slot",
      `Are you sure you want to delete ${formatTime12(
        slot.start_time,
      )} – ${formatTime12(slot.end_time)}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",

          onPress: async () => {
            try {
              setDeletingId(slot.id);

              await api.delete(`/admin/time-slots/${slot.id}`);

              if (editingId === slot.id) {
                resetForm();
              }

              await load();
            } catch (e) {
              Alert.alert("Delete time slot", apiError(e));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  /* =========================
     START TIME CHANGE
  ========================= */

  const handleStartChange = (value) => {
    setStartInput(value);

    const converted = convertTo24Hour(value);

    /*
     * Do not save partial/invalid input.
     */
    if (!converted) {
      setStart("");
      setEnd("");
      return;
    }

    setStart(converted);

    // Automatically calculate end according
    // to selected duration.
    setEnd(addHours(converted, durationHours));
  };

  /* =========================
     DURATION CHANGE
  ========================= */

  const handleDurationChange = (hours) => {
    setDurationHours(hours);

    /*
     * If a valid start time already exists,
     * immediately update the end time.
     */
    if (start) {
      setEnd(addHours(start, hours));
    }
  };

  /* =========================
     SAVE
  ========================= */

  const saveSlot = async () => {
    const numericMaxOrders = Number(maxOrders);

    /*
     * Validate date.
     */
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert(
        "Time slot",
        "Please enter a valid date in YYYY-MM-DD format.",
      );
      return;
    }

    /*
     * Validate duration.
     */
    if (![1, 2, 3].includes(Number(durationHours))) {
      Alert.alert("Time slot", "Please select a duration of 1, 2 or 3 hours.");
      return;
    }

    /*
     * Validate start time.
     */
    const startMinutes = minutesFromTime(start);

    if (startMinutes === null) {
      Alert.alert(
        "Time slot",
        "Please enter a valid start time, for example 01:00 PM.",
      );
      return;
    }

    /*
     * Always calculate the end time again
     * before saving.
     */
    const calculatedEnd = addHours(start, durationHours);

    if (!calculatedEnd) {
      Alert.alert("Time slot", "Unable to calculate the end time.");
      return;
    }

    setEnd(calculatedEnd);

    /*
     * Validate duration.
     */
    if (!isCorrectDuration(start, calculatedEnd, durationHours)) {
      Alert.alert(
        "Invalid time slot",
        `Delivery time slot must be exactly ${durationHours} ${
          durationHours === 1 ? "hour" : "hours"
        }.`,
      );
      return;
    }

    /*
     * Validate maximum orders.
     */
    if (!Number.isInteger(numericMaxOrders) || numericMaxOrders < 1) {
      Alert.alert("Time slot", "Maximum orders must be at least 1.");
      return;
    }

    const payload = {
      slot_date: date,
      start_time: start,
      end_time: calculatedEnd,
      max_orders: numericMaxOrders,
      is_active: isActive,
    };

    try {
      setSaving(true);

      if (editingId) {
        await api.put(`/admin/time-slots/${editingId}`, payload);
      } else {
        await api.post("/admin/time-slots", payload);
      }

      resetForm();

      await load();
    } catch (e) {
      Alert.alert(
        editingId ? "Update time slot" : "Create time slot",
        apiError(e),
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     SLOT CARD
  ========================= */

  const renderSlot = (slot) => {
    const booked = Number(slot.booked_orders || 0);

    const capacity = Number(slot.max_orders || 1);

    const percentage = Math.min(100, Math.round((booked / capacity) * 100));

    const isFull = booked >= capacity;

    const isDeleting = deletingId === slot.id;

    const slotDuration = getDurationHours(slot.start_time, slot.end_time);

    return (
      <Card key={slot.id} style={s.slotCard}>
        {/* TOP */}

        <View style={s.slotTop}>
          <View style={s.timeIcon}>
            <Text style={s.timeIconText}>◷</Text>
          </View>

          <View style={s.slotInfo}>
            <Text style={s.slotTime}>
              {formatTime12(slot.start_time)}
              {" – "}
              {formatTime12(slot.end_time)}
            </Text>

            <View style={s.slotMetaRow}>
              <Text style={s.slotDate}>{slot.date || date}</Text>

              <View style={s.durationBadge}>
                <Text style={s.durationBadgeText}>
                  {slotDuration} {slotDuration === 1 ? "hour" : "hours"}
                </Text>
              </View>
            </View>
          </View>

          <View style={[s.statusBadge, isFull ? s.statusFull : s.statusOpen]}>
            <View style={[s.statusDot, isFull ? s.dotFull : s.dotOpen]} />

            <Text
              style={[
                s.statusText,
                isFull ? s.statusTextFull : s.statusTextOpen,
              ]}
            >
              {isFull ? "FULL" : "OPEN"}
            </Text>
          </View>
        </View>

        {/* CAPACITY */}

        <View style={s.capacityHeader}>
          <Text style={s.capacityTitle}>Order capacity</Text>

          <Text style={s.capacityValue}>
            {booked} / {capacity}
          </Text>
        </View>

        <View style={s.progressTrack}>
          <View
            style={[
              s.progressFill,
              {
                width: `${percentage}%`,
              },
              isFull && s.progressFull,
            ]}
          />
        </View>

        <Text style={s.capacityHint}>
          {isFull
            ? "No more orders can be accepted"
            : `${capacity - booked} ${
                capacity - booked === 1 ? "spot" : "spots"
              } remaining`}
        </Text>

        {/* ACTIONS */}

        <View style={s.slotActions}>
          <Pressable
            style={s.editButton}
            onPress={() => editSlot(slot)}
            disabled={deletingId !== null || saving}
          >
            <Text style={s.editIcon}>✎</Text>

            <Text style={s.editText}>Edit</Text>
          </Pressable>

          <Pressable
            style={s.deleteButton}
            onPress={() => deleteSlot(slot)}
            disabled={deletingId !== null || saving}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={theme.colors.danger} />
            ) : (
              <>
                <Text style={s.deleteIcon}>⌫</Text>

                <Text style={s.deleteText}>Delete</Text>
              </>
            )}
          </Pressable>
        </View>
      </Card>
    );
  };

  /* =========================
     UI
  ========================= */

  return (
    <ScrollView
      style={screen}
      contentContainerStyle={[pad, s.container]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}

      <Header
        title="Delivery time slots"
        subtitle="Manage order capacity by time"
      />

      {/* DATE */}

      <Card style={s.dateCard}>
        <View style={s.dateIcon}>
          <Text style={s.dateIconText}>▣</Text>
        </View>

        <View style={s.dateContent}>
          <Text style={s.dateLabel}>Selected date</Text>

          <Input value={date} onChangeText={setDate} style={s.dateInput} />
        </View>
      </Card>

      {/* SUMMARY */}

      <View style={s.summaryRow}>
        <View style={{ flex: 1 }}>
          <SummaryCard value={stats.total} label="Total" icon="◷" />
        </View>

        <View style={{ flex: 1 }}>
          <SummaryCard value={stats.open} label="Open" icon="✓" positive />
        </View>

        <View style={{ flex: 1 }}>
          <SummaryCard value={stats.full} label="Full" icon="!" warning />
        </View>
      </View>

      {/* SECTION */}

      <View style={s.sectionHeader}>
        <View>
          <Text style={s.sectionTitle}>Available slots</Text>

          <Text style={s.sectionSubtitle}>
            {slots.length === 0
              ? "No slots configured"
              : `${slots.length} ${
                  slots.length === 1 ? "slot" : "slots"
                } for this date`}
          </Text>
        </View>

        <Pressable style={s.refreshButton} onPress={load} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primaryDark} />
          ) : (
            <Text style={s.refreshText}>↻</Text>
          )}
        </Pressable>
      </View>

      {/* LIST */}

      {loading ? (
        <Card style={s.loadingCard}>
          <ActivityIndicator size="large" color={theme.colors.primaryDark} />

          <Text style={s.loadingTitle}>Loading time slots</Text>

          <Text style={s.loadingSubtitle}>Please wait...</Text>
        </Card>
      ) : (
        <>
          {slots.map(renderSlot)}

          {slots.length === 0 && (
            <Card style={s.emptyCard}>
              <View style={s.emptyIcon}>
                <Text style={s.emptyIconText}>◷</Text>
              </View>

              <Text style={s.emptyTitle}>No time slots yet</Text>

              <Text style={s.emptySubtitle}>
                Create your first delivery slot for {date}.
              </Text>
            </Card>
          )}
        </>
      )}

      {/* FORM HEADER */}

      <View style={s.formHeader}>
        <View style={s.formHeaderIcon}>
          <Text style={s.formHeaderIconText}>{editingId ? "✎" : "+"}</Text>
        </View>

        <View>
          <Text style={s.formTitle}>
            {editingId ? "Update time slot" : "Create time slot"}
          </Text>

          <Text style={s.formSubtitle}>
            Set delivery time and order capacity
          </Text>
        </View>
      </View>

      {/* FORM */}

      <Card style={s.formCard}>
        <View style={s.formDate}>
          <Text style={s.formDateLabel}>Date</Text>

          <Text style={s.formDateValue}>{date}</Text>
        </View>

        <View style={s.divider} />

        {/* DURATION */}

        <Text style={s.durationLabel}>Slot duration</Text>

        <View style={s.durationRow}>
          {[1, 2, 3].map((hours) => {
            const selected = durationHours === hours;

            return (
              <Pressable
                key={hours}
                style={[s.durationButton, selected && s.durationButtonSelected]}
                onPress={() => handleDurationChange(hours)}
                disabled={saving}
              >
                <Text
                  style={[
                    s.durationButtonText,
                    selected && s.durationButtonTextSelected,
                  ]}
                >
                  {hours} {hours === 1 ? "Hour" : "Hours"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* TIME */}

        <View style={s.timeRow}>
          <View style={{ flex: 1 }}>
            <Input
              label="Start time"
              value={startInput}
              onChangeText={handleStartChange}
              placeholder="01:00 PM"
              editable={!saving}
            />
          </View>

          <View style={s.arrowContainer}>
            <Text style={s.arrow}>→</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Input
              label="End time"
              value={end ? formatTime12(end) : ""}
              editable={false}
              style={s.disabledInput}
            />
          </View>
        </View>

        <Text style={s.helperText}>
          End time is automatically set to {durationHours}{" "}
          {durationHours === 1 ? "hour" : "hours"} after the start time.
        </Text>

        {/* CAPACITY */}

        <Input
          label="Maximum orders"
          value={maxOrders}
          onChangeText={setMaxOrders}
          keyboardType="number-pad"
          placeholder="10"
          editable={!saving}
        />

        {/* STATUS */}

        <Text style={s.activeLabel}>Slot status</Text>

        <Pressable
          style={[
            s.activeToggle,
            isActive ? s.activeToggleOn : s.activeToggleOff,
          ]}
          onPress={() => setIsActive((value) => !value)}
          disabled={saving}
        >
          <View
            style={[
              s.toggleCircle,
              isActive ? s.toggleCircleOn : s.toggleCircleOff,
            ]}
          >
            <Text style={s.toggleIcon}>{isActive ? "✓" : "×"}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={[
                s.toggleTitle,
                isActive ? s.toggleTitleOn : s.toggleTitleOff,
              ]}
            >
              {isActive ? "Active slot" : "Inactive slot"}
            </Text>

            <Text style={s.toggleSubtitle}>
              {isActive
                ? "Customers can select this slot"
                : "Customers cannot select this slot"}
            </Text>
          </View>
        </Pressable>

        {/* SAVE */}

        <Button
          title={
            saving
              ? editingId
                ? "Updating..."
                : "Creating..."
              : editingId
                ? "Update time slot"
                : "Create time slot"
          }
          onPress={saveSlot}
          disabled={saving}
        />

        {/* CANCEL */}

        {editingId && (
          <Button
            secondary
            title="Cancel editing"
            onPress={resetForm}
            disabled={saving}
          />
        )}

        {saving && (
          <View style={s.savingRow}>
            <ActivityIndicator size="small" color={theme.colors.primaryDark} />

            <Text style={s.savingText}>
              {editingId ? "Updating time slot..." : "Creating time slot..."}
            </Text>
          </View>
        )}
      </Card>

      <View style={s.bottomSpace} />
    </ScrollView>
  );
}

/* =========================
   SUMMARY CARD
========================= */

function SummaryCard({ value, label, icon, positive, warning }) {
  return (
    <View style={s.summaryCard}>
      <View
        style={[
          s.summaryIcon,
          positive && s.summaryIconPositive,
          warning && s.summaryIconWarning,
        ]}
      >
        <Text style={s.summaryIconText}>{icon}</Text>
      </View>

      <Text style={s.summaryValue}>{value}</Text>

      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

/* =========================
   STYLES
========================= */

const s = StyleSheet.create({
  container: {
    paddingBottom: 30,
  },

  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 14,
  },

  dateIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  dateIconText: {
    fontSize: 21,
    color: theme.colors.primaryDark,
    fontWeight: "900",
  },

  dateContent: {
    flex: 1,
  },

  dateLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.muted,
    marginBottom: 3,
  },

  dateInput: {
    marginBottom: 0,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 24,
  },

  summaryCard: {
    backgroundColor: theme.colors.card || "#FFFFFF",
    borderRadius: 17,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    minHeight: 105,
    borderWidth: 1,
    borderColor: theme.colors.border || "#E8E8E8",
  },

  summaryIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
    marginBottom: 7,
  },

  summaryIconPositive: {
    backgroundColor: theme.colors.successSoft || "#E8F7EE",
  },

  summaryIconWarning: {
    backgroundColor: theme.colors.warningSoft || "#FFF3D6",
  },

  summaryIconText: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  summaryValue: {
    fontSize: 23,
    fontWeight: "900",
    color: theme.colors.text,
  },

  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: theme.colors.text,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 3,
    fontWeight: "600",
  },

  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  refreshText: {
    fontSize: 23,
    color: theme.colors.primaryDark,
    fontWeight: "900",
  },

  slotCard: {
    padding: 15,
    marginBottom: 11,
  },

  slotTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  timeIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  timeIconText: {
    fontSize: 25,
    color: theme.colors.primaryDark,
    fontWeight: "800",
  },

  slotInfo: {
    flex: 1,
  },

  slotTime: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.text,
  },

  slotMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  slotDate: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "600",
  },

  durationBadge: {
    marginLeft: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: theme.colors.primarySoft,
  },

  durationBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusOpen: {
    backgroundColor: theme.colors.successSoft || "#E8F7EE",
  },

  statusFull: {
    backgroundColor: theme.colors.warningSoft || "#FFF3D6",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    marginRight: 5,
  },

  dotOpen: {
    backgroundColor: theme.colors.success,
  },

  dotFull: {
    backgroundColor: theme.colors.warning || "#D99000",
  },

  statusText: {
    fontSize: 9,
    fontWeight: "900",
  },

  statusTextOpen: {
    color: theme.colors.success,
  },

  statusTextFull: {
    color: theme.colors.warning || "#D99000",
  },

  capacityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },

  capacityTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.muted,
  },

  capacityValue: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.text,
  },

  progressTrack: {
    height: 7,
    borderRadius: 8,
    backgroundColor: theme.colors.background || "#F0F1F3",
    overflow: "hidden",
    marginTop: 8,
  },

  progressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: theme.colors.primaryDark,
  },

  progressFull: {
    backgroundColor: theme.colors.warning || "#D99000",
  },

  capacityHint: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 6,
    fontWeight: "600",
  },

  slotActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border || "#EEEEEE",
  },

  editButton: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  editIcon: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  editText: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.primaryDark,
  },

  deleteButton: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    backgroundColor: theme.colors.dangerSoft || "#FFF0F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  deleteIcon: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.danger,
  },

  deleteText: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.danger,
  },

  emptyCard: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  emptyIconText: {
    fontSize: 31,
    color: theme.colors.primaryDark,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.text,
  },

  emptySubtitle: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.muted,
    marginTop: 6,
  },

  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    marginBottom: 11,
  },

  formHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: theme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  formHeaderIconText: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },

  formTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: theme.colors.text,
  },

  formSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 3,
    fontWeight: "600",
  },

  formCard: {
    padding: 16,
  },

  formDate: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  formDateLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "800",
  },

  formDateValue: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: "900",
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border || "#EEEEEE",
    marginVertical: 15,
  },

  /* =========================
     DURATION SELECTOR
  ========================= */

  durationLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 8,
  },

  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },

  durationButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border || "#DDDDDD",
    backgroundColor: theme.colors.card || "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  durationButtonSelected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primaryDark,
  },

  durationButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.muted,
  },

  durationButtonTextSelected: {
    color: theme.colors.primaryDark,
    fontWeight: "900",
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  arrowContainer: {
    paddingTop: 13,
  },

  arrow: {
    fontSize: 18,
    color: theme.colors.muted,
    fontWeight: "900",
  },

  disabledInput: {
    opacity: 0.65,
  },

  helperText: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: -3,
    marginBottom: 14,
    fontWeight: "600",
  },

  activeLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 8,
  },

  activeToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },

  activeToggleOn: {
    backgroundColor: theme.colors.successSoft || "#E8F7EE",
    borderColor: theme.colors.success || "#39A96B",
  },

  activeToggleOff: {
    backgroundColor: theme.colors.background || "#F6F6F6",
    borderColor: theme.colors.border || "#DDDDDD",
  },

  toggleCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  toggleCircleOn: {
    backgroundColor: theme.colors.success,
  },

  toggleCircleOff: {
    backgroundColor: theme.colors.muted || "#999999",
  },

  toggleIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },

  toggleTitle: {
    fontSize: 13,
    fontWeight: "900",
  },

  toggleTitleOn: {
    color: theme.colors.success,
  },

  toggleTitleOff: {
    color: theme.colors.text,
  },

  toggleSubtitle: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },

  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 11,
  },

  savingText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "700",
  },

  loadingCard: {
    minHeight: 190,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  loadingTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.text,
    marginTop: 12,
  },

  loadingSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },

  bottomSpace: {
    height: 20,
  },
});
