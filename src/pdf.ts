import { addDays, dayKey, daysBetween, daysInMonth, formatLong, formatMedium, fromKey, MONTHS, todayKey, WEEKDAYS_SHORT, type DayKey } from './dates';
import type { Entry, Tag } from './db';
import { FACE_CIRCLE, FACE_STROKE_WIDTH, FACES, type PaletteId } from './faces';
import { computeInsights, MIN_TAG_DAYS } from './insights';
import { faceColors, MOODS, moodInfo } from './moods';

export type ReportOptions = {
  from: DayKey;
  to: DayKey;
  entries: Entry[];
  tags: Tag[];
  includeNotes: boolean;
  includeTags: boolean;
  palette: PaletteId;
};

/** A mood face as inline SVG (light palette; reports are printed on white). */
function faceSvg(p: PaletteId, mood: number, size: number, bare = false) {
  const f = FACES[Math.min(5, Math.max(1, Math.round(mood)))];
  const c = faceColors(p, mood);
  const ink = c.ink.light;
  const circle = bare ? '' : `<path d="${FACE_CIRCLE}" fill="${c.fill.light}" stroke="#000" stroke-opacity="0.14" stroke-width="0.8"/>`;
  const features = f.features
    .map((p) =>
      p.kind === 'fill'
        ? `<path d="${p.d}" fill="${ink}"/>`
        : `<path d="${p.d}" fill="none" stroke="${ink}" stroke-width="${FACE_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`
    )
    .join('');
  return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 24 24">${circle}${features}</svg>`;
}

/** Static version of the app's mood-over-time chart: gradient line, gaps on unlogged days. */
function timelineSvg(p: PaletteId, from: DayKey, to: DayKey, byDate: Map<DayKey, Entry>) {
  const days = daysBetween(from, to);
  const W = 680;
  const H = 150;
  const left = 26;
  const top = 18;
  const pad = 8;
  const dw = (W - left) / days;
  const y = (m: number) => top + pad + ((5 - m) * (H - 2 * pad)) / 4;
  const x = (i: number) => left + i * dw + dw / 2;
  let paths = '';
  let run: string[] = [];
  const dots: string[] = [];
  const flush = () => {
    if (run.length > 1) paths += `<path d="${run.join('')}" fill="none" stroke="url(#g)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    run = [];
  };
  let months = '';
  for (let i = 0; i < days; i++) {
    const key = addDays(from, i);
    const d = fromKey(key);
    if (d.getDate() === 1 || i === 0) {
      months += `<text x="${left + i * dw + 2}" y="10" font-size="9" fill="#8A847B">${MONTHS[d.getMonth()].slice(0, 3)}</text>`;
      if (i > 0) months += `<line x1="${left + i * dw}" x2="${left + i * dw}" y1="${top}" y2="${top + H}" stroke="#B5AEA4" stroke-dasharray="2,3"/>`;
    }
    const e = byDate.get(key);
    if (e) {
      run.push(`${run.length ? 'L' : 'M'}${x(i).toFixed(1)},${y(e.mood)}`);
      if (!byDate.get(addDays(key, -1)) && !byDate.get(addDays(key, 1)))
        dots.push(`<circle cx="${x(i).toFixed(1)}" cy="${y(e.mood)}" r="3" fill="${faceColors(p, e.mood).fill.light}"/>`);
    } else flush();
  }
  flush();
  const grid = [5, 4, 3, 2, 1]
    .map((m) => `<line x1="${left}" x2="${W}" y1="${y(m)}" y2="${y(m)}" stroke="#ECE7DF"/>` + `<g transform="translate(2,${y(m) - 8})">${faceSvg(p, m, 16).replace('<svg ', '<svg x="0" y="0" ')}</g>`)
    .join('');
  const stops = [5, 4, 3, 2, 1].map((m) => `<stop offset="${(5 - m) / 4}" stop-color="${faceColors(p, m).fill.light}"/>`).join('');
  return `<svg width="100%" viewBox="0 0 ${W} ${top + H + 4}" class="timeline">
    <defs><linearGradient id="g" x1="0" y1="${y(5)}" x2="0" y2="${y(1)}" gradientUnits="userSpaceOnUse">${stops}</linearGradient></defs>
    ${grid}${months}${paths}${dots.join('')}</svg>`;
}

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

function monthGrid(p: PaletteId, year: number, month: number, byDate: Map<DayKey, Entry>, from: DayKey, to: DayKey) {
  const offset = new Date(year, month, 1).getDay();
  const cells: string[] = Array.from({ length: offset }, () => '<td class="blank"></td>');
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const key = dayKey(year, month, d);
    const entry = byDate.get(key);
    const inRange = key >= from && key <= to;
    cells.push(
      entry && inRange
        ? `<td style="background:${faceColors(p, entry.mood).fill.light}">${faceSvg(p, entry.mood, 16, true)}</td>`
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

export function buildReportHtml({ from, to, entries, tags, includeNotes, includeTags, palette: p }: ReportOptions) {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const stats = computeInsights(entries, tags);
  const totalDays = daysBetween(from, to);
  const avg = stats.average;

  const distribution = MOODS.map((m) => {
    const n = stats.distribution[m.value];
    const pct = stats.count ? (n / stats.count) * 100 : 0;
    return pct > 0 ? `<div style="width:${pct}%;background:${faceColors(p, m.value).fill.light}" title="${m.label}"></div>` : '';
  }).join('');

  const legend = MOODS.map(
    (m) => `<span class="legend">${faceSvg(p, m.value, 12)} ${m.label} · ${stats.distribution[m.value]}</span>`
  ).join('');

  const tagRows = stats.tags
    .filter((s) => s.count >= MIN_TAG_DAYS)
    .map(
      (s) => `<tr>
        <td>${esc(s.tag.emoji)} ${esc(s.tag.name)}</td>
        <td>${s.count}</td>
        <td>${faceSvg(p, s.average, 14)} ${s.average.toFixed(1)}</td>
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
          <span class="dot" style="background:${faceColors(p, m.value).fill.light}"></span>
          <strong>${formatLong(e.date)}</strong>
          <span class="mood">${faceSvg(p, m.value, 16)} ${m.label}</span>
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
  .face { vertical-align: middle; }
  .timeline { display: block; margin-bottom: 4px; }
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
  /* Fixed-width slot with the face first, so faces line up in a column whatever the label length. */
  .mood { color: #8A847B; margin-left: auto; width: 62px; flex-shrink: 0; display: flex; align-items: center; gap: 5px; }
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
    <div class="stat"><b>${avg == null ? '—' : `${faceSvg(p, avg, 18)} ${avg.toFixed(1)}`}</b><span>average mood (1–5)</span></div>
    <div class="stat"><b>${stats.distribution[5] + stats.distribution[4]}</b><span>good or great days</span></div>
    <div class="stat"><b>${stats.distribution[1] + stats.distribution[2]}</b><span>bad or awful days</span></div>
  </div>
  <div class="bar">${distribution}</div>
  <div>${legend}</div>

  <h2>Mood over time</h2>
  ${timelineSvg(p, from, to, byDate)}

  <h2>Calendar</h2>
  <div class="months">${monthsInRange(from, to).map(({ year, month }) => monthGrid(p, year, month, byDate, from, to)).join('')}</div>

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
