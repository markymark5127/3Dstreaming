# 3Dstreaming

A web-first XR video experiment for pairing ordinary 2D video with synchronized **3D sidecar metadata** and rendering stereoscopic playback across Meta Quest, Apple Vision Pro, Steam/OpenXR headsets, and ordinary browsers.

The core rule is simple: **the movie stays with the source that is allowed to provide it; 3Dstreaming stores only the metadata needed to spatialize it.**

## Architecture

```text
Media source                 3D profile service
(local first)                (depth/disparity/convergence)
     |                                  |
     +---------------+------------------+
                     |
              Playback core
          timeline + synchronization
                     |
             Renderer adapters
         WebXR / Quest / visionOS /
                native OpenXR
```

### Source adapters

The first source adapter is a local browser-readable video file. Future adapters can include Plex, Jellyfin, ordinary HTTP media, and provider-approved streaming integrations.

### 3D sidecars

A profile identifies an exact cut/edition and can point to:

- depth tracks
- precomputed left/right disparity tracks
- convergence metadata
- fingerprint samples used to identify the correct cut

The v1 JSON schema is in `public/profile.schema.json`.

### XR rendering

The first renderer is WebXR. The initial theater milestone deliberately renders the source as a normal 2D cinema screen; the next rendering milestone replaces that material with a depth/disparity-aware stereo shader.

## Run it

```bash
npm install
npm run dev
```

For WebXR on a headset, serve the app from HTTPS (or localhost during development) and open it in a WebXR-capable browser.

## Current prototype

- React + TypeScript + Vite
- installable PWA shell
- local-file media adapter
- v1 3D profile parser/schema
- playback clock primitive for sidecar synchronization
- capability detection (WebXR/WebGL/WebGPU/PWA)
- WebXR virtual theater for the loaded local video

## Near-term milestones

1. Render a generated depth/disparity sidecar beside a local video.
2. Synchronize sidecar frames to the media timeline and recover after seek/pause.
3. Implement per-eye displacement shader and conservative hole filling.
4. Add a deterministic demo profile and automated browser tests.
5. Add Plex/Jellyfin adapters.
6. Research streaming-provider adapters without bypassing protected-media controls.
