import { FormEvent, useState } from "react";
import type { ProviderConnection, UserAccount } from "../auth/types";
import { providerPlugins } from "../providers/providers";
import type { ProviderId } from "../providers/types";

interface AccountViewProps {
  user: UserAccount | null;
  amazonOAuthConfigured: boolean;
  providerBridgeConfigured: boolean;
  onSignIn(email: string, displayName: string): Promise<void>;
  onSignOut(): Promise<void>;
  onProviderConnect(providerId: ProviderId): Promise<void>;
  onProviderVerify(providerId: ProviderId): Promise<void>;
  onProviderDeactivate(providerId: ProviderId): Promise<void>;
  onIncludeOtherServicesChange(value: boolean): Promise<void>;
  onUpload(): void;
}

function isMyService(connection?: ProviderConnection): boolean {
  return Boolean(connection && connection.state !== "not-connected");
}

function isVerified(connection?: ProviderConnection): boolean {
  return (
    connection?.state === "oauth-connected" ||
    connection?.state === "bridge-verified"
  );
}

function connectionLabel(
  providerId: ProviderId,
  connection?: ProviderConnection
): string {
  if (!connection || connection.state === "not-connected") {
    return "Not in My Services";
  }

  if (isVerified(connection)) {
    if (providerId === "prime-video" && connection.verificationMethod === "oauth") {
      return connection.accountLabel
        ? `Amazon identity verified · ${connection.accountLabel}`
        : "Amazon identity verified · Prime entitlement remains provider-owned";
    }

    return connection.verificationMethod === "oauth"
      ? "Verified through official OAuth"
      : "Verified by companion bridge";
  }

  if (providerId === "prime-video") {
    return "In My Services · Amazon identity not yet verified";
  }

  return "In My Services · provider-owned sign-in cannot be verified by this PWA";
}

export function AccountView({
  user,
  amazonOAuthConfigured,
  providerBridgeConfigured,
  onSignIn,
  onSignOut,
  onProviderConnect,
  onProviderVerify,
  onProviderDeactivate,
  onIncludeOtherServicesChange,
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
          mappings, ratings, and search preferences. Streaming-provider credentials never
          enter 3Dstreaming.
        </p>

        <form className="account-form" onSubmit={(event) => void submit(event)}>
          <label>
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Display name</span>
            <input
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <button className="button primary" type="submit">
            Create / sign in
          </button>
          <small>
            Prototype 3Dstreaming account: stored in this browser for now.
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
              const amazonProvider = providerId === "prime-video";

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
                    <span>{connectionLabel(providerId, connection)}</span>
                  </div>

                  <div className="connection-actions">
                    {!enabled ? (
                      <button
                        className="button compact"
                        onClick={() => void onProviderConnect(providerId)}
                      >
                        Add & open sign-in ↗
                      </button>
                    ) : (
                      <>
                        <button
                          className="button compact secondary"
                          onClick={() => void onProviderConnect(providerId)}
                        >
                          Open provider ↗
                        </button>

                        {amazonProvider && (
                          <button
                            className="button compact primary"
                            disabled={!amazonOAuthConfigured}
                            onClick={() => void onProviderVerify(providerId)}
                            title={
                              amazonOAuthConfigured
                                ? "Verify Amazon identity through official Login with Amazon OAuth"
                                : "Set VITE_AMAZON_LWA_CLIENT_ID to enable Login with Amazon"
                            }
                          >
                            {verified ? "Re-check Amazon" : "Verify Amazon OAuth"}
                          </button>
                        )}

                        {!amazonProvider && (
                          providerBridgeConfigured ? (
                            <button
                              className="button compact secondary"
                              onClick={() => void onProviderVerify(providerId)}
                            >
                              Check confirmation
                            </button>
                          ) : (
                            <span className="provider-verification-note">
                              Install companion bridge to confirm
                            </span>
                          )
                        )}

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
            Login with Amazon can verify the Amazon identity attached to Prime Video, but
            it does not prove a Prime Video subscription entitlement. Netflix, Disney+,
            and HBO Max do not currently expose a public consumer OAuth flow that this PWA
            can use, so their sign-in remains provider-owned.
          </p>

          <section className="account-preferences">
            <div>
              <span className="kicker">SEARCH</span>
              <h2>Streaming search</h2>
              <p>
                By default, unified search only includes titles available on services in
                My Services.
              </p>
            </div>

            <label className="preference-toggle">
              <input
                type="checkbox"
                checked={user.preferences.includeOtherStreamingServices}
                onChange={(event) =>
                  void onIncludeOtherServicesChange(event.target.checked)
                }
              />
              <span>
                <strong>Show titles from other services</strong>
                <small>
                  Include supported providers outside My Services in unified search.
                </small>
              </span>
            </label>
          </section>
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
