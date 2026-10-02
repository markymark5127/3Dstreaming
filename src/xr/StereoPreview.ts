import * as THREE from "three";
import {
  createStereoPlayback,
  type StereoPlaybackOptions
} from "./StereoPlayback";

export interface StereoPreviewHandle {
  end(): void;
  setControls(strength: number, convergence: number, popOutLimit: number): void;
}

export function startStereoPreview(
  video: HTMLVideoElement,
  options: StereoPlaybackOptions
): StereoPreviewHandle {
  const resources = createStereoPlayback(video, options);

  const container = document.createElement("div");
  container.className = "stereo-preview-overlay";

  const header = document.createElement("div");
  header.className = "stereo-preview-header";
  header.innerHTML = "<strong>SBS stereo preview</strong><span>Left eye · Right eye</span>";

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

  const resize = () => {
    const width = Math.min(window.innerWidth - 60, 1400);
    const height = Math.min(window.innerHeight - 150, 760);
    renderer.setSize(width, height, false);
  };

  const end = () => {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKeyDown);
    resources.dispose();
    renderer.dispose();
    container.remove();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") end();
  };

  close.addEventListener("click", end, { once: true });
  window.addEventListener("keydown", onKeyDown);
  resize();
  window.addEventListener("resize", resize);

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    resources.update();

    const pixelRatio = renderer.getPixelRatio();
    const width = renderer.domElement.width / pixelRatio;
    const height = renderer.domElement.height / pixelRatio;
    const eyeWidth = width / 2;

    camera.aspect = eyeWidth / height;
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
