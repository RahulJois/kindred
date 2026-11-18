import type { SQLiteDatabase } from 'expo-sqlite';

import type { DayKey } from './dates';

export type Entry = { date: DayKey; mood: number; note: string; tagIds: number[] };
export type Tag = { id: number; name: string; emoji: string; archived: boolean };

const DEFAULT_TAGS: [string, string][] = [
  ['🏃', 'Exercise'],
  ['💼', 'Work'],
  ['😴', 'Good sleep'],
  ['👪', 'Family'],
  ['🤝', 'Friends'],
  ['🌳', 'Outdoors'],
  ['🎨', 'Hobby'],
  ['🛋️', 'Rest'],
];

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS entries (
        date TEXT PRIMARY KEY NOT NULL,
        mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
        note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS entry_tags (
        date TEXT NOT NULL REFERENCES entries(date) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id),
        PRIMARY KEY (date, tag_id)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `);
    for (const [emoji, name] of DEFAULT_TAGS) {
      await db.runAsync('INSERT INTO tags (name, emoji) VALUES (?, ?)', name, emoji);
    }
    version = 1;
  }

  if (version < 2) {
    // What a day looked like before each quick log, so the log can be undone.
    // prev_mood NULL means the day had no entry.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS quick_log_undo (
        ts INTEGER PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        prev_mood INTEGER
      );
    `);
    version = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${version}`);
}

type EntryRow = { date: string; mood: number; note: string; tag_ids: string | null };

const toEntry = (r: EntryRow): Entry => ({
  date: r.date,
  mood: r.mood,
  note: r.note,
  tagIds: r.tag_ids ? r.tag_ids.split(',').map(Number) : [],
});

/** Entries in [from, to], newest first. */
export async function getEntries(db: SQLiteDatabase, from: DayKey = '0000-01-01', to: DayKey = '9999-12-31') {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT e.date, e.mood, e.note, group_concat(et.tag_id) AS tag_ids
       FROM entries e LEFT JOIN entry_tags et ON et.date = e.date
      WHERE e.date BETWEEN ? AND ?
      GROUP BY e.date
      ORDER BY e.date DESC`,
    from,
    to
  );
  return rows.map(toEntry);
}

/**
 * Days whose note or one of whose tags contains `text` (case-insensitive), newest first.
 * `mood` narrows to one mood; an empty `text` with a mood lists every day with that mood.
 */
export async function searchEntries(db: SQLiteDatabase, text: string, mood: number | null, limit = 200) {
  const pattern = `%${text.trim().replace(/[\\%_]/g, (c) => '\\' + c)}%`;
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT e.date, e.mood, e.note, group_concat(et.tag_id) AS tag_ids
       FROM entries e LEFT JOIN entry_tags et ON et.date = e.date
      WHERE (?1 IS NULL OR e.mood = ?1)
        AND (e.note LIKE ?2 ESCAPE '\\' OR EXISTS (
              SELECT 1 FROM entry_tags x JOIN tags t ON t.id = x.tag_id
               WHERE x.date = e.date AND t.name LIKE ?2 ESCAPE '\\'))
      GROUP BY e.date
      ORDER BY e.date DESC
      LIMIT ?3`,
    mood,
    pattern,
    limit
  );
  return rows.map(toEntry);
}

export async function getEntry(db: SQLiteDatabase, date: DayKey) {
  const [entry] = await getEntries(db, date, date);
  return entry ?? null;
}

export async function saveEntry(db: SQLiteDatabase, entry: Entry) {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO entries (date, mood, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, note = excluded.note, updated_at = excluded.updated_at`,
      entry.date,
      entry.mood,
      entry.note,
      now,
      now
    );
    await db.runAsync('DELETE FROM entry_tags WHERE date = ?', entry.date);
    for (const tagId of entry.tagIds) {
      await db.runAsync('INSERT INTO entry_tags (date, tag_id) VALUES (?, ?)', entry.date, tagId);
    }
  });
}

/**
 * Sets just the mood for a day, keeping any note and tags. A quick log from the
 * notification only wins if it happened after the entry was last edited in the app.
 */
export async function setMood(db: SQLiteDatabase, date: DayKey, mood: number, at = Date.now()) {
  await db.runAsync(
    `INSERT INTO entries (date, mood, note, created_at, updated_at) VALUES (?, ?, '', ?, ?)
     ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, updated_at = excluded.updated_at
     WHERE excluded.updated_at >= entries.updated_at`,
    date,
    mood,
    at,
    at
  );
}

/** Applies a one-tap mood (notification, widget or today card), remembering the previous state for undo. */
export async function quickLog(db: SQLiteDatabase, date: DayKey, mood: number, ts: number) {
  const prev = await getEntry(db, date);
  await db.runAsync(
    'INSERT OR REPLACE INTO quick_log_undo (ts, date, prev_mood) VALUES (?, ?, ?)',
    ts,
    date,
    prev?.mood ?? null
  );
  // Undo only ever needs the last few seconds; drop anything older than a day.
  await db.runAsync('DELETE FROM quick_log_undo WHERE ts < ?', ts - 86_400_000);
  await setMood(db, date, mood, ts);
}

