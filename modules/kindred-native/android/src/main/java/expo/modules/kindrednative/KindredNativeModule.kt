package expo.modules.kindrednative

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

class KindredNativeModule : Module() {
  companion object {
    private var instance: WeakReference<KindredNativeModule>? = null

    /** Lets JS drain the queue straight away (a quick log or an undo) when the app is running. */
    fun emitMoodsChanged() {
      instance?.get()?.sendEvent("onMoodsChanged", mapOf<String, Any?>())
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("KindredNative")

    Events("onMoodsChanged")

    OnCreate {
      instance = WeakReference(this@KindredNativeModule)
      appContext.reactContext?.let {
        MoodNotification.ensureChannel(it)
        // A force-stop wipes the app's alarms, so re-arm them every time the app starts.
        ReminderScheduler.schedule(it)
      }
    }

    OnDestroy {
      if (instance?.get() === this@KindredNativeModule) instance = null
    }

    Function("getReminder") {
      val store = MoodStore(context)
      mapOf("enabled" to store.reminderEnabled, "hour" to store.reminderHour, "minute" to store.reminderMinute)
    }

    Function("setReminder") { enabled: Boolean, hour: Int, minute: Int ->
      val store = MoodStore(context)
      store.reminderEnabled = enabled
      store.reminderHour = hour.coerceIn(0, 23)
      store.reminderMinute = minute.coerceIn(0, 59)
      ReminderScheduler.schedule(context)
    }

    Function("drainPendingMoods") {
      MoodStore(context).drain()
    }

    Function("setDayMood") { date: String, mood: Int? ->
      MoodStore(context).setDayMood(date, mood)
      if (mood != null && date == Moods.dayKey()) MoodNotification.cancel(context)
      MoodWidgetProvider.refreshAll(context)
    }

    Function("setPalette") { id: String ->
      val store = MoodStore(context)
      if (store.palette == id) return@Function
      store.palette = id
      MoodWidgetProvider.refreshAll(context)
    }

    Function("showCheckInNow") {
      MoodNotification.show(context, Moods.dayKey())
    }

    Function("areNotificationsEnabled") {
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    Function("canScheduleExactAlarms") {
      ReminderScheduler.canScheduleExact(context)
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.startActivity(
          Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
      }
    }

    Function("openNotificationSettings") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Asks the launcher to add the widget. Returns false if the launcher can't pin widgets. */
    Function("requestPinWidget") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false
      manager.requestPinAppWidget(ComponentName(context, MoodWidgetProvider::class.java), null, null)
    }
  }
}
