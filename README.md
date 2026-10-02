# 3Dstreaming

Web-first XR video platform for pairing ordinary 2D video with synchronized 3D sidecar metadata (depth/disparity/convergence) and rendering stereoscopic playback across devices such as Meta Quest, Apple Vision Pro, and OpenXR headsets.

## Initial goals

- Progressive Web App first
- Local video playback as the first source adapter
- Device/capability detection instead of hard-coded headset checks
- Versioned 3D sidecar/profile format
- Playback synchronization core
- WebXR theater path
- Streaming-service adapters treated as optional integrations, not the foundation
- No redistribution of protected movie/video content

The first implementation lives on a feature branch while the core architecture is being established.
