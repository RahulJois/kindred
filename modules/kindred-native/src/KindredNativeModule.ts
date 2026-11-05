import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { KindredNativeEvents, PendingMood, ReminderSettings } from './KindredNative.types';

declare class KindredNativeModule extends NativeModule<KindredNativeEvents> {
  getReminder(): ReminderSettings;
  setReminder(enabled: boolean, hour: number, minute: number): void;
  drainPendingMoods(): PendingMood[];
  setDayMood(date: string, mood: number | null): void;
  showCheckInNow(): void;
  areNotificationsEnabled(): boolean;
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): void;
  openNotificationSettings(): void;
  requestPinWidget(): boolean;
  /** Mood color scheme for the widget and notification faces ('kindred' or 'classic'). */
  setPalette(id: string): void;
  /** Hides the app's Recents preview (Android 13+). Resets when the activity is recreated. */
  setHideInRecents(hide: boolean): void;
}

// Optional so the JS side still loads in Expo Go / web, where the native module is absent.
export default requireOptionalNativeModule<KindredNativeModule>('KindredNative');
