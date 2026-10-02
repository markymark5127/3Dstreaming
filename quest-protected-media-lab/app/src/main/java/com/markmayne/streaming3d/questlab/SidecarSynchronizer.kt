package com.markmayne.streaming3d.questlab

import android.os.Handler
import android.os.Looper
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlin.math.abs
import kotlin.math.max

data class SyncStats(
    val mainPositionMs: Long,
    val sidecarPositionMs: Long,
    val driftMs: Long,
    val resyncs: Long,
    val hasDecodedSidecar: Boolean,
)

class SidecarSynchronizer(
    private val mainPlayerProvider: () -> ExoPlayer?,
    private val sidecarPlayerProvider: () -> ExoPlayer?,
    private val offsetMsProvider: () -> Long,
    private val thresholdMs: Long = LabDefaults.RESYNC_THRESHOLD_MS,
    private val onStats: (SyncStats) -> Unit,
) {
  private val handler = Handler(Looper.getMainLooper())
  private var running = false
  private var resyncs = 0L

  private val tick =
      object : Runnable {
        override fun run() {
          if (!running) return

          val main = mainPlayerProvider()
          val sidecar = sidecarPlayerProvider()

          if (main != null) {
            val target = max(0L, main.currentPosition + offsetMsProvider())

            if (sidecar != null) {
              val drift = sidecar.currentPosition - target

              if (abs(drift) > thresholdMs && sidecar.playbackState != Player.STATE_IDLE) {
                sidecar.seekTo(target)
                resyncs += 1
              }

              if (main.isPlaying && !sidecar.isPlaying) {
                sidecar.play()
              } else if (!main.isPlaying && sidecar.isPlaying) {
                sidecar.pause()
              }

              onStats(
                  SyncStats(
                      mainPositionMs = main.currentPosition,
                      sidecarPositionMs = sidecar.currentPosition,
                      driftMs = drift,
                      resyncs = resyncs,
                      hasDecodedSidecar = true,
                  ),
              )
            } else {
              onStats(
                  SyncStats(
                      mainPositionMs = main.currentPosition,
                      sidecarPositionMs = target,
                      driftMs = 0L,
                      resyncs = resyncs,
                      hasDecodedSidecar = false,
                  ),
              )
            }
          }

          handler.postDelayed(this, 100L)
        }
      }

  fun start() {
    if (running) return
    running = true
    handler.post(tick)
  }

  fun stop() {
    running = false
    handler.removeCallbacks(tick)
  }

  fun reset() {
    resyncs = 0L
  }
}
