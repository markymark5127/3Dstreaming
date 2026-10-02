import { FormEvent, useState } from "react";
import type { UserAccount } from "../auth/types";
import { providerPlugins } from "../providers/providers";
import type { ProviderId } from "../providers/types";

interface AccountViewProps {
  user: UserAccount | null;
  onSignIn(email: string, displayName: string): Promise<void>;
  onSignOut(): Promise<void>;
  onProviderConnect(providerId: ProviderId): Promise<void>;
  onUpload(): void;
}

export function AccountView({
  user,
  onSignIn,
  onSignOut,
  onProviderConnect,
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
        <h1 className="page-title">Sign in to contribute.</h1>
        <p className="page-copy">
          Your 3Dstreaming account owns your uploads, ratings, revisions, and provider
          connection records. Provider passwords never belong to this account.
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
            Prototype only: this branch stores the account in this browser. Hosted authentication replaces this before production.
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
              <h2>Connections</h2>
            </div>
          </div>

          <div className="connection-list">
            {providerPlugins.map((plugin) => {
              const connection = user.providerConnections.find(
                (item) => item.providerId === plugin.provider!.id
              );

              return (
                <article className="connection-card" key={plugin.provider!.id}>
                  <div className={`service-logo service-${plugin.provider!.id}`}>
                    {plugin.provider!.shortName}
                  </div>
                  <div className="connection-copy">
                    <strong>{plugin.provider!.name}</strong>
                    <span>
                      {connection?.state === "provider-session"
                        ? "Provider sign-in opened · account linking API still required"
                        : "Not connected"}
                    </span>
                  </div>
                  <button
                    className="button compact"
                    onClick={() => void onProviderConnect(plugin.provider!.id)}
                  >
                    {connection ? "Open" : "Sign in"}
                  </button>
                </article>
              );
            })}
          </div>

          <p className="provider-disclaimer">
            Netflix, Disney+, and Max do not currently expose a public consumer OAuth/playback
            API for this use case. These buttons therefore keep authentication on the provider's
            site. The account model is ready to store approved tokens if/when a supported integration exists.
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
