import type { ProviderId } from "../providers/types";

export type ProviderConnectionState =
  | "not-connected"
  | "service-enabled"
  | "provider-session"
  | "session-active"
  | "oauth-connected"
  | "bridge-verified"
  | "needs-verification";

export type ProviderVerificationMethod =
  | "none"
  | "provider-owned"
  | "oauth"
  | "bridge";

export interface ProviderConnection {
  providerId: ProviderId;
  state: ProviderConnectionState;
  verificationMethod?: ProviderVerificationMethod;
  connectedAt?: string;
  lastVerifiedAt?: string;
  sessionConfirmedAt?: string;
  accountLabel?: string;
  tokenReference?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  avatarInitials: string;
  providerConnections: ProviderConnection[];
  createdAt: string;
}

export interface AccountService {
  getCurrentUser(): Promise<UserAccount | null>;
  signIn(email: string, displayName: string): Promise<UserAccount>;
  signOut(): Promise<void>;
  updateProviderConnection(connection: ProviderConnection): Promise<UserAccount>;
}
