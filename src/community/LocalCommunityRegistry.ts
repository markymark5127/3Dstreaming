import type {
  CommunityProfile,
  CommunityProfileQuery,
  CommunityRegistry
} from "./types";

const seedProfiles: CommunityProfile[] = [
  {
    id: "demo-big-buck-bunny",
    title: "Big Buck Bunny",
    year: 2008,
    mediaType: "movie",
    editionLabel: "Open movie demo / 24 fps",
    providerHints: ["local", "http"],
    author: { id: "3dstreaming-team", displayName: "3Dstreaming Team" },
    status: "published",
    ratingAverage: 4.8,
    ratingCount: 42,
    downloads: 1284,
    tags: ["demo", "animation", "depth"],
    updatedAt: "2026-10-02T00:00:00Z",
    profile: {
      schemaVersion: 1,
      id: "bbb-demo-depth-v1",
      title: "Big Buck Bunny",
      editionId: "open-movie-demo-24fps",
      sourceHints: ["local", "http"],
      fingerprint: {
        durationSeconds: 596.46,
        fps: 24,
        aspectRatio: 16 / 9
      },
      tracks: [
        {
          kind: "depth",
          url: "procedural://depth",
          codec: "vp9",
          fps: 12,
          width: 320,
          height: 180
        }
      ],
      defaults: {
        depthStrength: 0.58,
        convergence: 0.5,
        popOutLimit: 0.18
      },
      notes: "Metadata-only demo profile. The referenced depth asset is a placeholder for the stereo-rendering milestone."
    }
  },
  {
    id: "demo-sintel",
    title: "Sintel",
    year: 2010,
    mediaType: "movie",
    editionLabel: "Open movie demo / 24 fps",
    providerHints: ["local", "http"],
    author: { id: "3dstreaming-team", displayName: "3Dstreaming Team" },
    status: "published",
    ratingAverage: 4.6,
    ratingCount: 19,
    downloads: 603,
    tags: ["demo", "animation", "disparity"],
    updatedAt: "2026-10-02T00:00:00Z",
    profile: {
      schemaVersion: 1,
      id: "sintel-demo-disparity-v1",
      title: "Sintel",
      editionId: "open-movie-demo-24fps",
      sourceHints: ["local", "http"],
      fingerprint: {
        durationSeconds: 888.0,
        fps: 24,
        aspectRatio: 16 / 9
      },
      tracks: [
        {
          kind: "disparity-left",
          url: "procedural://left",
          codec: "vp9",
          fps: 12,
          width: 320,
          height: 180
        },
        {
          kind: "disparity-right",
          url: "procedural://right",
          codec: "vp9",
          fps: 12,
          width: 320,
          height: 180
        }
      ],
      defaults: {
        depthStrength: 0.55,
        convergence: 0.52,
        popOutLimit: 0.16
      }
    }
  }
];

export class LocalCommunityRegistry implements CommunityRegistry {
  private profiles = [...seedProfiles];

  async search(query: CommunityProfileQuery = {}): Promise<CommunityProfile[]> {
    const q = query.q?.trim().toLowerCase();
    const provider = query.provider?.trim().toLowerCase();
    const mediaType = query.mediaType;
    const authorId = query.authorId;

    return this.profiles
      .filter((item) => item.status === "published" || (authorId && item.author.id === authorId))
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
        return item.providerHints.some((hint) => hint.toLowerCase() === provider);
      })
      .filter((item) => !mediaType || (item.mediaType ?? "movie") === mediaType)
      .filter((item) => !authorId || item.author.id === authorId)
      .slice(0, query.limit ?? 20);
  }

  async get(id: string): Promise<CommunityProfile | null> {
    return this.profiles.find((profile) => profile.id === id) ?? null;
  }

  async publish(profile: CommunityProfile): Promise<CommunityProfile> {
    const next = { ...profile, status: "pending" as const };
    this.profiles = [next, ...this.profiles.filter((item) => item.id !== profile.id)];
    return next;
  }
}
