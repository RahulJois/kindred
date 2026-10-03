import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSQLiteContext } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, SectionTitle } from '../components/ui';
import { useQuery } from '../data';
import { addDays, daysBetween, formatMedium, fromKey, toKey, todayKey, type DayKey } from '../dates';
import { getEntries, getTags } from '../db';
import { buildReportHtml } from '../pdf';
import { useTheme } from '../theme';

type Preset = 'month' | '30' | '90' | 'year' | 'all' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

function presetRange(preset: Preset, firstEntry: DayKey | null): [DayKey, DayKey] {
  const today = todayKey();
  switch (preset) {
    case 'month':
      return [`${today.slice(0, 7)}-01`, today];
    case '30':
      return [addDays(today, -29), today];
    case '90':
      return [addDays(today, -89), today];
    case 'year':
      return [`${today.slice(0, 4)}-01-01`, today];
    default:
      return [firstEntry ?? today, today];
  }
}

export default function ExportScreen() {
  const t = useTheme();
  const db = useSQLiteContext();
  const first = useQuery(async (db) => (await db.getFirstAsync<{ d: string | null }>('SELECT min(date) AS d FROM entries'))?.d ?? null);

  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState<[DayKey, DayKey]>(() => presetRange('month', null));
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeTags, setIncludeTags] = useState(true);
  const [busy, setBusy] = useState(false);

  const [from, to] = preset === 'custom' ? custom : presetRange(preset, first ?? null);
  const count = useQuery(
    async (db) => (await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM entries WHERE date BETWEEN ? AND ?', from, to))?.n ?? 0,
    `${from}|${to}`
  );

  const pickDate = (which: 0 | 1) =>
    DateTimePickerAndroid.open({
      value: fromKey(custom[which]),
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_e, date) => {
        const key = toKey(date);
        setCustom(([a, b]) => {
          const next: [DayKey, DayKey] = which === 0 ? [key, b] : [a, key];
          return next[0] <= next[1] ? next : [next[1], next[0]];
        });
      },
    });

  const exportPdf = async () => {
    setBusy(true);
    try {
      const [entries, tags] = await Promise.all([getEntries(db, from, to), getTags(db)]);
      const html = buildReportHtml({ from, to, entries, tags, includeNotes, includeTags });
      const { uri } = await Print.printToFileAsync({ html });
      // expo-print names the file with a random UUID; give it a name that means something when saved.
      const pdf = new File(Paths.cache, `kindred-mood-${from}-to-${to}.pdf`);
      if (pdf.exists) pdf.delete();
      new File(uri).move(pdf);
      await Sharing.shareAsync(pdf.uri, { mimeType: 'application/pdf', dialogTitle: 'Share mood report' });
    } catch (e) {
      Alert.alert("Couldn't create the PDF", String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.content}>
      <SectionTitle>Date range</SectionTitle>
      <View style={styles.chips}>
        {PRESETS.map((p) => (
          <Chip key={p.value} label={p.label} selected={preset === p.value} onPress={() => setPreset(p.value)} />
        ))}
      </View>

      {preset === 'custom' && (
        <View style={styles.customRow}>
          <DateField label="From" value={custom[0]} onPress={() => pickDate(0)} />
          <DateField label="To" value={custom[1]} onPress={() => pickDate(1)} />
        </View>
      )}

      <Card style={{ marginTop: 8 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>
          {formatMedium(from)} – {formatMedium(to)}
        </Text>
        <Text style={{ color: t.muted, marginTop: 4 }}>
          {count ?? '…'} of {daysBetween(from, to)} {daysBetween(from, to) === 1 ? 'day' : 'days'} logged
        </Text>
      </Card>

      <SectionTitle>Include</SectionTitle>
      <Card style={{ paddingVertical: 4 }}>
        <ToggleRow label="Notes" value={includeNotes} onChange={setIncludeNotes} />
        <ToggleRow label="Tags and tag patterns" value={includeTags} onChange={setIncludeTags} last />
      </Card>

      <View style={{ marginTop: 24 }}>
        {busy ? <ActivityIndicator color={t.accent} /> : <Button title="Create PDF" onPress={exportPdf} disabled={!count} />}
      </View>
      <Text style={[styles.hint, { color: t.muted }]}>
        The report has a summary, a color calendar for each month, and every entry. You can save or send it from the share sheet.
      </Text>
    </ScrollView>
  );
}

function DateField({ label, value, onPress }: { label: string; value: DayKey; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.dateField, { borderColor: t.border, backgroundColor: t.card }]}>
      <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{formatMedium(value)}</Text>
    </Pressable>
  );
}

function ToggleRow({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.toggleRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border }]}>
      <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.accent + '77', false: t.border }}
        thumbColor={value ? t.accent : t.card}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  customRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  dateField: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  hint: { textAlign: 'center', fontSize: 13, marginTop: 14 },
});
