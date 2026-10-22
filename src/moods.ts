import { useCallback } from 'react';
import { useColorScheme } from 'react-native';

import { FACES } from './faces';

export type MoodValue = 1 | 2 | 3 | 4 | 5;

/** `color` is the light-theme fill (also used by the PDF and the native widget); `dark` is the dark-theme fill. */
export type MoodInfo = { value: MoodValue; label: string; color: string; dark: string };

// Best first. Colors and labels come from scripts/make-faces.py, shared with the native side.
export const MOODS: MoodInfo[] = ([5, 4, 3, 2, 1] as MoodValue[]).map((value) => ({
  value,
  label: FACES[value].label,
  color: FACES[value].fill.light,
  dark: FACES[value].fill.dark,
}));

const clampMood = (value: number) => Math.min(5, Math.max(1, Math.round(value))) as MoodValue;

/** Nearest mood for a value; averages like 3.6 round to a mood. */
export const moodInfo = (value: number): MoodInfo => MOODS.find((m) => m.value === clampMood(value))!;

/** Mood fill for the current theme. */
export function useMoodColor() {
  const dark = useColorScheme() === 'dark';
  return useCallback((value: number) => FACES[clampMood(value)].fill[dark ? 'dark' : 'light'], [dark]);
}
