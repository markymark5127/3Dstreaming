import type { CatalogItem } from "../catalog/types";

interface MediaCardProps {
  item: CatalogItem;
  profileCount: number;
  onOpen(item: CatalogItem): void;
}

export function MediaCard({ item, profileCount, onOpen }: MediaCardProps) {
  return (
    <button className="media-card" onClick={() => onOpen(item)}>
      <div className={`media-artwork ${item.artworkClass}`}>
        <span className="media-kind">{item.kind === "series" ? "SERIES" : "MOVIE"}</span>
        {profileCount > 0 && <span className="three-d-badge">3D</span>}
        <strong>{item.title}</strong>
      </div>
      <span className="media-title">{item.title}</span>
      <span className="media-subtitle">
        {profileCount > 0 ? `${profileCount} community profile${profileCount === 1 ? "" : "s"}` : item.subtitle}
      </span>
    </button>
  );
}
