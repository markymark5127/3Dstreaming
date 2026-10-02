import { useEffect, useMemo, useRef, useState } from "react";
import { LocalFileAdapter } from "./adapters/LocalFileAdapter";
import type { MediaSource } from "./adapters/MediaAdapter";
import { LocalAccountService } from "./auth/LocalAccountService";
import type { UserAccount } from "./auth/types";
import { catalog, searchCatalog } from "./catalog/catalog";
import type { CatalogItem } from "./catalog/types";
import { AccountView } from "./components/AccountView";
import { MediaCard } from "./components/MediaCard";
import { MapperPanel } from "./components/MapperPanel";
import { ProfileShelf } from "./components/ProfileShelf";
import { Sidebar, type AppSection } from "./components/Sidebar";
import { Upload3DModal } from "./components/Upload3DModal";
import { LocalCommunityRegistry } from "./community/LocalCommunityRegistry";
import type { CommunityProfile } from "./community/types";
import { loadThreeDProfile } from "./core/sidecar";
import { localMediaPlugin } from "./providers/LocalMediaPlugin";
import { providerPlugins } from "./providers/providers";
import { providerPluginRegistry } from "./providers/registry";
import type { MapperResult } from "./mapper/types";
import type { ProviderId } from "./providers/types";
import type { ThreeDProfile } from "./types/threeDProfile";
import type { SidecarRuntimeState } from "./sidecar/runtime";
import { detectCapabilities, type ClientCapabilities } from "./xr/capabilities";
import { startStereoPreview, type StereoPreviewHandle } from "./xr/StereoPreview";
import { startWebXRTheater, type XRTheaterHandle } from "./xr/WebXRTheater";

