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

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.autoClear = false;
  renderer.domElement.className = "stereo-preview-canvas";
  document.body.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);
  camera.position.set(0, 1.6, 0);

  let disposed = false;

  const resize = () => {
    const width = Math.min(window.innerWidth - 40, 1400);
    const height = Math.min(window.innerHeight - 80, 760);
    renderer.setSize(width, height, false);
  };

  resize();
  window.addEventListener("resize", resize);

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    resources.update();

    const canvas = renderer.domElement;
    const width = canvas.width / renderer.getPixelRatio();
    const height = canvas.height / renderer.getPixelRatio();
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
    end() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      resources.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
    setControls(strength, convergence, popOutLimit) {
      resources.setControls(strength, convergence, popOutLimit);
    }
  };
}
