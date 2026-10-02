import type {
  CommunityProfile,
  CommunityProfileQuery,
  CommunityRegistry
} from "./types";

export class CommunityApiClient implements CommunityRegistry {
  constructor(private readonly baseUrl: string) {}

  async search(query: CommunityProfileQuery = {}): Promise<CommunityProfile[]> {
    const url = new URL("/api/profiles", this.baseUrl);
    if (query.q) url.searchParams.set("q", query.q);
    if (query.provider) url.searchParams.set("provider", query.provider);
    if (query.limit) url.searchParams.set("limit", String(query.limit));

    const response = await fetch(url);
    if (!response.ok) throw new Error("Community registry search failed.");
    return response.json() as Promise<CommunityProfile[]>;
  }

  async get(id: string): Promise<CommunityProfile | null> {
    const response = await fetch(new URL(`/api/profiles/${encodeURIComponent(id)}`, this.baseUrl));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Community profile lookup failed.");
    return response.json() as Promise<CommunityProfile>;
  }

  async publish(profile: CommunityProfile): Promise<CommunityProfile> {
    const response = await fetch(new URL("/api/profiles", this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile)
    });

    if (!response.ok) throw new Error("Community profile submission failed.");
    return response.json() as Promise<CommunityProfile>;
  }
}
