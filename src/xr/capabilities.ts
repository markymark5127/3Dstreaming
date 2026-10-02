export interface ClientCapabilities {
  secureContext: boolean;
  serviceWorker: boolean;
  standalone: boolean;
  webgl2: boolean;
  webgpu: boolean;
  webxr: boolean;
  immersiveVr: boolean;
  mediaCapabilities: boolean;
}

export async function detectCapabilities(): Promise<ClientCapabilities> {
  const webxr = "xr" in navigator;
  let immersiveVr = false;

  if (webxr && navigator.xr) {
    try {
      immersiveVr = await navigator.xr.isSessionSupported("immersive-vr");
    } catch {
      immersiveVr = false;
    }
  }

  const canvas = document.createElement("canvas");

  return {
    secureContext: window.isSecureContext,
    serviceWorker: "serviceWorker" in navigator,
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    webgl2: Boolean(canvas.getContext("webgl2")),
    webgpu: "gpu" in navigator,
    webxr,
    immersiveVr,
    mediaCapabilities: "mediaCapabilities" in navigator
  };
}
