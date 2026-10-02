export type ProviderId = "netflix" | "disney-plus" | "max" | "prime-video";

export type ProviderCapability =
  | "provider-owned-auth"
  | "provider-owned-playback"
  | "catalog-search"
  | "embedded-playback"
  | "timeline-bridge";

export interface StreamingProvider {
  id: ProviderId;
  name: string;
  homeUrl: string;
  capabilities: ProviderCapability[];
  integrationStatus: "browser-only" | "research" | "official-api";
  notes: string;
}

export interface ProviderSearchResult {
  providerId: ProviderId;
  providerContentId: string;
  title: string;
  year?: number;
  watchUrl: string;
}

export interface ProviderAdapter {
  readonly provider: StreamingProvider;
  openProvider(): void;
  search?(query: string): Promise<ProviderSearchResult[]>;
  openTitle?(result: ProviderSearchResult): void;
}
