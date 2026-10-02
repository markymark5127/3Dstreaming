import * as THREE from "three";
import { PlaybackClock } from "../core/PlaybackClock";
import type { SidecarTrack, ThreeDProfile } from "../types/threeDProfile";

export type SidecarRenderMode = "depth" | "disparity";

export interface SidecarRuntimeState {
  mode: "video-depth" | "video-disparity" | "procedural-depth";
  mediaTime: number;
  sidecarTime: number;
  drift: number;
  resyncs: number;
}

export interface SidecarRuntime {
  readonly mode: SidecarRenderMode;
  readonly depthTexture: THREE.Texture;
  readonly leftDisparityTexture: THREE.Texture;
  readonly rightDisparityTexture: THREE.Texture;
  readonly state: SidecarRuntimeState;
  update(mediaTime: number, playing: boolean): void;
  dispose(): void;
}

function makeNeutralTexture(value: number): THREE.DataTexture {
  const byte = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
  const texture = new THREE.DataTexture(
    new Uint8Array([byte, byte, byte, 255]),
    1,
    1,
    THREE.RGBAFormat
  );
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

class ProceduralDepthRuntime implements SidecarRuntime {
  readonly mode = "depth" as const;
  readonly depthTexture: THREE.DataTexture;
  readonly leftDisparityTexture = makeNeutralTexture(0.5);
  readonly rightDisparityTexture = makeNeutralTexture(0.5);
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
          THREE.MathUtils.clamp(center * 0.72 + vertical * 0.28, 0, 1) * 255
        );

        const i = (y * width + x) * 4;
        data[i] = depth;
        data[i + 1] = depth;
        data[i + 2] = depth;
        data[i + 3] = 255;
      }
    }

    this.depthTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    this.depthTexture.needsUpdate = true;
    this.depthTexture.minFilter = THREE.LinearFilter;
    this.depthTexture.magFilter = THREE.LinearFilter;
    this.depthTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.depthTexture.wrapT = THREE.ClampToEdgeWrapping;
  }

  update(mediaTime: number): void {
    this.state.mediaTime = mediaTime;
    this.state.sidecarTime = mediaTime;
    this.state.drift = 0;
  }

  dispose(): void {
    this.depthTexture.dispose();
    this.leftDisparityTexture.dispose();
    this.rightDisparityTexture.dispose();
  }
}

class SyncedVideoTrack {
  readonly video: HTMLVideoElement;
  readonly texture: THREE.VideoTexture;
  readonly clock: PlaybackClock;
  resyncs = 0;

  constructor(track: SidecarTrack) {
    this.video = document.createElement("video");
    this.video.src = track.url;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.crossOrigin = "anonymous";

    this.texture = new THREE.VideoTexture(this.video);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;

    this.clock = new PlaybackClock(track.timeOffsetSeconds ?? 0);
  }

  update(mediaTime: number, playing: boolean): number {
    const sidecarTime = Number.isFinite(this.video.currentTime)
      ? this.video.currentTime
      : 0;

    if (this.clock.shouldResync(mediaTime, sidecarTime)) {
      const target = this.clock.targetSidecarTime(mediaTime);
      try {
        this.video.currentTime = target;
        this.resyncs += 1;
      } catch {
        // Not seekable until metadata arrives. The next update retries.
      }
    }

    if (playing && this.video.paused) {
      void this.video.play().catch(() => undefined);
    } else if (!playing && !this.video.paused) {
      this.video.pause();
    }

    return sidecarTime;
  }

  dispose(): void {
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.texture.dispose();
  }
}

class VideoDepthRuntime implements SidecarRuntime {
  readonly mode = "depth" as const;
  readonly leftDisparityTexture = makeNeutralTexture(0.5);
  readonly rightDisparityTexture = makeNeutralTexture(0.5);
  readonly depthTexture: THREE.Texture;
  readonly state: SidecarRuntimeState = {
    mode: "video-depth",
    mediaTime: 0,
    sidecarTime: 0,
    drift: 0,
    resyncs: 0
  };

  private readonly track: SyncedVideoTrack;

  constructor(track: SidecarTrack) {
    this.track = new SyncedVideoTrack(track);
    this.depthTexture = this.track.texture;
  }

  update(mediaTime: number, playing: boolean): void {
    const sidecarTime = this.track.update(mediaTime, playing);
    const snapshot = this.track.clock.snapshot(mediaTime, sidecarTime);

    this.state.mediaTime = mediaTime;
    this.state.sidecarTime = sidecarTime;
    this.state.drift = snapshot.drift;
    this.state.resyncs = this.track.resyncs;
  }

  dispose(): void {
    this.track.dispose();
    this.leftDisparityTexture.dispose();
    this.rightDisparityTexture.dispose();
  }
}

class VideoDisparityRuntime implements SidecarRuntime {
  readonly mode = "disparity" as const;
  readonly depthTexture = makeNeutralTexture(0.5);
  readonly leftDisparityTexture: THREE.Texture;
  readonly rightDisparityTexture: THREE.Texture;
  readonly state: SidecarRuntimeState = {
    mode: "video-disparity",
    mediaTime: 0,
    sidecarTime: 0,
    drift: 0,
    resyncs: 0
  };

  private readonly left: SyncedVideoTrack;
  private readonly right: SyncedVideoTrack;

  constructor(left: SidecarTrack, right: SidecarTrack) {
    this.left = new SyncedVideoTrack(left);
    this.right = new SyncedVideoTrack(right);
    this.leftDisparityTexture = this.left.texture;
    this.rightDisparityTexture = this.right.texture;
  }

  update(mediaTime: number, playing: boolean): void {
    const leftTime = this.left.update(mediaTime, playing);
    const rightTime = this.right.update(mediaTime, playing);
    const sidecarTime = (leftTime + rightTime) * 0.5;
    const leftDrift = this.left.clock.snapshot(mediaTime, leftTime).drift;
    const rightDrift = this.right.clock.snapshot(mediaTime, rightTime).drift;

    this.state.mediaTime = mediaTime;
    this.state.sidecarTime = sidecarTime;
    this.state.drift = Math.max(Math.abs(leftDrift), Math.abs(rightDrift));
    this.state.resyncs = this.left.resyncs + this.right.resyncs;
  }

  dispose(): void {
    this.left.dispose();
    this.right.dispose();
    this.depthTexture.dispose();
  }
}

export function createSidecarRuntime(profile?: ThreeDProfile | null): SidecarRuntime {
  const depth = profile?.tracks.find((item) => item.kind === "depth");
  const left = profile?.tracks.find((item) => item.kind === "disparity-left");
  const right = profile?.tracks.find((item) => item.kind === "disparity-right");

  if (left?.url && right?.url && !left.url.startsWith("procedural:") && !right.url.startsWith("procedural:")) {
    return new VideoDisparityRuntime(left, right);
  }

  if (depth?.url && !depth.url.startsWith("procedural:")) {
    return new VideoDepthRuntime(depth);
  }

  return new ProceduralDepthRuntime(depth?.width ?? 320, depth?.height ?? 180);
}
