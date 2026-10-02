import * as THREE from "three";
import { createSidecarRuntime, type SidecarRuntimeState } from "../sidecar/runtime";
import type { ThreeDProfile } from "../types/threeDProfile";
import { StereoVideoMaterial } from "./StereoVideoMaterial";

export interface StereoPlaybackOptions {
  profile?: ThreeDProfile | null;
  strength: number;
  convergence: number;
  popOutLimit: number;
  onSidecarState?: (state: SidecarRuntimeState) => void;
  autoEyeFromCamera?: boolean;
}

export interface StereoPlaybackResources {
  scene: THREE.Scene;
  screen: THREE.Mesh<THREE.PlaneGeometry, StereoVideoMaterial>;
  material: StereoVideoMaterial;
  videoTexture: THREE.VideoTexture;
  sidecar: ReturnType<typeof createSidecarRuntime>;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  update(): void;
  setControls(strength: number, convergence: number, popOutLimit: number): void;
  dispose(): void;
}

export function createStereoPlayback(
  video: HTMLVideoElement,
  options: StereoPlaybackOptions
): StereoPlaybackResources {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050608);

  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const sidecar = createSidecarRuntime(options.profile);
  const material = new StereoVideoMaterial({
    videoTexture,
    depthTexture: sidecar.depthTexture,
    leftDisparityTexture: sidecar.leftDisparityTexture,
    rightDisparityTexture: sidecar.rightDisparityTexture,
    mode: sidecar.mode,
    strength: options.strength,
    convergence: options.convergence,
    popOutLimit: options.popOutLimit
  });

  const aspect =
    video.videoWidth && video.videoHeight
      ? video.videoWidth / video.videoHeight
      : options.profile?.fingerprint.aspectRatio ?? 16 / 9;

  const width = 3.4;
  const height = width / aspect;

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  screen.position.set(0, 1.6, -3);
  if (options.autoEyeFromCamera !== false) {
    screen.onBeforeRender = (_renderer, _scene, camera) => {
      material.setEyeForCamera(camera);
    };
  }
  scene.add(screen);

  const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x11151c });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const updateSourceSize = () => {
    material.setSourceSize(video.videoWidth || 1920, video.videoHeight || 1080);
  };
  updateSourceSize();
  video.addEventListener("loadedmetadata", updateSourceSize);

  let lastDiagnostic = 0;

  return {
    scene,
    screen,
    material,
    videoTexture,
    sidecar,
    floor,
    update() {
      sidecar.update(video.currentTime || 0, !video.paused && !video.ended);

      const now = performance.now();
      if (options.onSidecarState && now - lastDiagnostic > 250) {
        options.onSidecarState({ ...sidecar.state });
        lastDiagnostic = now;
      }
    },
    setControls(strength, convergence, popOutLimit) {
      material.setControls(strength, convergence, popOutLimit);
    },
    dispose() {
      video.removeEventListener("loadedmetadata", updateSourceSize);
      sidecar.dispose();
      videoTexture.dispose();
      screen.geometry.dispose();
      material.dispose();
      floor.geometry.dispose();
      floorMaterial.dispose();
    }
  };
}
