import { useEffect, useMemo, useRef, useState } from "react";
import { LocalFileAdapter } from "./adapters/LocalFileAdapter";
import type { MediaSource } from "./adapters/MediaAdapter";
import { amazonLogin } from "./auth/AmazonLoginWithAmazon";
import { LocalAccountService } from "./auth/LocalAccountService";
import type { UserAccount } from "./auth/types";
import { catalog, searchCatalog } from "./catalog/catalog";
import { searchUnifiedCatalog } from "./catalog/TmdbCatalogService";
import type { CatalogItem } from "./catalog/types";
import {
  isWatchmodeConfigured,
  resolveDirectProviderLinks
} from "./catalog/WatchmodeLinkService";
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
  const [streamingResults, setStreamingResults] = useState<CatalogItem[]>([]);
  const [streamingSearchLoading, setStreamingSearchLoading] = useState(false);
  const [streamingSearchConfigured, setStreamingSearchConfigured] = useState(true);
  const [streamingSearchError, setStreamingSearchError] = useState("");
  const [providerLinksLoading, setProviderLinksLoading] = useState(false);

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

  const enabledProviderPlugins = useMemo(() => {
    if (!user) return [];

    return providerPlugins.filter((plugin) => {
      const connection = user.providerConnections.find(
        (item) => item.providerId === plugin.provider?.id
      );

      return Boolean(connection && connection.state !== "not-connected");
    });
  }, [user]);

  const enabledProviderIds = useMemo(
    () => enabledProviderPlugins.map((plugin) => plugin.provider!.id),
    [enabledProviderPlugins]
  );

  const includeOtherServices =
    user?.preferences.includeOtherStreamingServices ?? false;

  const visibleStreamingResults = useMemo(() => {
    const withSupportedProviders = streamingResults.filter(
      (item) => (item.availableProviderIds?.length ?? 0) > 0
    );

    if (includeOtherServices) return withSupportedProviders;
    if (!user || enabledProviderIds.length === 0) return [];

    return withSupportedProviders.filter((item) =>
      item.availableProviderIds?.some((providerId) =>
        enabledProviderIds.includes(providerId)
      )
    );
  }, [streamingResults, includeOtherServices, user, enabledProviderIds]);

  useEffect(() => {
    const query = searchQuery.trim();

    if (section !== "search" || query.length < 2) {
      setStreamingResults([]);
      setStreamingSearchLoading(false);
      setStreamingSearchError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStreamingSearchLoading(true);
      setStreamingSearchError("");

      void searchUnifiedCatalog(
        query,
        import.meta.env.VITE_STREAMING_REGION || "US",
        controller.signal
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          setStreamingSearchConfigured(result.configured);
          setStreamingResults(result.items);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setStreamingSearchError(
            error instanceof Error ? error.message : "Streaming catalog search failed."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setStreamingSearchLoading(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery, section]);

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

    const existing = user.providerConnections.find(
      (item) => item.providerId === providerId
    );

    const next = await accountService.updateProviderConnection({
      ...existing,
      providerId,
      state:
        result.value.state === "connected"
          ? "oauth-connected"
          : "service-enabled",
      verificationMethod:
        result.value.state === "connected" ? "oauth" : "provider-owned",
      connectedAt: existing?.connectedAt ?? new Date().toISOString(),
      accountLabel: result.value.accountLabel
    });

    setUser(next);
    setStatus(
      `${plugin.displayName} was added to My Services. Sign-in stays on ${plugin.displayName}; 3Dstreaming does not claim the provider session is verified.`
    );
  }

  async function verifyProvider(providerId: ProviderId) {
    if (!user) return;

    if (providerId !== "prime-video") {
      setStatus(
        "This provider does not expose a public consumer OAuth flow to 3Dstreaming. Verification requires a supported provider API or companion bridge."
      );
      return;
    }

    if (!amazonLogin.isConfigured()) {
      setStatus(
        "Login with Amazon is not configured. Add VITE_AMAZON_LWA_CLIENT_ID and register this HTTPS origin in your Amazon security profile."
      );
      return;
    }

    const existing = user.providerConnections.find(
      (item) => item.providerId === providerId
    );

    try {
      const profile =
        existing?.state === "oauth-connected"
          ? await amazonLogin.verify().catch(() => amazonLogin.connect())
          : await amazonLogin.connect();

      const now = new Date().toISOString();
      const accountLabel = profile.email ?? profile.name ?? "Amazon account";

      const next = await accountService.updateProviderConnection({
        ...existing,
        providerId,
        state: "oauth-connected",
        verificationMethod: "oauth",
        connectedAt: existing?.connectedAt ?? now,
        lastVerifiedAt: now,
        accountLabel
      });

      setUser(next);
      setStatus(
        `Amazon identity verified as ${accountLabel}. Prime Video still performs the actual subscription/entitlement check when the title opens.`
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Amazon OAuth verification failed."
      );
    }
  }

  async function updateIncludeOtherServices(value: boolean) {
    if (!user) return;

    const next = await accountService.updatePreferences({
      includeOtherStreamingServices: value
    });

    setUser(next);
    setStatus(
      value
        ? "Unified search now includes supported services outside My Services."
        : "Unified search now only shows titles available on My Services."
    );
  }

  async function openCatalogItem(item: CatalogItem) {
    setSelectedItem(item);

    if (
      item.externalSource !== "tmdb" ||
      !item.externalId ||
      !isWatchmodeConfigured()
    ) {
      return;
    }

    setProviderLinksLoading(true);

    try {
      const links = await resolveDirectProviderLinks(
        item,
        import.meta.env.VITE_STREAMING_REGION || "US"
      );

      setSelectedItem((current) =>
        current?.id === item.id
          ? {
              ...current,
              providerLinks: links
            }
          : current
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not resolve exact provider title links."
      );
    } finally {
      setProviderLinksLoading(false);
    }
  }

  async function deactivateProvider(providerId: ProviderId) {
    if (!user) return;

    if (providerId === "prime-video") {
      void amazonLogin.logout().catch(() => undefined);
    }

    const existing = user.providerConnections.find(
      (item) => item.providerId === providerId
    );

    const next = await accountService.updateProviderConnection({
      ...existing,
      providerId,
      state: "not-connected"
    });

    setUser(next);

    const providerName = providerPluginRegistry.get(providerId).displayName;
    setStatus(
      `${providerName} was removed from My Services. The provider's own browser session is unchanged.`
    );
  }

  function copyProviderQueryIfNeeded(providerId: ProviderId, query: string) {
    if (!query.trim()) return;
    if (providerId !== "disney-plus" && providerId !== "max") return;

    void navigator.clipboard?.writeText(query.trim()).catch(() => undefined);
  }

  function openAllConnectedSearches(query: string) {
    const trimmed = query.trim();

    if (!trimmed) {
      setStatus("Enter a movie or show before searching your connected services.");
      return;
    }

    if (enabledProviderPlugins.length === 0) {
      setStatus("Add at least one streaming service to My Services first.");
      setSection("account");
      return;
    }

    for (const plugin of enabledProviderPlugins) {
      copyProviderQueryIfNeeded(plugin.provider!.id, trimmed);
      plugin.openSearch(trimmed);
    }

    setStatus(
      `Opened ${enabledProviderPlugins.length} service search${enabledProviderPlugins.length === 1 ? "" : "es"} for “${trimmed}”. Your browser may ask to allow multiple tabs.`
    );
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
              activeProviderIds={enabledProviderIds}
              onOpen={openCatalogItem}
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
              <button className="button light" onClick={() => void openCatalogItem(featured)}>
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

        <section className="connected-search-panel">
          <div className="connected-search-heading">
            <div>
              <span className="kicker">UNIFIED STREAMING SEARCH</span>
              <h2>
                {searchQuery.trim().length < 2
                  ? "Search once. See where it streams."
                  : streamingSearchLoading
                    ? `Searching “${searchQuery.trim()}”…`
                    : `${visibleStreamingResults.length} streaming result${visibleStreamingResults.length === 1 ? "" : "s"}`}
              </h2>
            </div>
            <button className="text-button" onClick={() => setSection("account")}>
              Manage services
            </button>
          </div>

          {!streamingSearchConfigured ? (
            <div className="catalog-config-note">
              <strong>Unified catalog search needs a TMDB API token.</strong>
              <span>
                Add VITE_TMDB_READ_ACCESS_TOKEN to .env.local. Provider availability is
                supplied by JustWatch through TMDB.
              </span>
            </div>
          ) : streamingSearchError ? (
            <div className="catalog-config-note error-note">
              <strong>Couldn’t search the streaming catalog.</strong>
              <span>{streamingSearchError}</span>
            </div>
          ) : searchQuery.trim().length >= 2 && !streamingSearchLoading ? (
            !user ? (
              <div className="catalog-config-note">
                <strong>Sign in to personalize streaming search.</strong>
                <span>
                  Search defaults to My Services. Sign in, add your services, or enable
                  “Show titles from other services” in Account.
                </span>
              </div>
            ) : enabledProviderIds.length === 0 && !includeOtherServices ? (
              <div className="catalog-config-note">
                <strong>Add at least one service to My Services.</strong>
                <span>
                  Or enable “Show titles from other services” in Account to search the
                  full supported catalog.
                </span>
              </div>
            ) : visibleStreamingResults.length > 0 ? (
              <>
                <div className="media-grid streaming-results-grid">
                  {visibleStreamingResults.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      profileCount={profileCount(item)}
                      activeProviderIds={enabledProviderIds}
                      onOpen={openCatalogItem}
                    />
                  ))}
                </div>
                <p className="availability-attribution">
                  Availability powered by JustWatch via TMDB. Exact title links are resolved
                  through Watchmode when configured. Availability can vary by region and plan.
                </p>
              </>
            ) : (
              <div className="catalog-config-note">
                <strong>No matching title is available on the services you selected.</strong>
                <span>
                  Try another title or enable “Show titles from other services” in Account.
                </span>
              </div>
            )
          ) : (
            <div className="catalog-config-note">
              <strong>Netflix · Disney+ · HBO Max · Prime Video</strong>
              <span>Type at least two characters to search movies and shows across services.</span>
            </div>
          )}

          {enabledProviderPlugins.length > 0 && searchQuery.trim() && (
            <button
              className="button secondary connected-search-all"
              onClick={() => openAllConnectedSearches(searchQuery)}
            >
              Also open this search on all My Services ↗
            </button>
          )}
        </section>

        <div className="shelf-heading">
          <h2>3Dstreaming Library</h2>
          <span>{filteredCatalog.length} results</span>
        </div>
        <div className="media-grid">
          {filteredCatalog.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              profileCount={profileCount(item)}
              activeProviderIds={enabledProviderIds}
              onOpen={openCatalogItem}
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
              onOpen={openCatalogItem}
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
            amazonOAuthConfigured={amazonLogin.isConfigured()}
            onProviderConnect={connectProvider}
            onProviderVerify={verifyProvider}
            onProviderDeactivate={deactivateProvider}
            onIncludeOtherServicesChange={updateIncludeOtherServices}
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
            style={
              selectedItem.backdropUrl
                ? {
                    backgroundImage: `url("${selectedItem.backdropUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }
                : undefined
            }
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

              {(selectedItem.availableProviderIds?.length ?? 0) > 0 && (
                <div className="detail-provider-links">
                  <span>Stream on</span>
                  {providerLinksLoading && (
                    <small className="provider-link-loading">
                      Resolving exact title links…
                    </small>
                  )}
                  <div>
                    {providerPlugins
                      .filter((plugin) =>
                        selectedItem.availableProviderIds?.includes(plugin.provider!.id)
                      )
                      .map((plugin) => {
                        const providerId = plugin.provider!.id;
                        const enabled = enabledProviderIds.includes(providerId);
                        const directUrl = selectedItem.providerLinks?.[providerId];

                        if (!directUrl) {
                          return (
                            <button
                              key={plugin.id}
                              className="button compact secondary"
                              disabled
                              title={
                                isWatchmodeConfigured()
                                  ? "Watchmode did not return a direct web link for this provider/title."
                                  : "Configure VITE_WATCHMODE_API_KEY to resolve exact title links."
                              }
                            >
                              {plugin.provider!.shortName} {plugin.displayName}
                              {enabled ? " · My Service" : ""} · no direct link
                            </button>
                          );
                        }

                        return (
                          <a
                            key={plugin.id}
                            href={directUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`button compact ${enabled ? "primary" : "secondary"}`}
                          >
                            ▶ {plugin.provider!.name}
                            {enabled ? " · My Service" : ""} ↗
                          </a>
                        );
                      })}
                  </div>
                  {!isWatchmodeConfigured() && (
                    <small className="provider-link-note">
                      Add VITE_WATCHMODE_API_KEY to enable exact provider title links.
                    </small>
                  )}
                  {selectedItem.availabilitySourceUrl && (
                    <a
                      className="availability-source-link"
                      href={selectedItem.availabilitySourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Check full availability ↗
                    </a>
                  )}
                </div>
              )}

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
