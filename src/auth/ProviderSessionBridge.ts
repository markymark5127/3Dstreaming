import type { ProviderId } from "../providers/types";

interface BridgeStatus {
  providerId: ProviderId;
  confirmedAt: string;
  pageUrl?: string;
}

interface BridgeResponse {
  ok?: boolean;
  status?: BridgeStatus | null;
  statuses?: Partial<Record<ProviderId, BridgeStatus>>;
  error?: string;
}

interface ChromeRuntime {
  sendMessage(
    extensionId: string,
    message: unknown,
    callback: (response: BridgeResponse) => void
  ): void;
  lastError?: {
    message?: string;
  };
}

declare global {
  interface Window {
    chrome?: {
      runtime?: ChromeRuntime;
    };
  }
}

function extensionId(): string {
  return (import.meta.env.VITE_PROVIDER_BRIDGE_EXTENSION_ID ?? "").trim();
}

export class ProviderSessionBridge {
  isConfigured(): boolean {
    return Boolean(extensionId()) && Boolean(window.chrome?.runtime);
  }

  async getStatus(providerId: ProviderId): Promise<BridgeStatus | null> {
    const runtime = window.chrome?.runtime;
    if (!runtime || !extensionId()) {
      throw new Error(
        "Provider Session Bridge is not configured. Install the companion extension and set VITE_PROVIDER_BRIDGE_EXTENSION_ID."
      );
    }

    return new Promise<BridgeStatus | null>((resolve, reject) => {
      runtime.sendMessage(
        extensionId(),
        {
          type: "get-provider-status",
          providerId
        },
        (response) => {
          const runtimeError = runtime.lastError?.message;
          if (runtimeError) {
            reject(new Error(runtimeError));
            return;
          }

          if (!response?.ok) {
            reject(
              new Error(
                response?.error || "Provider Session Bridge did not respond."
              )
            );
            return;
          }

          resolve(response.status ?? null);
        }
      );
    });
  }

  async clearStatus(providerId: ProviderId): Promise<void> {
    const runtime = window.chrome?.runtime;
    if (!runtime || !extensionId()) return;

    await new Promise<void>((resolve) => {
      runtime.sendMessage(
        extensionId(),
        {
          type: "clear-provider-status",
          providerId
        },
        () => resolve()
      );
    });
  }
}

export const providerSessionBridge = new ProviderSessionBridge();
