import { FormEvent, useState } from "react";
import type { ProviderConnection, UserAccount } from "../auth/types";
import { providerPlugins } from "../providers/providers";
import type { ProviderId } from "../providers/types";

interface AccountViewProps {
  user: UserAccount | null;
  onSignIn(email: string, displayName: string): Promise<void>;
  onSignOut(): Promise<void>;
  onProviderConnect(providerId: ProviderId): Promise<void>;
  onProviderDeactivate(providerId: ProviderId): Promise<void>;
  onUpload(): void;
}

function isMyService(connection?: ProviderConnection): boolean {
  return Boolean(
    connection &&
      connection.state !== "not-connected"
  );
}

function isVerified(connection?: ProviderConnection): boolean {
  return (
    connection?.state === "oauth-connected" ||
    connection?.state === "bridge-verified"
  );
}

function connectionLabel(connection?: ProviderConnection): string {
  if (!connection || connection.state === "not-connected") {
    return "Not in My Services";
  }

  if (isVerified(connection)) {
    return connection.verificationMethod === "oauth"
      ? "Verified through OAuth"
      : "Verified by companion bridge";
  }

  return "In My Services · sign-in is handled by the provider";
}

export function AccountView({
  user,
  onSignIn,
  onSignOut,
  onProviderConnect,
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
        <h1 className="page-title">Sign in to personalize your services.</h1>
        <p className="page-copy">
          Your 3Dstreaming account remembers the services you use, your community
          mappings, ratings, and revisions. Streaming-provider credentials never enter
          3Dstreaming.
        </p>

        <form className="account-form" onSubmit={(event) => void submit(event)}>
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span>Display name</span>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <button className="button primary" type="submit">
            Create / sign in
          </button>
          <small>
            Prototype account: stored in this browser for now. Hosted 3Dstreaming
            authentication replaces this before production.
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
        <button className="button secondary" onClick={() => void onSignOut()}>
          Sign out
        </button>
      </div>

      <div className="account-columns">
        <div>
          <div className="section-title-row">
            <div>
              <span className="kicker">STREAMING SERVICES</span>
              <h2>My Services</h2>
            </div>
          </div>

          <div className="connection-list">
            {providerPlugins.map((plugin) => {
              const providerId = plugin.provider!.id;
              const connection = user.providerConnections.find(
                (item) => item.providerId === providerId
              );
              const enabled = isMyService(connection);
              const verified = isVerified(connection);

              return (
                <article
                  className={`connection-card ${enabled ? "connection-active" : ""}`}
                  key={providerId}
                >
                  <div className={`service-logo service-${providerId}`}>
                    {plugin.provider!.shortName}
                  </div>

                  <div className="connection-copy">
                    <div className="connection-title-row">
                      <strong>{plugin.provider!.name}</strong>
                      {enabled && (
                        <span className="connection-active-pill">
                          {verified ? "VERIFIED" : "MY SERVICE"}
                        </span>
                      )}
                    </div>
                    <span>{connectionLabel(connection)}</span>
                  </div>

                  <div className="connection-actions">
                    {!enabled ? (
                      <button
                        className="button compact"
                        onClick={() => void onProviderConnect(providerId)}
                      >
                        Add & sign in ↗
                      </button>
                    ) : (
                      <>
                        <button
                          className="button compact secondary"
                          onClick={() => void onProviderConnect(providerId)}
                        >
                          Open / sign in ↗
                        </button>
                        <button
                          className="text-button danger-text"
                          onClick={() => void onProviderDeactivate(providerId)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <p className="provider-disclaimer">
            My Services is a preference list, not a claim that 3Dstreaming authenticated
            your Netflix, Disney+, HBO Max, or Prime Video account. A provider is only
            shown as Verified when an approved OAuth integration or companion bridge can
            actually prove the session.
          </p>
        </div>

        <div className="creator-panel">
          <span className="kicker">CREATOR TOOLS</span>
          <h2>Contribute 3D mappings</h2>
          <p>
            Upload a profile for an exact movie cut, streaming edition, series, season,
            or episode. Community submissions can later be rated, revised, and moderated.
          </p>
          <button className="button primary" onClick={onUpload}>
            Upload 3D mapping
          </button>
        </div>
      </div>
    </section>
  );
}
