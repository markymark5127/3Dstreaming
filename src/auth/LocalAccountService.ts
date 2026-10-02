import type {
  AccountService,
  ProviderConnection,
  UserAccount
} from "./types";

const STORAGE_KEY = "3dstreaming.prototype.account";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "3D";
}

export class LocalAccountService implements AccountService {
  async getCurrentUser(): Promise<UserAccount | null> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as UserAccount;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  async signIn(email: string, displayName: string): Promise<UserAccount> {
    const user: UserAccount = {
      id: crypto.randomUUID(),
      email: email.trim(),
      displayName: displayName.trim() || email.split("@")[0] || "Creator",
      avatarInitials: initials(displayName || email),
      providerConnections: [],
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }

  async updateProviderConnection(connection: ProviderConnection): Promise<UserAccount> {
    const current = await this.getCurrentUser();
    if (!current) throw new Error("Sign in to 3Dstreaming first.");

    const next: UserAccount = {
      ...current,
      providerConnections: [
        ...current.providerConnections.filter(
          (item) => item.providerId !== connection.providerId
        ),
        connection
      ]
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }
}
