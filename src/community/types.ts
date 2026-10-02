import type { ThreeDProfile } from "../types/threeDProfile";

export type CommunityProfileStatus = "draft" | "pending" | "published" | "flagged";

export interface CommunityAuthor {
  id: string;
  displayName: string;
}

export interface CommunityProfile {
  id: string;
  title: string;
  year?: number;
  editionLabel: string;
  providerHints: string[];
  author: CommunityAuthor;
  status: CommunityProfileStatus;
  ratingAverage: number;
  ratingCount: number;
  downloads: number;
  tags: string[];
  updatedAt: string;
  profile: ThreeDProfile;
}

export interface CommunityProfileQuery {
  q?: string;
  provider?: string;
  limit?: number;
}

export interface CommunityRegistry {
  search(query?: CommunityProfileQuery): Promise<CommunityProfile[]>;
  get(id: string): Promise<CommunityProfile | null>;
  publish(profile: CommunityProfile): Promise<CommunityProfile>;
}
