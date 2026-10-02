import type { CommunityProfile } from "../community/types";

interface ProfileShelfProps {
  profiles: CommunityProfile[];
  onUse(profile: CommunityProfile): void;
}

export function ProfileShelf({ profiles, onUse }: ProfileShelfProps) {
  if (profiles.length === 0) {
    return <div className="empty-shelf">No community 3D profiles here yet.</div>;
  }

  return (
    <div className="profile-shelf">
      {profiles.map((item) => (
        <button className="profile-tile" key={item.id} onClick={() => onUse(item)}>
          <div className="profile-tile-top">
            <span className="three-d-logo">3D</span>
            <span>★ {item.ratingAverage.toFixed(1)}</span>
          </div>
          <div>
            <strong>{item.title}</strong>
            <span>{item.editionLabel}</span>
          </div>
          <small>
            {item.author.displayName} · {item.downloads.toLocaleString()} uses
          </small>
        </button>
      ))}
    </div>
  );
}
