@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)

package com.markmayne.streaming3d.questlab

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Surface
import androidx.compose.ui.platform.ComposeView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.meta.spatial.compose.ComposeFeature
import com.meta.spatial.compose.ComposeViewPanelRegistration
import com.meta.spatial.core.Entity
import com.meta.spatial.core.Pose
import com.meta.spatial.core.Quaternion
import com.meta.spatial.core.SpatialFeature
import com.meta.spatial.core.Vector3
import com.meta.spatial.runtime.ReferenceSpace
import com.meta.spatial.runtime.SessionState
import com.meta.spatial.runtime.StereoMode
import com.meta.spatial.toolkit.AppSystemActivity
import com.meta.spatial.toolkit.DpPerMeterDisplayOptions
import com.meta.spatial.toolkit.MediaPanelRenderOptions
import com.meta.spatial.toolkit.MediaPanelSettings
import com.meta.spatial.toolkit.Panel
import com.meta.spatial.toolkit.PanelRegistration
import com.meta.spatial.toolkit.PanelStyleOptions
import com.meta.spatial.toolkit.PixelDisplayOptions
import com.meta.spatial.toolkit.QuadShapeOptions
import com.meta.spatial.toolkit.Transform
import com.meta.spatial.toolkit.UIPanelSettings
import com.meta.spatial.toolkit.VideoSurfacePanelRegistration
import com.meta.spatial.toolkit.Visible
import com.meta.spatial.vr.VRFeature
import java.util.concurrent.Executors
import kotlin.math.max

class QuestProtectedMediaActivity : AppSystemActivity() {
  private val uiState = LabUiState()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val networkExecutor = Executors.newSingleThreadExecutor()

  private var monoSurface: Surface? = null
  private var splitSurface: Surface? = null
  private var sidecarSurface: Surface? = null

  private var monoEntity: Entity? = null
  private var splitEntity: Entity? = null

  private var protectedPlayer: ExoPlayer? = null
  private var sidecarPlayer: ExoPlayer? = null
  private var sidecarOffsetMs = 0L
  private var pendingRequest: ProbeRequest? = null
  private var resumeAfterFocus = false

  private val synchronizer =
      SidecarSynchronizer(
          mainPlayerProvider = { protectedPlayer },
          sidecarPlayerProvider = { sidecarPlayer },
          offsetMsProvider = { sidecarOffsetMs },
          onStats = { stats ->
            uiState.mainPositionMs = stats.mainPositionMs
            uiState.sidecarPositionMs = stats.sidecarPositionMs
            uiState.driftMs = stats.driftMs
            uiState.resyncs = stats.resyncs
            uiState.sidecarLabel =
                if (stats.hasDecodedSidecar) "decoded track" else "virtual clock"
          },
      )

