import type { ProviderAdapter, StreamingProvider } from "./types";

export const providers: StreamingProvider[] = [
  {
    id: "netflix",
    name: "Netflix",
    shortName: "N",
    homeUrl: "https://www.netflix.com/login",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes: "Authentication stays on Netflix. No public consumer OAuth/playback API is exposed for third-party account linking in this prototype."
  },
  {
    id: "disney-plus",
    name: "Disney+",
    shortName: "D+",
    homeUrl: "https://www.disneyplus.com/login",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes: "Disney+ uses MyDisney, but 3Dstreaming does not receive or store MyDisney credentials."
  },
  {
    id: "max",
    name: "Max",
    shortName: "M",
    homeUrl: "https://auth.max.com/login",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes: "Authentication and protected playback stay on Max until a supported account-linking/playback integration exists."
  },
  {
    id: "prime-video",
    name: "Prime Video",
    shortName: "P",
    homeUrl: "https://www.primevideo.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "research",
    notes: "Amazon offers Login with Amazon OAuth, but Amazon identity login alone does not provide a Prime Video playback entitlement or stream."
  }
];

export class BrowserProviderAdapter implements ProviderAdapter {
  constructor(readonly provider: StreamingProvider) {}

  openProvider(): void {
    window.open(this.provider.homeUrl, "_blank", "noopener,noreferrer");
  }
}

export const providerAdapters = providers.map(
  (provider) => new BrowserProviderAdapter(provider)
);