/** Reverts the quick log [ts]. Returns the day it touched and its mood afterwards, or null if unknown. */
export async function undoQuickLog(db: SQLiteDatabase, ts: number) {
  const row = await db.getFirstAsync<{ date: string; prev_mood: number | null }>(
    'SELECT date, prev_mood FROM quick_log_undo WHERE ts = ?',
    ts
  );
  if (!row) return null;
  if (row.prev_mood == null) {
    await deleteEntry(db, row.date);
  } else {
    // Restore only the mood; tags and a note added since are kept.
    await db.runAsync('UPDATE entries SET mood = ?, updated_at = ? WHERE date = ?', row.prev_mood, Date.now(), row.date);
  }
  await db.runAsync('DELETE FROM quick_log_undo WHERE ts = ?', ts);
  return { date: row.date, mood: row.prev_mood };
}

export async function deleteEntry(db: SQLiteDatabase, date: DayKey) {
  await db.runAsync('DELETE FROM entries WHERE date = ?', date);
}

type TagRow = { id: number; name: string; emoji: string; archived: number };

export async function getTags(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<TagRow>('SELECT id, name, emoji, archived FROM tags ORDER BY id');
  return rows.map((r): Tag => ({ ...r, archived: r.archived === 1 }));
}

export async function addTag(db: SQLiteDatabase, emoji: string, name: string) {
  await db.runAsync('INSERT INTO tags (name, emoji) VALUES (?, ?)', name, emoji);
}

export async function updateTag(db: SQLiteDatabase, id: number, emoji: string, name: string) {
  await db.runAsync('UPDATE tags SET emoji = ?, name = ? WHERE id = ?', emoji, name, id);
}

export const DEFAULT_TAG_EMOJI = '🏷️';

/**
 * Writes imported days in one transaction. Tags are matched to existing ones by name (ignoring
 * case) and created when missing. Days already in Kindred are kept unless `replaceExisting`.
 * Rows go in as one JSON parameter expanded by json_each, so a year of history is a handful of
 * statements instead of one native call per row.
 */
export async function importDays(
  db: SQLiteDatabase,
  days: { date: DayKey; mood: number; note: string; tagNames: string[] }[],
  replaceExisting: boolean,
  /** Emoji for tags the import creates, keyed by lowercased name. Existing tags keep theirs. */
  tagEmojis: Record<string, string> = {}
) {
  const result = { added: 0, replaced: 0, skipped: 0, tagsCreated: 0 };
  await db.withTransactionAsync(async () => {
    const tagIds = new Map((await getTags(db)).map((t) => [t.name.trim().toLowerCase(), t.id]));
    const existing = new Set((await db.getAllAsync<{ date: string }>('SELECT date FROM entries')).map((r) => r.date));

    const rows: { date: DayKey; mood: number; note: string }[] = [];
    const links: [DayKey, number][] = [];
    for (const day of days) {
      if (existing.has(day.date)) {
        if (!replaceExisting) {
          result.skipped++;
          continue;
        }
        result.replaced++;
      } else result.added++;
      rows.push({ date: day.date, mood: day.mood, note: day.note });
      for (const name of day.tagNames) {
        const key = name.trim().toLowerCase();
        let id = tagIds.get(key);
        if (id == null) {
          id = (await db.runAsync('INSERT INTO tags (name, emoji) VALUES (?, ?)', name.trim(), tagEmojis[key] || DEFAULT_TAG_EMOJI)).lastInsertRowId;
          tagIds.set(key, id);
          result.tagsCreated++;
        }
        links.push([day.date, id]);
      }
    }
    if (rows.length === 0) return;

    const now = Date.now();
    const json = JSON.stringify(rows);
    await db.runAsync(
      `INSERT INTO entries (date, mood, note, created_at, updated_at)
       SELECT json_extract(value, '$.date'), json_extract(value, '$.mood'), json_extract(value, '$.note'), ?, ?
         FROM json_each(?) WHERE true
       ON CONFLICT(date) DO UPDATE SET mood = excluded.mood, note = excluded.note, updated_at = excluded.updated_at`,
      now,
      now,
      json
    );
    await db.runAsync(
      `DELETE FROM entry_tags WHERE date IN (SELECT json_extract(value, '$.date') FROM json_each(?))`,
      json
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO entry_tags (date, tag_id)
       SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]') FROM json_each(?)`,
      JSON.stringify(links)
    );
  });
  return result;
}

/** Tags are archived rather than deleted so past entries keep their history. */
export async function setTagArchived(db: SQLiteDatabase, id: number, archived: boolean) {
  await db.runAsync('UPDATE tags SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
}

export async function getSetting(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}
