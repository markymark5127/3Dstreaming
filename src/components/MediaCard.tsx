import type { CatalogItem } from "../catalog/types";
import { providersById } from "../providers/providers";
import type { ProviderId } from "../providers/types";

interface MediaCardProps {
  item: CatalogItem;
  profileCount: number;
  activeProviderIds?: ProviderId[];
  onOpen(item: CatalogItem): void;
}

export function MediaCard({
  item,
  profileCount,
  activeProviderIds = [],
  onOpen
}: MediaCardProps) {
  const availability = item.availableProviderIds ?? [];

  return (
    <button className="media-card" onClick={() => onOpen(item)}>
      <div
        className={`media-artwork ${item.artworkClass} ${item.posterUrl ? "media-artwork-poster" : ""}`}
        style={
          item.posterUrl
            ? {
                backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.78), rgba(0,0,0,.04) 60%), url("${item.posterUrl}")`
              }
            : undefined
        }
      >
        <span className="media-kind">
          {item.kind === "series" ? "SERIES" : item.kind === "episode" ? "EPISODE" : "MOVIE"}
        </span>
        {profileCount > 0 && <span className="three-d-badge">3D</span>}
        <strong>{item.title}</strong>
      </div>

      <span className="media-title">
        {item.title}
        {item.year ? <small className="media-year"> · {item.year}</small> : null}
      </span>

      {availability.length > 0 ? (
        <span className="media-provider-row">
          {availability.map((providerId) => {
            const provider = providersById[providerId];
            const active = activeProviderIds.includes(providerId);

            return (
              <span
                className={`media-provider-badge ${active ? "provider-signed-in" : ""}`}
                key={providerId}
                title={`${provider.name}${active ? " · active session" : ""}`}
              >
                {provider.shortName}
              </span>
            );
          })}
        </span>
      ) : (
        <span className="media-subtitle">
          {profileCount > 0
            ? `${profileCount} community profile${profileCount === 1 ? "" : "s"}`
            : item.subtitle}
        </span>
      )}
    </button>
  );
}
