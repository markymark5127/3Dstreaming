@file:androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)

package com.markmayne.streaming3d.questlab

import android.content.Context
import android.net.Uri
import android.os.Handler
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.Renderer
import androidx.media3.exoplayer.RenderersFactory
import androidx.media3.exoplayer.audio.AudioRendererEventListener
import androidx.media3.exoplayer.dash.DefaultDashChunkSource
import androidx.media3.exoplayer.dash.DashMediaSource
import androidx.media3.exoplayer.drm.DefaultDrmSessionManager
import androidx.media3.exoplayer.drm.FrameworkMediaDrm
import androidx.media3.exoplayer.drm.HttpMediaDrmCallback
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.metadata.MetadataOutput
import androidx.media3.exoplayer.text.TextOutput
import androidx.media3.exoplayer.video.MediaCodecVideoRenderer
import androidx.media3.exoplayer.video.VideoRendererEventListener
import com.meta.horizon.media.OculusMediaCodecVideoRenderer

private const val USER_AGENT = "3Dstreaming-Quest-Lab"
private const val CONNECT_TIMEOUT_MS = 15_000
private const val READ_TIMEOUT_MS = 30_000
private const val ALLOWED_VIDEO_JOINING_TIME_MS = 5_000L

private class OculusDrmRenderersFactory(
    private val context: Context,
    private val licenseUrl: String,
) : RenderersFactory {
  private val base =
      DefaultRenderersFactory(context)
          .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)

  override fun createRenderers(
      eventHandler: Handler,
      videoRendererEventListener: VideoRendererEventListener,
      audioRendererEventListener: AudioRendererEventListener,
      textRendererOutput: TextOutput,
      metadataRendererOutput: MetadataOutput,
  ): Array<Renderer> {
    val renderers =
        base
            .createRenderers(
                eventHandler,
                videoRendererEventListener,
                audioRendererEventListener,
                textRendererOutput,
                metadataRendererOutput,
            )
            .filterNot { it is MediaCodecVideoRenderer }
            .toMutableList()

    val httpFactory =
        DefaultHttpDataSource.Factory()
            .setUserAgent(USER_AGENT)
            .setConnectTimeoutMs(CONNECT_TIMEOUT_MS)
            .setReadTimeoutMs(READ_TIMEOUT_MS)
            .setAllowCrossProtocolRedirects(true)

    val drmCallback = HttpMediaDrmCallback(licenseUrl, httpFactory)
    val drmSessionManager =
        DefaultDrmSessionManager.Builder()
            .setUuidAndExoMediaDrmProvider(
                C.WIDEVINE_UUID,
                FrameworkMediaDrm.DEFAULT_PROVIDER,
            )
            .setPlayClearSamplesWithoutKeys(true)
            .setMultiSession(true)
            .build(drmCallback)

    renderers.add(
        0,
        OculusMediaCodecVideoRenderer(
            context,
            MediaCodecSelector.DEFAULT,
            ALLOWED_VIDEO_JOINING_TIME_MS,
            drmSessionManager,
            true,
            eventHandler,
            videoRendererEventListener,
        ),
    )

    return renderers.toTypedArray()
  }
}

object ProtectedPlayerFactory {
  fun build(context: Context, licenseUrl: String): ExoPlayer {
    val loadControl =
        DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                10_000,
                30_000,
                1_000,
                2_000,
            )
            .build()

    return ExoPlayer.Builder(
            context,
            OculusDrmRenderersFactory(context, licenseUrl),
        )
        .setLoadControl(loadControl)
        .build()
  }

  fun prepareWidevineDash(
      player: ExoPlayer,
      context: Context,
      mediaUrl: String,
      licenseUrl: String,
  ) {
    val dataSourceFactory =
        DefaultHttpDataSource.Factory()
            .setUserAgent(USER_AGENT)
            .setAllowCrossProtocolRedirects(true)

    val mediaItem =
        MediaItem.Builder()
            .setUri(Uri.parse(mediaUrl))
            .setDrmConfiguration(
                MediaItem.DrmConfiguration.Builder(C.WIDEVINE_UUID)
                    .setLicenseUri(Uri.parse(licenseUrl))
                    .build(),
            )
            .build()

    val dashSource =
        DashMediaSource.Factory(
                DefaultDashChunkSource.Factory(dataSourceFactory),
                dataSourceFactory,
            )
            .createMediaSource(mediaItem)

    player.setMediaSource(dashSource)
    player.prepare()
  }
}
