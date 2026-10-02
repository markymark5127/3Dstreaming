import * as THREE from "three";
import { PlaybackClock } from "../core/PlaybackClock";
import type { SidecarTrack, ThreeDProfile } from "../types/threeDProfile";

export interface SidecarRuntimeState {
  mode: "video-depth" | "procedural-depth";
  mediaTime: number;
  sidecarTime: number;
  drift: number;
  resyncs: number;
}

export interface SidecarRuntime {
  readonly texture: THREE.Texture;
  readonly state: SidecarRuntimeState;
  update(mediaTime: number, playing: boolean): void;
  dispose(): void;
}

class ProceduralDepthRuntime implements SidecarRuntime {
  readonly texture: THREE.DataTexture;
  readonly state: SidecarRuntimeState = {
    mode: "procedural-depth",
    mediaTime: 0,
    sidecarTime: 0,
    drift: 0,
    resyncs: 0
  };

  constructor(width = 320, height = 180) {
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = (x / Math.max(1, width - 1)) * 2 - 1;
        const ny = (y / Math.max(1, height - 1)) * 2 - 1;
        const center = Math.max(0, 1 - Math.sqrt(nx * nx + ny * ny));
        const vertical = 1 - y / Math.max(1, height - 1);
        const depth = Math.round(
          THREE.MathUtils.clamp(center * 0.7 + vertical * 0.3, 0, 1) * 255
        );
        const i = (y * width + x) * 4;
        data[i] = depth;
        data[i + 1] = depth;
        data[i + 2] = depth;
        data[i + 3] = 255;
      }
    }

    this.texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    this.texture.needsUpdate = true;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
  }

  update(mediaTime: number): void {
    this.state.mediaTime = mediaTime;
    this.state.sidecarTime = mediaTime;
    this.state.drift = 0;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

class VideoDepthRuntime implements SidecarRuntime {
  readonly texture: THREE.VideoTexture;
  readonly state: SidecarRuntimeState = {
    mode: "video-depth",
    mediaTime: 0,
    sidecarTime: 0,
    drift: 0,
    resyncs: 0
  };

  private readonly video: HTMLVideoElement;
  private readonly clock: PlaybackClock;
  private disposed = false;

  constructor(track: SidecarTrack) {
    this.video = document.createElement("video");
    this.video.src = track.url;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.crossOrigin = "anonymous";
    this.video.loop = false;

    this.texture = new THREE.VideoTexture(this.video);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;

    this.clock = new PlaybackClock(track.timeOffsetSeconds ?? 0);
  }

  update(mediaTime: number, playing: boolean): void {
    if (this.disposed) return;

    const sidecarTime = Number.isFinite(this.video.currentTime)
      ? this.video.currentTime
      : 0;

    const snapshot = this.clock.snapshot(mediaTime, sidecarTime);

    this.state.mediaTime = mediaTime;
    this.state.sidecarTime = sidecarTime;
    this.state.drift = snapshot.drift;

    if (this.clock.shouldResync(mediaTime, sidecarTime)) {
      const target = this.clock.targetSidecarTime(mediaTime);
      if (Number.isFinite(target)) {
        try {
          this.video.currentTime = target;
          this.state.resyncs += 1;
        } catch {
          // The media element may not be seekable until metadata arrives.
        }
      }
    }

    if (playing && this.video.paused) {
      void this.video.play().catch(() => undefined);
    } else if (!playing && !this.video.paused) {
      this.video.pause();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.texture.dispose();
  }
}

export function createSidecarRuntime(profile?: ThreeDProfile | null): SidecarRuntime {
  const track = profile?.tracks.find((item) => item.kind === "depth");

  if (track?.url) {
    return new VideoDepthRuntime(track);
  }

  return new ProceduralDepthRuntime();
}
