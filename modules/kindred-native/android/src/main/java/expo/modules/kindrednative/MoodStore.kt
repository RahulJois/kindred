package expo.modules.kindrednative

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Small SharedPreferences store used by the native side.
 *
 * Moods logged from the notification or widget are queued here rather than written
 * to SQLite directly: expo-sqlite bundles its own SQLite build, and two SQLite
 * libraries writing the same file in one process can corrupt locks. The JS app
 * drains the queue into its database on launch, on resume, and on the
 * onMoodsChanged event.
 */
class MoodStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("kindred", Context.MODE_PRIVATE)

  var reminderEnabled: Boolean
    get() = prefs.getBoolean("reminderEnabled", false)
    set(value) { prefs.edit().putBoolean("reminderEnabled", value).apply() }

  var reminderHour: Int
    get() = prefs.getInt("reminderHour", 21)
    set(value) { prefs.edit().putInt("reminderHour", value).apply() }

  var reminderMinute: Int
    get() = prefs.getInt("reminderMinute", 0)
    set(value) { prefs.edit().putInt("reminderMinute", value).apply() }

  /** Today's mood if known (from the app or a quick log), otherwise null. */
  fun todayMood(): Int? {
    if (prefs.getString("loggedDate", null) != Moods.dayKey()) return null
    return prefs.getInt("loggedMood", 0).takeIf { it in 1..5 }
  }

  fun setDayMood(date: String, mood: Int?) {
    if (date != Moods.dayKey()) return
    prefs.edit().apply {
      if (mood == null) remove("loggedDate").remove("loggedMood")
      else putString("loggedDate", date).putInt("loggedMood", mood)
    }.apply()
  }

  /** Queues a quick log and returns its id (its timestamp), which an undo refers back to. */
  @Synchronized
  fun enqueue(date: String, mood: Int): Long {
    val ts = System.currentTimeMillis()
    val op = JSONObject().put("type", "log").put("date", date).put("mood", mood).put("ts", ts)
    // Remember today's previous mood so an undo can put the widget back before the app syncs.
    todayMood()?.takeIf { date == Moods.dayKey() }?.let { op.put("prevToday", it) }
    val queue = JSONArray(prefs.getString("pending", "[]")).put(op)
    prefs.edit().putString("pending", queue.toString()).commit()
    return ts
  }

  /**
   * Undoes the quick log [ts]. If the app hasn't picked it up yet, it's simply dropped from the
   * queue; otherwise an undo op is queued for the app, which knows what the day looked like before.
   */
  @Synchronized
  fun undo(ts: Long) {
    val queue = JSONArray(prefs.getString("pending", "[]"))
    val kept = JSONArray()
    var dropped: JSONObject? = null
    for (i in 0 until queue.length()) {
      val op = queue.getJSONObject(i)
      if (op.optString("type", "log") == "log" && op.getLong("ts") == ts) dropped = op else kept.put(op)
    }
    if (dropped == null) kept.put(JSONObject().put("type", "undo").put("ts", ts))
    prefs.edit().putString("pending", kept.toString()).commit()

    dropped?.let { op ->
      val prev = if (op.has("prevToday")) op.getInt("prevToday") else null
      setDayMood(op.getString("date"), prev)
    }
  }

  @Synchronized
  fun drain(): List<Map<String, Any>> {
    val queue = JSONArray(prefs.getString("pending", "[]"))
    prefs.edit().putString("pending", "[]").commit()
    return (0 until queue.length()).map { i ->
      val o = queue.getJSONObject(i)
      val ts = o.getLong("ts").toDouble()
      if (o.optString("type", "log") == "undo") mapOf("type" to "undo", "ts" to ts)
      else mapOf("type" to "log", "date" to o.getString("date"), "mood" to o.getInt("mood"), "ts" to ts)
    }
  }
}
