import type { ThreeDProfile } from "../types/threeDProfile";
import type {
  CommunityProfile,
  CommunityProfileQuery,
  CommunityRegistry
} from "./types";

interface CommunityManifestEntry
  extends Omit<CommunityProfile, "profile"> {
  profileUrl: string;
}

interface CommunityManifest {
  schemaVersion: number;
  generatedAt: string;
  profiles: CommunityManifestEntry[];
}

function appAssetUrl(path: string): string {
  const base = new URL(import.meta.env.BASE_URL || "/", window.location.origin);
  return new URL(path.replace(/^\//, ""), base).toString();
}

function resolveTrackUrls(
  profile: ThreeDProfile,
  profileUrl: string
): ThreeDProfile {
  return {
    ...profile,
    tracks: profile.tracks.map((track) => {
      if (
        track.url.startsWith("blob:") ||
        track.url.startsWith("data:") ||
        track.url.startsWith("procedural:")
      ) {
        return track;
      }

      return {
        ...track,
        url: new URL(track.url, profileUrl).toString()
      };
    })
  };
}

export class LocalCommunityRegistry implements CommunityRegistry {
  private manifestPromise: Promise<CommunityProfile[]> | null = null;
  private sessionProfiles: CommunityProfile[] = [];

  private loadPublished(): Promise<CommunityProfile[]> {
    if (this.manifestPromise) return this.manifestPromise;

    this.manifestPromise = (async () => {
      const manifestUrl = appAssetUrl("community/index.json");
      const manifestResponse = await fetch(manifestUrl, {
        cache: "no-cache"
      });

      if (!manifestResponse.ok) {
        throw new Error(
          `Community manifest request failed (${manifestResponse.status}).`
        );
      }

      const manifest = (await manifestResponse.json()) as CommunityManifest;

      const profiles = await Promise.all(
        manifest.profiles
          .filter((entry) => entry.status === "published")
          .map(async (entry) => {
            const profileUrl = new URL(entry.profileUrl, manifestUrl).toString();
            const response = await fetch(profileUrl, { cache: "no-cache" });

            if (!response.ok) {
              throw new Error(
                `3D profile request failed for ${entry.id} (${response.status}).`
              );
            }

            const profile = resolveTrackUrls(
              (await response.json()) as ThreeDProfile,
              profileUrl
            );

            const { profileUrl: _profileUrl, ...metadata } = entry;

            return {
              ...metadata,
              profile
            };
          })
      );

      return profiles;
    })().catch((error) => {
      console.error("Could not load GitHub community registry.", error);
      return [];
    });

    return this.manifestPromise;
  }

  async search(
    query: CommunityProfileQuery = {}
  ): Promise<CommunityProfile[]> {
    const published = await this.loadPublished();
    const profiles = [
      ...this.sessionProfiles,
      ...published.filter(
        (item) =>
          !this.sessionProfiles.some((session) => session.id === item.id)
      )
    ];

    const q = query.q?.trim().toLowerCase();
    const provider = query.provider?.trim().toLowerCase();
    const mediaType = query.mediaType;
    const authorId = query.authorId;

    return profiles
      .filter(
        (item) =>
          item.status === "published" ||
          (authorId && item.author.id === authorId)
      )
      .filter((item) => {
        if (!q) return true;

        return [
          item.title,
          item.editionLabel,
          item.author.displayName,
          ...item.tags
        ].some((value) => value.toLowerCase().includes(q));
      })
      .filter((item) => {
        if (!provider) return true;

        return item.providerHints.some(
          (hint) => hint.toLowerCase() === provider
        );
      })
      .filter(
        (item) =>
          !mediaType || (item.mediaType ?? "movie") === mediaType
      )
      .filter((item) => !authorId || item.author.id === authorId)
      .slice(0, query.limit ?? 20);
  }

  async get(id: string): Promise<CommunityProfile | null> {
    const profiles = await this.search({ limit: 500 });
    return profiles.find((profile) => profile.id === id) ?? null;
  }

  async publish(profile: CommunityProfile): Promise<CommunityProfile> {
    const next = {
      ...profile,
      status: "pending" as const
    };

    this.sessionProfiles = [
      next,
      ...this.sessionProfiles.filter((item) => item.id !== profile.id)
    ];

    return next;
  }
}
