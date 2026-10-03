import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import KindredNative from '../modules/kindred-native';
import { todayKey, type DayKey } from './dates';
import { getEntry, getSetting, quickLog, setSetting, undoQuickLog } from './db';

type DataContextValue = { version: number; refresh: () => void };

const DataContext = createContext<DataContextValue>({ version: 0, refresh: () => {} });

/** Applies moods tapped (and undone) in the notification/widget to SQLite. Returns how many ops ran. */
async function syncPendingMoods(db: SQLiteDatabase) {
  const pending = KindredNative?.drainPendingMoods() ?? [];
  for (const op of pending) {
    if (op.type === 'log') await quickLog(db, op.date, op.mood, op.ts);
    else await undoQuickLog(db, op.ts);
  }
  // Keep the widget and the reminder's "already logged" check in step with the database.
  const today = await getEntry(db, todayKey());
  KindredNative?.setDayMood(todayKey(), today?.mood ?? null);
  return pending.length;
}

export async function requestNotificationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** First launch: ask for notifications and turn on a 9 PM check-in. */
async function onboard(db: SQLiteDatabase) {
  if (await getSetting(db, 'onboarded')) return;
  await requestNotificationPermission();
  KindredNative?.setReminder(true, 21, 0);
  await setSetting(db, 'onboarded', '1');
}

export function DataProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const sync = () => syncPendingMoods(db).then(refresh, console.warn);
    onboard(db).catch(console.warn);
    sync();
    const logged = KindredNative?.addListener('onMoodsChanged', sync);
    // Also re-renders on resume so "today" rolls over if the app was left open overnight.
    const resumed = AppState.addEventListener('change', (state) => state === 'active' && sync());
    return () => {
      logged?.remove();
      resumed.remove();
    };
  }, [db, refresh]);

  return <DataContext.Provider value={{ version, refresh }}>{children}</DataContext.Provider>;
}

export const useRefresh = () => useContext(DataContext).refresh;

/**
 * Runs a DB read when the screen is focused and whenever data changes.
 * `key` should change whenever the read's inputs change (e.g. the selected year).
 */
export function useQuery<T>(read: (db: SQLiteDatabase) => Promise<T>, key = ''): T | undefined {
  const db = useSQLiteContext();
  const { version } = useContext(DataContext);
  const [result, setResult] = useState<T>();
  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      readRef.current(db).then((r) => active && setResult(r), console.warn);
      return () => {
        active = false;
      };
      // `version` and `key` are deliberate re-run triggers, not values read in the callback.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, version, key])
  );
  return result;
}

/** Tell the native side about a change so the widget and reminder stay accurate. */
export function notifyDayMood(date: DayKey, mood: number | null) {
  KindredNative?.setDayMood(date, mood);
}
