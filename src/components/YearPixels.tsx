import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayKey, daysInMonth, MONTHS, todayKey, type DayKey } from '../dates';
import type { Entry } from '../db';
import { moodInfo } from '../moods';
import { useTheme } from '../theme';

type Props = {
  year: number;
  byDate: Map<DayKey, Entry>;
  onPressDay: (date: DayKey) => void;
  onPressMonth: (month: number) => void;
};

/** "Year in pixels": one row per month, one square per day. */
export function YearPixels({ year, byDate, onPressDay, onPressMonth }: Props) {
  const t = useTheme();
  const today = todayKey();
  return (
    <View>
      {MONTHS.map((name, month) => {
        const days = daysInMonth(year, month);
        return (
          <View key={month} style={styles.row}>
            <Pressable onPress={() => onPressMonth(month)} style={styles.label} hitSlop={6}>
              <Text style={[styles.labelText, { color: t.muted }]}>{name[0]}</Text>
            </Pressable>
            {Array.from({ length: 31 }, (_, i) => {
              if (i >= days) return <View key={i} style={styles.pixel} />;
              const date = dayKey(year, month, i + 1);
              const entry = byDate.get(date);
              const future = date > today;
              return (
                <Pressable
                  key={i}
                  disabled={future}
                  onPress={() => onPressDay(date)}
                  hitSlop={2}
                  style={[
                    styles.pixel,
                    { backgroundColor: entry ? moodInfo(entry.mood).color : t.empty, opacity: future ? 0.4 : 1 },
                    date === today && { borderWidth: 1.5, borderColor: t.text },
                  ]}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { width: 16 },
  labelText: { fontSize: 11, fontWeight: '600' },
  pixel: { flex: 1, aspectRatio: 1, margin: 1, borderRadius: 2 },
});
