export type MediaSourceKind = "local-file" | "network" | "streaming";

export interface MediaSource {
  id: string;
  label: string;
  kind: MediaSourceKind;
  url: string;
  mimeType?: string;
  durationSeconds?: number;
}

export interface MediaAdapter<TInput = unknown> {
  readonly id: string;
  readonly label: string;
  canOpen(input: TInput): boolean;
  open(input: TInput): Promise<MediaSource>;
  dispose?(): void;
}
