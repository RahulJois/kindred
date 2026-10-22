import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { addDays, daysBetween, formatShort, fromKey, MONTHS, type DayKey } from '../dates';
import type { Entry, Tag } from '../db';
import { moodInfo, useMoodColor } from '../moods';
import { useTheme } from '../theme';
import { MoodFace } from './MoodFace';

type Props = {
  entries: Entry[];
  from: DayKey;
  to: DayKey;
  mode: 'line' | 'bars';
  tags: Tag[];
  /** Days with this tag are emphasised; the rest recede. */
  highlightTagId: number | null;
};

const PLOT_HEIGHT = 170;
const PAD_Y = 12; // keeps the top/bottom levels' strokes and markers inside the plot
const AXIS_HEIGHT = 34; // month labels above, day numbers below
const LEFT_AXIS = 30;
const MIN_DAY_WIDTH = 6;

const levelY = (mood: number) => AXIS_HEIGHT / 2 + PAD_Y + ((5 - mood) * (PLOT_HEIGHT - 2 * PAD_Y)) / 4;

/** Mood over time: one point per logged day, gaps where nothing was logged. */
export function MoodTimeline({ entries, from, to, mode, tags, highlightTagId }: Props) {
  const t = useTheme();
  const moodColor = useMoodColor();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const days = daysBetween(from, to);
  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
  const visible = Math.max(0, width - LEFT_AXIS);
  const dayWidth = days > 0 ? Math.max(MIN_DAY_WIDTH, visible / days) : MIN_DAY_WIDTH;
  const plotWidth = days * dayWidth;
  const x = (i: number) => i * dayWidth + dayWidth / 2;
  const totalHeight = PLOT_HEIGHT + AXIS_HEIGHT;
  const baseline = levelY(1);
  const highlighting = highlightTagId != null;

  // Each day of the range, with its entry if one was logged.
  const series = useMemo(
    () => Array.from({ length: days }, (_, i) => byDate.get(addDays(from, i)) ?? null),
    [days, from, byDate]
  );

  // Consecutive logged days form one line segment; a missing day breaks the line rather than inventing data.
  const segments = useMemo(() => {
    const out: number[][] = [];
    let run: number[] = [];
    series.forEach((e, i) => {
      if (e) run.push(i);
      else if (run.length) {
        out.push(run);
        run = [];
      }
    });
    if (run.length) out.push(run);
    return out;
  }, [series]);

  const linePath = (run: number[]) => run.map((i, k) => `${k ? 'L' : 'M'}${x(i)},${levelY(series[i]!.mood)}`).join('');
  const areaPath = (run: number[]) =>
    `${linePath(run)}L${x(run[run.length - 1])},${baseline}L${x(run[0])},${baseline}Z`;

  // Month boundaries (dashed) and their labels; day numbers on a regular cadence below.
  const ticks = useMemo(() => {
    const months: { i: number; label: string }[] = [];
    const daysLabels: { i: number; label: string }[] = [];
    const every = dayWidth >= 18 ? 3 : dayWidth >= 10 ? 7 : 14;
    let lastX = -Infinity;
    for (let i = 0; i < days; i++) {
      const d = fromKey(addDays(from, i));
      if (d.getDate() === 1 || i === 0) months.push({ i, label: MONTHS[d.getMonth()].slice(0, 3) });
      // The 1st is marked by the month boundary; skip labels that would crowd their neighbour.
      const cx = i * dayWidth + dayWidth / 2;
      if (d.getDate() !== 1 && d.getDate() % every === 1 % every && cx - lastX >= 24) {
        daysLabels.push({ i, label: String(d.getDate()) });
        lastX = cx;
      }
    }
    return { months, daysLabels };
  }, [days, from, dayWidth]);

  const onTap = (e: GestureResponderEvent) => {
    const i = Math.floor(e.nativeEvent.locationX / dayWidth);
    if (i < 0 || i >= days) return;
    // Snap to the nearest logged day within a few days, so narrow bars are still easy to hit.
    for (let r = 0; r <= 3; r++) {
      for (const j of [i - r, i + r]) {
        if (j >= 0 && j < days && series[j]) return setSelected(j === selected ? null : j);
      }
    }
    setSelected(null);
  };

  const sel = selected != null ? series[selected] : null;
  const gradientStops = [5, 4, 3, 2, 1].map((m) => ({ offset: (5 - m) / 4, color: moodColor(m) }));
  // The neutral "Okay" fill is pale by design; the 2px line needs a darker neutral to stay visible.
  const lineStops = gradientStops.map((s) => (s.offset === 0.5 ? { ...s, color: t.muted } : s));
  const recede = (e: Entry | null) => highlighting && !(e && e.tagIds.includes(highlightTagId!));

  const summary =
    entries.length === 0
      ? 'No moods logged in this range.'
      : `Mood from ${formatShort(from)} to ${formatShort(to)}: ${entries.length} days logged, average ${(
          entries.reduce((s, e) => s + e.mood, 0) / entries.length
        ).toFixed(1)}.`;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={summary}>
      <View style={styles.tooltipRow}>
        {sel ? (
          <View style={styles.tooltip}>
            <MoodFace mood={sel.mood} size={20} />
            <Text style={[styles.tooltipText, { color: t.text }]}>
              {formatShort(sel.date)} · {moodInfo(sel.mood).label}
            </Text>
            {sel.tagIds.length > 0 && (
              <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
                {'  '}
                {sel.tagIds
                  .map((id) => tags.find((tag) => tag.id === id)?.emoji)
                  .filter(Boolean)
                  .join(' ')}
              </Text>
            )}
          </View>
        ) : (
          <Text style={{ color: t.muted, fontSize: 13 }}>Tap a day to see it</Text>
        )}
      </View>

      <View style={{ flexDirection: 'row' }}>
        {/* Y axis: the five faces, aligned to their levels. */}
        <View style={{ width: LEFT_AXIS, height: totalHeight }}>
          {[5, 4, 3, 2, 1].map((m) => (
            <View key={m} style={[styles.axisFace, { top: levelY(m) - 10 }]}>
              <MoodFace mood={m} size={20} />
            </View>
          ))}
        </View>

        {width > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            <Pressable onPress={onTap}>
              <Svg width={plotWidth} height={totalHeight}>
                <Defs>
                  <LinearGradient id="mood" x1="0" y1={levelY(5)} x2="0" y2={levelY(1)} gradientUnits="userSpaceOnUse">
                    {gradientStops.map((s) => (
                      <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
                    ))}
                  </LinearGradient>
                  <LinearGradient id="moodLine" x1="0" y1={levelY(5)} x2="0" y2={levelY(1)} gradientUnits="userSpaceOnUse">
                    {lineStops.map((s) => (
                      <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
                    ))}
                  </LinearGradient>
                </Defs>

                {/* Recessive grid: one hairline per mood level. */}
                {[5, 4, 3, 2, 1].map((m) => (
                  <Line key={m} x1={0} x2={plotWidth} y1={levelY(m)} y2={levelY(m)} stroke={t.border} strokeWidth={1} />
                ))}
                {ticks.months.map(({ i, label }) => (
                  <SvgText key={`m${i}`} x={i * dayWidth + 3} y={12} fontSize={11} fill={t.muted} fontWeight="600">
                    {label}
                  </SvgText>
                ))}
                {ticks.months
                  .filter(({ i }) => i > 0)
                  .map(({ i }) => (
                    <Line
                      key={`ml${i}`}
                      x1={i * dayWidth}
                      x2={i * dayWidth}
                      y1={AXIS_HEIGHT / 2}
                      y2={AXIS_HEIGHT / 2 + PLOT_HEIGHT}
                      stroke={t.muted}
                      strokeOpacity={0.5}
                      strokeDasharray="3,4"
                    />
                  ))}
                {ticks.daysLabels.map(({ i, label }) => (
                  <SvgText key={`d${i}`} x={x(i)} y={totalHeight - 3} fontSize={10} fill={t.muted} textAnchor="middle">
                    {label}
                  </SvgText>
                ))}

                {selected != null && (
                  <Line
                    x1={x(selected)}
                    x2={x(selected)}
                    y1={AXIS_HEIGHT / 2}
                    y2={AXIS_HEIGHT / 2 + PLOT_HEIGHT}
                    stroke={t.text}
                    strokeOpacity={0.35}
                    strokeWidth={1}
                  />
                )}

                {mode === 'line' ? (
                  <>
                    {segments.map((run) => (
                      <Path key={`a${run[0]}`} d={areaPath(run)} fill="url(#mood)" fillOpacity={highlighting ? 0.06 : 0.14} />
                    ))}
                    {segments.map((run) =>
                      run.length > 1 ? (
                        <Path
                          key={`l${run[0]}`}
                          d={linePath(run)}
                          fill="none"
                          stroke="url(#moodLine)"
                          strokeOpacity={highlighting ? 0.3 : 1}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ) : null
                    )}
                    {/* Markers: isolated days (no line to show them), highlighted days, and every day when there's room. */}
                    {series.map((e, i) => {
                      if (!e) return null;
                      const isolated = !series[i - 1] && !series[i + 1];
                      const emphasised = highlighting && !recede(e);
                      if (!isolated && !emphasised && dayWidth < 14 && i !== selected) return null;
                      if (highlighting && recede(e) && i !== selected) return null;
                      return (
                        <Circle
                          key={i}
                          cx={x(i)}
                          cy={levelY(e.mood)}
                          r={emphasised || i === selected ? 5 : 4}
                          fill={moodColor(e.mood)}
                          stroke={t.card}
                          strokeWidth={2}
                        />
                      );
                    })}
                  </>
                ) : (
                  series.map((e, i) => {
                    if (!e) return null;
                    const w = Math.max(2, dayWidth - 2); // 2px surface gap between bars
                    const top = levelY(e.mood);
                    const r = Math.min(4, w / 2);
                    return (
                      <Rect
                        key={i}
                        x={i * dayWidth + 1}
                        y={top}
                        width={w}
                        height={baseline - top + PAD_Y}
                        rx={r}
                        fill={moodColor(e.mood)}
                        fillOpacity={recede(e) && i !== selected ? 0.25 : 1}
                      />
                    );
                  })
                )}
              </Svg>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltipRow: { height: 26, justifyContent: 'center', marginBottom: 4 },
  tooltip: { flexDirection: 'row', alignItems: 'center' },
  tooltipText: { marginLeft: 6, fontSize: 14, fontWeight: '600' },
  axisFace: { position: 'absolute', left: 0 },
});
