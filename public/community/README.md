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
        <sidecar files>
```

`index.json` contains searchable community metadata and a `profileUrl`.
The profile JSON contains the edition fingerprint, stereo defaults, and relative
URLs for its depth/disparity sidecars.

The app resolves those relative sidecar URLs against the published profile URL,
so a community entry can move as one self-contained folder.

## Publishing rules

A published entry should identify an exact source edition/cut. At minimum:

- stable profile id
- human-readable title + edition label
- duration/aspect fingerprint
- depth or disparity track metadata
- author
- status
- relative sidecar URLs

Streaming providers remain responsible for the movie itself. 3Dstreaming stores
and distributes only community-authored 3D mapping data.
