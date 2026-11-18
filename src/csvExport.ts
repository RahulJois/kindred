import { fromKey, WEEKDAYS } from './dates';
import type { Entry, Tag } from './db';
import { toCsv } from './import/csv';
import { moodInfo } from './moods';

/**
 * One row per day, oldest first. Tags are names joined with " | ", the same convention as Daylio,
 * with their emojis in the same order in tag_emojis, so Kindred can import the file as a backup.
 */
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
  const header = ['date', 'weekday', 'mood', 'mood_label', ...(includeTags ? ['tags', 'tag_emojis'] : []), ...(includeNotes ? ['note'] : [])];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [
      e.date,
      WEEKDAYS[fromKey(e.date).getDay()],
      e.mood,
      moodInfo(e.mood).label,
      ...(includeTags ? tagColumns(e.tagIds.map((id) => tagById.get(id)).filter((t): t is Tag => !!t)) : []),
      ...(includeNotes ? [e.note] : []),
    ]);
  return toCsv([header, ...rows]);
}

/** Names and emojis as two parallel " | " lists. "|" is the separator, so it can't appear in a name. */
const tagColumns = (tags: Tag[]) => [tags.map((t) => t.name.replace(/\|/g, '/')).join(' | '), tags.map((t) => t.emoji).join(' | ')];
