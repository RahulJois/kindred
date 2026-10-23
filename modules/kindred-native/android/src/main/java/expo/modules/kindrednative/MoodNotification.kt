package expo.modules.kindrednative

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.toBitmap

object MoodNotification {
  private const val CHANNEL_ID = "kindred_daily_checkin"
  // Separate ids: syncing a mood cancels the check-in, and must not take the Undo confirmation with it.
  private const val CHECK_IN_ID = 4201
  private const val CONFIRMATION_ID = 4202

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      context.getString(R.string.kindred_channel_name),
      NotificationManager.IMPORTANCE_HIGH
    ).apply { description = context.getString(R.string.kindred_channel_description) }
    manager.createNotificationChannel(channel)
  }

  /** Posts the check-in with five tappable mood faces that log [date] without opening the app. */
  fun show(context: Context, date: String) {
    ensureChannel(context)
    val small = RemoteViews(context.packageName, R.layout.kindred_notification_small)
    val big = RemoteViews(context.packageName, R.layout.kindred_notification_big)
    val palette = MoodStore(context).palette
    for (mood in Moods.values) {
      small.setImageViewResource(Moods.faceViewId(mood), Moods.face(mood, palette))
      big.setImageViewResource(Moods.faceViewId(mood), Moods.face(mood, palette))
      val tap = logMoodIntent(context, mood, date, requestCode = 10 + mood)
      small.setOnClickPendingIntent(Moods.viewId(mood), tap)
      big.setOnClickPendingIntent(Moods.viewId(mood), tap)
    }

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.kindred_ic_stat)
      .setContentTitle("How was today?")
      .setContentText("Tap a face to log your mood")
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(small)
      .setCustomHeadsUpContentView(small)
      .setCustomBigContentView(big)
      .setContentIntent(openAppIntent(context))
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .build()
    post(context, CHECK_IN_ID, notification)
  }

  /** Swaps the check-in for a short confirmation, with Undo, that disappears on its own. */
  fun showLogged(context: Context, mood: Int, ts: Long) {
    val undo = PendingIntent.getBroadcast(
      context,
      30,
      Intent(context, MoodReceiver::class.java).setAction(MoodReceiver.ACTION_UNDO).putExtra(MoodReceiver.EXTRA_TS, ts),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    ensureChannel(context)
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.kindred_ic_stat)
      .setContentTitle("Logged · ${Moods.label(mood)}")
      .setLargeIcon(ContextCompat.getDrawable(context, Moods.face(mood, MoodStore(context).palette))?.toBitmap(128, 128))
      .setContentText("Tap to add tags or a note")
      .setContentIntent(openAppIntent(context))
      .addAction(0, "Undo", undo)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setAutoCancel(true)
      .setTimeoutAfter(10_000)
      .build()
    cancel(context)
    post(context, CONFIRMATION_ID, notification)
  }

  /** Removes the check-in (once today is logged). */
  fun cancel(context: Context) {
    NotificationManagerCompat.from(context).cancel(CHECK_IN_ID)
  }

  fun cancelConfirmation(context: Context) {
    NotificationManagerCompat.from(context).cancel(CONFIRMATION_ID)
  }

  fun logMoodIntent(context: Context, mood: Int, date: String?, requestCode: Int): PendingIntent {
    val intent = Intent(context, MoodReceiver::class.java)
      .setAction(MoodReceiver.ACTION_LOG_MOOD)
      .putExtra(MoodReceiver.EXTRA_MOOD, mood)
    if (date != null) intent.putExtra(MoodReceiver.EXTRA_DATE, date)
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  fun openAppIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun post(context: Context, id: Int, notification: android.app.Notification) {
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) {
      Log.w("Kindred", "notifications disabled; not posting")
      return
    }
    try {
      manager.notify(id, notification)
      Log.i("Kindred", "posted notification")
    } catch (e: SecurityException) {
      // POST_NOTIFICATIONS was revoked between the check and the call.
      Log.w("Kindred", "notify failed", e)
    }
  }
}
