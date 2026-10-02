import type { ProviderId } from "../providers/types";

export type MediaKind = "movie" | "series" | "episode";

export interface CatalogItem {
  id: string;
  title: string;
  subtitle: string;
  kind: MediaKind;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  runtimeLabel?: string;
  summary: string;
  artworkClass: string;
  posterUrl?: string;
  backdropUrl?: string;
  profileIds: string[];
  providerIds: string[];
  availableProviderIds?: ProviderId[];
  externalSource?: "tmdb";
  externalId?: number;
  availabilitySourceUrl?: string;
  featured?: boolean;
}
