import type { ProviderId, StreamingProvider } from "./types";

export const providerManifests: StreamingProvider[] = [
  {
    id: "netflix",
    name: "Netflix",
    shortName: "N",
    homeUrl: "https://www.netflix.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes:
      "Provider-owned browser authentication and playback. Public consumer catalog/timeline APIs are not available to this plugin."
  },
  {
    id: "disney-plus",
    name: "Disney+",
    shortName: "D+",
    homeUrl: "https://www.disneyplus.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes:
      "Provider-owned browser authentication and playback. No third-party consumer playback token is stored by 3Dstreaming."
  },
  {
    id: "max",
    name: "Max",
    shortName: "M",
    homeUrl: "https://www.max.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes:
      "Provider-owned browser authentication and playback. A future approved integration can add catalog/timeline capabilities."
  },
  {
    id: "prime-video",
    name: "Prime Video",
    shortName: "P",
    homeUrl: "https://www.primevideo.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "research",
    notes:
      "Amazon identity OAuth exists, while Prime Video API access is partner-oriented and does not provide general consumer playback to this app."
  }
];

export const providersById = Object.fromEntries(
  providerManifests.map((provider) => [provider.id, provider])
) as Record<ProviderId, StreamingProvider>;
