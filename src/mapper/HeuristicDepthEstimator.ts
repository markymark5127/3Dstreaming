import type { DepthEstimator } from "./types";

export class HeuristicDepthEstimator implements DepthEstimator {
  readonly id = "browser-fast-v1" as const;
  readonly name = "Fast Browser Mapper";

  constructor(private readonly temporalSmoothing = 0.78) {}

  async estimate(
    source: ImageData,
    previousDepth?: Uint8ClampedArray
  ): Promise<Uint8ClampedArray> {
    const { width, height, data } = source;
    const count = width * height;
    const luma = new Float32Array(count);
    const output = new Uint8ClampedArray(count);

    for (let i = 0; i < count; i += 1) {
      const p = i * 4;
      luma[i] =
        (data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722) / 255;
    }

    for (let y = 0; y < height; y += 1) {
      const ny = y / Math.max(1, height - 1);

      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const nx = x / Math.max(1, width - 1);
        const cx = (nx - 0.5) * 2;
        const cy = (ny - 0.46) * 2;
        const centerPrior = Math.max(0, 1 - Math.sqrt(cx * cx + cy * cy));

        const x0 = Math.max(0, x - 2);
        const x1 = Math.min(width - 1, x + 2);
        const y0 = Math.max(0, y - 2);
        const y1 = Math.min(height - 1, y + 2);

        let neighborhood = 0;
        let samples = 0;

        for (let sy = y0; sy <= y1; sy += 2) {
          for (let sx = x0; sx <= x1; sx += 2) {
            neighborhood += luma[sy * width + sx];
            samples += 1;
          }
        }

        const localMean = neighborhood / Math.max(1, samples);
        const contrast = Math.min(1, Math.abs(luma[i] - localMean) * 4.0);
        const lowerFramePrior = ny;

        let depth =
          centerPrior * 0.48 +
          lowerFramePrior * 0.24 +
          contrast * 0.20 +
          luma[i] * 0.08;

        depth = Math.max(0, Math.min(1, depth));

        if (previousDepth) {
          const previous = previousDepth[i] / 255;
          depth =
            previous * this.temporalSmoothing +
            depth * (1 - this.temporalSmoothing);
        }

        output[i] = Math.round(depth * 255);
      }
    }

    return output;
  }
}
