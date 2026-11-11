import type { DayKey } from '../dates';
import type { MoodValue } from '../moods';
import { parseCsvRecords } from './csv';

/** One check-in as it appears in the source app. A day can have several. */
export type SourceRow = { date: DayKey; minutes: number; moodLabel: string; activities: string[]; note: string };

export type ParsedImport = {
  source: 'daylio' | 'kindred';
  rows: SourceRow[];
  /** Emoji for each tag name (lowercased), used when the import has to create the tag. */
  tagEmojis: Record<string, string>;
  /** Every mood name in the file with how often it appears; `mood` is our best guess, null if unknown. */
  moodLabels: { label: string; count: number; mood: MoodValue | null }[];
};

/** What gets written to Kindred: one entry per day. */
export type ImportedDay = { date: DayKey; mood: MoodValue; note: string; tagNames: string[] };

// Daylio's five default mood names. Custom names (renamed moods) are mapped by the user.
const DAYLIO_MOODS: Record<string, MoodValue> = { rad: 5, good: 4, meh: 3, bad: 2, awful: 1 };

/** "9:40 PM", "09:40 pm" or "21:40" → minutes after midnight. */
function parseTime(s: string) {
  const m = /^(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?\.?$/i.exec(s.trim());
  if (!m) return 0;
  let h = Number(m[1]) % 24;
  if (m[3]) h = (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
  return h * 60 + Number(m[2]);
}

/** Daylio notes can carry light HTML (line breaks, bold). Keep the text. */
function plainText(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

export function parseDaylio(text: string): ParsedImport {
  const { headers, records } = parseCsvRecords(text);
  if (!headers.includes('full_date') || !headers.includes('mood')) {
    throw new Error("This doesn't look like a Daylio export. In Daylio, go to More → Export Entries → CSV.");
  }

  const rows: SourceRow[] = [];
  const counts = new Map<string, number>();
  for (const r of records) {
    const date = r.full_date.trim();
    const moodLabel = r.mood.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !moodLabel) continue;
    const title = plainText(r.note_title ?? '');
    const body = plainText(r.note ?? '');
    rows.push({
      date,
      minutes: parseTime(r.time ?? ''),
      moodLabel,
      activities: (r.activities ?? '')
        .split('|')
        .map((a) => a.trim())
        .filter(Boolean),
      note: [title, body].filter(Boolean).join('\n\n'),
    });
    counts.set(moodLabel, (counts.get(moodLabel) ?? 0) + 1);
  }
  if (rows.length === 0) throw new Error('The file has no entries.');

  const moodLabels = [...counts]
    .map(([label, count]) => ({ label, count, mood: DAYLIO_MOODS[label.toLowerCase()] ?? null }))
    // Known moods best-first, then unknown ones by how common they are.
    .sort((a, b) => (b.mood ?? 0) - (a.mood ?? 0) || b.count - a.count);
  return { source: 'daylio', rows, moodLabels, tagEmojis: {} };
}

/**
 * Folds check-ins into one entry per day: the day's last check-in sets the mood, activities are
 * combined, and notes are kept in time order.
 */
export function toDays(rows: SourceRow[], moodFor: (label: string) => MoodValue): ImportedDay[] {
  const byDate = new Map<DayKey, SourceRow[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  return [...byDate].map(([date, dayRows]) => {
    const sorted = [...dayRows].sort((a, b) => a.minutes - b.minutes);
    return {
      date,
      mood: moodFor(sorted[sorted.length - 1].moodLabel),
      note: sorted
        .map((r) => r.note)
        .filter(Boolean)
        .join('\n\n'),
      tagNames: [...new Set(sorted.flatMap((r) => r.activities))],
    };
  });
}
