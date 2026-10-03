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
}

// Optional so the JS side still loads in Expo Go / web, where the native module is absent.
export default requireOptionalNativeModule<KindredNativeModule>('KindredNative');
