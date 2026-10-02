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

function apiKey(): string {
  return (import.meta.env.VITE_WATCHMODE_API_KEY ?? "").trim();
}

function normalizeProvider(name: string): ProviderId | null {
  const value = name.trim().toLowerCase();

  if (value.includes("netflix")) return "netflix";
  if (value.includes("disney")) return "disney-plus";

  if (
    value === "hbo max" ||
    value === "max" ||
    value.includes("hbo max") ||
    value.startsWith("max ")
  ) {
    return "max";
  }

  if (
    value === "amazon prime video" ||
    value === "prime video" ||
    value.includes("amazon prime video") ||
    value.includes("prime video")
  ) {
    return "prime-video";
  }

  return null;
}

function validWebUrl(value?: string | null): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  return value;
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
  const links: Partial<Record<ProviderId, string>> = {};

  for (const source of sources) {
    if (source.region.toUpperCase() !== region.toUpperCase()) continue;
    if (source.type !== "sub" && source.type !== "free" && source.type !== "tve") continue;

    const providerId = normalizeProvider(source.name);
    if (!providerId || links[providerId]) continue;

    const url = validWebUrl(source.web_url);
    if (url) links[providerId] = url;
  }

  return links;
}
