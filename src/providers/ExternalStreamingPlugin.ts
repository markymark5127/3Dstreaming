import type { StreamingProvider } from "./types";
import type {
  PluginConnectionResult,
  PluginExternalAction,
  PluginPlaybackRequest,
  PluginPlaybackState,
  PluginResult,
  PluginSearchResult,
  StreamingProviderPlugin
} from "./pluginTypes";

interface ExternalPluginOptions {
  provider: StreamingProvider;
  authUrl: string;
  browseUrl: string;
  searchUrl?: (query: string) => string;
}

function open(action: PluginExternalAction): void {
  window.open(action.url, action.target ?? "_blank", "noopener,noreferrer");
}

export class ExternalStreamingPlugin implements StreamingProviderPlugin {
  readonly id;
  readonly displayName;
  readonly provider;

  constructor(private readonly options: ExternalPluginOptions) {
    this.provider = options.provider;
    this.id = options.provider.id;
    this.displayName = options.provider.name;
  }

  async connect(): Promise<PluginResult<PluginConnectionResult>> {
    const action: PluginExternalAction = {
      label: `Sign in to ${this.displayName}`,
      url: this.options.authUrl
    };

    open(action);

    return {
      ok: true,
      value: {
        state: "external-auth-opened",
        message:
          `${this.displayName} sign-in opened. Return to 3Dstreaming and confirm the session after you finish signing in.`
      }
    };
  }

  async disconnect(): Promise<PluginResult<void>> {
    return {
      ok: false,
      code: "external-action-required",
      message:
        `${this.displayName} owns the actual browser session. 3Dstreaming can mark the connection inactive, but signing out must happen on ${this.displayName}.`,
      action: { label: `Open ${this.displayName}`, url: this.options.browseUrl }
    };
  }

  async search(query: string): Promise<PluginResult<PluginSearchResult[]>> {
    return {
      ok: false,
      code: "external-action-required",
      message:
        `${this.displayName} search stays provider-owned. Open the provider search experience for this query.`,
      action: this.getSearchAction(query)
    };
  }

  getSearchAction(query: string): PluginExternalAction {
    const trimmed = query.trim();
    const url = this.options.searchUrl
      ? this.options.searchUrl(trimmed)
      : this.options.browseUrl;

    return {
      label: trimmed ? `Search ${this.displayName} for “${trimmed}”` : `Browse ${this.displayName}`,
      url
    };
  }

  openSearch(query: string): PluginResult<PluginExternalAction> {
    const action = this.getSearchAction(query);
    open(action);
    return { ok: true, value: action };
  }

  async startPlayback(request: PluginPlaybackRequest): Promise<PluginResult<PluginPlaybackState>> {
    const url = request.watchUrl ?? this.options.browseUrl;
    open({ label: `Open in ${this.displayName}`, url });

    return {
      ok: false,
      code: "external-action-required",
      message:
        `${this.displayName} playback remains in the provider-owned protected player. ` +
        "A future approved timeline bridge can synchronize the 3D sidecar without changing this plugin contract.",
      action: { label: `Open in ${this.displayName}`, url }
    };
  }

  async getPlaybackState(): Promise<PluginResult<PluginPlaybackState>> {
    return this.timelineUnavailable();
  }

  async play(): Promise<PluginResult<PluginPlaybackState>> {
    return this.timelineUnavailable();
  }

  async pause(): Promise<PluginResult<PluginPlaybackState>> {
    return this.timelineUnavailable();
  }

  async seek(_seconds: number): Promise<PluginResult<PluginPlaybackState>> {
    return this.timelineUnavailable();
  }

  private timelineUnavailable(): PluginResult<PluginPlaybackState> {
    return {
      ok: false,
      code: "unsupported",
      message:
        `${this.displayName} does not currently expose an approved browser timeline bridge to 3Dstreaming.`
    };
  }
}
