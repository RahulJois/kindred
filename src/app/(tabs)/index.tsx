import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthCalendar } from '../../components/MonthCalendar';
import { MoodLegend } from '../../components/MoodLegend';
import { MoodFace } from '../../components/MoodFace';
import { MoodPicker } from '../../components/MoodPicker';
import { UndoBar } from '../../components/UndoBar';
import { YearPixels } from '../../components/YearPixels';
import { Card, Segmented, StatusBarBackdrop } from '../../components/ui';
import { notifyDayMood, useQuery, useRefresh } from '../../data';
import { formatLong, formatShort, fromKey, MONTHS, todayKey, type DayKey } from '../../dates';
import { getEntries, getTags, quickLog as applyQuickLog, undoQuickLog, type Entry, type Tag } from '../../db';
import { moodInfo, useMoodColor } from '../../moods';
import { useTheme } from '../../theme';

export default function JournalScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const refresh = useRefresh();

  const now = fromKey(todayKey());
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [lastLog, setLastLog] = useState<{ ts: number; mood: number } | null>(null);
  const dismissUndo = useCallback(() => setLastLog(null), []);

  const today = todayKey();
  const data = useQuery(
    async (db) => ({
      // A week either side of the year, for the neighbouring-month days the month calendar shows.
      entries: await getEntries(db, `${year - 1}-12-25`, `${year + 1}-01-07`),
      todayEntry: (await getEntries(db, today, today))[0] ?? null,
      tags: await getTags(db),
    }),
    `${year}|${today}`
  );
  const byDate = useMemo(() => new Map((data?.entries ?? []).map((e) => [e.date, e])), [data]);
  const tagById = useMemo(() => new Map((data?.tags ?? []).map((t) => [t.id, t])), [data]);

  const openDay = (date: DayKey) => router.push({ pathname: '/day/[date]', params: { date } });

  const quickLog = async (mood: number) => {
    const ts = Date.now();
    await applyQuickLog(db, today, mood, ts);
    notifyDayMood(today, mood);
    refresh();
    setLastLog({ ts, mood });
  };

  const undo = async () => {
    if (!lastLog) return;
    setLastLog(null);
    const restored = await undoQuickLog(db, lastLog.ts);
    if (restored) notifyDayMood(restored.date, restored.mood);
    refresh();
  };

  const step = (delta: number) => {
    if (mode === 'year') return setYear((y) => y + delta);
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const atPresent = mode === 'year' ? year >= now.getFullYear() : year * 12 + month >= now.getFullYear() * 12 + now.getMonth();

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const monthEntries = (data?.entries ?? []).filter((e) => e.date.startsWith(monthPrefix));

  return (
    <>
      <ScrollView
        style={{ backgroundColor: t.background }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: t.text }]}>Kindred</Text>
        <Text style={[styles.subtitle, { color: t.muted }]}>{formatLong(today)}</Text>

        <TodayCard entry={data?.todayEntry ?? null} tagById={tagById} onLog={quickLog} onOpen={() => openDay(today)} />

        <View style={styles.toolbar}>
          <Pressable onPress={() => step(-1)} hitSlop={10} accessibilityLabel="Previous">
            <Ionicons name="chevron-back" size={22} color={t.text} />
          </Pressable>
          <Text style={[styles.period, { color: t.text }]}>{mode === 'year' ? year : `${MONTHS[month]} ${year}`}</Text>
          <Pressable onPress={() => step(1)} disabled={atPresent} hitSlop={10} accessibilityLabel="Next">
            <Ionicons name="chevron-forward" size={22} color={atPresent ? t.border : t.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ width: 150 }}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'year', label: 'Year' },
              ]}
            />
          </View>
        </View>

        <Card>
          {mode === 'month' ? (
            <MonthCalendar year={year} month={month} byDate={byDate} onPressDay={openDay} />
          ) : (
            <YearPixels
              year={year}
              byDate={byDate}
              onPressDay={openDay}
              onPressMonth={(m) => {
                setMonth(m);
                setMode('month');
              }}
            />
          )}
          <MoodLegend />
        </Card>

        {mode === 'month' && (
          <>
            <Text style={[styles.listTitle, { color: t.muted }]}>
              {monthEntries.length} {monthEntries.length === 1 ? 'entry' : 'entries'} in {MONTHS[month]}
            </Text>
            {monthEntries.map((e) => (
              <EntryRow key={e.date} entry={e} tagById={tagById} onPress={() => openDay(e.date)} />
            ))}
          </>
        )}
      </ScrollView>
      <StatusBarBackdrop />
      {lastLog && (
        <UndoBar
          message={`Logged ${moodInfo(lastLog.mood).label}`}
          icon={<MoodFace mood={lastLog.mood} size={22} />}
          onUndo={undo}
          onDismiss={dismissUndo}
        />
      )}
    </>
  );
}

function TodayCard({
  entry,
  tagById,
  onLog,
  onOpen,
}: {
  entry: Entry | null;
  tagById: Map<number, Tag>;
  onLog: (mood: number) => void;
  onOpen: () => void;
}) {
  const t = useTheme();
  const moodColor = useMoodColor();
  if (!entry) {
    return (
      <Card style={styles.today}>
        <Text style={[styles.todayTitle, { color: t.text }]}>How&apos;s today?</Text>
        <MoodPicker value={null} onChange={onLog} />
      </Card>
    );
  }
  const m = moodInfo(entry.mood);
  const color = moodColor(entry.mood);
  const tagLabels = entry.tagIds.map((id) => tagById.get(id)).filter(Boolean).map((tag) => `${tag!.emoji} ${tag!.name}`);
  return (
    <Pressable onPress={onOpen}>
      <Card style={[styles.today, { borderColor: color, borderWidth: 1.5 }]}>
        <View style={styles.todayRow}>
          <MoodFace mood={entry.mood} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.todayTitle, { color: t.text, marginBottom: 2 }]}>Today · {m.label}</Text>
            <Text style={{ color: t.muted }} numberOfLines={2}>
              {entry.note.trim() || tagLabels.length ? [tagLabels.join('  '), entry.note.trim()].filter(Boolean).join('\n') : 'Add tags or a note →'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.muted} />
        </View>
      </Card>
    </Pressable>
  );
}

function EntryRow({ entry, tagById, onPress }: { entry: Entry; tagById: Map<number, Tag>; onPress: () => void }) {
  const t = useTheme();
  const m = moodInfo(entry.mood);
  const tags = entry.tagIds.map((id) => tagById.get(id)?.emoji).filter(Boolean).join(' ');
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.entry, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}>
      <MoodFace mood={entry.mood} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '600' }}>
          {formatShort(entry.date)} <Text style={{ color: t.muted, fontWeight: '400' }}>· {m.label}</Text>
          {tags ? <Text>{'  '}{tags}</Text> : null}
        </Text>
        {entry.note.trim() ? (
          <Text style={{ color: t.muted, marginTop: 2 }} numberOfLines={2}>
            {entry.note.trim()}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { fontSize: 30, fontWeight: '800' },
  subtitle: { fontSize: 14, marginBottom: 16 },
  today: { marginBottom: 20 },
  todayTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  period: { fontSize: 17, fontWeight: '700', minWidth: 120, textAlign: 'center' },
  listTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 24, marginBottom: 4 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
