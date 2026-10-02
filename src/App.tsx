import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LocalFileAdapter } from "./adapters/LocalFileAdapter";
import type { MediaSource } from "./adapters/MediaAdapter";
import { LocalCommunityRegistry } from "./community/LocalCommunityRegistry";
import type { CommunityProfile } from "./community/types";
import { loadThreeDProfile } from "./core/sidecar";
import { providerAdapters } from "./providers/providers";
import type { ThreeDProfile } from "./types/threeDProfile";
import { detectCapabilities, type ClientCapabilities } from "./xr/capabilities";
import { startWebXRTheater, type XRTheaterHandle } from "./xr/WebXRTheater";

const localAdapter = new LocalFileAdapter();
const communityRegistry = new LocalCommunityRegistry();

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const xrHandle = useRef<XRTheaterHandle | null>(null);
  const [source, setSource] = useState<MediaSource | null>(null);
  const [profile, setProfile] = useState<ThreeDProfile | null>(null);
  const [communityProfiles, setCommunityProfiles] = useState<CommunityProfile[]>([]);
  const [communityQuery, setCommunityQuery] = useState("");
  const [capabilities, setCapabilities] = useState<ClientCapabilities | null>(null);
  const [status, setStatus] = useState("Browse community profiles or choose a local video to begin.");
  const [depthStrength, setDepthStrength] = useState(60);
  const [convergence, setConvergence] = useState(50);

  useEffect(() => {
    detectCapabilities().then(setCapabilities);
    void refreshCommunityProfiles();

    return () => {
      localAdapter.dispose();
      void xrHandle.current?.end();
    };
  }, []);

  const capabilityRows = useMemo(() => {
    if (!capabilities) return [];
    return [
      ["Secure context", capabilities.secureContext],
      ["PWA/service worker", capabilities.serviceWorker],
      ["WebGL 2", capabilities.webgl2],
      ["WebGPU", capabilities.webgpu],
      ["WebXR", capabilities.webxr],
      ["Immersive VR", capabilities.immersiveVr]
    ] as const;
  }, [capabilities]);

  async function refreshCommunityProfiles(query = communityQuery) {
    const next = await communityRegistry.search({ q: query, limit: 12 });
    setCommunityProfiles(next);
  }

  async function searchCommunity(event: FormEvent) {
    event.preventDefault();
    await refreshCommunityProfiles();
  }

  function applyProfile(next: ThreeDProfile, label: string) {
    setProfile(next);
    setDepthStrength(Math.round((next.defaults?.depthStrength ?? 0.6) * 100));
    setConvergence(Math.round((next.defaults?.convergence ?? 0.5) * 100));
    setStatus(`Loaded 3D profile: ${label}. Match it to the exact movie edition before playback.`);
  }

  async function chooseVideo(file?: File) {
    if (!file) return;
    try {
      const next = await localAdapter.open(file);
      setSource(next);
      setStatus(`Loaded ${file.name}. The current XR theater is 2D; stereo sidecar rendering is the next milestone.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open video.");
    }
  }

  async function chooseProfile(file?: File) {
    if (!file) return;
    try {
      const next = await loadThreeDProfile(file);
      applyProfile(next, `${next.title} / ${next.editionId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read 3D profile.");
    }
  }

  async function enterVr() {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      xrHandle.current = await startWebXRTheater(videoRef.current);
      setStatus("WebXR theater running. Exit VR from the headset system controls.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not enter VR.");
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">COMMUNITY 3D LAYER FOR VIDEO</span>
          <h1>3Dstreaming</h1>
          <p>
            Find a community-made 3D profile for the exact cut you are watching, pair it
            with a legitimate video source, and render the result across XR devices.
          </p>
        </div>
        <span className="alpha-pill">prototype 0.2</span>
      </header>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MEDIA SOURCES</span>
            <h2>Bring the stream. Keep the account with the provider.</h2>
          </div>
          <p>
            Provider sign-in and playback stay provider-owned. 3Dstreaming never asks for
            or stores streaming-service passwords.
          </p>
        </div>

        <div className="provider-grid">
          {providerAdapters.map((adapter) => (
            <article className="provider-card" key={adapter.provider.id}>
              <div>
                <span className="provider-status">{adapter.provider.integrationStatus}</span>
                <h3>{adapter.provider.name}</h3>
                <p>{adapter.provider.notes}</p>
              </div>
              <button className="button" onClick={() => adapter.openProvider()}>
                Open {adapter.provider.name}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block community-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">COMMUNITY 3D LIBRARY</span>
            <h2>Profiles are the shared layer.</h2>
          </div>
          <p>
            Community entries contain depth/disparity/convergence metadata for a specific
            edition—not the movie itself.
          </p>
        </div>

        <form className="community-search" onSubmit={(event) => void searchCommunity(event)}>
          <input
            value={communityQuery}
            onChange={(event) => setCommunityQuery(event.target.value)}
            placeholder="Search title, creator, tag, or edition..."
            aria-label="Search community 3D profiles"
          />
          <button className="button primary" type="submit">Search profiles</button>
        </form>

        <div className="community-grid">
          {communityProfiles.map((item) => (
            <article className="profile-card" key={item.id}>
              <div className="profile-title-row">
                <div>
                  <h3>{item.title}{item.year ? ` (${item.year})` : ""}</h3>
                  <p>{item.editionLabel}</p>
                </div>
                <span className="profile-rating">★ {item.ratingAverage.toFixed(1)}</span>
              </div>

              <div className="profile-tags">
                {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>

              <div className="profile-stats">
                <span>by {item.author.displayName}</span>
                <span>{item.downloads.toLocaleString()} uses</span>
                <span>{item.profile.tracks.length} track(s)</span>
              </div>

              <button
                className="button"
                onClick={() => applyProfile(item.profile, `${item.title} / ${item.editionLabel}`)}
              >
                Use this 3D profile
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PLAYBACK LAB</span>
            <h2>Test the source + sidecar pipeline.</h2>
          </div>
          <p>
            Local files are the first fully controllable source while provider-specific
            playback bridges are researched separately.
          </p>
        </div>

        <div className="workspace">
          <div className="player-card">
            <div className="video-frame">
              {source ? (
                <video ref={videoRef} src={source.url} controls playsInline />
              ) : (
                <div className="empty-state">
                  <strong>No video loaded</strong>
                  <span>Start with an MP4/WebM/MKV your browser can decode.</span>
                </div>
              )}
            </div>

            <div className="toolbar">
              <label className="button primary">
                Open local video
                <input
                  hidden
                  type="file"
                  accept="video/*,.mkv"
                  onChange={(event) => void chooseVideo(event.target.files?.[0])}
                />
              </label>

              <label className="button">
                Load profile JSON
                <input
                  hidden
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void chooseProfile(event.target.files?.[0])}
                />
              </label>

              <button
                className="button"
                disabled={!source || !capabilities?.immersiveVr}
                onClick={() => void enterVr()}
              >
                Enter VR theater
              </button>
            </div>

            <p className="status">{status}</p>
          </div>

          <aside className="controls-card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">ACTIVE 3D PROFILE</span>
                <h2>{profile?.title ?? "No sidecar loaded"}</h2>
              </div>
              <span className={profile ? "dot ready" : "dot"} />
            </div>

            <label className="slider-row">
              <span>Depth strength</span>
              <strong>{depthStrength}%</strong>
              <input
                type="range"
                min="0"
                max="100"
                value={depthStrength}
                onChange={(event) => setDepthStrength(Number(event.target.value))}
              />
            </label>

            <label className="slider-row">
              <span>Convergence</span>
              <strong>{convergence}%</strong>
              <input
                type="range"
                min="0"
                max="100"
                value={convergence}
                onChange={(event) => setConvergence(Number(event.target.value))}
              />
            </label>

            {profile && (
              <div className="profile-meta">
                <span>{profile.editionId}</span>
                <span>{profile.tracks.length} sidecar track(s)</span>
                <span>{profile.fingerprint.durationSeconds.toFixed(2)} sec</span>
              </div>
            )}

            <hr />

            <span className="eyebrow">DEVICE CAPABILITIES</span>
            <div className="capability-grid">
              {capabilityRows.map(([label, ok]) => (
                <div className="capability" key={label}>
                  <span>{label}</span>
                  <strong className={ok ? "yes" : "no"}>{ok ? "YES" : "NO"}</strong>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="milestones">
        <article>
          <span>01</span>
          <h3>Community registry</h3>
          <p>Profiles are searchable, attributable, rateable, versioned, and tied to an exact movie cut—not to a device.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Provider adapters</h3>
          <p>Netflix, Disney+, Max, Prime, Plex, Jellyfin, and local media can evolve independently behind one source interface.</p>
        </article>
        <article>
          <span>03</span>
          <h3>XR renderers</h3>
          <p>WebXR is first. Quest-native, visionOS, and OpenXR clients can all consume the same community sidecar profile.</p>
        </article>
      </section>
    </main>
  );
}
