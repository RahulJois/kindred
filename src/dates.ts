/** Days are stored as local-calendar keys: "YYYY-MM-DD". */
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export const toKey = (d: Date): DayKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key: DayKey, days: number): DayKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export const dayKey = (year: number, month0: number, day: number) => `${year}-${pad(month0 + 1)}-${pad(day)}`;

export const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86_400_000) + 1;
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const formatLong = (key: DayKey) =>
  fromKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export const formatShort = (key: DayKey) =>
  fromKey(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const formatMedium = (key: DayKey) =>
  fromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function formatTime(hour: number, minute: number) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`;
}