const localAdapter = new LocalFileAdapter();
const communityRegistry = new LocalCommunityRegistry();
const accountService = new LocalAccountService();

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const xrHandle = useRef<XRTheaterHandle | null>(null);
  const previewHandle = useRef<StereoPreviewHandle | null>(null);

  const [section, setSection] = useState<AppSection>("home");
  const [user, setUser] = useState<UserAccount | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  const [profiles, setProfiles] = useState<CommunityProfile[]>([]);
  const [myProfiles, setMyProfiles] = useState<CommunityProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [source, setSource] = useState<MediaSource | null>(null);
  const [activeProfile, setActiveProfile] = useState<ThreeDProfile | null>(null);
  const [capabilities, setCapabilities] = useState<ClientCapabilities | null>(null);
  const [status, setStatus] = useState("Choose a local video and community profile to test playback.");
  const [depthStrength, setDepthStrength] = useState(60);
  const [convergence, setConvergence] = useState(50);
  const [sidecarState, setSidecarState] = useState<SidecarRuntimeState | null>(null);

  useEffect(() => {
    void bootstrap();

    return () => {
      localAdapter.dispose();
      previewHandle.current?.end();
      void xrHandle.current?.end();
    };
  }, []);

  async function bootstrap() {
    const [caps, account, community] = await Promise.all([
      detectCapabilities(),
      accountService.getCurrentUser(),
      communityRegistry.search({ limit: 50 })
    ]);

    setCapabilities(caps);
    setUser(account);
    setProfiles(community);

    if (account) {
      setMyProfiles(await communityRegistry.search({ authorId: account.id, limit: 50 }));
    }
  }

  const filteredCatalog = useMemo(
    () => searchCatalog(searchQuery),
    [searchQuery]
  );

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles;

    return profiles.filter((item) =>
      [item.title, item.editionLabel, item.author.displayName, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [profiles, searchQuery]);

  const movieItems = catalog.filter((item) => item.kind === "movie");
  const showItems = catalog.filter((item) => item.kind === "series" || item.kind === "episode");
  const featured = catalog.find((item) => item.featured) ?? catalog[0];

  function profileCount(item: CatalogItem) {
    return profiles.filter((profile) =>
      item.profileIds.includes(profile.id) || profile.title === item.title
    ).length;
  }

  function profilesFor(item: CatalogItem) {
    return profiles.filter((profile) =>
      item.profileIds.includes(profile.id) || profile.title === item.title
    );
  }

  function useCommunityProfile(item: CommunityProfile) {
    setActiveProfile(item.profile);
    setDepthStrength(Math.round((item.profile.defaults?.depthStrength ?? 0.6) * 100));
    setConvergence(Math.round((item.profile.defaults?.convergence ?? 0.5) * 100));
    setStatus(`Loaded ${item.title} · ${item.editionLabel}. Pair it with the matching source cut.`);
    setSection("my-3d");
  }

  async function chooseVideo(file?: File) {
    if (!file) return;

    try {
      const next = await localAdapter.open(file);
      setSource(next);
      setStatus(`Loaded ${file.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open video.");
    }
  }

  async function chooseProfile(file?: File) {
    if (!file) return;

    try {
      const next = await loadThreeDProfile(file);
      setActiveProfile(next);
      setDepthStrength(Math.round((next.defaults?.depthStrength ?? 0.6) * 100));
      setConvergence(Math.round((next.defaults?.convergence ?? 0.5) * 100));
      setStatus(`Loaded ${next.title} · ${next.editionId}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read 3D profile.");
    }
  }

  function stereoOptions() {
    return {
      profile: activeProfile,
      strength: depthStrength / 100,
      convergence: convergence / 100,
      popOutLimit: activeProfile?.defaults?.popOutLimit ?? 0.18,
      onSidecarState: setSidecarState
    };
  }

  function previewSbs(mode: "window" | "cardboard" = "window") {
    if (!videoRef.current) return;

    previewHandle.current?.end();
    previewHandle.current = startStereoPreview(
      videoRef.current,
      stereoOptions(),
      mode
    );

    setStatus(
      mode === "cardboard"
        ? "Cardboard mode running full-screen SBS for phone viewers."
        : "SBS preview running. Left and right halves use opposite stereo warps."
    );
  }

  async function enterVr() {
    if (!videoRef.current) return;

    try {
      previewHandle.current?.end();
      previewHandle.current = null;
      await videoRef.current.play();
      xrHandle.current = await startWebXRTheater(videoRef.current, stereoOptions());
      setStatus("WebXR stereo theater running.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not enter VR.");
    }
  }

  async function signIn(email: string, displayName: string) {
    const next = await accountService.signIn(email, displayName);
    setUser(next);
    setMyProfiles(await communityRegistry.search({ authorId: next.id, limit: 50 }));
  }

  async function signOut() {
    await accountService.signOut();
    setUser(null);
    setMyProfiles([]);
  }

  async function connectProvider(providerId: ProviderId) {
    if (!user) return;

    const plugin = providerPluginRegistry.get(providerId);
    const result = await plugin.connect();

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    const next = await accountService.updateProviderConnection({
      providerId,
      state:
        result.value.state === "connected"
          ? "oauth-connected"
          : "provider-session",
      connectedAt: new Date().toISOString(),
      accountLabel: result.value.accountLabel
    });

    setUser(next);
    setStatus(result.value.message);
  }

  function bindVideoElement(element: HTMLVideoElement | null) {
    videoRef.current = element;
    localMediaPlugin.bindMediaElement(element);
  }

  useEffect(() => {
    const strength = depthStrength / 100;
    const conv = convergence / 100;
    const popOut = activeProfile?.defaults?.popOutLimit ?? 0.18;

    previewHandle.current?.setControls(strength, conv, popOut);
    xrHandle.current?.setControls(strength, conv, popOut);
  }, [depthStrength, convergence, activeProfile]);

  async function useMapperResult(result: MapperResult, sourceFile: File) {
    const nextSource = await localAdapter.open(sourceFile);
    setSource(nextSource);
    setActiveProfile(result.runtimeProfile);
    setDepthStrength(
      Math.round((result.runtimeProfile.defaults?.depthStrength ?? 0.58) * 100)
    );
    setConvergence(
      Math.round((result.runtimeProfile.defaults?.convergence ?? 0.5) * 100)
    );
    setSidecarState(null);
    setStatus(
      `Generated and loaded ${result.depthFileName}. You can preview it immediately in SBS or Cardboard mode.`
    );

    requestAnimationFrame(() => {
      videoRef.current?.load();
    });
  }

  async function publishProfile(profile: CommunityProfile) {
    const submitted = await communityRegistry.publish(profile);
    setMyProfiles((current) => [submitted, ...current.filter((item) => item.id !== submitted.id)]);
  }

  function renderShelf(title: string, items: CatalogItem[]) {
    return (
      <section className="shelf-section">
        <div className="shelf-heading">
          <h2>{title}</h2>
          <button className="text-button">See All</button>
        </div>
        <div className="media-shelf">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              profileCount={profileCount(item)}
              onOpen={setSelectedItem}
            />
          ))}
        </div>
      </section>
    );
  }

  function homeView() {
    return (
      <>
        <section className={`feature-hero ${featured.artworkClass}`}>
          <div className="feature-vignette" />
          <div className="feature-content">
            <span className="kicker">FEATURED COMMUNITY 3D</span>
            <h1>{featured.title}</h1>
            <div className="feature-meta">
              <span>{featured.year}</span>
              <span>{featured.runtimeLabel}</span>
              <span className="three-d-pill">{profileCount(featured)} 3D profile</span>
            </div>
            <p>{featured.summary}</p>
            <div className="feature-actions">
              <button className="button light" onClick={() => setSelectedItem(featured)}>
                ▶ View 3D options
              </button>
              <button className="button glass" onClick={() => setSection("my-3d")}>
                Open local source
              </button>
            </div>
          </div>
        </section>

        <section className="shelf-section first-shelf">
          <div className="shelf-heading">
            <h2>Popular Community 3D</h2>
            <button className="text-button" onClick={() => setSection("search")}>Browse Library</button>
          </div>
          <ProfileShelf profiles={profiles} onUse={useCommunityProfile} />
        </section>

        {renderShelf("Movies", movieItems)}
        {renderShelf("TV & Episodes", showItems)}

        <section className="service-strip">
          <div>
            <span className="kicker">YOUR SOURCES</span>
            <h2>One 3D library. Your existing services.</h2>
          </div>
          <div className="mini-service-logos">
            <span className="service-logo service-netflix">N</span>
            <span className="service-logo service-disney-plus">D+</span>
            <span className="service-logo service-max">M</span>
            <span className="service-logo service-prime-video">P</span>
          </div>
          <button className="button glass" onClick={() => setSection("account")}>Manage Services</button>
        </section>
      </>
    );
  }

  function searchView() {
    return (
      <section className="content-section">
        <span className="kicker">SEARCH</span>
        <h1 className="page-title">Find something to watch in 3D.</h1>

        <div className="search-bar-large">
          <span>⌕</span>
          <input
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Movies, shows, creators, editions..."
          />
        </div>

        <div className="provider-search-actions">
          <span>Search connected services</span>
          <div>
            {providerPlugins.map((plugin) => (
              <button
                key={plugin.id}
                className="button secondary compact"
                onClick={() => plugin.openSearch(searchQuery)}
              >
                {plugin.provider?.shortName} {plugin.displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="shelf-heading">
          <h2>Titles</h2>
          <span>{filteredCatalog.length} results</span>
        </div>
        <div className="media-grid">
          {filteredCatalog.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              profileCount={profileCount(item)}
              onOpen={setSelectedItem}
            />
          ))}
        </div>

        <div className="shelf-heading spaced-heading">
          <h2>Community 3D Profiles</h2>
          <span>{filteredProfiles.length} results</span>
        </div>
        <ProfileShelf profiles={filteredProfiles} onUse={useCommunityProfile} />
      </section>
    );
  }

  function libraryView(kind: "movies" | "shows") {
    const items = kind === "movies" ? movieItems : showItems;

    return (
      <section className="content-section">
        <span className="kicker">{kind === "movies" ? "MOVIES" : "TV SHOWS"}</span>
        <h1 className="page-title">
          {kind === "movies" ? "Movies with community depth." : "Series and episode mappings."}
        </h1>
        <p className="page-copy">
          Browse the shared catalog. Titles can exist before anyone contributes a 3D profile,
          making it easy to see what the community should convert next.
        </p>
        <div className="media-grid roomy-grid">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              profileCount={profileCount(item)}
              onOpen={setSelectedItem}
            />
          ))}
        </div>
      </section>
    );
  }

  function my3DView() {
    return (
      <section className="content-section">
        <div className="page-heading-row">
          <div>
            <span className="kicker">MY 3D</span>
            <h1 className="page-title">Your mappings & playback.</h1>
          </div>
          <button
            className="button light"
            onClick={() => user ? setShowUpload(true) : setSection("account")}
          >
            ＋ Upload 3D mapping
          </button>
        </div>

        <section className="shelf-section flush-shelf">
          <div className="shelf-heading">
            <h2>Your contributions</h2>
            <span>{user ? `${myProfiles.length} submissions` : "Sign in to contribute"}</span>
          </div>
          {user ? (
            <ProfileShelf profiles={myProfiles} onUse={useCommunityProfile} />
          ) : (
            <button className="sign-in-prompt" onClick={() => setSection("account")}>
              <strong>Sign in to build the community library</strong>
              <span>Your uploads, revisions, ratings, and service links live on your 3Dstreaming account.</span>
            </button>
          )}
        </section>

        <section className="playback-studio">
          <div className="studio-video">
            {source ? (
              <video ref={bindVideoElement} src={source.url} controls playsInline />
            ) : (
              <div className="studio-empty">
                <span className="three-d-logo large-logo">3D</span>
                <strong>Local playback test</strong>
                <span>Load a source movie to test the active mapping.</span>
              </div>
            )}
          </div>

          <div className="studio-controls">
            <div>
              <span className="kicker">ACTIVE MAPPING</span>
              <h2>{activeProfile?.title ?? "No mapping selected"}</h2>
              <p>{activeProfile?.editionId ?? "Choose a community profile or load a JSON mapping."}</p>
            </div>

            <label className="control-slider">
              <span>Depth <strong>{depthStrength}%</strong></span>
              <input type="range" min="0" max="100" value={depthStrength} onChange={(e) => setDepthStrength(Number(e.target.value))} />
            </label>

            <label className="control-slider">
              <span>Convergence <strong>{convergence}%</strong></span>
              <input type="range" min="0" max="100" value={convergence} onChange={(e) => setConvergence(Number(e.target.value))} />
            </label>

            <div className="studio-actions">
              <label className="button primary">
                Open video
                <input hidden type="file" accept="video/*,.mkv" onChange={(e) => void chooseVideo(e.target.files?.[0])} />
              </label>
              <label className="button secondary">
                Load mapping JSON
                <input hidden type="file" accept=".json,application/json" onChange={(e) => void chooseProfile(e.target.files?.[0])} />
              </label>
              <button
                className="button secondary"
                disabled={!source}
                onClick={() => previewSbs("window")}
              >
                Preview SBS
              </button>
              <button
                className="button secondary"
                disabled={!source}
                onClick={() => previewSbs("cardboard")}
              >
                Cardboard
              </button>
              <button
                className="button secondary"
                disabled={!source || !capabilities?.immersiveVr}
                onClick={() => void enterVr()}
              >
                Enter VR
              </button>
            </div>

            {sidecarState && (
              <div className="sidecar-diagnostics">
                <span><strong>Sidecar</strong> {sidecarState.mode}</span>
                <span><strong>Drift</strong> {(sidecarState.drift * 1000).toFixed(1)} ms</span>
                <span><strong>Resyncs</strong> {sidecarState.resyncs}</span>
              </div>
            )}
            <p className="studio-status">{status}</p>
          </div>
        </section>

        <MapperPanel onUseResult={useMapperResult} />
      </section>
    );
  }

  function page() {
    switch (section) {
      case "search":
        return searchView();
      case "movies":
        return libraryView("movies");
      case "shows":
        return libraryView("shows");
      case "my-3d":
        return my3DView();
      case "account":
        return (
          <AccountView
            user={user}
            onSignIn={signIn}
            onSignOut={signOut}
            onProviderConnect={connectProvider}
            onUpload={() => user ? setShowUpload(true) : undefined}
          />
        );
      default:
        return homeView();
    }
  }

  return (
    <div className="tv-app">
      <Sidebar
        active={section}
        onChange={setSection}
        accountInitials={user?.avatarInitials}
      />

      <main className="tv-content">
        {page()}
      </main>

      {selectedItem && (
        <div className="detail-backdrop" onMouseDown={() => setSelectedItem(null)}>
          <article
            className={`media-detail ${selectedItem.artworkClass}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="detail-shade" />
            <button className="detail-close" onClick={() => setSelectedItem(null)}>×</button>
            <div className="detail-content">
              <span className="kicker">{selectedItem.kind.toUpperCase()}</span>
              <h2>{selectedItem.title}</h2>
              <div className="feature-meta">
                <span>{selectedItem.year}</span>
                <span>{selectedItem.runtimeLabel}</span>
                <span>{profileCount(selectedItem)} community 3D profile(s)</span>
              </div>
              <p>{selectedItem.summary}</p>

              {profilesFor(selectedItem).length > 0 ? (
                <div className="detail-profiles">
                  {profilesFor(selectedItem).map((item) => (
                    <button key={item.id} onClick={() => {
                      useCommunityProfile(item);
                      setSelectedItem(null);
                    }}>
                      <span>
                        <strong>{item.editionLabel}</strong>
                        <small>by {item.author.displayName} · ★ {item.ratingAverage.toFixed(1)}</small>
                      </span>
                      <span>Use 3D →</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  className="button light"
                  onClick={() => {
                    setSelectedItem(null);
                    user ? setShowUpload(true) : setSection("account");
                  }}
                >
                  Be the first to add a 3D mapping
                </button>
              )}
            </div>
          </article>
        </div>
      )}

      {showUpload && user && (
        <Upload3DModal
          user={user}
          onClose={() => setShowUpload(false)}
          onSubmit={publishProfile}
        />
      )}
    </div>
  );
}
