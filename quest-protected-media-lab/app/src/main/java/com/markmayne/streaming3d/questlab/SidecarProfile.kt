package com.markmayne.streaming3d.questlab

import java.net.URI
import java.net.URL
import org.json.JSONObject

data class SidecarProfile(
    val trackUrl: String?,
    val timeOffsetMs: Long,
    val fps: Double?,
)

object SidecarProfileLoader {
  fun load(profileUrl: String): SidecarProfile {
    val json = JSONObject(URL(profileUrl).readText())
    val tracks = json.optJSONArray("tracks")

    var trackUrl: String? = null
    var offsetSeconds = 0.0
    var fps: Double? = null

    if (tracks != null) {
      for (i in 0 until tracks.length()) {
        val track = tracks.getJSONObject(i)
        val kind = track.optString("kind")
        if (kind == "depth" || kind.startsWith("disparity-")) {
          val rawUrl = track.optString("url")
          if (rawUrl.isNotBlank()) {
            trackUrl = URI(profileUrl).resolve(rawUrl).toString()
          }
          offsetSeconds = track.optDouble("timeOffsetSeconds", 0.0)
          if (track.has("fps")) {
            fps = track.optDouble("fps")
          }
          break
        }
      }
    }

    return SidecarProfile(
        trackUrl = trackUrl,
        timeOffsetMs = (offsetSeconds * 1000.0).toLong(),
        fps = fps,
    )
  }
}
