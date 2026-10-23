import { fromKey, WEEKDAYS } from './dates';
import type { Entry, Tag } from './db';
import { toCsv } from './import/csv';
import { moodInfo } from './moods';

/** One row per day, oldest first. Tags are names joined with " | ", the same convention as Daylio. */
export function buildEntriesCsv({
  entries,
  tags,
  includeNotes,
  includeTags,
}: {
  entries: Entry[];
  tags: Tag[];
  includeNotes: boolean;
  includeTags: boolean;
}) {
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const header = ['date', 'weekday', 'mood', 'mood_label', ...(includeTags ? ['tags'] : []), ...(includeNotes ? ['note'] : [])];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [
      e.date,
      WEEKDAYS[fromKey(e.date).getDay()],
      e.mood,
      moodInfo(e.mood).label,
      ...(includeTags
        ? [
            e.tagIds
              .map((id) => tagById.get(id)?.name)
              .filter(Boolean)
              .join(' | '),
          ]
        : []),
      ...(includeNotes ? [e.note] : []),
    ]);
  return toCsv([header, ...rows]);
}
