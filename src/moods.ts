import { useCallback } from 'react';
import { useColorScheme } from 'react-native';

import { FACES, PALETTES, type FaceColors, type PaletteId } from './faces';
import { usePalette } from './palette';

export type MoodValue = 1 | 2 | 3 | 4 | 5;

export type MoodInfo = { value: MoodValue; label: string };

// Best first. Labels come from scripts/make-faces.py, shared with the native side.
export const MOODS: MoodInfo[] = ([5, 4, 3, 2, 1] as MoodValue[]).map((value) => ({ value, label: FACES[value].label }));

const clampMood = (value: number) => Math.min(5, Math.max(1, Math.round(value))) as MoodValue;

/** Nearest mood for a value; averages like 3.6 round to a mood. */
export const moodInfo = (value: number): MoodInfo => MOODS.find((m) => m.value === clampMood(value))!;

/** Fill and ink for a mood in a palette (theme-independent, for the PDF). */
export const faceColors = (palette: PaletteId, value: number): FaceColors => PALETTES[palette].colors[clampMood(value)];

/** Fill and ink for a mood in the user's palette and the current theme. */
export function useFaceColors() {
  const { palette } = usePalette();
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return useCallback(
    (value: number) => {
      const c = faceColors(palette, value);
      return { fill: c.fill[theme], ink: c.ink[theme] };
    },
    [palette, theme]
  );
}

/** Mood fill for the user's palette and the current theme. */
export function useMoodColor() {
  const colors = useFaceColors();
  return useCallback((value: number) => colors(value).fill, [colors]);
}
