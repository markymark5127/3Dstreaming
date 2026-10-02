import { HeuristicDepthEstimator } from "./HeuristicDepthEstimator";
import type {
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

function waitForEvent(
  target: EventTarget,
  event: string,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Mapping cancelled.", "AbortError"));
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      target.removeEventListener(event, onEvent);
      signal?.removeEventListener("abort", onAbort);
    };

    target.addEventListener(event, onEvent, { once: true });
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

function downloadProfile(profile: ThreeDProfile): Blob {
  return new Blob([JSON.stringify(profile, null, 2)], {
    type: "application/json"
  });
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

    onProgress?.({
      phase: "loading",
      mediaTime: 0,
      duration: 0,
      progress: 0,
      processedFrames: 0
    });

    video.load();
    if (video.readyState < 1) {
      await waitForEvent(video, "loadedmetadata", signal);
    }

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      URL.revokeObjectURL(sourceUrl);
      throw new Error("Could not determine the source video duration.");
    }

    const aspectRatio =
      video.videoWidth && video.videoHeight
        ? video.videoWidth / video.videoHeight
        : config.width / config.height;

    const mimeType = chooseRecorderMimeType();
    if (!mimeType) {
      URL.revokeObjectURL(sourceUrl);
      throw new Error("This browser cannot record a WebM depth track.");
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

    const estimator = new HeuristicDepthEstimator(config.temporalSmoothing);
    let previousDepth: Uint8ClampedArray | undefined;
    let processedFrames = 0;
    let nextSampleTime = 0;
    const sampleInterval = 1 / config.fps;
    let stopped = false;

    const stop = async () => {
      if (stopped) return;
      stopped = true;
      video.pause();
      if (recorder.state !== "inactive") recorder.stop();
      await recorded;
    };

    const abortHandler = () => {
      void stop();
    };
    signal?.addEventListener("abort", abortHandler, { once: true });

    const renderDepthFrame = (mediaTime: number) => {
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

      previousDepth = estimator.estimate(sourceFrame, previousDepth);

      const depthImage = depthContext.createImageData(
        depthCanvas.width,
        depthCanvas.height
      );

      for (let i = 0; i < previousDepth.length; i += 1) {
        const p = i * 4;
        const value = previousDepth[i];
        depthImage.data[p] = value;
        depthImage.data[p + 1] = value;
        depthImage.data[p + 2] = value;
        depthImage.data[p + 3] = 255;
      }

      depthContext.putImageData(depthImage, 0, 0);
      processedFrames += 1;

      onProgress?.({
        phase: "mapping",
        mediaTime,
        duration,
        progress: Math.min(1, mediaTime / duration),
        processedFrames
      });
    };

    const frameLoop = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (signal?.aborted || stopped) return;

      if (metadata.mediaTime + sampleInterval * 0.25 >= nextSampleTime) {
        renderDepthFrame(metadata.mediaTime);
        while (nextSampleTime <= metadata.mediaTime) {
          nextSampleTime += sampleInterval;
        }
      }

      if (!video.ended) {
        video.requestVideoFrameCallback(frameLoop);
      }
    };

    // Seed the canvas before recording so frame 0 is not transparent.
    if (video.readyState < 2) {
      await waitForEvent(video, "loadeddata", signal);
    }

    video.currentTime = 0;
    sourceContext.drawImage(video, 0, 0, config.width, config.height);
    const seed = sourceContext.getImageData(0, 0, config.width, config.height);
    previousDepth = estimator.estimate(seed);
    renderDepthFrame(0);

    recorder.start(1000);
    video.requestVideoFrameCallback(frameLoop);

    try {
      await video.play();
      await waitForEvent(video, "ended", signal);

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
          "Generated locally by the 3Dstreaming Fast Browser Mapper. This baseline mapper uses visual heuristics, not a semantic monocular-depth ML model."
      };

      const runtimeDepthUrl = URL.createObjectURL(depthBlob);
      const runtimeProfile: ThreeDProfile = {
        ...exportProfile,
        tracks: exportProfile.tracks.map((track) => ({
          ...track,
          url: runtimeDepthUrl
        }))
      };

      void downloadProfile(exportProfile);

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
      URL.revokeObjectURL(sourceUrl);
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
