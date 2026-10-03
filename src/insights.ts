import { addDays, fromKey, todayKey, type DayKey } from './dates';
import type { Entry, Tag } from './db';

/** A tag needs this many logged days before its mood difference is shown as a pattern. */
export const MIN_TAG_DAYS = 3;

export type TagStat = { tag: Tag; count: number; average: number; delta: number };

export type Insights = {
  count: number;
  average: number | null;
  distribution: Record<number, number>;
  weekdays: { average: number | null; count: number }[]; // index 0 = Sunday
  tags: TagStat[];
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeInsights(entries: Entry[], tags: Tag[]): Insights {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const byWeekday: number[][] = [[], [], [], [], [], [], []];
  for (const e of entries) {
    distribution[e.mood]++;
    byWeekday[fromKey(e.date).getDay()].push(e.mood);
  }
  const average = mean(entries.map((e) => e.mood));

  // For each tag: average mood on days with it vs. days without it.
  const tagStats: TagStat[] = [];
  for (const tag of tags) {
    const withTag = entries.filter((e) => e.tagIds.includes(tag.id)).map((e) => e.mood);
    const without = entries.filter((e) => !e.tagIds.includes(tag.id)).map((e) => e.mood);
    if (withTag.length === 0) continue;
    const avgWith = mean(withTag)!;
    tagStats.push({ tag, count: withTag.length, average: avgWith, delta: avgWith - (mean(without) ?? avgWith) });
  }
  tagStats.sort((a, b) => b.delta - a.delta);

  return {
    count: entries.length,
    average,
    distribution,
    weekdays: byWeekday.map((moods) => ({ average: mean(moods), count: moods.length })),
    tags: tagStats,
  };
}

/** Consecutive logged days ending today (or yesterday, if today isn't logged yet), and the best run ever. */
export function computeStreaks(allDates: DayKey[]) {
  const logged = new Set(allDates);
  let day = logged.has(todayKey()) ? todayKey() : addDays(todayKey(), -1);
  let current = 0;
  while (logged.has(day)) {
    current++;
    day = addDays(day, -1);
  }

  let longest = 0;
  let run = 0;
  let prev: DayKey | null = null;
  for (const d of [...allDates].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}
