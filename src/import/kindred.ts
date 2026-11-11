import { MOODS, type MoodValue } from '../moods';
import { parseCsvRecords } from './csv';
import { parseDaylio, type ParsedImport, type SourceRow } from './daylio';

const splitList = (s: string | undefined) => (s ?? '').split('|').map((x) => x.trim());

/** A CSV from Kindred's own export (Settings → Export as PDF or CSV): date, mood 1–5, tags, note. */
export function parseKindred(text: string): ParsedImport {
  const { records } = parseCsvRecords(text);
  const rows: SourceRow[] = [];
  const tagEmojis: Record<string, string> = {};
  const counts = new Map<MoodValue, number>();

  for (const r of records) {
    const date = r.date.trim();
    const mood = Number(r.mood) as MoodValue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !MOODS.some((m) => m.value === mood)) continue;
    const names = splitList(r.tags);
    const emojis = splitList(r.tag_emojis);
    names.forEach((name, i) => {
      if (name && emojis[i]) tagEmojis[name.toLowerCase()] ??= emojis[i];
    });
    rows.push({
      date,
      minutes: 0,
      moodLabel: moodLabel(mood),
      activities: names.filter(Boolean),
      // Kindred notes are plain text, unlike Daylio's HTML, so they're kept exactly.
      note: r.note ?? '',
    });
    counts.set(mood, (counts.get(mood) ?? 0) + 1);
  }
  if (rows.length === 0) throw new Error('The file has no entries.');

  const moodLabels = [...counts]
    .sort((a, b) => b[0] - a[0])
    .map(([mood, count]) => ({ label: moodLabel(mood), count, mood }));
  return { source: 'kindred', rows, moodLabels, tagEmojis };
}

const moodLabel = (mood: MoodValue) => MOODS.find((m) => m.value === mood)!.label;

/** Reads a Kindred or Daylio CSV, telling them apart by their columns. */
export function parseImport(text: string): ParsedImport {
  const { headers } = parseCsvRecords(text.slice(0, 2000));
  if (headers.includes('full_date')) return parseDaylio(text);
  if (headers.includes('date') && headers.includes('mood')) return parseKindred(text);
  throw new Error(
    "This file isn't a Kindred or Daylio export. Use a CSV from Settings → Export as PDF or CSV, or from Daylio's More → Export Entries → CSV."
  );
}
