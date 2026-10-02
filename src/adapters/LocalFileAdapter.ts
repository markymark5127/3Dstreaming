import type { MediaAdapter, MediaSource } from "./MediaAdapter";

export class LocalFileAdapter implements MediaAdapter<File> {
  readonly id = "local-file";
  readonly label = "Local file";
  private activeUrl?: string;

  canOpen(input: File): boolean {
    return input instanceof File && (input.type.startsWith("video/") || input.type === "");
  }

  async open(file: File): Promise<MediaSource> {
    if (!this.canOpen(file)) {
      throw new Error("Please choose a video file.");
    }

    this.dispose();
    this.activeUrl = URL.createObjectURL(file);

    return {
      id: `local:${file.name}:${file.size}:${file.lastModified}`,
      label: file.name,
      kind: "local-file",
      url: this.activeUrl,
      mimeType: file.type || undefined
    };
  }

  dispose(): void {
    if (this.activeUrl) {
      URL.revokeObjectURL(this.activeUrl);
      this.activeUrl = undefined;
    }
  }
}
