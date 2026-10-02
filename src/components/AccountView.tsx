import { FormEvent, useState } from "react";
import type { ProviderConnection, UserAccount } from "../auth/types";
import { providerPlugins } from "../providers/providers";
import type { ProviderId } from "../providers/types";

interface AccountViewProps {
  user: UserAccount | null;
  onSignIn(email: string, displayName: string): Promise<void>;
  onSignOut(): Promise<void>;
  onProviderConnect(providerId: ProviderId): Promise<void>;
  onProviderConfirm(providerId: ProviderId): Promise<void>;
  onProviderDeactivate(providerId: ProviderId): Promise<void>;
  onUpload(): void;
}

function isActive(connection?: ProviderConnection): boolean {
  return connection?.state === "session-active" || connection?.state === "oauth-connected";
}

function connectionLabel(connection?: ProviderConnection): string {
  if (!connection || connection.state === "not-connected") {
    return "Not connected";
  }

  if (connection.state === "provider-session") {
    return "Sign-in opened · confirm after you finish signing in";
  }

  if (connection.state === "needs-verification") {
    return "Session needs confirmation";
  }

  if (isActive(connection)) {
    const confirmed = connection.sessionConfirmedAt ?? connection.lastVerifiedAt;
    if (!confirmed) return "Active · signed-in session confirmed";

    return `Active · confirmed ${new Date(confirmed).toLocaleDateString()}`;
  }

  return "Connected";
}

export function AccountView({
  user,
  onSignIn,
  onSignOut,
  onProviderConnect,
  onProviderConfirm,
  onProviderDeactivate,
  onUpload
}: AccountViewProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSignIn(email, displayName);
  }

  if (!user) {
    return (
      <section className="content-section narrow-section">
        <span className="kicker">3DSTREAMING ACCOUNT</span>
        <h1 className="page-title">Sign in to connect your services.</h1>
        <p className="page-copy">
          Your 3Dstreaming account remembers which streaming services you use, your
          community mappings, ratings, and revisions. Provider passwords stay with the
          provider.
        </p>

        <form className="account-form" onSubmit={(event) => void submit(event)}>
          <label>
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <span>Display name</span>
            <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <button className="button primary" type="submit">Create / sign in</button>
          <small>
            Prototype account: stored in this browser for now. Hosted authentication replaces
            this before production.
          </small>
        </form>
      </section>
    );
  }

  return (
    <section className="content-section">
      <div className="account-hero">
        <span className="avatar large">{user.avatarInitials}</span>
        <div>
          <span className="kicker">ACCOUNT</span>
          <h1 className="page-title">{user.displayName}</h1>
          <p className="page-copy">{user.email}</p>
        </div>
        <button className="button secondary" onClick={() => void onSignOut()}>Sign out</button>
      </div>

      <div className="account-columns">
        <div>
          <div className="section-title-row">
            <div>
              <span className="kicker">STREAMING SERVICES</span>
              <h2>Connected services</h2>
            </div>
          </div>

          <div className="connection-list">
            {providerPlugins.map((plugin) => {
              const providerId = plugin.provider!.id;
              const connection = user.providerConnections.find(
                (item) => item.providerId === providerId
              );
              const active = isActive(connection);
              const pending =
                connection?.state === "provider-session" ||
                connection?.state === "needs-verification";

              return (
                <article
                  className={`connection-card ${active ? "connection-active" : ""}`}
                  key={providerId}
                >
                  <div className={`service-logo service-${providerId}`}>
                    {plugin.provider!.shortName}
                  </div>

                  <div className="connection-copy">
                    <div className="connection-title-row">
                      <strong>{plugin.provider!.name}</strong>
                      {active && <span className="connection-active-pill">ACTIVE</span>}
                    </div>
                    <span>{connectionLabel(connection)}</span>
                  </div>

                  <div className="connection-actions">
                    {!connection || connection.state === "not-connected" ? (
                      <button
                        className="button compact"
                        onClick={() => void onProviderConnect(providerId)}
                      >
                        Sign in
                      </button>
                    ) : pending ? (
                      <>
                        <button
                          className="button compact secondary"
                          onClick={() => void onProviderConnect(providerId)}
                        >
                          Open sign-in
                        </button>
                        <button
                          className="button compact primary"
                          onClick={() => void onProviderConfirm(providerId)}
                        >
                          I’m signed in
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="button compact secondary"
                          onClick={() => plugin.openSearch("")}
                        >
                          Open
                        </button>
                        <button
                          className="text-button danger-text"
                          onClick={() => void onProviderDeactivate(providerId)}
                        >
                          Mark signed out
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <p className="provider-disclaimer">
            “Active” currently means you confirmed that the provider-owned browser session is
            signed in. 3Dstreaming cannot inspect Netflix, Disney+, HBO Max, or Prime Video
            cookies from this origin, so this status is a convenience record rather than an
            independent entitlement check.
          </p>
        </div>

        <div className="creator-panel">
          <span className="kicker">CREATOR TOOLS</span>
          <h2>Contribute 3D mappings</h2>
          <p>
            Upload a profile for an exact movie cut, streaming edition, series, season, or episode.
            Community submissions can later be rated, revised, and moderated.
          </p>
          <button className="button primary" onClick={onUpload}>Upload 3D mapping</button>
        </div>
      </div>
    </section>
  );
}
