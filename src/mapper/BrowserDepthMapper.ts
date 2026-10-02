import { HeuristicDepthEstimator } from "./HeuristicDepthEstimator";
import { TransformersDepthEstimator } from "./TransformersDepthEstimator";
import type {
  DepthEstimator,
  MapperConfig,
  MapperProgress,
  MapperResult
} from "./types";
import type { ThreeDProfile } from "../types/threeDProfile";

interface MapVideoOptions {
  title: string;
  editionId: string;
  sourceFile: File;
  config: MapperConfig;
  signal?: AbortSignal;
  onProgress?: (progress: MapperProgress) => void;
}

function waitForMediaEvent(
  video: HTMLVideoElement,
  event: string,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Mapping cancelled.", "AbortError"));
    };

    const onError = () => {
      cleanup();
      reject(
        new Error(
          `The browser could not decode this video (media error ${video.error?.code ?? "unknown"}). Try MP4/H.264 or WebM.`
        )
      );
    };

    const onEvent = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function safeStem(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "3d-mapping"
  );
}

function chooseRecorderMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function createEstimator(config: MapperConfig): DepthEstimator {
  if (config.engine === "depth-anything-v2-small") {
    return new TransformersDepthEstimator(config.temporalSmoothing);
  }

  return new HeuristicDepthEstimator(config.temporalSmoothing);
}

