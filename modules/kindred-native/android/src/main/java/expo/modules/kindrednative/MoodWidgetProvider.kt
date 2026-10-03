package expo.modules.kindrednative

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

class MoodWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    manager.updateAppWidget(appWidgetIds, render(context))
  }

  companion object {
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, MoodWidgetProvider::class.java))
      if (ids.isNotEmpty()) manager.updateAppWidget(ids, render(context))
    }

    private fun render(context: Context): RemoteViews {
      val today = MoodStore(context).todayMood()
      val views = RemoteViews(context.packageName, R.layout.kindred_widget)
      views.setTextViewText(
        R.id.kindred_widget_title,
        if (today == null) "How's today?" else "Today · ${Moods.emoji(today)} ${Moods.label(today)}"
      )
      MoodNotification.openAppIntent(context)?.let {
        views.setOnClickPendingIntent(R.id.kindred_widget_title, it)
      }
      for (mood in Moods.values) {
        val id = Moods.viewId(mood)
        // No date extra: the widget always logs whatever day it is when tapped.
        views.setOnClickPendingIntent(id, MoodNotification.logMoodIntent(context, mood, null, requestCode = 20 + mood))
        views.setInt(id, "setBackgroundResource", if (mood == today) R.drawable.kindred_mood_selected else 0)
      }
      return views
    }
  }
}
