# 3Dstreaming

A community-first, web-first XR video platform for pairing ordinary 2D video with synchronized **3D sidecar metadata** and rendering stereoscopic playback across Meta Quest, Apple Vision Pro, Steam/OpenXR headsets, and ordinary browsers.

The core rule is simple:

> **The movie stays with the source that is allowed to provide it. 3Dstreaming stores and distributes only the metadata needed to spatialize that exact cut.**

## Product model

```text
Streaming/local source                 Community 3D registry
(provider-owned playback)              (depth/disparity/convergence)
          |                                      |
          +------------------+-------------------+
                             |
                      Playback core
                 identity + timeline sync
                             |
                     Renderer adapters
              WebXR / Quest / visionOS / OpenXR
```

Community profiles are intended to be device-independent. A good conversion for a specific cut should be reusable on Quest, Vision Pro, PC VR, and future clients.

## Community registry

The prototype now has:

- a community profile model with author, ratings, tags, downloads, moderation state, and edition metadata
- an in-browser development registry seeded with open-movie examples
- a hosted `CommunityApiClient` interface for the future backend
- a searchable community-library UI
- a v1 profile schema at `public/profile.schema.json`

See `docs/community-registry.md`.

## Streaming provider adapters

Netflix, Disney+, Max, and Prime Video are modeled as independent source adapters.

Current browser adapters **do not capture passwords, proxy protected video, or bypass DRM**. They hand authentication/playback to the provider's own origin. Catalog search, embedded playback, or timeline synchronization are capabilities that can be added independently if a provider-supported API/SDK or safe platform bridge becomes available.

See `docs/provider-integrations.md`.

## XR rendering

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
- community 3D profile browser
- streaming-provider adapter model
- local-file media adapter
- v1 3D profile parser/schema
- playback clock primitive for sidecar synchronization
- capability detection (WebXR/WebGL/WebGPU/PWA)
- WebXR virtual theater for the loaded local video
- GitHub Actions build verification

## Near-term milestones

1. Render a deterministic depth/disparity sidecar beside a local video.
2. Synchronize sidecar frames to the media timeline and recover after seek/pause.
3. Implement per-eye displacement shader and conservative hole filling.
4. Replace the local development registry with a real account/community backend.
5. Add contributor uploads, revisions, ratings, reports, and moderation.
6. Add Plex/Jellyfin adapters.
7. Prototype safe provider-specific timeline bridges without bypassing protected-media controls.
