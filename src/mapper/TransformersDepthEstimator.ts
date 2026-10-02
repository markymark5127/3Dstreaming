import {
  pipeline,
  RawImage
} from "@huggingface/transformers";
import type { DepthEstimator } from "./types";

type DepthOutput = {
  depth?: RawImage;
  predicted_depth?: {
    data: Float32Array;
    dims: number[];
  };
};

type DepthPipeline = (image: RawImage) => Promise<DepthOutput>;

export class TransformersDepthEstimator implements DepthEstimator {
  readonly id = "depth-anything-v2-small" as const;
  readonly name = "Depth Anything V2 Small";

  private estimator: DepthPipeline | null = null;

  constructor(private readonly temporalSmoothing = 0.72) {}

  async prepare(): Promise<void> {
    if (this.estimator) return;

    const device = "gpu" in navigator ? "webgpu" : "wasm";

    const created = await pipeline(
      "depth-estimation",
      "onnx-community/depth-anything-v2-small",
      { device }
    );

    this.estimator = created as unknown as DepthPipeline;
  }

  async estimate(
    source: ImageData,
    previousDepth?: Uint8ClampedArray
  ): Promise<Uint8ClampedArray> {
    await this.prepare();

    const image = new RawImage(
      source.data,
      source.width,
      source.height,
      4
    );

    const result = await this.estimator!(image);
    const output = new Uint8ClampedArray(source.width * source.height);

    if (result.depth) {
      const depthImage =
        result.depth.width === source.width &&
        result.depth.height === source.height
          ? result.depth
          : await result.depth.clone().resize(source.width, source.height);

      const channels = depthImage.channels;
      const data = depthImage.data;

      for (let i = 0; i < output.length; i += 1) {
        const value = data[i * channels] ?? 0;
        output[i] = this.smooth(value, previousDepth?.[i]);
      }

      return output;
    }

    if (result.predicted_depth) {
      const tensor = result.predicted_depth;
      const data = tensor.data;

      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;

      for (const value of data) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }

      const range = Math.max(1e-6, max - min);

      // Fallback assumes the tensor is already in raster order. Most pipeline
      // outputs also expose result.depth, so this path should rarely be needed.
      for (let i = 0; i < output.length; i += 1) {
        const sourceIndex = Math.min(
          data.length - 1,
          Math.floor((i / output.length) * data.length)
        );
        const value = Math.round(((data[sourceIndex] - min) / range) * 255);
        output[i] = this.smooth(value, previousDepth?.[i]);
      }

      return output;
    }

    throw new Error("Depth Anything returned no usable depth image.");
  }

  private smooth(current: number, previous?: number): number {
    if (previous === undefined) return current;

    return Math.round(
      previous * this.temporalSmoothing +
      current * (1 - this.temporalSmoothing)
    );
  }
}
