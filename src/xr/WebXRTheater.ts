import * as THREE from "three";
import {
  createStereoPlayback,
  type StereoPlaybackOptions
} from "./StereoPlayback";

export interface XRTheaterHandle {
  end(): Promise<void>;
  setControls(strength: number, convergence: number, popOutLimit: number): void;
}

export async function startWebXRTheater(
  video: HTMLVideoElement,
  options: StereoPlaybackOptions
): Promise<XRTheaterHandle> {
  if (!navigator.xr) {
    throw new Error("WebXR is not available in this browser.");
  }

  const supported = await navigator.xr.isSessionSupported("immersive-vr");
  if (!supported) {
    throw new Error("Immersive VR sessions are not supported on this device/browser.");
  }

  const session = await navigator.xr.requestSession("immersive-vr", {
    optionalFeatures: ["local-floor"]
  });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.className = "xr-canvas";
  document.body.appendChild(renderer.domElement);

  const resources = createStereoPlayback(video, options);

  const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camera.position.set(0, 1.6, 0);

  await renderer.xr.setSession(session);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    renderer.setAnimationLoop(null);
    resources.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  renderer.setAnimationLoop(() => {
    resources.update();
    renderer.render(resources.scene, camera);
  });

  session.addEventListener("end", cleanup, { once: true });

  return {
    async end() {
      if (session.visibilityState !== "hidden") {
        await session.end();
      } else {
        cleanup();
      }
    },
    setControls(strength, convergence, popOutLimit) {
      resources.setControls(strength, convergence, popOutLimit);
    }
  };
}
