import { useNoteStore } from "@/stores/noteStore";
import { useUIStore } from "@/stores/uiStore";
import { Editor } from "@/components/editor/Editor";
import { BacklinksPanel } from "@/components/editor/BacklinksPanel";
import { GraphViewPanel } from "@/plugins/builtin";
import { VaultHealthPanel } from "@/components/vault/VaultHealthPanel";

const EmptyState = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center">
      <div className="text-6xl mb-4">📝</div>
      <h2 className="text-xl font-semibold text-dark-200 mb-2">No note selected</h2>
      <p className="text-dark-500">
        Select a note from the sidebar or create a new one
      </p>
      <div className="mt-4 text-sm text-dark-600">
        <kbd className="px-2 py-1 bg-dark-800 rounded">Ctrl+K</kbd> to search
      </div>
    </div>
  </div>
);

function NotesView() {
  const { currentNote } = useNoteStore();

  if (!currentNote) {
    return (
      <div className="flex-1 bg-dark-950">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-dark-950 flex flex-col overflow-hidden">
      {/* Note header */}
      <div className="px-6 py-4 border-b border-dark-800">
        <h1 className="text-xl font-semibold text-dark-100">{currentNote.title}</h1>
        <div className="flex items-center gap-4 mt-1 text-sm text-dark-500">
          <span>{currentNote.path}</span>
          <span>
            Modified: {new Date(currentNote.modified_at * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor />
      </div>

      {/* Backlinks Panel */}
      <BacklinksPanel />
    </div>
  );
}

export function MainPanel() {
  const { mainViewMode, setMainViewMode } = useUIStore();

  if (mainViewMode === "graph") {
    return <GraphViewPanel />;
  }

  if (mainViewMode === "vault-health") {
    return (
      <div className="flex-1 bg-dark-950">
        <VaultHealthPanel onClose={() => setMainViewMode("notes")} />
      </div>
    );
  }

  return <NotesView />;
}
