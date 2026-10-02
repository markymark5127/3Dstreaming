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

interface TmdbProviderListResponse {
  results?: Array<
    TmdbProvider & {
      display_priority?: number;
    }
  >;
}

export interface StreamingHomeRow {
  providerId: ProviderId;
  providerName: string;
  items: CatalogItem[];
}

export interface StreamingHomeResult {
  rows: StreamingHomeRow[];
  configured: boolean;
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

function providerName(providerId: ProviderId): string {
  switch (providerId) {
    case "netflix":
      return "Netflix";
    case "disney-plus":
      return "Disney+";
    case "max":
      return "HBO Max";
    case "prime-video":
      return "Prime Video";
  }
}

function providerListScore(
  providerId: ProviderId,
  provider: TmdbProvider & { display_priority?: number }
): number {
  const name = provider.provider_name.trim().toLowerCase();
  let score = 0;

  switch (providerId) {
    case "netflix":
      if (name === "netflix") score += 100;
      else if (name.startsWith("netflix")) score += 80;
      break;
    case "disney-plus":
      if (name === "disney plus" || name === "disney+") score += 100;
      else if (name.includes("disney")) score += 70;
      break;
    case "max":
      if (name === "max" || name === "hbo max") score += 100;
      else if (name.includes("max")) score += 60;
      break;
    case "prime-video":
      if (name === "amazon prime video" || name === "prime video") score += 100;
      else if (name.includes("prime video")) score += 70;
      break;
  }

  if (name.includes("with ads")) score -= 5;
  score -= (provider.display_priority ?? 1000) * 0.001;

  return score;
}

async function tmdbProviderIdFor(
  providerId: ProviderId,
  mediaType: "movie" | "tv",
  region: string,
  signal?: AbortSignal
): Promise<number | null> {
  const list = await tmdbFetch<TmdbProviderListResponse>(
    `/watch/providers/${mediaType}?language=en-US&watch_region=${encodeURIComponent(
      region.toUpperCase()
    )}`,
    signal
  );

  const candidates = (list.results ?? [])
    .filter((provider) => normalizeProvider(provider.provider_name) === providerId)
    .sort(
      (a, b) =>
        providerListScore(providerId, b) -
        providerListScore(providerId, a)
    );

  return candidates[0]?.provider_id ?? null;
}

function homeCatalogItem(
  item: TmdbSearchItem & { media_type: "movie" | "tv" },
  providerId: ProviderId
): CatalogItem {
  const title = titleFor(item);
  const year = yearFor(item);

  return {
    id: `tmdb-${item.media_type}-${item.id}`,
    title,
    subtitle: `Popular on ${providerName(providerId)}`,
    kind: item.media_type === "movie" ? "movie" : "series",
    year,
    summary: item.overview?.trim() || "No summary available.",
    artworkClass: "artwork-tmdb",
    posterUrl: item.poster_path ? `${IMAGE_BASE}${item.poster_path}` : undefined,
    backdropUrl: item.backdrop_path
      ? `${BACKDROP_BASE}${item.backdrop_path}`
      : undefined,
    profileIds: [],
    providerIds: [providerId],
    availableProviderIds: [providerId],
    externalSource: "tmdb",
    externalId: item.id
  };
}

async function discoverPopularForProvider(
  providerId: ProviderId,
  mediaType: "movie" | "tv",
  tmdbProviderId: number,
  region: string,
  signal?: AbortSignal
): Promise<Array<TmdbSearchItem & { media_type: "movie" | "tv" }>> {
  const data = await tmdbFetch<TmdbSearchResponse>(
    `/discover/${mediaType}?include_adult=false&language=en-US&page=1&sort_by=popularity.desc&watch_region=${encodeURIComponent(
      region.toUpperCase()
    )}&with_watch_monetization_types=${encodeURIComponent(
      "flatrate|ads|free"
    )}&with_watch_providers=${tmdbProviderId}`,
    signal
  );

  return (data.results ?? []).map((item) => ({
    ...item,
    media_type: mediaType
  }));
}

export async function getStreamingHomeRows(
  providerIds: ProviderId[],
  region = "US",
  signal?: AbortSignal
): Promise<StreamingHomeResult> {
  if (!token()) {
    return { rows: [], configured: false };
  }

  if (providerIds.length === 0) {
    return { rows: [], configured: true };
  }

  const rows = await Promise.all(
    providerIds.map(async (providerId): Promise<StreamingHomeRow> => {
      try {
        const [movieProviderId, tvProviderId] = await Promise.all([
          tmdbProviderIdFor(providerId, "movie", region, signal),
          tmdbProviderIdFor(providerId, "tv", region, signal)
        ]);

        const [movies, shows] = await Promise.all([
          movieProviderId
            ? discoverPopularForProvider(
                providerId,
                "movie",
                movieProviderId,
                region,
                signal
              )
            : Promise.resolve([]),
          tvProviderId
            ? discoverPopularForProvider(
                providerId,
                "tv",
                tvProviderId,
                region,
                signal
              )
            : Promise.resolve([])
        ]);

        const combined = [...movies, ...shows]
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
          .filter((item, index, all) => {
            const key = `${item.media_type}:${item.id}`;
            return (
              all.findIndex(
                (candidate) =>
                  `${candidate.media_type}:${candidate.id}` === key
              ) === index
            );
          })
          .slice(0, 12)
          .map((item) => homeCatalogItem(item, providerId));

        return {
          providerId,
          providerName: providerName(providerId),
          items: combined
        };
      } catch (error) {
        if (signal?.aborted) throw error;

        console.warn(
          `Could not populate ${providerName(providerId)} home row.`,
          error
        );

        return {
          providerId,
          providerName: providerName(providerId),
          items: []
        };
      }
    })
  );

  return {
    configured: true,
    rows: rows.filter((row) => row.items.length > 0)
  };
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
