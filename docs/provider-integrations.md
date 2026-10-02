# Streaming provider integration model

Streaming providers are **sources**, not the core of 3Dstreaming.

## Security boundary

3Dstreaming must never ask the user to type a Netflix, Disney+, Max, or Prime Video password into a 3Dstreaming-controlled form. Authentication stays on the provider's own origin or uses a provider-approved OAuth/native integration.

Likewise, the project does not proxy decrypted protected video or attempt to remove/bypass DRM.

## Adapter model

Each provider adapter declares capabilities independently:

- provider-owned authentication
- provider-owned playback
- catalog search
- embedded playback
- timeline bridge

Today, the four initial provider adapters expose only provider-owned authentication/playback by opening the provider's supported web experience.

If a provider later exposes an approved catalog API, OAuth flow, playback SDK, or protected-media extension point, that adapter can gain those capabilities without changing the community registry or XR renderer.

## Desired long-term flow

```text
3Dstreaming search
       |
       +--> community 3D registry
       |
       +--> provider catalog adapter (when officially available)
                         |
                         v
                 provider-owned playback
                         |
                    timeline bridge
                         |
              matching 3D sidecar profile
                         |
                    XR renderer
```

A browser extension, native Quest companion, or provider SDK may eventually supply a safe timeline bridge, but it should never expose account passwords or DRM keys to the web application.