  override fun registerFeatures(): List<SpatialFeature> =
      listOf(
          VRFeature(this),
          ComposeFeature(),
      )

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    synchronizer.start()
  }

  override fun onSceneReady() {
    super.onSceneReady()
    scene.setReferenceSpace(ReferenceSpace.LOCAL_FLOOR)

    val screenPose =
        Pose(
            Vector3(0f, 1.55f, -3.0f),
            Quaternion(0f, 180f, 0f),
        )

    monoEntity =
        Entity.create(
            Panel(R.id.protected_mono_panel),
            Transform(screenPose),
            Visible(true),
        )

    splitEntity =
        Entity.create(
            Panel(R.id.protected_split_panel),
            Transform(screenPose),
            Visible(false),
        )

    Entity.create(
        Panel(R.id.sidecar_panel),
        Transform(Pose(Vector3(0f, -5f, -3f), Quaternion(0f, 180f, 0f))),
        Visible(true),
    )

    Entity.create(
        Panel(R.id.controls_panel),
        Transform(
            Pose(
                Vector3(0f, 0.45f, -2.0f),
                Quaternion(0f, 180f, 0f),
            ),
        ),
        Visible(true),
    )

    startProbe(
        ProbeRequest(
            mode = ProbeMode.PROTECTED_MONO,
            mediaUrl = LabDefaults.MEDIA_URL,
            licenseUrl = LabDefaults.LICENSE_URL,
            profileUrl = LabDefaults.PROFILE_URL,
            sidecarUrl = LabDefaults.SIDECAR_URL,
        ),
    )
  }

  override fun registerPanels(): List<PanelRegistration> =
      listOf(
          protectedPanel(
              id = R.id.protected_mono_panel,
              stereoMode = StereoMode.None,
              onSurface = { surface ->
                monoSurface = surface
                consumePendingIfReady()
              },
          ),
          protectedPanel(
              id = R.id.protected_split_panel,
              stereoMode = StereoMode.LeftRight,
              onSurface = { surface ->
                splitSurface = surface
                consumePendingIfReady()
              },
          ),
          VideoSurfacePanelRegistration(
              R.id.sidecar_panel,
              surfaceConsumer = { _, surface ->
                sidecarSurface = surface
              },
              settingsCreator = {
                MediaPanelSettings(
                    shape = QuadShapeOptions(width = 0.02f, height = 0.01125f),
                    display = PixelDisplayOptions(width = 320, height = 180),
                    rendering =
                        MediaPanelRenderOptions(
                            isDRM = false,
                            stereoMode = StereoMode.None,
                            zIndex = -10,
                        ),
                    style = PanelStyleOptions(R.style.PanelAppThemeTransparent),
                )
              },
          ),
          ComposeViewPanelRegistration(
              R.id.controls_panel,
              composeViewCreator = { _, context ->
                ComposeView(context).apply {
                  setContent {
                    LabControls(
                        state = uiState,
                        onStart = { mode, mediaUrl, licenseUrl, profileUrl, sidecarUrl ->
                          startProbe(
                              ProbeRequest(
                                  mode = mode,
                                  mediaUrl = mediaUrl,
                                  licenseUrl = licenseUrl,
                                  profileUrl = profileUrl,
                                  sidecarUrl = sidecarUrl,
                              ),
                          )
                        },
                        onTogglePlayback = { togglePlayback() },
                        onSeekRelative = { deltaMs -> seekRelative(deltaMs) },
                    )
                  }
                }
              },
              settingsCreator = {
                UIPanelSettings(
                    shape = QuadShapeOptions(width = 1.3f, height = 1.0f),
                    style = PanelStyleOptions(R.style.PanelAppThemeTransparent),
                    display = DpPerMeterDisplayOptions(),
                )
              },
          ),
      )

  private fun protectedPanel(
      id: Int,
      stereoMode: StereoMode,
      onSurface: (Surface) -> Unit,
  ): PanelRegistration =
      VideoSurfacePanelRegistration(
          id,
          surfaceConsumer = { _, surface -> onSurface(surface) },
          settingsCreator = {
            MediaPanelSettings(
                shape = QuadShapeOptions(width = 3.2f, height = 1.8f),
                display = PixelDisplayOptions(width = 3840, height = 2160),
                rendering =
                    MediaPanelRenderOptions(
                        isDRM = true,
                        stereoMode = stereoMode,
                        zIndex = 0,
                    ),
                style = PanelStyleOptions(R.style.PanelAppThemeTransparent),
            )
          },
      )

  private fun startProbe(request: ProbeRequest) {
    pendingRequest = request
    uiState.mode = request.mode
    uiState.status = "Preparing ${request.mode}…"
    uiState.lastError = ""
    synchronizer.reset()

    setModeVisibility(request.mode)
    consumePendingIfReady()
  }

  private fun consumePendingIfReady() {
    val request = pendingRequest ?: return
    val targetSurface =
        when (request.mode) {
          ProbeMode.PROTECTED_MONO -> monoSurface
          ProbeMode.PROTECTED_SECURE_SPLIT -> splitSurface
        }

    if (targetSurface == null) {
      uiState.status = "Waiting for protected Quest surface…"
      return
    }

    pendingRequest = null
    protectedPlayer?.release()

    val player = ProtectedPlayerFactory.build(this, request.licenseUrl)
    protectedPlayer = player

    player.setVideoSurface(targetSurface)
    player.addListener(
        object : Player.Listener {
          override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_READY) {
              uiState.status =
                  when (request.mode) {
                    ProbeMode.PROTECTED_MONO ->
                        "Widevine DIRECT_TO_SURFACE ready."
                    ProbeMode.PROTECTED_SECURE_SPLIT ->
                        "Widevine DIRECT_TO_SURFACE + StereoMode.LeftRight ready."
                  }
              player.play()
            }
          }

          override fun onIsPlayingChanged(isPlaying: Boolean) {
            uiState.isPlaying = isPlaying
          }

          override fun onPlayerError(error: PlaybackException) {
            uiState.lastError = error.message ?: error.errorCodeName
            uiState.status = "Protected playback failed."
          }
        },
    )

    try {
      ProtectedPlayerFactory.prepareWidevineDash(
          player = player,
          context = this,
          mediaUrl = request.mediaUrl,
          licenseUrl = request.licenseUrl,
      )
    } catch (error: Throwable) {
      uiState.lastError = error.message ?: error.javaClass.simpleName
      uiState.status = "Could not configure protected playback."
    }

    configureSidecar(request)
  }

  private fun configureSidecar(request: ProbeRequest) {
    sidecarPlayer?.release()
    sidecarPlayer = null
    sidecarOffsetMs = 0L
    uiState.sidecarLabel = "virtual clock"

    if (request.profileUrl.isNotBlank()) {
      uiState.status += " Loading sidecar profile…"
      networkExecutor.execute {
        try {
          val profile = SidecarProfileLoader.load(request.profileUrl)
          mainHandler.post {
            val resolvedUrl =
                request.sidecarUrl.ifBlank { profile.trackUrl.orEmpty() }
            sidecarOffsetMs = profile.timeOffsetMs
            attachDecodedSidecar(resolvedUrl)
          }
        } catch (error: Throwable) {
          mainHandler.post {
            uiState.lastError =
                "Sidecar profile: ${error.message ?: error.javaClass.simpleName}"
            attachDecodedSidecar(request.sidecarUrl)
          }
        }
      }
      return
    }

    attachDecodedSidecar(request.sidecarUrl)
  }

  private fun attachDecodedSidecar(url: String) {
    if (url.isBlank()) {
      uiState.sidecarLabel = "virtual clock"
      return
    }

    val surface = sidecarSurface
    if (surface == null) {
      uiState.lastError = "Depth sidecar surface is not ready yet."
      return
    }

    sidecarPlayer?.release()
    sidecarPlayer =
        ExoPlayer.Builder(this).build().apply {
          volume = 0f
          setVideoSurface(surface)
          setMediaItem(MediaItem.fromUri(url))
          prepare()
        }

    uiState.sidecarLabel = "decoded track"
  }

  private fun setModeVisibility(mode: ProbeMode) {
    monoEntity?.setComponent(Visible(mode == ProbeMode.PROTECTED_MONO))
    splitEntity?.setComponent(Visible(mode == ProbeMode.PROTECTED_SECURE_SPLIT))
  }

  private fun togglePlayback() {
    val player = protectedPlayer ?: return
    if (player.isPlaying) player.pause() else player.play()
  }

  private fun seekRelative(deltaMs: Long) {
    val player = protectedPlayer ?: return
    player.seekTo(max(0L, player.currentPosition + deltaMs))
  }

  override fun onSessionStateChanged(state: SessionState) {
    super.onSessionStateChanged(state)

    when (state) {
      SessionState.VISIBLE -> {
        resumeAfterFocus = protectedPlayer?.isPlaying == true
        protectedPlayer?.pause()
      }
      SessionState.FOCUSED -> {
        if (resumeAfterFocus) protectedPlayer?.play()
      }
      else -> Unit
    }
  }

  override fun onSpatialShutdown() {
    synchronizer.stop()
    protectedPlayer?.release()
    sidecarPlayer?.release()
    networkExecutor.shutdownNow()
    protectedPlayer = null
    sidecarPlayer = null
    super.onSpatialShutdown()
  }

  private data class ProbeRequest(
      val mode: ProbeMode,
      val mediaUrl: String,
      val licenseUrl: String,
      val profileUrl: String,
      val sidecarUrl: String,
  )
}
