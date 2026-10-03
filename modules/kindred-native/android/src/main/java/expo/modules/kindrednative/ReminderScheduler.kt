package expo.modules.kindrednative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

object ReminderScheduler {
  private const val REQ_REMINDER = 1
  private const val REQ_MIDNIGHT = 2

  fun canScheduleExact(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  }

  /** (Re)schedules the next daily reminder plus a midnight alarm that refreshes the widget. */
  fun schedule(context: Context) {
    val alarms = context.getSystemService(AlarmManager::class.java)
    val store = MoodStore(context)

    val reminder = pendingIntent(context, MoodReceiver.ACTION_REMINDER, REQ_REMINDER)
    alarms.cancel(reminder)
    if (store.reminderEnabled) {
      val at = nextOccurrence(store.reminderHour, store.reminderMinute)
      if (canScheduleExact(context)) {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, reminder)
      } else {
        // Without the exact-alarm permission Android may deliver this a few minutes late.
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, reminder)
      }
    }

    val midnight = pendingIntent(context, MoodReceiver.ACTION_MIDNIGHT, REQ_MIDNIGHT)
    alarms.set(AlarmManager.RTC, nextOccurrence(0, 1), midnight)
  }

  private fun nextOccurrence(hour: Int, minute: Int): Long {
    val now = Calendar.getInstance()
    val at = (now.clone() as Calendar).apply {
      set(Calendar.HOUR_OF_DAY, hour)
      set(Calendar.MINUTE, minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    if (!at.after(now)) at.add(Calendar.DAY_OF_YEAR, 1)
    return at.timeInMillis
  }

  private fun pendingIntent(context: Context, action: String, requestCode: Int): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      requestCode,
      Intent(context, MoodReceiver::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
}
