import * as THREE from "three";

export interface StereoVideoMaterialOptions {
  videoTexture: THREE.Texture;
  depthTexture: THREE.Texture;
  strength: number;
  convergence: number;
  popOutLimit: number;
}

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D videoMap;
  uniform sampler2D depthMap;
  uniform float eyeSign;
  uniform float strength;
  uniform float convergence;
  uniform float popOutLimit;
  uniform vec2 sourceTexel;

  varying vec2 vUv;

  float readDepth(vec2 uv) {
    return texture2D(depthMap, clamp(uv, 0.0, 1.0)).r;
  }

  void main() {
    float depth = readDepth(vUv);
    float centered = clamp(depth - convergence, -popOutLimit, popOutLimit);

    // Keep disparity intentionally conservative. strength=1 is about 2.8% of screen width
    // at the maximum allowed depth offset.
    float disparity = centered * strength * 0.028;
    vec2 warpedUv = vUv + vec2(eyeSign * disparity, 0.0);

    // Small edge-aware fallback: if the displaced sample crosses a strong depth edge,
    // bias toward two nearby samples instead of exposing a single stretched texel.
    float leftDepth = readDepth(warpedUv - vec2(sourceTexel.x * 2.0, 0.0));
    float rightDepth = readDepth(warpedUv + vec2(sourceTexel.x * 2.0, 0.0));
    float edge = max(abs(depth - leftDepth), abs(depth - rightDepth));

    vec2 safeUv = clamp(warpedUv, sourceTexel, vec2(1.0) - sourceTexel);
    vec4 base = texture2D(videoMap, safeUv);

    if (edge > 0.10) {
      vec4 a = texture2D(videoMap, clamp(safeUv - vec2(sourceTexel.x, 0.0), 0.0, 1.0));
      vec4 b = texture2D(videoMap, clamp(safeUv + vec2(sourceTexel.x, 0.0), 0.0, 1.0));
      base = mix(base, (a + b) * 0.5, 0.35);
    }

    gl_FragColor = base;
  }
`;

export class StereoVideoMaterial extends THREE.ShaderMaterial {
  constructor(options: StereoVideoMaterialOptions) {
    super({
      uniforms: {
        videoMap: { value: options.videoTexture },
        depthMap: { value: options.depthTexture },
        eyeSign: { value: 0 },
        strength: { value: options.strength },
        convergence: { value: options.convergence },
        popOutLimit: { value: options.popOutLimit },
        sourceTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) }
      },
      vertexShader,
      fragmentShader,
      toneMapped: false
    });
  }

  setControls(strength: number, convergence: number, popOutLimit: number): void {
    this.uniforms.strength.value = strength;
    this.uniforms.convergence.value = convergence;
    this.uniforms.popOutLimit.value = popOutLimit;
  }

  setSourceSize(width: number, height: number): void {
    this.uniforms.sourceTexel.value.set(
      1 / Math.max(1, width),
      1 / Math.max(1, height)
    );
  }

  setEyeForCamera(camera: THREE.Camera): void {
    const xrCamera = camera as THREE.Camera & { viewport?: THREE.Vector4; name?: string };
    const viewportX = xrCamera.viewport?.x;

    if (typeof viewportX === "number") {
      this.uniforms.eyeSign.value = viewportX > 0 ? 1 : -1;
      return;
    }

    if (xrCamera.name?.toLowerCase().includes("right")) {
      this.uniforms.eyeSign.value = 1;
      return;
    }

    if (xrCamera.name?.toLowerCase().includes("left")) {
      this.uniforms.eyeSign.value = -1;
      return;
    }

    // Desktop/non-XR preview stays centered instead of receiving a false stereo shift.
    this.uniforms.eyeSign.value = 0;
  }
}
