import React, { useEffect, useState } from "react";
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
import {
  Button,
  Card,
  Header,
  Input,
  SectionTitle,
  StatusPill,
} from "../components/UI";
import { screen, pad, dateISO, initials } from "../utils/screenHelpers";

export function AdminRidersScreen() {
  const [r, setR] = useState([]);

  // Add rider
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("Bike");
  const [vehicleNumber, setVehicleNumber] = useState("");

  // Slots
  const [slotOptions, setSlotOptions] = useState([]);
  const [assignedSlots, setAssignedSlots] = useState({});
  const [openRider, setOpenRider] = useState(null);

  // Loading
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [updatingRider, setUpdatingRider] = useState(null);
  const [deletingRider, setDeletingRider] = useState(null);
  const [loadingAssignments, setLoadingAssignments] = useState(null);
  const [savingAssignments, setSavingAssignments] = useState(null);

  // Edit
  const [editingRider, setEditingRider] = useState(null);

  // --------------------------------------------------
  // LOAD RIDERS + TODAY'S SLOT AVAILABILITY
  // --------------------------------------------------

  const load = async ({ refreshOpenRider = true } = {}) => {
    try {
      setLoading(true);

      const [ridersResponse, slotsResponse] = await Promise.all([
        api.get("/admin/riders"),
        api.get("/admin/time-slots/availability", {
          params: { date: dateISO() },
        }),
      ]);

      const ridersData = ridersResponse.data || [];
      const slotsData = slotsResponse.data || [];

      setR(ridersData);
      setSlotOptions(slotsData);

      // Remove local assignments for riders
      // that no longer exist.
      setAssignedSlots((current) => {
        const validRiderIds = new Set(
          ridersData.map((rider) => String(rider.id)),
        );

        return Object.fromEntries(
          Object.entries(current).filter(([riderId]) =>
            validRiderIds.has(String(riderId)),
          ),
        );
      });

      // If a rider's slot panel is open,
      // reload that rider's assignments from
      // the server after refresh.
      if (
        refreshOpenRider &&
        openRider &&
        ridersData.some((rider) => String(rider.id) === String(openRider))
      ) {
        await loadAssignments(openRider);
      }
    } catch (e) {
      Alert.alert("Riders", apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // --------------------------------------------------
  // LOAD RIDER SLOT ASSIGNMENTS
  // --------------------------------------------------

  const loadAssignments = async (riderId) => {
    try {
      setLoadingAssignments(riderId);

      const response = await api.get(`/admin/riders/${riderId}/time-slots`, {
        params: { date: dateISO() },
      });

      const slots = response.data || [];

      // Always replace the rider's assignment state
      // with the current server state.
      const assignedIds = slots
        .filter((slot) => slot.assigned)
        .map((slot) => slot.slot_id ?? slot.id);

      setAssignedSlots((current) => ({
        ...current,
        [riderId]: assignedIds,
      }));
    } catch (e) {
      Alert.alert("Rider slots", apiError(e));
    } finally {
      setLoadingAssignments(null);
    }
  };

  // --------------------------------------------------
  // SAVE RIDER SLOTS
  // --------------------------------------------------

  const saveAssignments = async (riderId) => {
    try {
      setSavingAssignments(riderId);

      await api.put(
        `/admin/riders/${riderId}/time-slots`,
        {
          time_slot_ids: assignedSlots[riderId] || [],
        },
        {
          params: { date: dateISO() },
        },
      );

      // Read the saved assignments back from
      // the server so local state cannot become stale.
      await loadAssignments(riderId);

      // Refresh availability for all riders,
      // but don't reload the open rider twice.
      await load({
        refreshOpenRider: false,
      });

      Alert.alert(
        "Assignments saved",
        "The rider's delivery slots were updated.",
      );
    } catch (e) {
      Alert.alert("Save assignments", apiError(e));
    } finally {
      setSavingAssignments(null);
    }
  };

  // --------------------------------------------------
  // AVAILABILITY
  // --------------------------------------------------

  const updateAvailability = async (x) => {
    try {
      setUpdatingRider(x.id);

      await api.put(`/admin/riders/${x.id}`, {
        name: x.name,
        email: x.email,
        phone: x.phone || "",
        vehicle_type: x.vehicle_type || x.vehicle || "Bike",
        vehicle_number: x.vehicle_number || "",
        is_active: x.is_active,
        is_available: !x.is_available,
      });

      await load();
    } catch (e) {
      Alert.alert("Update rider", apiError(e));
    } finally {
      setUpdatingRider(null);
    }
  };

  // --------------------------------------------------
  // EDIT RIDER
  // --------------------------------------------------

  const startEditRider = (x) => {
    setEditingRider({
      id: x.id,
      name: x.name || "",
      email: x.email || "",
      phone: x.phone || "",
      vehicle_type: x.vehicle_type || x.vehicle || "Bike",
      vehicle_number: x.vehicle_number || "",
      is_active: x.is_active,
      is_available: x.is_available,
    });
  };

  const updateRider = async () => {
    if (!editingRider) return;

    const riderName = editingRider.name.trim();

    const riderEmail = editingRider.email.trim().toLowerCase();

    if (!riderName) {
      Alert.alert("Rider details", "Enter the rider name.");
      return;
    }

    if (!riderEmail || !riderEmail.includes("@")) {
      Alert.alert("Rider details", "Enter a valid email address.");
      return;
    }

    try {
      setUpdatingRider(editingRider.id);

      await api.put(`/admin/riders/${editingRider.id}`, {
        name: riderName,
        email: riderEmail,
        phone: editingRider.phone?.trim() || "",
        vehicle_type: editingRider.vehicle_type?.trim() || "Bike",
        vehicle_number: editingRider.vehicle_number?.trim() || "",
        is_active: editingRider.is_active,
        is_available: editingRider.is_available,
      });

      setEditingRider(null);

      await load();

      Alert.alert("Rider updated", "Rider details were updated successfully.");
    } catch (e) {
      Alert.alert("Update rider", apiError(e));
    } finally {
      setUpdatingRider(null);
    }
  };

  // --------------------------------------------------
  // DELETE RIDER
  // --------------------------------------------------

  const deleteRider = (x) => {
    if ((x.active_orders || 0) > 0) {
      Alert.alert(
        "Cannot delete rider",
        `${x.name} has ${x.active_orders} active ${
          x.active_orders === 1 ? "order" : "orders"
        }. Reassign or complete the orders before deleting this rider.`,
      );
      return;
    }

    Alert.alert("Delete rider", `Are you sure you want to delete ${x.name}?`, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingRider(x.id);

            await api.delete(`/admin/riders/${x.id}`);

            if (String(openRider) === String(x.id)) {
              setOpenRider(null);
            }

            if (editingRider?.id === x.id) {
              setEditingRider(null);
            }

            setAssignedSlots((current) => {
              const next = {
                ...current,
              };

              delete next[x.id];

              return next;
            });

            await load({
              refreshOpenRider: false,
            });

            Alert.alert("Rider deleted", "The rider was deleted successfully.");
          } catch (e) {
            Alert.alert("Delete rider", apiError(e));
          } finally {
            setDeletingRider(null);
          }
        },
      },
    ]);
  };

  // --------------------------------------------------
  // ADD RIDER
  // --------------------------------------------------

  const addRider = async () => {
    const riderName = name.trim();

    const riderEmail = email.trim().toLowerCase();

    const riderPassword = password.trim();

    if (
      !riderName ||
      !riderEmail ||
      !riderEmail.includes("@") ||
      riderPassword.length < 8
    ) {
      Alert.alert(
        "Rider details",
        "Enter a name, valid email, and password with at least 8 characters.",
      );
      return;
    }

    try {
      setAdding(true);

      await api.post("/admin/riders", {
        name: riderName,
        email: riderEmail,
        phone: phone.trim(),
        password: riderPassword,
        vehicle_type: vehicleType.trim() || "Bike",
        vehicle_number: vehicleNumber.trim(),
        is_active: true,
        is_available: true,
      });

      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setVehicleType("Bike");
      setVehicleNumber("");

      await load();

      Alert.alert("Rider added", "The rider was added successfully.");
    } catch (e) {
      Alert.alert("Add rider", apiError(e));
    } finally {
      setAdding(false);
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <ScrollView
      style={screen}
      contentContainerStyle={pad}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header + Refresh */}

      <View style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Header title="Riders" subtitle="Manage your delivery team" />
        </View>

        <Pressable
          style={[s.refreshButton, loading && s.refreshButtonDisabled]}
          onPress={() =>
            load({
              refreshOpenRider: true,
            })
          }
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primaryDark} />
          ) : (
            <Text style={s.refreshText}>↻</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryDark} />

          <Text style={s.loadingText}>Loading riders...</Text>
        </View>
      ) : (
        <>
          {/* ==========================================
              RIDERS
          =========================================== */}

          {r.length === 0 ? (
            <Card style={s.emptyCard}>
              <Text style={s.emptyTitle}>No riders found</Text>

              <Text style={s.emptyText}>
                Add your first delivery rider below.
              </Text>
            </Card>
          ) : (
            r.map((x) => {
              const isUpdating = updatingRider === x.id;

              const isDeleting = deletingRider === x.id;

              const isLoadingSlots = loadingAssignments === x.id;

              const isSavingSlots = savingAssignments === x.id;

              return (
                <Card
                  key={x.id}
                  style={{
                    marginBottom: 10,
                  }}
                >
                  <View style={s.row}>
                    <View style={s.riderAvatar}>
                      <Text style={s.avatarText}>{initials(x.name)}</Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text style={s.name}>{x.name}</Text>

                      <Text style={s.muted}>{x.email}</Text>

                      {!!x.phone && <Text style={s.muted}>{x.phone}</Text>}

                      <Text style={s.muted}>
                        {x.vehicle_type || x.vehicle || "Bike"}{" "}
                        {x.vehicle_number || ""} •{" "}
                        {x.is_available ? "Available" : "Unavailable"}
                      </Text>

                      <Text style={s.muted}>
                        {x.active_orders || 0} active orders
                      </Text>
                    </View>

                    <StatusPill
                      status={x.is_active ? "confirmed" : "cancelled"}
                    />
                  </View>

                  {/* Availability / Edit */}

                  <View style={s.actionButtons}>
                    <View style={s.actionButton}>
                      <Button
                        secondary
                        title={
                          isUpdating
                            ? "Updating..."
                            : x.is_available
                              ? "Set unavailable"
                              : "Set available"
                        }
                        onPress={() => updateAvailability(x)}
                        disabled={isUpdating || isDeleting}
                      />
                    </View>

                    <View style={s.actionButton}>
                      <Button
                        secondary
                        title="Edit"
                        onPress={() => startEditRider(x)}
                        disabled={isUpdating || isDeleting}
                      />
                    </View>
                  </View>

                  {/* Slots / Delete */}

                  <View style={s.actionButtons}>
                    <View style={s.actionButton}>
                      <Button
                        secondary
                        title={
                          openRider === x.id
                            ? "Hide today's slots"
                            : "Select today's slots"
                        }
                        onPress={async () => {
                          const next = openRider === x.id ? null : x.id;

                          setOpenRider(next);

                          if (next && assignedSlots[x.id] === undefined) {
                            await loadAssignments(x.id);
                          }
                        }}
                        disabled={isLoadingSlots || isDeleting}
                      />
                    </View>

                    <View style={s.actionButton}>
                      <Button
                        secondary
                        title={isDeleting ? "Deleting..." : "Delete"}
                        onPress={() => deleteRider(x)}
                        disabled={
                          isDeleting || isUpdating || (x.active_orders || 0) > 0
                        }
                      />
                    </View>
                  </View>

                  {isDeleting && (
                    <View style={s.actionLoading}>
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primaryDark}
                      />

                      <Text style={s.actionLoadingText}>Deleting rider...</Text>
                    </View>
                  )}

                  {/* Today's slots */}

                  {openRider === x.id && (
                    <View
                      style={{
                        marginTop: 8,
                      }}
                    >
                      {isLoadingSlots ? (
                        <View style={s.slotsLoading}>
                          <ActivityIndicator
                            size="small"
                            color={theme.colors.primaryDark}
                          />

                          <Text style={s.actionLoadingText}>
                            Loading today's slots...
                          </Text>
                        </View>
                      ) : (
                        <>
                          {slotOptions.length === 0 ? (
                            <Text style={s.muted}>
                              No time slots available today.
                            </Text>
                          ) : (
                            slotOptions.map((slot) => {
                              const slotId = slot.slot_id ?? slot.id;

                              const checked = (assignedSlots[x.id] || []).some(
                                (id) => String(id) === String(slotId),
                              );

                              const assignedToOther =
                                slot.assigned_rider &&
                                String(slot.assigned_rider.id) !== String(x.id);

                              const disabled =
                                assignedToOther || !slot.is_active;

                              return (
                                <Pressable
                                  key={slotId}
                                  disabled={disabled}
                                  style={[
                                    s.option,
                                    checked && s.optionSelected,
                                    disabled && {
                                      opacity: 0.45,
                                    },
                                  ]}
                                  onPress={() =>
                                    setAssignedSlots((current) => {
                                      const currentIds = current[x.id] || [];

                                      const nextIds = checked
                                        ? currentIds.filter(
                                            (id) =>
                                              String(id) !== String(slotId),
                                          )
                                        : [...currentIds, slotId];

                                      return {
                                        ...current,
                                        [x.id]: nextIds,
                                      };
                                    })
                                  }
                                >
                                  <Text
                                    style={{
                                      marginRight: 10,
                                    }}
                                  >
                                    {assignedToOther
                                      ? "🔒"
                                      : checked
                                        ? "☑"
                                        : "☐"}
                                  </Text>

                                  <Text style={s.name}>
                                    {slot.time ||
                                      `${slot.start_time} - ${slot.end_time}`}
                                    {slot.assigned_rider
                                      ? ` — Assigned to ${slot.assigned_rider.name}`
                                      : !slot.is_active
                                        ? " — Inactive"
                                        : ""}
                                  </Text>
                                </Pressable>
                              );
                            })
                          )}

                          <Button
                            title={
                              isSavingSlots
                                ? "Saving assignment..."
                                : "Save assignment"
                            }
                            onPress={() => saveAssignments(x.id)}
                            disabled={isSavingSlots}
                          />
                        </>
                      )}
                    </View>
                  )}
                </Card>
              );
            })
          )}

          {/* ==========================================
              EDIT RIDER
          =========================================== */}

          {editingRider && (
            <>
              <SectionTitle title="Edit rider" />

              <Card
                style={{
                  marginBottom: 16,
                }}
              >
                <Input
                  label="Name"
                  placeholder="Ali Raza"
                  value={editingRider.name}
                  onChangeText={(value) =>
                    setEditingRider((current) => ({
                      ...current,
                      name: value,
                    }))
                  }
                />

                <Input
                  label="Email"
                  placeholder="rider@example.com"
                  value={editingRider.email}
                  onChangeText={(value) =>
                    setEditingRider((current) => ({
                      ...current,
                      email: value,
                    }))
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Input
                  label="Phone"
                  placeholder="0300 1234567"
                  value={editingRider.phone}
                  onChangeText={(value) =>
                    setEditingRider((current) => ({
                      ...current,
                      phone: value,
                    }))
                  }
                  keyboardType="phone-pad"
                />

                <Input
                  label="Vehicle type"
                  placeholder="Bike"
                  value={editingRider.vehicle_type}
                  onChangeText={(value) =>
                    setEditingRider((current) => ({
                      ...current,
                      vehicle_type: value,
                    }))
                  }
                />

                <Input
                  label="Vehicle number"
                  placeholder="ABC-123"
                  value={editingRider.vehicle_number}
                  onChangeText={(value) =>
                    setEditingRider((current) => ({
                      ...current,
                      vehicle_number: value,
                    }))
                  }
                />

                <Button
                  title={
                    updatingRider === editingRider.id
                      ? "Updating rider..."
                      : "Update rider"
                  }
                  onPress={updateRider}
                  disabled={updatingRider === editingRider.id}
                />

                <View
                  style={{
                    marginTop: 8,
                  }}
                >
                  <Button
                    secondary
                    title="Cancel"
                    onPress={() => setEditingRider(null)}
                  />
                </View>
              </Card>
            </>
          )}

          {/* ==========================================
              ADD RIDER
          =========================================== */}

          <SectionTitle title="Add rider" />

          <Input
            label="Name"
            placeholder="Ali Raza"
            value={name}
            onChangeText={setName}
          />

          <Input
            label="Email"
            placeholder="rider@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Phone"
            placeholder="0300 1234567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Input
            label="Vehicle type"
            placeholder="Bike"
            value={vehicleType}
            onChangeText={setVehicleType}
          />

          <Input
            label="Vehicle number"
            placeholder="ABC-123"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
          />

          <Button
            title={adding ? "Adding rider..." : "Add rider"}
            onPress={addRider}
            disabled={adding}
          />

          {adding && (
            <View style={s.addingContainer}>
              <ActivityIndicator
                size="small"
                color={theme.colors.primaryDark}
              />

              <Text style={s.addingText}>Adding rider...</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },

  refreshButtonDisabled: {
    opacity: 0.6,
  },

  refreshText: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    color: theme.colors.primaryDark,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontWeight: "800",
    color: theme.colors.primaryDark,
  },

  name: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.text,
  },

  muted: {
    color: theme.colors.muted,
    fontSize: 13,
    marginTop: 3,
  },

  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },

  actionButton: {
    flex: 1,
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

  loadingContainer: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },

  slotsLoading: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },

  actionLoading: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },

  actionLoadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  addingContainer: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },

  addingText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  emptyCard: {
    alignItems: "center",
    paddingVertical: 28,
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.text,
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: theme.colors.muted,
  },
});
