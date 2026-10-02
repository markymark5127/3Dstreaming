package com.markmayne.streaming3d.questlab

enum class ProbeMode {
  PROTECTED_MONO,
  PROTECTED_SECURE_SPLIT,
}

object LabDefaults {
  const val MEDIA_URL =
      "https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd"
  const val LICENSE_URL =
      "https://cwip-shaka-proxy.appspot.com/no_auth"
  const val PROFILE_URL = ""
  const val SIDECAR_URL = ""
  const val RESYNC_THRESHOLD_MS = 80L
}
