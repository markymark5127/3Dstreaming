import { searchCatalog } from "../catalog/catalog";
import type {
  PluginConnectionResult,
  PluginExternalAction,
  PluginPlaybackRequest,
  PluginPlaybackState,
  PluginResult,
  PluginSearchResult,
  StreamingProviderPlugin
} from "./pluginTypes";

function stateFor(media: HTMLMediaElement, contentId?: string): PluginPlaybackState {
  return {
    status: media.ended ? "ended" : media.paused ? "paused" : "playing",
    currentTime: media.currentTime || 0,
    duration: Number.isFinite(media.duration) ? media.duration : undefined,
    contentId
  };
}

export class LocalMediaPlugin implements StreamingProviderPlugin {
  readonly id = "local" as const;
  readonly displayName = "Local Library";
  private media: HTMLMediaElement | null = null;
  private contentId?: string;

  bindMediaElement(element: HTMLMediaElement | null): void {
    this.media = element;
  }

  async connect(): Promise<PluginResult<PluginConnectionResult>> {
    return {
      ok: true,
      value: {
        state: "connected",
        accountLabel: "This device",
        message: "Local files are available without an external account."
      }
    };
  }

  async disconnect(): Promise<PluginResult<void>> {
    this.media = null;
    this.contentId = undefined;
    return { ok: true, value: undefined };
  }

  async search(query: string): Promise<PluginResult<PluginSearchResult[]>> {
    return {
      ok: true,
      value: searchCatalog(query).map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        year: item.year,
        providerId: "local",
        catalogItem: item
      }))
    };
  }

  getSearchAction(_query: string): PluginExternalAction {
    return {
      label: "Search Local Library",
      url: window.location.href
    };
  }

  openSearch(_query: string): PluginResult<PluginExternalAction> {
    return {
      ok: false,
      code: "unsupported",
      message: "Local Library search happens inside 3Dstreaming."
    };
  }

  async startPlayback(request: PluginPlaybackRequest): Promise<PluginResult<PluginPlaybackState>> {
    this.contentId = request.contentId;

    if (!this.media) return this.missingMedia();

    await this.media.play();
    return { ok: true, value: stateFor(this.media, this.contentId) };
  }

  async getPlaybackState(): Promise<PluginResult<PluginPlaybackState>> {
    return this.withMedia((media) => stateFor(media, this.contentId));
  }

  async play(): Promise<PluginResult<PluginPlaybackState>> {
    if (!this.media) return this.missingMedia();
    await this.media.play();
    return { ok: true, value: stateFor(this.media, this.contentId) };
  }

  async pause(): Promise<PluginResult<PluginPlaybackState>> {
    return this.withMedia((media) => {
      media.pause();
      return stateFor(media, this.contentId);
    });
  }

  async seek(seconds: number): Promise<PluginResult<PluginPlaybackState>> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return {
        ok: false,
        code: "invalid-request",
        message: "Seek time must be a non-negative number."
      };
    }

    return this.withMedia((media) => {
      media.currentTime = Math.min(
        seconds,
        Number.isFinite(media.duration) ? media.duration : seconds
      );
      return stateFor(media, this.contentId);
    });
  }

  private withMedia(
    fn: (media: HTMLMediaElement) => PluginPlaybackState
  ): PluginResult<PluginPlaybackState> {
    if (!this.media) return this.missingMedia();
    return { ok: true, value: fn(this.media) };
  }

  private missingMedia(): PluginResult<PluginPlaybackState> {
    return {
      ok: false,
      code: "media-not-bound",
      message: "No local media element is bound to the plugin."
    };
  }
}

export const localMediaPlugin = new LocalMediaPlugin();
