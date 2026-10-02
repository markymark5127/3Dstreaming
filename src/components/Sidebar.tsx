export type AppSection =
  | "home"
  | "search"
  | "movies"
  | "shows"
  | "my-3d"
  | "account";

interface SidebarProps {
  active: AppSection;
  onChange(section: AppSection): void;
  accountInitials?: string;
}

const nav: Array<{ id: AppSection; label: string; icon: string }> = [
  { id: "search", label: "Search", icon: "⌕" },
  { id: "home", label: "Home", icon: "⌂" },
  { id: "movies", label: "Movies", icon: "▶" },
  { id: "shows", label: "TV Shows", icon: "▣" },
  { id: "my-3d", label: "My 3D", icon: "◫" }
];

export function Sidebar({ active, onChange, accountInitials }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onChange("home")} aria-label="3Dstreaming home">
        <span className="brand-mark">3D</span>
        <span className="brand-word">streaming</span>
      </button>

      <nav className="side-nav" aria-label="Main navigation">
        {nav.map((item) => (
          <button
            key={item.id}
            className={active === item.id ? "nav-item active" : "nav-item"}
            onClick={() => onChange(item.id)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <button
        className={active === "account" ? "account-button active" : "account-button"}
        onClick={() => onChange("account")}
      >
        <span className="avatar">{accountInitials ?? "?"}</span>
        <span>Account</span>
      </button>
    </aside>
  );
}
