import type { ProviderAdapter, StreamingProvider } from "./types";

export const providers: StreamingProvider[] = [
  {
    id: "netflix",
    name: "Netflix",
    homeUrl: "https://www.netflix.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes: "Quest Browser can play Netflix directly. 3Dstreaming does not receive Netflix credentials or decrypted video frames."
  },
  {
    id: "disney-plus",
    name: "Disney+",
    homeUrl: "https://www.disneyplus.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "research",
    notes: "Provider-owned sign-in/playback only until an approved catalog or playback integration exists."
  },
  {
    id: "max",
    name: "Max",
    homeUrl: "https://www.max.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "research",
    notes: "Provider-owned sign-in/playback only until an approved catalog or playback integration exists."
  },
  {
    id: "prime-video",
    name: "Prime Video",
    homeUrl: "https://www.primevideo.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "research",
    notes: "Provider-owned sign-in/playback only until an approved catalog or playback integration exists."
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
