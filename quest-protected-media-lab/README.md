# 3Dstreaming Quest Protected Media Lab

This is a native Meta Quest experiment, separate from the 3Dstreaming PWA.

Goal: test whether a Widevine-protected direct-to-surface movie can remain inside Quest's secure media path while 3Dstreaming independently synchronizes a 3D sidecar and asks the compositor for useful per-eye presentation.

## What is implemented

- Meta Spatial SDK 0.14.0
- Android Media3 / ExoPlayer
- Meta OculusMediaCodecVideoRenderer
- Widevine DASH playback
- VideoSurfacePanelRegistration with isDRM = true
- protected mono mode
- protected StereoMode.LeftRight split probe
- optional 3Dstreaming .3d.json loading
- optional depth.webm decode
- 100 ms sidecar synchronization loop
- 80 ms drift correction threshold
- live drift / resync diagnostics

The default stream is the public Shaka Widevine Sintel demo also used by Meta's current PremiumMediaSample.

## Probe 1: protected mono

Expected result: Sintel plays normally through the direct-to-surface protected panel.

## Probe 2: secure SBS split

This uses the same protected Sintel stream, but the panel is configured with StereoMode.LeftRight.

Sintel is not an SBS movie, so the result should look wrong on purpose. Close one eye at a time. If the left eye receives the left half of the protected frame and the right eye receives the right half, Quest is honoring a fixed secure per-eye routing operation while the video remains protected.

That still does not prove arbitrary depth-map warping is possible. Spatial SDK's public direct-surface API exposes stereo layout selection, but not a readable protected texture or custom protected-pixel displacement shader.

## Sidecar test

Paste either a URL to a 3Dstreaming .3d.json profile or a direct URL to a generated depth.webm.

A second muted ExoPlayer decodes the sidecar on a tiny hidden/off-screen surface. Every 100 ms the app compares protectedMovie.currentPosition with depthSidecar.currentPosition and seeks the sidecar when drift exceeds 80 ms.

This validates the timeline half of the architecture even if protected-image reprojection remains unavailable.

## Build

Meta's current samples use Android Studio Narwhal (2025.1.1) or newer, JDK 17, Gradle 9.4.1, AGP 8.11.1, and Spatial SDK 0.14.0.

This lab intentionally does not commit a Gradle wrapper JAR yet. Configure Gradle 9.4.1 in Android Studio, or run:

    cd quest-protected-media-lab
    gradle wrapper --gradle-version 9.4.1
    ./gradlew :app:assembleDebug

Then install/run on a developer-enabled Quest 2, Quest 3, Quest 3S, or Quest Pro.

## Device checklist

1. Launch Protected mono and confirm Widevine Sintel plays.
2. Pause, seek plus/minus 10 seconds, and resume.
3. Add a hosted 3Dstreaming sidecar and verify drift/resync diagnostics.
4. Launch Secure SBS split.
5. Close one eye at a time and record whether the protected frame is split differently per eye.
6. If both eyes receive the same view, the fixed stereo route may be constrained for DRM on that Horizon OS build.
7. If each eye receives a different half, secure fixed stereo routing works; arbitrary sidecar-driven displacement is still the remaining compositor/API blocker.

## Safety / DRM boundary

This lab does not obtain commercial-provider media URLs or license URLs, extract keys, capture protected frames, or bypass Widevine. It uses a public DRM demo and supported Meta/Media3 APIs.