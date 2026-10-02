import type { ThreeDProfile } from "../types/threeDProfile";

export interface MapperConfig {
  width: number;
  height: number;
  fps: number;
  temporalSmoothing: number;
}

export interface MapperProgress {
  phase: "loading" | "mapping" | "finalizing" | "done";
  mediaTime: number;
  duration: number;
  progress: number;
  processedFrames: number;
}

export interface MapperResult {
  depthBlob: Blob;
  depthFileName: string;
  profileFileName: string;
  exportProfile: ThreeDProfile;
  runtimeProfile: ThreeDProfile;
  sourceDuration: number;
  sourceAspectRatio: number;
}

export interface DepthEstimator {
  readonly id: string;
  readonly name: string;
  estimate(
    source: ImageData,
    previousDepth?: Uint8ClampedArray
  ): Uint8ClampedArray;
}
