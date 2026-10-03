import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, SectionTitle, Segmented, StatusBarBackdrop } from '../../components/ui';
import { useQuery } from '../../data';
import { addDays, todayKey, WEEKDAYS } from '../../dates';
import { getEntries, getTags } from '../../db';
import { computeInsights, computeStreaks, MIN_TAG_DAYS } from '../../insights';
import { MOODS, moodInfo } from '../../moods';
import { useTheme } from '../../theme';

type Range = '30' | '90' | 'year' | 'all';

function rangeStart(range: Range) {
  const today = todayKey();
  if (range === '30') return addDays(today, -29);
  if (range === '90') return addDays(today, -89);
  if (range === 'year') return `${today.slice(0, 4)}-01-01`;
  return '0000-01-01';
}

export default function InsightsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<Range>('30');

  const data = useQuery(async (db) => ({ all: await getEntries(db), tags: await getTags(db) }));
  const from = rangeStart(range);
  const entries = useMemo(() => (data?.all ?? []).filter((e) => e.date >= from), [data, from]);
  const stats = useMemo(() => computeInsights(entries, data?.tags ?? []), [entries, data]);
  const streaks = useMemo(() => computeStreaks((data?.all ?? []).map((e) => e.date)), [data]);

  const maxCount = Math.max(1, ...Object.values(stats.distribution));
  const tagStats = stats.tags.filter((s) => s.count >= MIN_TAG_DAYS);

  return (
    <>
      <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: t.text }]}>Insights</Text>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
            { value: 'year', label: 'This year' },
            { value: 'all', label: 'All' },
          ]}
        />

        <View style={styles.stats}>
          <Stat label="Average" value={stats.average == null ? '—' : `${moodInfo(stats.average).emoji} ${stats.average.toFixed(1)}`} />
          <Stat label="Days logged" value={String(stats.count)} />
          <Stat label="Streak" value={`${streaks.current}d`} hint={`best ${streaks.longest}d`} />
        </View>

        {stats.count === 0 ? (
          <Card>
            <Text style={{ color: t.muted, textAlign: 'center' }}>Log a few days and patterns will show up here.</Text>
          </Card>
        ) : (
          <>
            <SectionTitle>Mood count</SectionTitle>
            <Card>
              {MOODS.map((m) => (
                <View key={m.value} style={styles.barRow}>
                  <Text style={styles.barEmoji}>{m.emoji}</Text>
                  <View style={[styles.barTrack, { backgroundColor: t.empty }]}>
                    <View style={[styles.bar, { width: `${(stats.distribution[m.value] / maxCount) * 100}%`, backgroundColor: m.color }]} />
                  </View>
                  <Text style={[styles.barValue, { color: t.muted }]}>{stats.distribution[m.value]}</Text>
                </View>
              ))}
            </Card>

            <SectionTitle>Tags and mood</SectionTitle>
            <Card>
              {tagStats.length === 0 ? (
                <Text style={{ color: t.muted }}>
                  Tag your days (at least {MIN_TAG_DAYS} times per tag) to see which ones go with better or worse moods.
                </Text>
              ) : (
                tagStats.map((s) => (
                  <View key={s.tag.id} style={styles.tagRow}>
                    <Text style={{ color: t.text, flex: 1, fontSize: 15 }}>
                      {s.tag.emoji} {s.tag.name} <Text style={{ color: t.muted, fontSize: 13 }}>· {s.count}d</Text>
                    </Text>
                    <Text style={{ color: t.muted, marginRight: 12 }}>
                      {moodInfo(s.average).emoji} {s.average.toFixed(1)}
                    </Text>
                    <Text style={[styles.delta, { color: s.delta >= 0 ? '#2E8B60' : t.danger }]}>
                      {s.delta >= 0 ? '+' : ''}
                      {s.delta.toFixed(1)}
                    </Text>
                  </View>
                ))
              )}
              {tagStats.length > 0 && (
                <Text style={[styles.footnote, { color: t.muted }]}>Average mood on days with the tag, and the difference vs. days without it.</Text>
              )}
            </Card>

            <SectionTitle>By day of week</SectionTitle>
            <Card>
              <View style={styles.weekRow}>
                {stats.weekdays.map((w, i) => (
                  <View key={i} style={styles.weekCol}>
                    <View style={[styles.weekTrack, { backgroundColor: t.empty }]}>
                      {w.average != null && (
                        <View
                          style={[styles.weekBar, { height: `${(w.average / 5) * 100}%`, backgroundColor: moodInfo(w.average).color }]}
                        />
                      )}
                    </View>
                    <Text style={{ color: t.text, fontSize: 12, marginTop: 4 }}>{w.average == null ? '–' : w.average.toFixed(1)}</Text>
                    <Text style={{ color: t.muted, fontSize: 11 }}>{WEEKDAYS[i].slice(0, 3)}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
      <StatusBarBackdrop />
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const t = useTheme();
  return (
    <Card style={styles.stat}>
      <Text style={[styles.statValue, { color: t.text }]}>{value}</Text>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
      {hint ? <Text style={{ color: t.muted, fontSize: 11 }}>{hint}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 14 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, padding: 12 },
  statValue: { fontSize: 20, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  barEmoji: { fontSize: 20, width: 32 },
  barTrack: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  bar: { height: 12, borderRadius: 6 },
  barValue: { width: 32, textAlign: 'right' },
  tagRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  delta: { width: 44, textAlign: 'right', fontWeight: '700' },
  footnote: { fontSize: 12, marginTop: 8 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol: { flex: 1, alignItems: 'center' },
  weekTrack: { width: 18, height: 90, borderRadius: 9, justifyContent: 'flex-end', overflow: 'hidden' },
  weekBar: { width: '100%', borderRadius: 9 },
});
