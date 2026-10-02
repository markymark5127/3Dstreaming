import { useEffect, useMemo, useRef, useState } from "react";
import { LocalFileAdapter } from "./adapters/LocalFileAdapter";
import type { MediaSource } from "./adapters/MediaAdapter";
import { loadThreeDProfile } from "./core/sidecar";
import type { ThreeDProfile } from "./types/threeDProfile";
import { detectCapabilities, type ClientCapabilities } from "./xr/capabilities";
import { startWebXRTheater, type XRTheaterHandle } from "./xr/WebXRTheater";

const adapter = new LocalFileAdapter();

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const xrHandle = useRef<XRTheaterHandle | null>(null);
  const [source, setSource] = useState<MediaSource | null>(null);
  const [profile, setProfile] = useState<ThreeDProfile | null>(null);
  const [capabilities, setCapabilities] = useState<ClientCapabilities | null>(null);
  const [status, setStatus] = useState("Choose a local video to begin.");
  const [depthStrength, setDepthStrength] = useState(60);
  const [convergence, setConvergence] = useState(50);

  useEffect(() => {
    detectCapabilities().then(setCapabilities);
    return () => {
      adapter.dispose();
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

  async function chooseVideo(file?: File) {
    if (!file) return;
    try {
      const next = await adapter.open(file);
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
      setProfile(next);
      setDepthStrength(Math.round((next.defaults?.depthStrength ?? 0.6) * 100));
      setConvergence(Math.round((next.defaults?.convergence ?? 0.5) * 100));
      setStatus(`Loaded 3D profile: ${next.title} / ${next.editionId}`);
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
          <span className="eyebrow">WEB-FIRST XR VIDEO LAB</span>
          <h1>3Dstreaming</h1>
          <p>
            Pair the video you already have access to with a synchronized 3D sidecar,
            then render the result on whatever XR device the browser can support.
          </p>
        </div>
        <span className="alpha-pill">prototype 0.1</span>
      </header>

      <section className="workspace">
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
              Load 3D profile
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
              <span className="eyebrow">3D PROFILE</span>
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
      </section>

      <section className="milestones">
        <article>
          <span>01</span>
          <h3>Source adapters</h3>
          <p>Local files first. Plex, Jellyfin, HTTP, and approved streaming integrations plug into the same interface later.</p>
        </article>
        <article>
          <span>02</span>
          <h3>3D sidecars</h3>
          <p>Depth, disparity, and convergence tracks are separate from the movie and versioned against a specific cut.</p>
        </article>
        <article>
          <span>03</span>
          <h3>XR renderers</h3>
          <p>WebXR is the first renderer. Quest, visionOS, and OpenXR-native renderers can share the same playback core.</p>
        </article>
      </section>
    </main>
  );
}
