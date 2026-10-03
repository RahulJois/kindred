package expo.modules.kindrednative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class MoodReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION_LOG_MOOD = "expo.modules.kindrednative.LOG_MOOD"
    const val ACTION_REMINDER = "expo.modules.kindrednative.REMINDER"
    const val ACTION_MIDNIGHT = "expo.modules.kindrednative.MIDNIGHT"
    const val ACTION_UNDO = "expo.modules.kindrednative.UNDO"
    const val EXTRA_TS = "ts"
    const val EXTRA_MOOD = "mood"
    const val EXTRA_DATE = "date"
    private const val TAG = "Kindred"
  }

  override fun onReceive(context: Context, intent: Intent) {
    Log.i(TAG, "onReceive ${intent.action} today=${Moods.dayKey()} logged=${MoodStore(context).todayMood()}")
    when (intent.action) {
      ACTION_LOG_MOOD -> logMood(context, intent)
      ACTION_UNDO -> {
        MoodStore(context).undo(intent.getLongExtra(EXTRA_TS, 0))
        MoodNotification.cancelConfirmation(context)
        MoodWidgetProvider.refreshAll(context)
        KindredNativeModule.emitMoodsChanged()
      }
      ACTION_REMINDER -> {
        // Skip the nudge if today is already logged.
        if (MoodStore(context).todayMood() == null) MoodNotification.show(context, Moods.dayKey())
        ReminderScheduler.schedule(context)
      }
      ACTION_MIDNIGHT -> {
        MoodWidgetProvider.refreshAll(context)
        ReminderScheduler.schedule(context)
      }
      else -> {
        // Boot, app update, clock/timezone change, exact-alarm permission change.
        ReminderScheduler.schedule(context)
        MoodWidgetProvider.refreshAll(context)
      }
    }
  }

  private fun logMood(context: Context, intent: Intent) {
    val mood = intent.getIntExtra(EXTRA_MOOD, 0)
    if (mood !in 1..5) return
    // The notification carries the day it was posted for, so a late tap still logs that day.
    // Widget taps carry no date and log whatever day it is now.
    val fromNotification = intent.hasExtra(EXTRA_DATE)
    val date = intent.getStringExtra(EXTRA_DATE) ?: Moods.dayKey()

    val store = MoodStore(context)
    val ts = store.enqueue(date, mood)
    store.setDayMood(date, mood)

    // The widget redraws with the new mood, so it doesn't need a confirmation; just clear any pending check-in.
    if (fromNotification) MoodNotification.showLogged(context, mood, ts) else if (date == Moods.dayKey()) MoodNotification.cancel(context)
    MoodWidgetProvider.refreshAll(context)
    KindredNativeModule.emitMoodsChanged()
  }
}
