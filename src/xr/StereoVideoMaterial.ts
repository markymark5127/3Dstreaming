import * as THREE from "three";
import type { SidecarRenderMode } from "../sidecar/runtime";

export interface StereoVideoMaterialOptions {
  videoTexture: THREE.Texture;
  depthTexture: THREE.Texture;
  leftDisparityTexture: THREE.Texture;
  rightDisparityTexture: THREE.Texture;
  mode: SidecarRenderMode;
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
  uniform sampler2D leftDisparityMap;
  uniform sampler2D rightDisparityMap;
  uniform float mode;
  uniform float eyeSign;
  uniform float strength;
  uniform float convergence;
  uniform float popOutLimit;
  uniform vec2 sourceTexel;

  varying vec2 vUv;

  float readDepth(vec2 uv) {
    return texture2D(depthMap, clamp(uv, 0.0, 1.0)).r;
  }

  float readDisparity(vec2 uv) {
    float encoded = eyeSign < 0.0
      ? texture2D(leftDisparityMap, clamp(uv, 0.0, 1.0)).r
      : texture2D(rightDisparityMap, clamp(uv, 0.0, 1.0)).r;

    return (encoded - 0.5) * 2.0;
  }

  void main() {
    float offset = 0.0;
    float edgeDepth = readDepth(vUv);

    if (mode > 0.5) {
      // Disparity tracks are encoded with 0.5 = neutral; 0/1 are opposite maximum shifts.
      offset = clamp(readDisparity(vUv), -1.0, 1.0) * strength * 0.028;
    } else {
      float centered = clamp(edgeDepth - convergence, -popOutLimit, popOutLimit);
      offset = eyeSign * centered * strength * 0.028;
    }

    vec2 warpedUv = vUv + vec2(offset, 0.0);
    vec2 safeUv = clamp(warpedUv, sourceTexel, vec2(1.0) - sourceTexel);

    vec4 base = texture2D(videoMap, safeUv);

    // Conservative horizontal fill around depth discontinuities.
    if (mode < 0.5) {
      float leftDepth = readDepth(warpedUv - vec2(sourceTexel.x * 2.0, 0.0));
      float rightDepth = readDepth(warpedUv + vec2(sourceTexel.x * 2.0, 0.0));
      float edge = max(abs(edgeDepth - leftDepth), abs(edgeDepth - rightDepth));

      if (edge > 0.10) {
        vec4 a = texture2D(
          videoMap,
          clamp(safeUv - vec2(sourceTexel.x, 0.0), 0.0, 1.0)
        );
        vec4 b = texture2D(
          videoMap,
          clamp(safeUv + vec2(sourceTexel.x, 0.0), 0.0, 1.0)
        );
        base = mix(base, (a + b) * 0.5, 0.35);
      }
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
        leftDisparityMap: { value: options.leftDisparityTexture },
        rightDisparityMap: { value: options.rightDisparityTexture },
        mode: { value: options.mode === "disparity" ? 1 : 0 },
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

  setEyeSign(eyeSign: -1 | 0 | 1): void {
    this.uniforms.eyeSign.value = eyeSign;
  }

  setEyeForCamera(camera: THREE.Camera): void {
    const xrCamera = camera as THREE.Camera & { viewport?: THREE.Vector4; name?: string };
    const viewportX = xrCamera.viewport?.x;

    if (typeof viewportX === "number") {
      this.setEyeSign(viewportX > 0 ? 1 : -1);
      return;
    }

    const name = xrCamera.name?.toLowerCase() ?? "";
    if (name.includes("right")) {
      this.setEyeSign(1);
      return;
    }
    if (name.includes("left")) {
      this.setEyeSign(-1);
      return;
    }

    this.setEyeSign(0);
  }
}
