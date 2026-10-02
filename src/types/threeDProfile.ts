export type TrackKind = "depth" | "disparity-left" | "disparity-right" | "convergence";

export interface FingerprintSample {
  atSeconds: number;
  sha256: string;
}

export interface MediaFingerprint {
  durationSeconds: number;
  fps?: number;
  aspectRatio?: number;
  samples?: FingerprintSample[];
}

export interface SidecarTrack {
  kind: TrackKind;
  url: string;
  codec?: string;
  fps?: number;
  width?: number;
  height?: number;
  timeOffsetSeconds?: number;
}

export interface ThreeDProfile {
  schemaVersion: 1;
  id: string;
  title: string;
  editionId: string;
  sourceHints?: string[];
  fingerprint: MediaFingerprint;
  tracks: SidecarTrack[];
  defaults?: {
    depthStrength?: number;
    convergence?: number;
    popOutLimit?: number;
  };
  notes?: string;
}
