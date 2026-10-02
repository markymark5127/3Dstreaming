import type { ThreeDProfile } from "../types/threeDProfile";

export type MapperEngineId = "browser-fast-v1" | "depth-anything-v2-small";

export interface MapperConfig {
  width: number;
  height: number;
  fps: number;
  temporalSmoothing: number;
  engine: MapperEngineId;
}

export interface MapperProgress {
  phase: "loading" | "loading-model" | "mapping" | "finalizing" | "done";
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
  readonly id: MapperEngineId;
  readonly name: string;
  prepare?(): Promise<void>;
  estimate(
    source: ImageData,
    previousDepth?: Uint8ClampedArray
  ): Promise<Uint8ClampedArray>;
}
