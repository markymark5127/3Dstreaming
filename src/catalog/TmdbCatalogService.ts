import type { CatalogItem } from "./types";
import type { ProviderId } from "../providers/types";

interface TmdbSearchItem {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  vote_count?: number;
}

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
}

interface TmdbWatchRegion {
  link?: string;
  flatrate?: TmdbProvider[];
  ads?: TmdbProvider[];
  free?: TmdbProvider[];
}

interface TmdbWatchResponse {
  results?: Record<string, TmdbWatchRegion>;
}

interface TmdbSearchResponse {
  results?: TmdbSearchItem[];
}

export interface UnifiedCatalogSearchResult {
  items: CatalogItem[];
  configured: boolean;
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";
const MAX_AVAILABILITY_CANDIDATES = 18;

function token(): string {
  return (import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN ?? "").trim();
}

function normalizeProvider(name: string): ProviderId | null {
  const value = name.trim().toLowerCase();

  if (value.includes("netflix")) return "netflix";
  if (value.includes("disney")) return "disney-plus";

  if (
    value === "hbo max" ||
    value === "max" ||
    value.includes("hbo max with ads") ||
    value.includes("max with ads")
  ) {
    return "max";
  }

  if (
    value === "amazon prime video" ||
    value === "prime video" ||
    value.includes("amazon prime video with ads") ||
    value.includes("prime video with ads")
  ) {
    return "prime-video";
  }

  return null;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleFor(item: TmdbSearchItem): string {
  return item.title ?? item.name ?? "Untitled";
}

function relevanceScore(item: TmdbSearchItem, query: string): number {
  const q = normalizeText(query);
  const title = normalizeText(titleFor(item));
  const words = title.split(/\s+/).filter(Boolean);

  let score = 0;

  if (title === q) {
    score += 100_000;
  } else if (title.startsWith(q)) {
    score += 80_000;
  } else if (words.some((word) => word === q)) {
    score += 70_000;
  } else if (words.some((word) => word.startsWith(q))) {
    score += 60_000;
  } else if (title.includes(q)) {
    score += 40_000;
  }

  // TMDB popularity is useful only as a tie-breaker. A strong textual match
  // should always outrank a popular but unrelated "Battle..." result for "bat".
  score += Math.min(item.popularity ?? 0, 10_000);
  score += Math.min(item.vote_count ?? 0, 10_000) * 0.01;

  return score;
}

async function tmdbFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const accessToken = token();

  if (!accessToken) {
    throw new Error("TMDB catalog search is not configured.");
  }

  const response = await fetch(`${TMDB_BASE}${path}`, {
    signal,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

async function providersFor(
  item: TmdbSearchItem & { media_type: "movie" | "tv" },
  region: string,
  signal?: AbortSignal
): Promise<{ providerIds: ProviderId[]; link?: string }> {
  const type = item.media_type;
  const data = await tmdbFetch<TmdbWatchResponse>(
    `/${type}/${item.id}/watch/providers`,
    signal
  );

  const availability = data.results?.[region.toUpperCase()];
  if (!availability) return { providerIds: [] };

  const providers = [
    ...(availability.flatrate ?? []),
    ...(availability.ads ?? []),
    ...(availability.free ?? [])
  ];

  const providerIds = [
    ...new Set(
      providers
        .map((provider) => normalizeProvider(provider.provider_name))
        .filter((provider): provider is ProviderId => provider !== null)
    )
  ];

  return {
    providerIds,
    link: availability.link
  };
}

function yearFor(item: TmdbSearchItem): number | undefined {
  const date = item.media_type === "movie" ? item.release_date : item.first_air_date;
  if (!date) return undefined;

  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : undefined;
}

export async function searchUnifiedCatalog(
  query: string,
  region = "US",
  signal?: AbortSignal
): Promise<UnifiedCatalogSearchResult> {
  if (!token()) {
    return { items: [], configured: false };
  }

  const q = query.trim();
  if (q.length < 2) {
    return { items: [], configured: true };
  }

  // Search movie and TV indexes independently instead of /search/multi.
  // That keeps people out of the candidate pool and gives short prefixes like
  // "bat" enough room for Batman titles to be ranked properly.
  const [movieSearch, tvSearch] = await Promise.all([
    tmdbFetch<TmdbSearchResponse>(
      `/search/movie?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`,
      signal
    ),
    tmdbFetch<TmdbSearchResponse>(
      `/search/tv?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`,
      signal
    )
  ]);

  const combined: Array<TmdbSearchItem & { media_type: "movie" | "tv" }> = [
    ...(movieSearch.results ?? []).map((item) => ({
      ...item,
      media_type: "movie" as const
    })),
    ...(tvSearch.results ?? []).map((item) => ({
      ...item,
      media_type: "tv" as const
    }))
  ];

  const seen = new Set<string>();
  const candidates = combined
    .filter((item) => {
      const key = `${item.media_type}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const scoreDifference =
        relevanceScore(b, q) - relevanceScore(a, q);

      if (scoreDifference !== 0) return scoreDifference;

      return titleFor(a).localeCompare(titleFor(b));
    })
    .slice(0, MAX_AVAILABILITY_CANDIDATES);

  const availability = await Promise.all(
    candidates.map(async (item) => {
      try {
        return await providersFor(item, region, signal);
      } catch {
        return { providerIds: [] as ProviderId[], link: undefined };
      }
    })
  );

  return {
    configured: true,
    items: candidates.map((item, index) => {
      const title = titleFor(item);
      const providerIds = availability[index].providerIds;
      const year = yearFor(item);

      return {
        id: `tmdb-${item.media_type}-${item.id}`,
        title,
        subtitle:
          providerIds.length > 0
            ? `${providerIds.length} streaming service${providerIds.length === 1 ? "" : "s"} found`
            : "No supported subscription service found",
        kind: item.media_type === "movie" ? "movie" : "series",
        year,
        summary: item.overview?.trim() || "No summary available.",
        artworkClass: "artwork-tmdb",
        posterUrl: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : undefined,
        backdropUrl: item.backdrop_path
          ? `${BACKDROP_BASE}${item.backdrop_path}`
          : undefined,
        profileIds: [],
        providerIds,
        availableProviderIds: providerIds,
        externalSource: "tmdb",
        externalId: item.id,
        availabilitySourceUrl: availability[index].link
      };
    })
  };
}
