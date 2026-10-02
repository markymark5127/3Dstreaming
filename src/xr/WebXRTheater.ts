import * as THREE from "three";

export interface XRTheaterHandle {
  end(): Promise<void>;
}

export async function startWebXRTheater(video: HTMLVideoElement): Promise<XRTheaterHandle> {
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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050608);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 1.6, 0);

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
  const width = 3.4;
  const height = width / aspect;

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  );
  screen.position.set(0, 1.6, -3);
  scene.add(screen);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({ color: 0x11151c })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  await renderer.xr.setSession(session);
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  const cleanup = () => {
    renderer.setAnimationLoop(null);
    texture.dispose();
    screen.geometry.dispose();
    (screen.material as THREE.Material).dispose();
    floor.geometry.dispose();
    (floor.material as THREE.Material).dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  session.addEventListener("end", cleanup, { once: true });

  return {
    async end() {
      if (session.visibilityState !== "hidden") {
        await session.end();
      }
    }
  };
}
