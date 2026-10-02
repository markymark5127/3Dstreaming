import type { CatalogItem } from "./types";
import type { ProviderId } from "../providers/types";

interface WatchmodeSource {
  name: string;
  type: "sub" | "rent" | "buy" | "free" | "tve";
  region: string;
  web_url?: string | null;
  ios_url?: string | null;
  android_url?: string | null;
}

const WATCHMODE_BASE = "https://api.watchmode.com/v1";

const ACCESSIBILITY_EDITION_MARKERS = [
  "asl",
  "american-sign-language",
  "american_sign_language",
  "sign-language",
  "sign_language",
  "with-asl",
  "with_asl"
];

function apiKey(): string {
  return (import.meta.env.VITE_WATCHMODE_API_KEY ?? "").trim();
}

function normalizeProvider(name: string): ProviderId | null {
  const value = name.trim().toLowerCase();

  if (value.includes("netflix")) return "netflix";
  if (value.includes("disney")) return "disney-plus";

  // Do not confuse channel add-ons sold through other storefronts with the
  // first-party HBO Max destination. Those links can land on a different
  // product/edition than the title the user selected.
  if (
    (value.includes("max") || value.includes("hbo")) &&
    (value.includes("amazon channel") ||
      value.includes("prime channel") ||
      value.includes("roku channel") ||
      value.includes("apple tv channel"))
  ) {
    return null;
  }

  if (
    value === "hbo max" ||
    value === "max" ||
    value === "hbo max with ads" ||
    value === "max with ads"
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

function validWebUrl(value?: string | null): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return null;

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function titleRequestsAccessibilityEdition(title: string): boolean {
  const normalized = title.toLowerCase();
  return (
    normalized.includes("asl") ||
    normalized.includes("american sign language") ||
    normalized.includes("sign language")
  );
}

function looksLikeAccessibilityEdition(url: string): boolean {
  let comparable = url.toLowerCase();

  try {
    const parsed = new URL(url);
    comparable = decodeURIComponent(
      `${parsed.hostname}${parsed.pathname}${parsed.search}`
    ).toLowerCase();
  } catch {
    // The URL was already syntax-checked; this is only defensive.
  }

  return ACCESSIBILITY_EDITION_MARKERS.some((marker) =>
    comparable.includes(marker)
  );
}

function expectedFirstPartyHost(
  providerId: ProviderId,
  hostname: string
): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  switch (providerId) {
    case "netflix":
      return host === "netflix.com" || host.endsWith(".netflix.com");
    case "disney-plus":
      return host === "disneyplus.com" || host.endsWith(".disneyplus.com");
    case "max":
      return (
        host === "hbomax.com" ||
        host.endsWith(".hbomax.com") ||
        host === "max.com" ||
        host.endsWith(".max.com")
      );
    case "prime-video":
      return host === "primevideo.com" || host.endsWith(".primevideo.com");
  }
}

function sourceScore(
  item: CatalogItem,
  providerId: ProviderId,
  source: WatchmodeSource,
  url: string
): number {
  if (
    !titleRequestsAccessibilityEdition(item.title) &&
    looksLikeAccessibilityEdition(url)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  try {
    const hostname = new URL(url).hostname;

    if (expectedFirstPartyHost(providerId, hostname)) {
      score += 100;
    } else {
      score -= 50;
    }
  } catch {
    return Number.NEGATIVE_INFINITY;
  }

  // Prefer normal subscription entries over TV-everywhere/free fallbacks.
  if (source.type === "sub") score += 20;
  if (source.type === "tve") score += 5;

  const sourceName = source.name.toLowerCase();
  if (sourceName.includes("with ads")) score -= 1;

  return score;
}

export function isWatchmodeConfigured(): boolean {
  return Boolean(apiKey());
}

export async function resolveDirectProviderLinks(
  item: CatalogItem,
  region = "US",
  signal?: AbortSignal
): Promise<Partial<Record<ProviderId, string>>> {
  if (!apiKey() || item.externalSource !== "tmdb" || !item.externalId) {
    return {};
  }

  const watchmodeId =
    item.kind === "movie"
      ? `movie-${item.externalId}`
      : `tv-${item.externalId}`;

  const response = await fetch(
    `${WATCHMODE_BASE}/title/${watchmodeId}/sources/?regions=${encodeURIComponent(region.toUpperCase())}`,
    {
      signal,
      headers: {
        "X-API-Key": apiKey(),
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Watchmode request failed (${response.status}).`);
  }

  const sources = (await response.json()) as WatchmodeSource[];
  const candidates = new Map<
    ProviderId,
    { url: string; score: number }
  >();

  for (const source of sources) {
    if (source.region.toUpperCase() !== region.toUpperCase()) continue;
    if (
      source.type !== "sub" &&
      source.type !== "free" &&
      source.type !== "tve"
    ) {
      continue;
    }

    const providerId = normalizeProvider(source.name);
    if (!providerId) continue;

    const url = validWebUrl(source.web_url);
    if (!url) continue;

    const score = sourceScore(item, providerId, source, url);
    if (!Number.isFinite(score)) continue;

    const current = candidates.get(providerId);
    if (!current || score > current.score) {
      candidates.set(providerId, { url, score });
    }
  }

  return Object.fromEntries(
    [...candidates.entries()].map(([providerId, candidate]) => [
      providerId,
      candidate.url
    ])
  ) as Partial<Record<ProviderId, string>>;
}
