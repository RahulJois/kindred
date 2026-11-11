import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { MoodFace } from '../components/MoodFace';
import { Button, Card, SectionTitle } from '../components/ui';
import { notifyDayMood, useRefresh } from '../data';
import { formatMedium, todayKey } from '../dates';
import { getTags, importDays } from '../db';
import { toDays, type ParsedImport } from '../import/daylio';
import { parseImport } from '../import/kindred';
import { MOODS, type MoodValue } from '../moods';
import { useTheme } from '../theme';

type Loaded = ParsedImport & { existingDates: Set<string>; tagNames: Set<string> };

export default function ImportScreen() {
  const t = useTheme();
  const db = useSQLiteContext();
  const refresh = useRefresh();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Record<string, MoodValue | null>>({});
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    try {
      const picked = await File.pickFileAsync();
      if (picked.canceled) return;
      setBusy(true);
      const parsed = parseImport(await picked.result.text());
      const [dates, tags] = await Promise.all([db.getAllAsync<{ date: string }>('SELECT date FROM entries'), getTags(db)]);
      setLoaded({
        ...parsed,
        existingDates: new Set(dates.map((d) => d.date)),
        tagNames: new Set(tags.map((tag) => tag.name.trim().toLowerCase())),
      });
      setMapping(Object.fromEntries(parsed.moodLabels.map((m) => [m.label, m.mood])));
      setReplaceExisting(false);
    } catch (e) {
      Alert.alert("Couldn't read that file", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const unmapped = loaded ? loaded.moodLabels.filter((m) => mapping[m.label] == null) : [];

  const preview = useMemo(() => {
    if (!loaded) return null;
    const days = toDays(loaded.rows, (label) => mapping[label] ?? 3);
    const dates = days.map((d) => d.date).sort();
    const activities = new Set(days.flatMap((d) => d.tagNames));
    return {
      days,
      first: dates[0],
      last: dates[dates.length - 1],
      overlap: days.filter((d) => loaded.existingDates.has(d.date)).length,
      multiCheckIn: loaded.rows.length - days.length,
      activities: activities.size,
      newTags: [...activities].filter((a) => !loaded.tagNames.has(a.trim().toLowerCase())).length,
    };
  }, [loaded, mapping]);

  const runImport = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await importDays(db, preview.days, replaceExisting, loaded!.tagEmojis);
      const today = preview.days.find((d) => d.date === todayKey());
      if (today && (replaceExisting || !loaded!.existingDates.has(today.date))) notifyDayMood(today.date, today.mood);
      refresh();
      const parts: string[] = [];
      if (res.added) parts.push(`${res.added} ${res.added === 1 ? 'day' : 'days'} added`);
      if (res.replaced) parts.push(`${res.replaced} ${res.replaced === 1 ? 'day' : 'days'} replaced`);
      if (res.skipped) parts.push(`${res.skipped} already in Kindred kept as they were`);
      if (res.tagsCreated) parts.push(`${res.tagsCreated} new ${res.tagsCreated === 1 ? 'tag' : 'tags'}`);
      Alert.alert('Import complete', parts.join(', ') + '.', [{ text: 'Done', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Import failed', `Nothing was changed. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const willImport = preview ? (replaceExisting ? preview.days.length : preview.days.length - preview.overlap) : 0;

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.content}>
      <Card>
        <Text style={[styles.heading, { color: t.text }]}>Bring your history</Text>
        <Text style={{ color: t.muted, lineHeight: 20, marginTop: 6 }}>
          Restore a CSV you exported from Kindred (Settings → Export as PDF or CSV, with tags and notes), or bring over Daylio: open More →
          Export Entries → CSV there. Moods, tags and notes come across; Daylio activities become tags.
        </Text>
        <View style={{ marginTop: 14 }}>
          <Button title={loaded ? 'Choose a different file' : 'Choose CSV file'} variant={loaded ? 'secondary' : 'primary'} onPress={choose} disabled={busy} />
        </View>
      </Card>

      {loaded && preview && (
        <>
          <SectionTitle>In this file</SectionTitle>
          <Card>
            <Text style={[styles.heading, { color: t.text }]}>
              {preview.days.length} {preview.days.length === 1 ? 'day' : 'days'}
            </Text>
            <Text style={{ color: t.muted, marginTop: 2 }}>
              {loaded.source === 'kindred' ? 'Kindred export' : 'Daylio export'} · {formatMedium(preview.first)} – {formatMedium(preview.last)}
            </Text>
            <View style={[styles.facts, { borderColor: t.border }]}>
              {preview.activities > 0 && (
                <Fact>
                  {preview.activities} {noun(preview.activities, loaded.source === 'kindred' ? 'tag' : 'activity')}
                  {preview.newTags ? `, ${preview.newTags} will be new ${preview.newTags === 1 ? 'tag' : 'tags'}` : ', all match your tags'}
                </Fact>
              )}
              {preview.multiCheckIn > 0 && (
                <Fact>
                  {preview.multiCheckIn} extra {preview.multiCheckIn === 1 ? 'check-in' : 'check-ins'} on days with more than one. Kindred keeps
                  one mood per day, so the day&apos;s last check-in is used and notes are combined.
                </Fact>
              )}
              {preview.overlap > 0 && (
                <Fact>
                  {preview.overlap} {preview.overlap === 1 ? 'day is' : 'days are'} already logged in Kindred.
                </Fact>
              )}
            </View>
          </Card>

          {/* Kindred's own moods map one to one; only Daylio's (possibly renamed) moods need matching. */}
          {loaded.source === 'daylio' && <SectionTitle>Moods</SectionTitle>}
          <Card style={{ paddingVertical: 4, display: loaded.source === 'daylio' ? 'flex' : 'none' }}>
            {loaded.moodLabels.map((m, i) => (
              <View
                key={m.label}
                style={[styles.moodRow, i < loaded.moodLabels.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16, textTransform: 'capitalize' }}>{m.label}</Text>
                  <Text style={{ color: mapping[m.label] == null ? t.danger : t.muted, fontSize: 12 }}>
                    {mapping[m.label] == null ? 'Pick a mood' : `${m.count} ${m.count === 1 ? 'check-in' : 'check-ins'}`}
                  </Text>
                </View>
                {MOODS.map((mood) => {
                  const selected = mapping[m.label] === mood.value;
                  return (
                    <Pressable
                      key={mood.value}
                      onPress={() => setMapping((prev) => ({ ...prev, [m.label]: mood.value }))}
                      accessibilityLabel={`${m.label} as ${mood.label}`}
                      accessibilityState={{ selected }}
                      hitSlop={4}
                      style={[styles.moodOption, { opacity: selected ? 1 : 0.3 }]}>
                      <MoodFace mood={mood.value} size={28} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Card>

          {preview.overlap > 0 && (
            <Card style={{ marginTop: 12, paddingVertical: 8 }}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16 }}>Replace days already in Kindred</Text>
                  <Text style={{ color: t.muted, fontSize: 13, marginTop: 2 }}>
                    {replaceExisting ? 'The file wins for those days, including tags and notes' : 'Your Kindred entries stay as they are'}
                  </Text>
                </View>
                <Switch
                  value={replaceExisting}
                  onValueChange={setReplaceExisting}
                  trackColor={{ true: t.accent + '77', false: t.border }}
                  thumbColor={replaceExisting ? t.accent : t.card}
                />
              </View>
            </Card>
          )}

          <View style={{ marginTop: 24 }}>
            {busy ? (
              <ActivityIndicator color={t.accent} />
            ) : (
              <Button
                title={unmapped.length ? 'Pick a mood for every name' : willImport ? `Import ${willImport} ${willImport === 1 ? 'day' : 'days'}` : 'Nothing new to import'}
                onPress={runImport}
                disabled={unmapped.length > 0 || willImport === 0}
              />
            )}
          </View>
        </>
      )}
      {!loaded && busy && <ActivityIndicator color={t.accent} style={{ marginTop: 24 }} />}
    </ScrollView>
  );
}

const noun = (n: number, word: string) => (n === 1 ? word : word === 'activity' ? 'activities' : word + 's');

function Fact({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, lineHeight: 20, marginTop: 8 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 18, fontWeight: '700' },
  facts: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 4 },
  moodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  moodOption: { marginLeft: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
});
