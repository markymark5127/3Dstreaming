import { useRef, useState } from "react";
import {
  BrowserDepthMapper,
  downloadMapperResult
} from "../mapper/BrowserDepthMapper";
import type {
  MapperProgress,
  MapperResult
} from "../mapper/types";

interface MapperPanelProps {
  onUseResult(result: MapperResult, sourceFile: File): void;
}

const mapper = new BrowserDepthMapper();

export function MapperPanel({ onUseResult }: MapperPanelProps) {
  const abortRef = useRef<AbortController | null>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [edition, setEdition] = useState("local-source");
  const [fps, setFps] = useState(6);
  const [resolution, setResolution] = useState("320x180");
  const [smoothing, setSmoothing] = useState(78);
  const [progress, setProgress] = useState<MapperProgress | null>(null);
  const [result, setResult] = useState<MapperResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  async function runMapper() {
    if (!sourceFile) {
      setError("Choose a source video first.");
      return;
    }

    setError("");
    setResult(null);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const [width, height] = resolution.split("x").map(Number);

    try {
      const mapped = await mapper.mapVideo({
        title: title.trim() || sourceFile.name.replace(/\.[^.]+$/, ""),
        editionId: edition.trim() || "local-source",
        sourceFile,
        config: {
          width,
          height,
          fps,
          temporalSmoothing: smoothing / 100
        },
        signal: controller.signal,
        onProgress: setProgress
      });

      setResult(mapped);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setError("Mapping cancelled.");
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not generate the 3D mapping."
        );
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  const percent = Math.round((progress?.progress ?? 0) * 100);

  return (
    <section className="mapper-panel">
      <div className="mapper-heading">
        <div>
          <span className="kicker">3D MAPPER</span>
          <h2>Turn a 2D video into a sidecar mapping.</h2>
          <p>
            Everything runs locally in this browser. The source movie is not uploaded.
            This first engine creates a synchronized grayscale depth track in real time.
          </p>
        </div>
        <span className="mapper-engine-badge">FAST BROWSER v1</span>
      </div>

      <div className="mapper-grid">
        <label className="mapper-source">
          <strong>{sourceFile?.name ?? "Choose source video"}</strong>
          <span>
            {sourceFile
              ? `${(sourceFile.size / 1024 / 1024).toFixed(1)} MB`
              : "MP4 / WebM / browser-decodable MOV, OGG, etc."}
          </span>
          <input
            hidden
            type="file"
            accept="video/*,.mov,.avi,.ogg,.ogv,.mkv"
            disabled={running}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSourceFile(file);
              if (file && !title) {
                setTitle(file.name.replace(/\.[^.]+$/, ""));
              }
            }}
          />
        </label>

        <div className="mapper-fields">
          <label>
            <span>Title</span>
            <input
              value={title}
              disabled={running}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Big Buck Bunny"
            />
          </label>

          <label>
            <span>Edition / cut</span>
            <input
              value={edition}
              disabled={running}
              onChange={(event) => setEdition(event.target.value)}
              placeholder="local-source / Blu-ray / Netflix US"
            />
          </label>

          <div className="mapper-setting-row">
            <label>
              <span>Depth FPS</span>
              <select
                value={fps}
                disabled={running}
                onChange={(event) => setFps(Number(event.target.value))}
              >
                <option value={4}>4 fps · small</option>
                <option value={6}>6 fps · recommended baseline</option>
                <option value={8}>8 fps</option>
                <option value={12}>12 fps · smoother</option>
              </select>
            </label>

            <label>
              <span>Depth resolution</span>
              <select
                value={resolution}
                disabled={running}
                onChange={(event) => setResolution(event.target.value)}
              >
                <option value="256x144">256×144 · fastest</option>
                <option value="320x180">320×180 · recommended</option>
                <option value="480x270">480×270 · detailed</option>
              </select>
            </label>
          </div>

          <label className="mapper-smoothing">
            <span>
              Temporal smoothing
              <strong>{smoothing}%</strong>
            </span>
            <input
              type="range"
              min="0"
              max="95"
              value={smoothing}
              disabled={running}
              onChange={(event) => setSmoothing(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      {running && (
        <div className="mapper-progress">
          <div className="mapper-progress-meta">
            <span>
              {progress?.phase === "loading"
                ? "Loading source…"
                : progress?.phase === "finalizing"
                  ? "Finalizing depth.webm…"
                  : "Mapping video in real time…"}
            </span>
            <strong>{percent}%</strong>
          </div>
          <div className="mapper-progress-track">
            <span style={{ width: `${percent}%` }} />
          </div>
          <small>
            {progress
              ? `${progress.mediaTime.toFixed(1)} / ${progress.duration.toFixed(1)} sec · ${progress.processedFrames} depth frames`
              : "Preparing…"}
          </small>
          <button
            className="button secondary compact"
            onClick={() => abortRef.current?.abort()}
          >
            Cancel
          </button>
        </div>
      )}

      {result && sourceFile && (
        <div className="mapper-result">
          <div>
            <span className="three-d-logo">3D</span>
            <div>
              <strong>Mapping complete</strong>
              <span>
                {result.depthFileName} · {(result.depthBlob.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          </div>
          <div className="mapper-result-actions">
            <button
              className="button secondary"
              onClick={() => downloadMapperResult(result)}
            >
              Download files
            </button>
            <button
              className="button primary"
              onClick={() => onUseResult(result, sourceFile)}
            >
              Use mapping now
            </button>
          </div>
        </div>
      )}

      {error && <p className="form-error mapper-error">{error}</p>}

      {!running && !result && (
        <div className="mapper-footer">
          <p>
            This v1 mapper is intended to prove the complete file workflow. It uses fast
            visual-depth heuristics; a semantic AI depth engine will plug into the same
            exporter next.
          </p>
          <button
            className="button light"
            disabled={!sourceFile}
            onClick={() => void runMapper()}
          >
            Generate 3D mapping
          </button>
        </div>
      )}
    </section>
  );
}
