import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayKey, daysInMonth, todayKey, WEEKDAYS_SHORT, type DayKey } from '../dates';
import type { Entry } from '../db';
import { useMoodColor } from '../moods';
import { MoodFace } from './MoodFace';
import { useTheme } from '../theme';

type Props = { year: number; month: number; byDate: Map<DayKey, Entry>; onPressDay: (date: DayKey) => void };

export function MonthCalendar({ year, month, byDate, onPressDay }: Props) {
  const t = useTheme();
  const moodColor = useMoodColor();
  const today = todayKey();
  const offset = new Date(year, month, 1).getDay();
  const cells: (DayKey | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => dayKey(year, month, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  const weeks: (DayKey | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={styles.week}>
        {WEEKDAYS_SHORT.map((w, i) => (
          <Text key={i} style={[styles.weekday, { color: t.muted }]}>
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((date, di) => {
            if (!date) return <View key={`blank-${wi}-${di}`} style={styles.cell} />;
            const entry = byDate.get(date);
            const future = date > today;
            return (
              <Pressable
                key={date}
                disabled={future}
                onPress={() => onPressDay(date)}
                style={({ pressed }) => [
                  styles.cell,
                  styles.day,
                  { backgroundColor: entry ? moodColor(entry.mood) : t.empty, opacity: future ? 0.35 : pressed ? 0.6 : 1 },
                  date === today && { borderColor: t.text },
                ]}>
                {entry ? (
                  <MoodFace mood={entry.mood} size={26} bare />
                ) : (
                  <Text style={[styles.num, { color: t.muted }]}>{Number(date.slice(8))}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  cell: { flex: 1, aspectRatio: 1, margin: 2 },
  // Every cell carries the border so today's outline doesn't change its size.
  day: { borderRadius: 10, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 13, fontWeight: '500' },
});
