import * as THREE from "three";
import {
  createStereoPlayback,
  type StereoPlaybackOptions
} from "./StereoPlayback";

export type StereoPreviewMode = "window" | "cardboard";

export interface StereoPreviewHandle {
  end(): void;
  setControls(strength: number, convergence: number, popOutLimit: number): void;
}

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

export function startStereoPreview(
  video: HTMLVideoElement,
  options: StereoPlaybackOptions,
  mode: StereoPreviewMode = "window"
): StereoPreviewHandle {
  const resources = createStereoPlayback(video, {
    ...options,
    autoEyeFromCamera: false
  });

  const container = document.createElement("div");
  container.className =
    mode === "cardboard"
      ? "stereo-preview-overlay cardboard-mode"
      : "stereo-preview-overlay";

  const header = document.createElement("div");
  header.className = "stereo-preview-header";
  header.innerHTML =
    mode === "cardboard"
      ? "<strong>Cardboard mode</strong><span>Left eye · Right eye</span>"
      : "<strong>SBS stereo preview</strong><span>Left eye · Right eye</span>";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "stereo-preview-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close stereo preview");
  header.appendChild(close);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.autoClear = false;
  renderer.domElement.className = "stereo-preview-canvas";

  container.append(header, renderer.domElement);
  document.body.appendChild(container);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);
  camera.position.set(0, 1.6, 0);

  let disposed = false;
  let enteredFullscreen = false;

  const resize = () => {
    if (mode === "cardboard") {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      return;
    }

    const width = Math.min(window.innerWidth - 60, 1400);
    const height = Math.min(window.innerHeight - 150, 760);
    renderer.setSize(width, height, false);
  };

  const unlockOrientation = () => {
    const orientation = screen.orientation as LockableOrientation | undefined;
    try {
      orientation?.unlock?.();
    } catch {
      // Orientation APIs vary across browsers.
    }
  };

  const end = () => {
    if (disposed) return;
    disposed = true;

    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("fullscreenchange", onFullscreenChange);

    unlockOrientation();
    resources.dispose();
    renderer.dispose();
    container.remove();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") end();
  };

  const onFullscreenChange = () => {
    resize();

    if (
      mode === "cardboard" &&
      enteredFullscreen &&
      document.fullscreenElement !== container
    ) {
      end();
    }
  };

  close.addEventListener("click", () => {
    if (document.fullscreenElement === container) {
      void document.exitFullscreen().finally(end);
    } else {
      end();
    }
  }, { once: true });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", onFullscreenChange);

  resize();

  if (mode === "cardboard") {
    void container.requestFullscreen?.().then(async () => {
      enteredFullscreen = true;
      resize();

      const orientation = screen.orientation as LockableOrientation | undefined;
      try {
        await orientation?.lock?.("landscape");
      } catch {
        // Full-screen SBS still works if orientation lock is unavailable.
      }
    }).catch(() => {
      // Some mobile browsers restrict the Fullscreen API. The overlay still fills
      // the browser viewport as a graceful fallback.
    });
  }

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    resources.update();

    const pixelRatio = renderer.getPixelRatio();
    const width = renderer.domElement.width / pixelRatio;
    const height = renderer.domElement.height / pixelRatio;
    const eyeWidth = width / 2;

    camera.aspect = eyeWidth / Math.max(1, height);
    camera.updateProjectionMatrix();

    renderer.setScissorTest(true);
    renderer.clear();

    resources.material.setEyeSign(-1);
    renderer.setViewport(0, 0, eyeWidth, height);
    renderer.setScissor(0, 0, eyeWidth, height);
    renderer.render(resources.scene, camera);

    resources.material.setEyeSign(1);
    renderer.setViewport(eyeWidth, 0, eyeWidth, height);
    renderer.setScissor(eyeWidth, 0, eyeWidth, height);
    renderer.render(resources.scene, camera);

    renderer.setScissorTest(false);
  });

  return {
    end,
    setControls(strength, convergence, popOutLimit) {
      resources.setControls(strength, convergence, popOutLimit);
    }
  };
}
