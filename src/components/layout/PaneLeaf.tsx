import { useCallback } from "react";
import { usePaneStore, PaneLeaf as PaneLeafType } from "@/stores/paneStore";
import { Editor } from "@/components/editor/Editor";
import { BacklinksPanel } from "@/components/editor/BacklinksPanel";
import { PaneEmptyState } from "./PaneEmptyState";

interface PaneLeafProps {
  pane: PaneLeafType;
}

export function PaneLeaf({ pane }: PaneLeafProps) {
  const activePaneId = usePaneStore((s) => s.activePaneId);
  const setActivePane = usePaneStore((s) => s.setActivePane);
  const openNoteInPane = usePaneStore((s) => s.openNoteInPane);
  const isActive = activePaneId === pane.id;

  const handleFocus = useCallback(() => {
    if (!isActive) {
      setActivePane(pane.id);
    }
  }, [isActive, pane.id, setActivePane]);

  const handleClick = useCallback(() => {
    if (!isActive) {
      setActivePane(pane.id);
    }
  }, [isActive, pane.id, setActivePane]);

  // Open a note in this pane (for backlinks)
  const handleOpenNote = useCallback((path: string) => {
    openNoteInPane(pane.id, path);
  }, [openNoteInPane, pane.id]);

  // Empty pane
  if (!pane.notePath || !pane.note) {
    return (
      <div
        className={`h-full bg-dark-950 transition-colors ${
          isActive ? "ring-1 ring-inset ring-accent-primary/50" : ""
        }`}
        onClick={handleClick}
      >
        <PaneEmptyState paneId={pane.id} />
      </div>
    );
  }

  // Pane with note
  return (
    <div
      className={`h-full flex flex-col overflow-hidden bg-dark-950 transition-colors ${
        isActive ? "ring-1 ring-inset ring-accent-primary/50" : ""
      }`}
      onClick={handleClick}
      onFocus={handleFocus}
    >
      {/* Note header */}
      <div className="px-6 py-4 border-b border-dark-800 flex-shrink-0">
        <h1 className="text-xl font-semibold text-dark-100">{pane.note.title}</h1>
        <div className="flex items-center gap-4 mt-1 text-sm text-dark-500">
          <span>{pane.note.path}</span>
          <span>
            Modified: {new Date(pane.note.modified_at * 1000).toLocaleDateString()}
          </span>
          {pane.hasUnsavedChanges && (
            <span className="text-yellow-500">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor paneId={pane.id} />
      </div>

      {/* Backlinks Panel */}
      <BacklinksPanel notePath={pane.notePath} onOpenNote={handleOpenNote} />
    </div>
  );
}
