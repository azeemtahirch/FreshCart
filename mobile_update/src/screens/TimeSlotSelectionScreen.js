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
import { theme } from "../theme/theme";
import { Header, StatusPill } from "../components/UI";
import {
  screen,
  pad,
  useKarachiClock,
  isSelectableSlot,
  timeLabel,
} from "../utils/screenHelpers";

export function TimeSlotSelectionScreen({ route, navigation }) {
  const now = useKarachiClock();
  const date = now.date;
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    api
      .get("/time-slots", { params: { date } })
      .then((r) => setSlots(r.data || []))
      .catch((e) => Alert.alert("Error", apiError(e)));
  }, [date]);

  return (
    <View style={screen}>
      <Header
        title="Delivery time"
        subtitle={date}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={pad}>
        {slots.map((x) => {
          const disabled = !isSelectableSlot(x, now);

          return (
            <Pressable
              key={x.id}
              disabled={disabled}
              onPress={() => {
                route.params?.onSelect?.(x);
                navigation.goBack();
              }}
              style={[s.bigSlot, disabled && { opacity: 0.45 }]}
            >
              <View style={s.slotClock}>
                <Text>◷</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={s.name}>
                  {timeLabel(x.start_time)} – {timeLabel(x.end_time)}
                </Text>

                <Text style={s.muted}>
                  {disabled ? "UNAVAILABLE" : "Available"}
                </Text>
              </View>

              {disabled ? (
                <StatusPill status="cancelled" />
              ) : (
                <Text style={s.arrow}>›</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  arrow: { fontSize: 28, color: theme.colors.muted },
  bigSlot: {
    backgroundColor: "#fff",
    padding: 17,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    ...theme.shadow,
  },
  slotClock: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
});
