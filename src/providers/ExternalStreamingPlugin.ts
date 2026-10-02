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
          `${this.displayName} authentication opened on the provider's own site. ` +
          "3Dstreaming does not receive the provider password or a playback token."
      }
    };
  }

  async disconnect(): Promise<PluginResult<void>> {
    return {
      ok: false,
      code: "external-action-required",
      message:
        `${this.displayName} owns this browser session. Sign out on ${this.displayName} to end it.`,
      action: { label: `Open ${this.displayName}`, url: this.options.browseUrl }
    };
  }

  async search(query: string): Promise<PluginResult<PluginSearchResult[]>> {
    return {
      ok: false,
      code: "external-action-required",
      message:
        `${this.displayName} does not expose a public consumer catalog API to this plugin. ` +
        "Continue the search in the provider-owned experience.",
      action: this.searchAction(query)
    };
  }

  openSearch(query: string): PluginResult<PluginExternalAction> {
    const action = this.searchAction(query);
    open(action);
    return { ok: true, value: action };
  }

  private searchAction(query: string): PluginExternalAction {
    const url = this.options.searchUrl
      ? this.options.searchUrl(query)
      : this.options.browseUrl;

    return {
      label: query.trim() ? `Search ${this.displayName}` : `Browse ${this.displayName}`,
      url
    };
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
