import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore } from "@/stores/noteStore";
import { NoteDiff } from "./NoteDiff";
import { CloseIcon } from "@/components/common/Icons";

interface NoteVersion {
  commitHash: string;
  shortHash: string;
  date: number;
  message: string;
  author: string;
}

const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const RestoreIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

interface NoteHistoryProps {
  onClose: () => void;
}

export function NoteHistory({ onClose }: NoteHistoryProps) {
  const { currentNote, loadNotes, openNote } = useNoteStore();
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);
  const [versionContent, setVersionContent] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (currentNote) {
      loadHistory();
    }
  }, [currentNote?.path]);

  const loadHistory = async () => {
    if (!currentNote) return;

    setIsLoading(true);
    setError(null);

    try {
      const history = await invoke<NoteVersion[]>("git_note_history", {
        notePath: currentNote.path,
      });
      setVersions(history);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersionContent = async (version: NoteVersion) => {
    if (!currentNote) return;

    setSelectedVersion(version);
    setVersionContent(null);

    try {
      const content = await invoke<string>("git_note_at_commit", {
        notePath: currentNote.path,
        commitHash: version.commitHash,
      });
      setVersionContent(content);
    } catch (err) {
      setError(String(err));
    }
  };

  const restoreVersion = async (version: NoteVersion) => {
    if (!currentNote) return;

    setIsRestoring(true);
    setError(null);

    try {
      await invoke("git_restore_note_version", {
        notePath: currentNote.path,
        commitHash: version.commitHash,
      });

      // Refresh the note and notes list
      await loadNotes();
      await openNote(currentNote.path);

      // Show success and close
      setSelectedVersion(null);
      setVersionContent(null);
      await loadHistory();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  if (!currentNote) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-dark-900 border-l border-dark-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-primary/10 rounded-lg text-accent-primary">
              <HistoryIcon />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-100">Version History</h2>
              <p className="text-sm text-dark-500 truncate max-w-xs">
                {currentNote.title}
              </p>
            </div>
          </div>
          <button
            className="btn-icon text-dark-400 hover:text-dark-200"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Version list */}
          <div className="w-1/2 border-r border-dark-800 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent-primary border-t-transparent" />
              </div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-dark-500 mb-2">No version history</div>
                <p className="text-xs text-dark-600">
                  This note hasn't been committed to git yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-dark-800">
                {versions.map((version, index) => (
                  <button
                    key={version.commitHash}
                    className={`w-full text-left p-4 transition-colors ${
                      selectedVersion?.commitHash === version.commitHash
                        ? "bg-accent-primary/10"
                        : "hover:bg-dark-850"
                    }`}
                    onClick={() => loadVersionContent(version)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-mono text-accent-primary">
                        {version.shortHash}
                      </span>
                      <span className="text-xs text-dark-500">
                        {formatDate(version.date)}
                      </span>
                    </div>
                    <p className="text-sm text-dark-200 line-clamp-2">
                      {version.message || "(No message)"}
                    </p>
                    <p className="text-xs text-dark-500 mt-1">
                      by {version.author}
                    </p>
                    {index === 0 && (
                      <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-accent-success/20 text-accent-success rounded">
                        Current
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Version preview */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            {selectedVersion ? (
              <>
                {/* Version header */}
                <div className="p-4 border-b border-dark-800 bg-dark-850">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-accent-primary">
                      {selectedVersion.shortHash}
                    </span>
                    {versions[0]?.commitHash !== selectedVersion.commitHash && (
                      <button
                        className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                        onClick={() => restoreVersion(selectedVersion)}
                        disabled={isRestoring}
                      >
                        <RestoreIcon />
                        {isRestoring ? "Restoring..." : "Restore this version"}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-dark-300">{selectedVersion.message}</p>
                  <p className="text-xs text-dark-500 mt-1">
                    {formatDate(selectedVersion.date)} by {selectedVersion.author}
                  </p>
                </div>

                {/* Content or diff */}
                <div className="flex-1 overflow-y-auto">
                  {versionContent !== null ? (
                    <NoteDiff
                      oldContent={versionContent}
                      newContent={currentNote.content}
                      oldLabel={`${selectedVersion.shortHash}`}
                      newLabel="Current"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent-primary border-t-transparent" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-dark-500">
                <div className="text-center">
                  <EyeIcon />
                  <p className="mt-2 text-sm">Select a version to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
