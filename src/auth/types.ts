import type { ProviderId } from "../providers/types";

export type ProviderConnectionState =
  | "not-connected"
  | "provider-session"
  | "oauth-connected"
  | "needs-verification";

export interface ProviderConnection {
  providerId: ProviderId;
  state: ProviderConnectionState;
  connectedAt?: string;
  lastVerifiedAt?: string;
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
