export interface AmazonIdentityProfile {
  customerId?: string;
  name?: string;
  email?: string;
}

interface AmazonAuthResponse {
  code?: string;
  error?: string;
  error_description?: string;
}

interface AmazonTokenResponse {
  success?: boolean;
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface AmazonProfileResponse {
  success?: boolean;
  error?: string;
  profile?: {
    CustomerId?: string;
    Name?: string;
    PrimaryEmail?: string;
  };
}

interface AmazonLoginApi {
  setClientId(clientId: string): void;
  authorize(
    options: {
      scope: string;
      pkce: boolean;
      interactive?: "auto" | "always" | "never";
    },
    callback: (response: AmazonAuthResponse) => void
  ): void;
  retrieveToken(): AmazonTokenResponse | null;
  retrieveToken(
    code: string,
    callback: (response: AmazonTokenResponse) => void
  ): void;
  retrieveProfile(
    accessToken: string,
    callback: (response: AmazonProfileResponse) => void
  ): void;
  logout(): void;
}

declare global {
  interface Window {
    amazon?: {
      Login: AmazonLoginApi;
    };
    onAmazonLoginReady?: () => void;
  }
}

const SDK_ID = "amazon-login-sdk";
const SDK_URL = "https://assets.loginwithamazon.com/sdk/na/login1.js";

function clientId(): string {
  return (import.meta.env.VITE_AMAZON_LWA_CLIENT_ID ?? "").trim();
}

function profileFrom(response: AmazonProfileResponse): AmazonIdentityProfile {
  if (!response.success || !response.profile) {
    throw new Error(response.error || "Amazon profile verification failed.");
  }

  return {
    customerId: response.profile.CustomerId,
    name: response.profile.Name,
    email: response.profile.PrimaryEmail
  };
}

export class AmazonLoginWithAmazon {
  private sdkPromise: Promise<AmazonLoginApi> | null = null;

  isConfigured(): boolean {
    return Boolean(clientId());
  }

  async connect(): Promise<AmazonIdentityProfile> {
    const login = await this.loadSdk();

    const auth = await new Promise<AmazonAuthResponse>((resolve) => {
      login.authorize(
        {
          scope: "profile",
          pkce: true,
          interactive: "always"
        },
        resolve
      );
    });

    if (auth.error || !auth.code) {
      throw new Error(
        auth.error_description || auth.error || "Amazon sign-in was cancelled."
      );
    }

    const token = await new Promise<AmazonTokenResponse>((resolve) => {
      login.retrieveToken(auth.code!, resolve);
    });

    if (!token.success || !token.access_token) {
      throw new Error(token.error || "Amazon token exchange failed.");
    }

    return this.retrieveProfile(login, token.access_token);
  }

  async verify(): Promise<AmazonIdentityProfile> {
    const login = await this.loadSdk();
    const cached = login.retrieveToken();

    if (cached?.success && cached.access_token) {
      return this.retrieveProfile(login, cached.access_token);
    }

    const auth = await new Promise<AmazonAuthResponse>((resolve) => {
      login.authorize(
        {
          scope: "profile",
          pkce: true,
          interactive: "never"
        },
        resolve
      );
    });

    if (auth.error || !auth.code) {
      throw new Error(
        "No reusable Amazon OAuth session was found. Choose Verify with Amazon to sign in again."
      );
    }

    const token = await new Promise<AmazonTokenResponse>((resolve) => {
      login.retrieveToken(auth.code!, resolve);
    });

    if (!token.success || !token.access_token) {
      throw new Error(token.error || "Amazon session verification failed.");
    }

    return this.retrieveProfile(login, token.access_token);
  }

  async logout(): Promise<void> {
    if (!this.isConfigured()) return;
    const login = await this.loadSdk();
    login.logout();
  }

  private async retrieveProfile(
    login: AmazonLoginApi,
    accessToken: string
  ): Promise<AmazonIdentityProfile> {
    const response = await new Promise<AmazonProfileResponse>((resolve) => {
      login.retrieveProfile(accessToken, resolve);
    });

    return profileFrom(response);
  }

  private loadSdk(): Promise<AmazonLoginApi> {
    if (!this.isConfigured()) {
      return Promise.reject(
        new Error(
          "Login with Amazon is not configured. Add VITE_AMAZON_LWA_CLIENT_ID."
        )
      );
    }

    if (window.amazon?.Login) {
      window.amazon.Login.setClientId(clientId());
      return Promise.resolve(window.amazon.Login);
    }

    if (this.sdkPromise) return this.sdkPromise;

    this.sdkPromise = new Promise<AmazonLoginApi>((resolve, reject) => {
      const finish = () => {
        const login = window.amazon?.Login;
        if (!login) {
          reject(new Error("Login with Amazon SDK did not initialize."));
          return;
        }

        login.setClientId(clientId());
        resolve(login);
      };

      const previousReady = window.onAmazonLoginReady;
      window.onAmazonLoginReady = () => {
        previousReady?.();
        finish();
      };

      const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Could not load Login with Amazon SDK.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.id = SDK_ID;
      script.src = SDK_URL;
      script.async = true;
      script.addEventListener("load", () => {
        if (window.amazon?.Login) finish();
      });
      script.addEventListener(
        "error",
        () => reject(new Error("Could not load Login with Amazon SDK.")),
        { once: true }
      );
      document.head.appendChild(script);
    });

    return this.sdkPromise;
  }
}

export const amazonLogin = new AmazonLoginWithAmazon();