export class BrowserDepthMapper {
  async mapVideo(options: MapVideoOptions): Promise<MapperResult> {
    const { sourceFile, config, signal, onProgress } = options;
    const sourceUrl = URL.createObjectURL(sourceFile);
    const video = document.createElement("video");
    video.src = sourceUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = config.width;
    sourceCanvas.height = config.height;

    const depthCanvas = document.createElement("canvas");
    depthCanvas.width = config.width;
    depthCanvas.height = config.height;

    const sourceContext = sourceCanvas.getContext("2d", {
      willReadFrequently: true
    });
    const depthContext = depthCanvas.getContext("2d");

    if (!sourceContext || !depthContext) {
      URL.revokeObjectURL(sourceUrl);
      throw new Error("Canvas processing is unavailable in this browser.");
    }

    if (typeof depthCanvas.captureStream !== "function") {
      URL.revokeObjectURL(sourceUrl);
      throw new Error(
        "This browser cannot record a depth-video sidecar from canvas."
      );
    }

    onProgress?.({
      phase: "loading",
      mediaTime: 0,
      duration: 0,
      progress: 0,
      processedFrames: 0
    });

    video.load();

    try {
      if (video.readyState < 1) {
        await waitForMediaEvent(video, "loadedmetadata", signal);
      }

      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Could not determine the source video duration.");
      }

      const aspectRatio =
        video.videoWidth && video.videoHeight
          ? video.videoWidth / video.videoHeight
          : config.width / config.height;

      if (video.readyState < 2) {
        await waitForMediaEvent(video, "loadeddata", signal);
      }

      const mimeType = chooseRecorderMimeType();
      if (!mimeType) {
        throw new Error("This browser cannot record a WebM depth track.");
      }

      const estimator = createEstimator(config);

      if (estimator.prepare) {
        onProgress?.({
          phase: "loading-model",
          mediaTime: 0,
          duration,
          progress: 0,
          processedFrames: 0
        });
        await estimator.prepare();
      }

      const capture = depthCanvas.captureStream(config.fps);
      const recorder = new MediaRecorder(capture, {
        mimeType,
        videoBitsPerSecond: 1_200_000
      });

      const chunks: Blob[] = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });

      const recorded = new Promise<void>((resolve, reject) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.addEventListener(
          "error",
          () => reject(new Error("Depth-track recording failed.")),
          { once: true }
        );
      });

      let previousDepth: Uint8ClampedArray | undefined;
      let processedFrames = 0;
      let nextSampleTime = 0;
      const sampleInterval = 1 / config.fps;
      let stopped = false;
      let currentProcessing: Promise<void> | null = null;
      let fallbackAnimationFrame = 0;
      let rejectProcessingFailure: ((reason?: unknown) => void) | null = null;
      const processingFailure = new Promise<never>((_resolve, reject) => {
        rejectProcessingFailure = reject;
      });

      const paintDepth = (values: Uint8ClampedArray) => {
        const depthImage = depthContext.createImageData(
          depthCanvas.width,
          depthCanvas.height
        );

        for (let i = 0; i < values.length; i += 1) {
          const p = i * 4;
          const value = values[i];
          depthImage.data[p] = value;
          depthImage.data[p + 1] = value;
          depthImage.data[p + 2] = value;
          depthImage.data[p + 3] = 255;
        }

        depthContext.putImageData(depthImage, 0, 0);
      };

      const processCurrentFrame = async (mediaTime: number) => {
        sourceContext.drawImage(
          video,
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height
        );

        const sourceFrame = sourceContext.getImageData(
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height
        );

        previousDepth = await estimator.estimate(
          sourceFrame,
          previousDepth
        );

        paintDepth(previousDepth);
        processedFrames += 1;

        onProgress?.({
          phase: "mapping",
          mediaTime,
          duration,
          progress: Math.min(1, mediaTime / duration),
          processedFrames
        });
      };

      const maybeProcess = (mediaTime: number) => {
        if (signal?.aborted || stopped) return;
        if (mediaTime + sampleInterval * 0.25 < nextSampleTime) return;
        if (currentProcessing) return;

        while (nextSampleTime <= mediaTime) {
          nextSampleTime += sampleInterval;
        }

        currentProcessing = processCurrentFrame(mediaTime)
          .catch((error) => {
            stopped = true;
            video.pause();
            if (recorder.state !== "inactive") recorder.stop();
            rejectProcessingFailure?.(error);
          })
          .finally(() => {
            currentProcessing = null;
          });
      };

      const scheduleFrames = () => {
        if (stopped || signal?.aborted || video.ended) return;

        if (typeof video.requestVideoFrameCallback === "function") {
          video.requestVideoFrameCallback((_now, metadata) => {
            maybeProcess(metadata.mediaTime);
            scheduleFrames();
          });
          return;
        }

        fallbackAnimationFrame = requestAnimationFrame(() => {
          maybeProcess(video.currentTime || 0);
          scheduleFrames();
        });
      };

      const stop = async () => {
        if (stopped) return;
        stopped = true;
        video.pause();

        if (fallbackAnimationFrame) {
          cancelAnimationFrame(fallbackAnimationFrame);
        }

        if (currentProcessing) {
          await currentProcessing.catch(() => undefined);
        }

        if (recorder.state !== "inactive") recorder.stop();
        await recorded;
      };

      const abortHandler = () => {
        void stop();
      };

      signal?.addEventListener("abort", abortHandler, { once: true });

      try {
        video.currentTime = 0;
        sourceContext.drawImage(video, 0, 0, config.width, config.height);

        const seed = sourceContext.getImageData(
          0,
          0,
          config.width,
          config.height
        );

        previousDepth = await estimator.estimate(seed);
        paintDepth(previousDepth);
        processedFrames = 1;
        nextSampleTime = sampleInterval;

        recorder.start(1000);
        scheduleFrames();

        await video.play();
        await Promise.race([
          waitForMediaEvent(video, "ended", signal),
          processingFailure
        ]);

        onProgress?.({
          phase: "finalizing",
          mediaTime: duration,
          duration,
          progress: 1,
          processedFrames
        });

        await stop();

        const depthBlob = new Blob(chunks, { type: mimeType });
        const stem = safeStem(options.title);
        const depthFileName = `${stem}.depth.webm`;
        const profileFileName = `${stem}.3d.json`;

        const exportProfile: ThreeDProfile = {
          schemaVersion: 1,
          id: crypto.randomUUID(),
          title: options.title.trim() || sourceFile.name,
          editionId: options.editionId.trim() || "local-source",
          sourceHints: ["local"],
          fingerprint: {
            durationSeconds: duration,
            aspectRatio
          },
          tracks: [
            {
              kind: "depth",
              url: depthFileName,
              codec: mimeType.includes("vp9") ? "vp9" : "vp8",
              fps: config.fps,
              width: config.width,
              height: config.height,
              timeOffsetSeconds: 0
            }
          ],
          defaults: {
            depthStrength: 0.58,
            convergence: 0.5,
            popOutLimit: 0.18
          },
          notes:
            `Generated locally by 3Dstreaming using ${estimator.name} (${estimator.id}).`
        };

        const runtimeDepthUrl = URL.createObjectURL(depthBlob);
        const runtimeProfile: ThreeDProfile = {
          ...exportProfile,
          tracks: exportProfile.tracks.map((track) => ({
            ...track,
            url: runtimeDepthUrl
          }))
        };

        onProgress?.({
          phase: "done",
          mediaTime: duration,
          duration,
          progress: 1,
          processedFrames
        });

        return {
          depthBlob,
          depthFileName,
          profileFileName,
          exportProfile,
          runtimeProfile,
          sourceDuration: duration,
          sourceAspectRatio: aspectRatio
        };
      } finally {
        signal?.removeEventListener("abort", abortHandler);
        capture.getTracks().forEach((track) => track.stop());
      }
    } finally {
      URL.revokeObjectURL(sourceUrl);
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }
}

export function downloadMapperResult(result: MapperResult): void {
  const files: Array<{ blob: Blob; name: string }> = [
    { blob: result.depthBlob, name: result.depthFileName },
    {
      blob: new Blob([JSON.stringify(result.exportProfile, null, 2)], {
        type: "application/json"
      }),
      name: result.profileFileName
    }
  ];

  for (const file of files) {
    const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
