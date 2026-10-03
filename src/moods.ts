export type MoodValue = 1 | 2 | 3 | 4 | 5;

export type MoodInfo = { value: MoodValue; emoji: string; label: string; color: string };

// Keep emojis and labels in sync with modules/kindred-native/.../Moods.kt.
export const MOODS: MoodInfo[] = [
  { value: 5, emoji: '😄', label: 'Great', color: '#3DAA7D' },
  { value: 4, emoji: '🙂', label: 'Good', color: '#9BC53D' },
  { value: 3, emoji: '😐', label: 'Okay', color: '#F2C14E' },
  { value: 2, emoji: '🙁', label: 'Bad', color: '#F0894B' },
  { value: 1, emoji: '😢', label: 'Awful', color: '#E05A5A' },
];

export const moodInfo = (value: number): MoodInfo => MOODS.find((m) => m.value === Math.round(value)) ?? MOODS[2];
