import type { CatalogItem } from "./types";

export const catalog: CatalogItem[] = [
  {
    id: "big-buck-bunny",
    title: "Big Buck Bunny",
    subtitle: "Community 3D map available",
    kind: "movie",
    year: 2008,
    runtimeLabel: "9m 56s",
    summary:
      "The first real published 3Dstreaming community map: a Depth Anything V2 depth sidecar for the 720p H.264 Big Buck Bunny cut.",
    artworkClass: "artwork-bunny",
    profileIds: ["41654621-2451-4d9c-baf9-0062d8522b39"],
    providerIds: ["local"],
    featured: true
  }
];

export function searchCatalog(query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;

  return catalog.filter((item) =>
    [item.title, item.subtitle, item.summary, item.kind]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}
