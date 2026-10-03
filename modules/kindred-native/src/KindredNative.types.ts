export type ReminderSettings = { enabled: boolean; hour: number; minute: number };

/**
 * A queued change from the notification or widget, waiting to be applied to SQLite.
 * `ts` identifies a log; an undo refers back to the log with the same `ts`.
 */
export type PendingMood = { type: 'log'; date: string; mood: number; ts: number } | { type: 'undo'; ts: number };

export type KindredNativeEvents = {
  onMoodsChanged: () => void;
};
