import type { CatalogItem } from "./types";

export const catalog: CatalogItem[] = [
  {
    id: "big-buck-bunny",
    title: "Big Buck Bunny",
    subtitle: "Community 3D demo",
    kind: "movie",
    year: 2008,
    runtimeLabel: "9 min",
    summary: "An open movie used to prove the shared sidecar, edition matching, and XR playback pipeline.",
    artworkClass: "artwork-bunny",
    profileIds: ["demo-big-buck-bunny"],
    providerIds: ["local"],
    featured: true
  },
  {
    id: "sintel",
    title: "Sintel",
    subtitle: "Community disparity demo",
    kind: "movie",
    year: 2010,
    runtimeLabel: "15 min",
    summary: "A second open movie profile used to test community-authored disparity tracks.",
    artworkClass: "artwork-sintel",
    profileIds: ["demo-sintel"],
    providerIds: ["local"]
  },
  {
    id: "tears-of-steel",
    title: "Tears of Steel",
    subtitle: "Awaiting a community profile",
    kind: "movie",
    year: 2012,
    runtimeLabel: "12 min",
    summary: "Catalog entries can exist before a 3D conversion is contributed.",
    artworkClass: "artwork-steel",
    profileIds: [],
    providerIds: ["local"]
  },
  {
    id: "cosmos-laundromat",
    title: "Cosmos Laundromat",
    subtitle: "Awaiting a community profile",
    kind: "movie",
    year: 2015,
    runtimeLabel: "12 min",
    summary: "A title can later receive multiple community versions for different cuts or sources.",
    artworkClass: "artwork-cosmos",
    profileIds: [],
    providerIds: ["local"]
  },
  {
    id: "caminandes",
    title: "Caminandes",
    subtitle: "Short-film collection",
    kind: "series",
    year: 2013,
    summary: "Series-level catalog entries are ready for season and episode-specific 3D mappings.",
    artworkClass: "artwork-caminandes",
    profileIds: [],
    providerIds: ["local"]
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
