import { FormEvent, useMemo, useState } from "react";
import type { UserAccount } from "../auth/types";
import type { CommunityProfile } from "../community/types";
import { loadThreeDProfile } from "../core/sidecar";
import type { ProviderId } from "../providers/types";

interface Upload3DModalProps {
  user: UserAccount;
  onClose(): void;
  onSubmit(profile: CommunityProfile): Promise<void>;
}

const providerOptions: Array<{ id: ProviderId | "local"; label: string }> = [
  { id: "netflix", label: "Netflix" },
  { id: "disney-plus", label: "Disney+" },
  { id: "max", label: "Max" },
  { id: "prime-video", label: "Prime Video" },
  { id: "local", label: "Local / disc / other" }
];

export function Upload3DModal({ user, onClose, onSubmit }: Upload3DModalProps) {
  const [title, setTitle] = useState("");
  const [mediaType, setMediaType] = useState<"movie" | "series" | "episode">("movie");
  const [year, setYear] = useState("");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [edition, setEdition] = useState("");
  const [tags, setTags] = useState("");
  const [providers, setProviders] = useState<string[]>(["local"]);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [sidecarFiles, setSidecarFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const sidecarSummary = useMemo(
    () => sidecarFiles.map((file) => file.name).join(", "),
    [sidecarFiles]
  );

  function toggleProvider(id: string) {
    setProviders((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!title.trim() || !edition.trim() || !profileFile) {
      setError("Title, edition/cut, and a 3D profile JSON file are required.");
      return;
    }

    try {
      setSubmitting(true);
      const parsed = await loadThreeDProfile(profileFile);

      const resolvedTracks = parsed.tracks.map((track, index) => {
        const referencedName = track.url.split("/").pop()?.toLowerCase();
        const kindHint =
          track.kind === "disparity-left"
            ? "left"
            : track.kind === "disparity-right"
              ? "right"
              : track.kind === "convergence"
                ? "conv"
                : "depth";

        const matchingFile =
          sidecarFiles.find((file) => file.name.toLowerCase() === referencedName) ??
          sidecarFiles.find((file) => file.name.toLowerCase().includes(kindHint)) ??
          (sidecarFiles.length === parsed.tracks.length ? sidecarFiles[index] : undefined) ??
          (sidecarFiles.length === 1 && parsed.tracks.length === 1 ? sidecarFiles[0] : undefined);

        return matchingFile
          ? { ...track, url: URL.createObjectURL(matchingFile) }
          : track;
      });

      const communityProfile: CommunityProfile = {
        id: crypto.randomUUID(),
        title: title.trim(),
        year: year ? Number(year) : undefined,
        mediaType,
        seasonNumber: season ? Number(season) : undefined,
        episodeNumber: episode ? Number(episode) : undefined,
        editionLabel: edition.trim(),
        providerHints: providers,
        author: { id: user.id, displayName: user.displayName },
        status: "pending",
        ratingAverage: 0,
        ratingCount: 0,
        downloads: 0,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        updatedAt: new Date().toISOString(),
        upload: {
          profileFileName: profileFile.name,
          sidecarFileNames: sidecarFiles.map((file) => file.name),
          totalBytes:
            profileFile.size + sidecarFiles.reduce((sum, file) => sum + file.size, 0)
        },
        profile: {
          ...parsed,
          title: title.trim(),
          editionId: edition.trim(),
          tracks: resolvedTracks
        }
      };

      await onSubmit(communityProfile);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read this 3D profile.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="upload-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="kicker">COMMUNITY CONTRIBUTION</span>
            <h2>Upload a 3D mapping</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="upload-form" onSubmit={(event) => void submit(event)}>
          <div className="form-grid two">
            <label>
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Movie or show title" />
            </label>
            <label>
              <span>Type</span>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value as typeof mediaType)}>
                <option value="movie">Movie</option>
                <option value="series">TV series</option>
                <option value="episode">TV episode</option>
              </select>
            </label>
          </div>

          <div className="form-grid three">
            <label>
              <span>Year</span>
              <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="2026" />
            </label>
            <label>
              <span>Season</span>
              <input value={season} onChange={(e) => setSeason(e.target.value)} inputMode="numeric" disabled={mediaType !== "episode"} />
            </label>
            <label>
              <span>Episode</span>
              <input value={episode} onChange={(e) => setEpisode(e.target.value)} inputMode="numeric" disabled={mediaType !== "episode"} />
            </label>
          </div>

          <label>
            <span>Edition / cut / stream version</span>
            <input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="Netflix US 2026 / Blu-ray theatrical / etc." />
          </label>

          <fieldset>
            <legend>Known compatible sources</legend>
            <div className="provider-checks">
              {providerOptions.map((provider) => (
                <label key={provider.id} className="check-pill">
                  <input
                    type="checkbox"
                    checked={providers.includes(provider.id)}
                    onChange={() => toggleProvider(provider.id)}
                  />
                  <span>{provider.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            <span>Tags</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="manual, depth, animation" />
          </label>

          <div className="file-drop-row">
            <label className="file-drop">
              <strong>3D profile JSON</strong>
              <span>{profileFile?.name ?? "Choose the mapping manifest"}</span>
              <input hidden type="file" accept=".json,application/json" onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)} />
            </label>

            <label className="file-drop">
              <strong>Sidecar track files</strong>
              <span>{sidecarSummary || "Depth/disparity/convergence files"}</span>
              <input
                hidden
                type="file"
                multiple
                accept=".webm,.mp4,.bin,.dat,.json,video/*,application/octet-stream"
                onChange={(e) => setSidecarFiles(Array.from(e.target.files ?? []))}
              />
            </label>
          </div>

          <p className="upload-note">
            This prototype records the submission metadata locally/in-memory. Production upload storage,
            moderation, signatures, and resumable file transfer are the next backend milestone.
          </p>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary" disabled={submitting}>
              {submitting ? "Preparing…" : "Submit for review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
