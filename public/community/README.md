# 3Dstreaming community registry

This directory is the GitHub-backed published community catalog.

## Layout

```text
community/
  index.json
  maps/
    <title-slug>/
      <edition-slug>/
        <profile>.3d.json
        <profile>.depthpack.json
```

`index.json` is the searchable registry. Each entry points at a profile JSON.
The profile identifies the exact source edition/cut, fingerprint, stereo defaults,
and the relative community-authored depth/disparity data.

The app resolves sidecar URLs relative to the profile URL, so one community map
can move as a self-contained folder.

## GitHub depth packs

Large full-quality depth videos do not belong in Git history long-term. For the
prototype registry, a map may include a compact `.depthpack.json` derivative.

A depth pack stores sparse quantized keyframes derived from the original mapping.
The browser inflates the pack and interpolates the depth texture while the movie
plays. The registry keeps provenance for the original mapping resolution/FPS.

Production direction:

```text
GitHub
  registry metadata + profile revisions
          |
          v
R2 / S3 / CDN
  full-quality depth/disparity assets
```

The profile format stays the same when storage moves; only the track URL changes.

## Publishing rules

A published entry should identify an exact source edition/cut. At minimum:

- stable profile id
- human-readable title + edition label
- duration/aspect fingerprint
- depth or disparity track metadata
- author
- status
- relative or CDN sidecar URL
- source-map provenance when a GitHub playback derivative is used

Streaming providers remain responsible for the movie itself. 3Dstreaming stores
and distributes only community-authored 3D mapping data. The browser extension
or native bridge identifies provider playback and synchronizes the selected
community map to that source.
