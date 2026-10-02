import type { CatalogItem } from "../catalog/types";
import type { ProviderId, StreamingProvider } from "./types";

export type StreamingPluginId = ProviderId | "local";

export type PluginErrorCode =
  | "unsupported"
  | "not-connected"
  | "external-action-required"
  | "media-not-bound"
  | "invalid-request";

export type PluginResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: PluginErrorCode;
      message: string;
      action?: PluginExternalAction;
    };

export interface PluginExternalAction {
  label: string;
  url: string;
  target?: "_blank" | "_self";
}

export interface PluginConnectionResult {
  state: "connected" | "external-auth-opened" | "not-supported";
  accountLabel?: string;
  message: string;
}

export interface PluginSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  year?: number;
  providerId: StreamingPluginId;
  watchUrl?: string;
  catalogItem?: CatalogItem;
}

export interface PluginPlaybackRequest {
  contentId?: string;
  title?: string;
  watchUrl?: string;
}

export interface PluginPlaybackState {
  status: "idle" | "playing" | "paused" | "ended";
  currentTime: number;
  duration?: number;
  contentId?: string;
}

export interface StreamingProviderPlugin {
  readonly id: StreamingPluginId;
  readonly provider?: StreamingProvider;
  readonly displayName: string;

  connect(): Promise<PluginResult<PluginConnectionResult>>;
  disconnect(): Promise<PluginResult<void>>;

  search(query: string): Promise<PluginResult<PluginSearchResult[]>>;
  getSearchAction(query: string): PluginExternalAction;
  openSearch(query: string): PluginResult<PluginExternalAction>;

  startPlayback(request: PluginPlaybackRequest): Promise<PluginResult<PluginPlaybackState>>;
  getPlaybackState(): Promise<PluginResult<PluginPlaybackState>>;
  play(): Promise<PluginResult<PluginPlaybackState>>;
  pause(): Promise<PluginResult<PluginPlaybackState>>;
  seek(seconds: number): Promise<PluginResult<PluginPlaybackState>>;

  bindMediaElement?(element: HTMLMediaElement | null): void;
}
