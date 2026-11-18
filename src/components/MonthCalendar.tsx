import { Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays, dayKey, daysInMonth, MONTHS, todayKey, WEEKDAYS_SHORT, type DayKey } from '../dates';
import type { Entry } from '../db';
import { FACES } from '../faces';
import { useMoodColor } from '../moods';
import { MoodFace } from './MoodFace';
import { useTheme } from '../theme';

/**
 * `byDate` should include the few days either side of the month (they can fall in the
 * neighbouring year), since the first and last weeks are filled out with them.
 */
type Props = { year: number; month: number; byDate: Map<DayKey, Entry>; onPressDay: (date: DayKey) => void };

export function MonthCalendar({ year, month, byDate, onPressDay }: Props) {
  const t = useTheme();
  const moodColor = useMoodColor();
  const today = todayKey();
  const first = dayKey(year, month, 1);
  const offset = new Date(year, month, 1).getDay();
  const count = daysInMonth(year, month);
  // Fill the first and last weeks with the neighbouring months' days so the weeks read continuously.
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => {
    const date = addDays(first, i - offset);
    return { date, outside: i < offset || i >= offset + count };
  });

  const weeks: (typeof cells)[] = [];
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
          {week.map(({ date, outside }) => {
            const entry = byDate.get(date);
            const future = date > today;
            const day = Number(date.slice(8));
            // The 1st of a neighbouring month is labelled with the month, so the boundary is obvious.
            const label = outside && day === 1 ? MONTHS[Number(date.slice(5, 7)) - 1].slice(0, 3) : String(day);
            return (
              <Pressable
                key={date}
                disabled={future}
                onPress={() => onPressDay(date)}
                accessibilityLabel={entry ? `${date}, ${FACES[entry.mood].label}` : date}
                style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}>
                <View
                  style={[
                    styles.tile,
                    { backgroundColor: entry ? moodColor(entry.mood) : t.empty, opacity: outside || future ? 0.35 : 1 },
                    date === today && { borderColor: t.text },
                  ]}>
                  {entry ? <MoodFace mood={entry.mood} size={26} bare /> : null}
                </View>
                <Text
                  style={[
                    styles.num,
                    { color: outside || future ? t.muted : t.text, opacity: outside || future ? 0.6 : 1 },
                    date === today && styles.todayNum,
                  ]}>
                  {label}
                </Text>
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
  cell: { flex: 1, margin: 2, marginBottom: 6, alignItems: 'center' },
  // Every tile carries the border so today's outline doesn't change its size.
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontSize: 12, fontWeight: '500', marginTop: 3 },
  todayNum: { fontWeight: '800' },
});
