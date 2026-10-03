package expo.modules.kindrednative

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/** Mood scale shared by the notification, the widget and the JS app (5 = best). */
object Moods {
  val values = intArrayOf(5, 4, 3, 2, 1)

  fun emoji(mood: Int) = when (mood) {
    5 -> "😄"
    4 -> "🙂"
    3 -> "😐"
    2 -> "🙁"
    else -> "😢"
  }

  fun label(mood: Int) = when (mood) {
    5 -> "Great"
    4 -> "Good"
    3 -> "Okay"
    2 -> "Bad"
    else -> "Awful"
  }

  fun viewId(mood: Int) = when (mood) {
    5 -> R.id.kindred_mood_5
    4 -> R.id.kindred_mood_4
    3 -> R.id.kindred_mood_3
    2 -> R.id.kindred_mood_2
    else -> R.id.kindred_mood_1
  }

  /** Local calendar day as YYYY-MM-DD, matching the JS date keys. */
  fun dayKey(cal: Calendar = Calendar.getInstance()): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
}
