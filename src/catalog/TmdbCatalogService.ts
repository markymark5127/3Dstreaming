import type { CatalogItem } from "./types";
import type { ProviderId } from "../providers/types";

interface TmdbSearchItem {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
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
  item: TmdbSearchItem,
  region: string,
  signal?: AbortSignal
): Promise<{ providerIds: ProviderId[]; link?: string }> {
  const type = item.media_type === "movie" ? "movie" : "tv";
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

  const search = await tmdbFetch<TmdbSearchResponse>(
    `/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`,
    signal
  );

  const candidates = (search.results ?? [])
    .filter(
      (item): item is TmdbSearchItem & { media_type: "movie" | "tv" } =>
        item.media_type === "movie" || item.media_type === "tv"
    )
    .slice(0, 12);

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
      const title = item.title ?? item.name ?? "Untitled";
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
