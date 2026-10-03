import { useColorScheme } from 'react-native';

const light = {
  background: '#F7F4EF',
  card: '#FFFFFF',
  text: '#26231F',
  muted: '#8A847B',
  border: '#E8E2D9',
  empty: '#ECE7DF',
  accent: '#D9785B',
  accentText: '#FFFFFF',
  danger: '#C94A4A',
};

const dark: typeof light = {
  background: '#171513',
  card: '#221F1C',
  text: '#F2EEE8',
  muted: '#9A938A',
  border: '#34302B',
  empty: '#2D2925',
  accent: '#E58B6E',
  accentText: '#1A1714',
  danger: '#E86B6B',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
