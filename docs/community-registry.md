# Community 3D registry

3Dstreaming is designed around a community-maintained library of **metadata-only 3D profiles**. The registry must not host the source movie, soundtrack, subtitles copied from the source, DRM keys, or provider credentials.

## Profile lifecycle

1. A contributor creates a profile for a specific cut/edition.
2. The client validates the v1 profile schema.
3. The contributor supplies timing/fingerprint metadata so other clients can match the correct edition.
4. The profile enters moderation.
5. Published profiles can be searched, rated, downloaded, reported, and superseded by newer revisions.

## Stored community data

A registry entry can contain:

- movie/show title and year
- exact edition/cut identifier
- provider hints
- duration, frame rate, aspect ratio, and non-reversible fingerprint samples
- depth/disparity/convergence sidecar URLs
- contributor identity
- ratings, download count, tags, revision history
- moderation/report state

The sidecar format should remain useful regardless of where the user legitimately obtains the video.

## API direction

The web client already targets a small registry interface:

- `GET /api/profiles?q=&provider=&limit=`
- `GET /api/profiles/:id`
- `POST /api/profiles`

Later versions should add:

- revisions
- ratings/reviews
- reports/moderation
- verified fingerprints
- contributor reputation
- signed profile manifests
- resumable sidecar uploads
- deduplication by title + edition fingerprint

The development client currently uses an in-browser registry seeded with open-movie examples. `CommunityApiClient` is the drop-in hosted implementation.
