import { dayKey, daysBetween, daysInMonth, formatLong, formatMedium, fromKey, MONTHS, todayKey, WEEKDAYS_SHORT, type DayKey } from './dates';
import type { Entry, Tag } from './db';
import { computeInsights, MIN_TAG_DAYS } from './insights';
import { MOODS, moodInfo } from './moods';

export type ReportOptions = {
  from: DayKey;
  to: DayKey;
  entries: Entry[];
  tags: Tag[];
  includeNotes: boolean;
  includeTags: boolean;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function monthsInRange(from: DayKey, to: DayKey) {
  const start = fromKey(from);
  const end = fromKey(to);
  const months: { year: number; month: number }[] = [];
  for (let y = start.getFullYear(), m = start.getMonth(); y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth()); ) {
    months.push({ year: y, month: m });
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
  return months;
}

function monthGrid(year: number, month: number, byDate: Map<DayKey, Entry>, from: DayKey, to: DayKey) {
  const offset = new Date(year, month, 1).getDay();
  const cells: string[] = Array.from({ length: offset }, () => '<td class="blank"></td>');
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const key = dayKey(year, month, d);
    const entry = byDate.get(key);
    const inRange = key >= from && key <= to;
    cells.push(
      entry && inRange
        ? `<td style="background:${moodInfo(entry.mood).color}">${moodInfo(entry.mood).emoji}</td>`
        : `<td class="${inRange ? 'empty' : 'out'}">${d}</td>`
    );
  }
  while (cells.length % 7) cells.push('<td class="blank"></td>');
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  return `
    <div class="month">
      <div class="month-title">${MONTHS[month]} ${year}</div>
      <table class="cal">
        <tr>${WEEKDAYS_SHORT.map((w) => `<th>${w}</th>`).join('')}</tr>
        ${rows.join('')}
      </table>
    </div>`;
}

export function buildReportHtml({ from, to, entries, tags, includeNotes, includeTags }: ReportOptions) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const stats = computeInsights(entries, tags);
  const totalDays = daysBetween(from, to);
  const avg = stats.average;

  const distribution = MOODS.map((m) => {
    const n = stats.distribution[m.value];
    const pct = stats.count ? (n / stats.count) * 100 : 0;
    return pct > 0 ? `<div style="width:${pct}%;background:${m.color}" title="${m.label}"></div>` : '';
  }).join('');

  const legend = MOODS.map(
    (m) => `<span class="legend"><i style="background:${m.color}"></i>${m.emoji} ${m.label} · ${stats.distribution[m.value]}</span>`
  ).join('');

  const tagRows = stats.tags
    .filter((s) => s.count >= MIN_TAG_DAYS)
    .map(
      (s) => `<tr>
        <td>${esc(s.tag.emoji)} ${esc(s.tag.name)}</td>
        <td>${s.count}</td>
        <td>${moodInfo(s.average).emoji} ${s.average.toFixed(1)}</td>
        <td class="${s.delta >= 0 ? 'up' : 'down'}">${s.delta >= 0 ? '+' : ''}${s.delta.toFixed(1)}</td>
      </tr>`
    )
    .join('');

  const entryRows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const m = moodInfo(e.mood);
      const tagText = includeTags
        ? e.tagIds
            .map((id) => tagById.get(id))
            .filter(Boolean)
            .map((t) => `<span class="tag">${esc(t!.emoji)} ${esc(t!.name)}</span>`)
            .join('')
        : '';
      const note = includeNotes && e.note.trim() ? `<div class="note">${esc(e.note.trim())}</div>` : '';
      return `<div class="entry">
        <div class="entry-head">
          <span class="dot" style="background:${m.color}"></span>
          <strong>${formatLong(e.date)}</strong>
          <span class="mood">${m.emoji} ${m.label}</span>
        </div>
        ${tagText ? `<div class="tags">${tagText}</div>` : ''}
        ${note}
      </div>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: #26231F; font-size: 12px; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 22px 0 8px; border-bottom: 1px solid #E8E2D9; padding-bottom: 4px; }
  .sub { color: #8A847B; margin-bottom: 14px; }
  .stats { display: flex; gap: 10px; margin-bottom: 12px; }
  .stat { flex: 1; border: 1px solid #E8E2D9; border-radius: 8px; padding: 8px 10px; }
  .stat b { display: block; font-size: 18px; }
  .stat span { color: #8A847B; font-size: 11px; }
  .bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: #ECE7DF; }
  .legend { display: inline-block; margin: 6px 12px 0 0; font-size: 11px; }
  .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; }
  .months { display: flex; flex-wrap: wrap; gap: 14px; }
  .month { width: 31%; page-break-inside: avoid; }
  .month-title { font-weight: 600; margin-bottom: 4px; }
  .cal { border-collapse: separate; border-spacing: 2px; width: 100%; }
  .cal th { font-size: 9px; color: #8A847B; font-weight: 500; }
  .cal td { height: 22px; text-align: center; font-size: 11px; border-radius: 4px; }
  .cal td.empty { background: #F1EDE6; color: #B5AEA4; font-size: 9px; }
  .cal td.out { color: #D9D3CA; font-size: 9px; }
  table.tags-table { width: 100%; border-collapse: collapse; }
  .tags-table th, .tags-table td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #F1EDE6; }
  .tags-table th { color: #8A847B; font-weight: 500; font-size: 11px; }
  .up { color: #2E8B60; } .down { color: #C94A4A; }
  .entry { padding: 8px 0; border-bottom: 1px solid #F1EDE6; page-break-inside: avoid; }
  .entry-head { display: flex; align-items: center; gap: 8px; }
  .dot { width: 10px; height: 10px; border-radius: 5px; display: inline-block; }
  .mood { color: #8A847B; margin-left: auto; }
  .tags { margin: 4px 0 0 18px; }
  .tag { display: inline-block; background: #F1EDE6; border-radius: 10px; padding: 1px 8px; margin: 2px 4px 0 0; font-size: 11px; }
  .note { margin: 6px 0 0 18px; white-space: pre-wrap; line-height: 1.45; }
  .muted { color: #8A847B; }
</style></head>
<body>
  <h1>Kindred · Mood report</h1>
  <div class="sub">${formatMedium(from)} – ${formatMedium(to)} · generated ${formatMedium(todayKey())}</div>

  <div class="stats">
    <div class="stat"><b>${stats.count} / ${totalDays}</b><span>days logged</span></div>
    <div class="stat"><b>${avg == null ? '—' : `${moodInfo(avg).emoji} ${avg.toFixed(1)}`}</b><span>average mood (1–5)</span></div>
    <div class="stat"><b>${stats.distribution[5] + stats.distribution[4]}</b><span>good or great days</span></div>
    <div class="stat"><b>${stats.distribution[1] + stats.distribution[2]}</b><span>bad or awful days</span></div>
  </div>
  <div class="bar">${distribution}</div>
  <div>${legend}</div>

  <h2>Calendar</h2>
  <div class="months">${monthsInRange(from, to).map(({ year, month }) => monthGrid(year, month, byDate, from, to)).join('')}</div>

  ${
    includeTags && tagRows
      ? `<h2>Tags and mood</h2>
         <table class="tags-table">
           <tr><th>Tag</th><th>Days</th><th>Avg mood</th><th>vs. other days</th></tr>
           ${tagRows}
         </table>`
      : ''
  }

  <h2>Entries</h2>
  ${entryRows || '<p class="muted">No entries in this range.</p>'}
</body></html>`;
}
