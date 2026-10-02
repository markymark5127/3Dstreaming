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
      "Provider-owned browser authentication and playback. No public consumer OAuth/account-linking API is configured for third-party PWAs."
  },
  {
    id: "disney-plus",
    name: "Disney+",
    shortName: "D+",
    homeUrl: "https://www.disneyplus.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes:
      "Provider-owned browser authentication and playback. 3Dstreaming does not receive MyDisney credentials or session cookies."
  },
  {
    id: "max",
    name: "HBO Max",
    shortName: "MAX",
    homeUrl: "https://www.hbomax.com/",
    capabilities: ["provider-owned-auth", "provider-owned-playback"],
    integrationStatus: "browser-only",
    notes:
      "Provider-owned browser authentication and playback. The internal provider id remains 'max' for saved-account compatibility."
  },
  {
    id: "prime-video",
    name: "Prime Video",
    shortName: "P",
    homeUrl: "https://www.primevideo.com/",
    capabilities: [
      "provider-owned-auth",
      "provider-owned-playback",
      "oauth-account-link"
    ],
    integrationStatus: "official-api",
    notes:
      "Login with Amazon OAuth can verify Amazon identity/profile. Prime Video subscription entitlement and protected playback remain provider-owned."
  }
];

export const providersById = Object.fromEntries(
  providerManifests.map((provider) => [provider.id, provider])
) as Record<ProviderId, StreamingProvider>;
