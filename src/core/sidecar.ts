import type { ThreeDProfile } from "../types/threeDProfile";

export function parseThreeDProfile(value: unknown): ThreeDProfile {
  if (!value || typeof value !== "object") {
    throw new Error("3D profile must be a JSON object.");
  }

  const profile = value as Partial<ThreeDProfile>;

  if (profile.schemaVersion !== 1) {
    throw new Error("Unsupported 3D profile schema version.");
  }

  if (!profile.id || !profile.title || !profile.editionId) {
    throw new Error("3D profile is missing id, title, or editionId.");
  }

  if (!profile.fingerprint || typeof profile.fingerprint.durationSeconds !== "number") {
    throw new Error("3D profile requires fingerprint.durationSeconds.");
  }

  if (!Array.isArray(profile.tracks)) {
    throw new Error("3D profile requires a tracks array.");
  }

  for (const track of profile.tracks) {
    if (!track?.kind || !track?.url) {
      throw new Error("Every 3D sidecar track requires kind and url.");
    }
  }

  return profile as ThreeDProfile;
}

export async function loadThreeDProfile(file: File): Promise<ThreeDProfile> {
  const json = JSON.parse(await file.text()) as unknown;
  return parseThreeDProfile(json);
}
