import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore } from "@/stores/noteStore";
import { useUIStore } from "@/stores/uiStore";
import clsx from "clsx";

// Version info from backend
interface NoteVersionInfo {
  id: number;
  note_id: string;
  created_at: number;
  trigger: string;
  label: string | null;
  content_preview: string;
}

// Icons
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RestoreIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const PreviewIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const SnapshotIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function getTriggerLabel(trigger: string): { label: string; color: string } {
  switch (trigger) {
    case "save":
      return { label: "Auto-saved", color: "text-blue-400" };
    case "manual":
      return { label: "Snapshot", color: "text-green-400" };
    case "auto":
      return { label: "Before restore", color: "text-yellow-400" };
    default:
      return { label: trigger, color: "text-dark-400" };
  }
}

interface VersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VersionHistory({ isOpen, onClose }: VersionHistoryProps) {
  const { currentNote, openNote, loadNotes } = useNoteStore();
  const { showConfirmDialog } = useUIStore();

  const [versions, setVersions] = useState<NoteVersionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<NoteVersionInfo | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  // Load versions when modal opens
  useEffect(() => {
    if (isOpen && currentNote) {
      loadVersions();
    }
  }, [isOpen, currentNote?.path]);

  const loadVersions = async () => {
    if (!currentNote) return;

    setIsLoading(true);
    try {
      const result = await invoke<NoteVersionInfo[]>("get_note_versions", {
        path: currentNote.path,
      });
      setVersions(result);
    } catch (err) {
      console.error("Failed to load versions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreview = async (version: NoteVersionInfo) => {
    setSelectedVersion(version);
    setIsLoadingPreview(true);
    try {
      const content = await invoke<string | null>("get_version_content", {
        versionId: version.id,
      });
      setPreviewContent(content);
    } catch (err) {
      console.error("Failed to load version content:", err);
      setPreviewContent(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRestore = useCallback(
    (version: NoteVersionInfo) => {
      if (!currentNote) return;

      showConfirmDialog({
        title: "Restore Version",
        message: `Are you sure you want to restore this version from ${formatTimestamp(version.created_at)}? Your current content will be saved as a new version first.`,
        confirmText: "Restore",
        cancelText: "Cancel",
        variant: "warning",
        onConfirm: async () => {
          try {
            await invoke("restore_note_version", {
              path: currentNote.path,
              versionId: version.id,
            });
            // Reload the note to show restored content
            await openNote(currentNote.path);
            await loadNotes();
            // Reload versions to show the new "before restore" version
            await loadVersions();
            setSelectedVersion(null);
            setPreviewContent(null);
          } catch (err) {
            console.error("Failed to restore version:", err);
          }
        },
      });
    },
    [currentNote, showConfirmDialog, openNote, loadNotes]
  );

  const handleCreateSnapshot = async () => {
    if (!currentNote) return;

    setIsCreatingSnapshot(true);
    try {
      await invoke("create_note_snapshot", {
        path: currentNote.path,
        label: snapshotLabel || null,
      });
      setSnapshotLabel("");
      await loadVersions();
    } catch (err) {
      console.error("Failed to create snapshot:", err);
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewContent !== null) {
          setPreviewContent(null);
          setSelectedVersion(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, previewContent, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <HistoryIcon />
            <h2 className="text-lg font-semibold text-dark-100">
              Version History
            </h2>
            {currentNote && (
              <span className="text-sm text-dark-400">
                — {currentNote.title}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-dark-200 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Version List */}
          <div className="w-80 border-r border-dark-700 flex flex-col">
            {/* Create Snapshot */}
            <div className="p-4 border-b border-dark-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Snapshot label (optional)"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSnapshot();
                  }}
                  className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-primary"
                />
                <button
                  onClick={handleCreateSnapshot}
                  disabled={isCreatingSnapshot}
                  className="px-3 py-2 bg-accent-primary text-dark-950 rounded-lg text-sm font-medium hover:bg-accent-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  <SnapshotIcon />
                  {isCreatingSnapshot ? "..." : "Save"}
                </button>
              </div>
            </div>

            {/* Version List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-dark-500">
                  Loading versions...
                </div>
              ) : versions.length === 0 ? (
                <div className="p-8 text-center text-dark-500">
                  <p>No versions yet.</p>
                  <p className="text-sm mt-2">
                    Versions are created automatically when you save.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-dark-800">
                  {versions.map((version) => {
                    const triggerInfo = getTriggerLabel(version.trigger);
                    const isSelected = selectedVersion?.id === version.id;

                    return (
                      <div
                        key={version.id}
                        className={clsx(
                          "p-4 cursor-pointer transition-colors",
                          isSelected
                            ? "bg-dark-800"
                            : "hover:bg-dark-850"
                        )}
                        onClick={() => loadPreview(version)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-dark-200">
                            {formatTimestamp(version.created_at)}
                          </span>
                          <span className={clsx("text-xs", triggerInfo.color)}>
                            {triggerInfo.label}
                          </span>
                        </div>
                        {version.label && (
                          <div className="text-sm text-accent-primary mb-1">
                            {version.label}
                          </div>
                        )}
                        <div className="text-xs text-dark-500 line-clamp-2">
                          {version.content_preview}...
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Preview Pane */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedVersion ? (
              <>
                {/* Preview Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-dark-700 bg-dark-850">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-dark-300">
                      Version from{" "}
                      <span className="text-dark-100 font-medium">
                        {formatTimestamp(selectedVersion.created_at)}
                      </span>
                    </span>
                    {selectedVersion.label && (
                      <span className="px-2 py-0.5 bg-accent-primary/20 text-accent-primary text-xs rounded">
                        {selectedVersion.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRestore(selectedVersion)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors"
                  >
                    <RestoreIcon />
                    Restore this version
                  </button>
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-auto p-6">
                  {isLoadingPreview ? (
                    <div className="text-center text-dark-500 py-8">
                      Loading preview...
                    </div>
                  ) : previewContent ? (
                    <pre className="font-mono text-sm text-dark-300 whitespace-pre-wrap">
                      {previewContent}
                    </pre>
                  ) : (
                    <div className="text-center text-dark-500 py-8">
                      Failed to load preview
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-dark-500">
                <div className="text-center">
                  <PreviewIcon />
                  <p className="mt-2">Select a version to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export a hook to manage the version history modal state
export function useVersionHistory() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}
