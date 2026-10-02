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
  profileIds: string[];
  providerIds: string[];
  featured?: boolean;
}
