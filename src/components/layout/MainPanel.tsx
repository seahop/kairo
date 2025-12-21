import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useNoteStore } from "@/stores/noteStore";
import { useUIStore } from "@/stores/uiStore";
import { Editor } from "@/components/editor/Editor";
import { BacklinksPanel } from "@/components/editor/BacklinksPanel";
import { PreviewPane } from "@/components/editor/PreviewPane";
import { GraphViewPanel } from "@/plugins/builtin";
import { VaultHealthPanel } from "@/components/vault/VaultHealthPanel";
import { SidePane } from "./SidePane";
import { TabBar } from "./TabBar";

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

// Primary note pane with full editor
function PrimaryNotePane() {
  const { currentNote } = useNoteStore();

  if (!currentNote) {
    return <EmptyState />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
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

// Secondary note pane (preview only, with option to swap or close)
function SecondaryNotePane() {
  const {
    secondaryNote,
    secondaryEditorContent,
    closeSecondaryNote,
    openNote,
    swapPanes,
    isSecondaryLoading,
  } = useNoteStore();

  if (!secondaryNote) {
    return (
      <div className="h-full flex items-center justify-center text-dark-500">
        {isSecondaryLoading ? 'Loading...' : 'No note in secondary pane'}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-800 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="font-medium text-dark-100 truncate">{secondaryNote.title}</h2>
          <p className="text-xs text-dark-500 truncate">{secondaryNote.path}</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
            onClick={swapPanes}
            title="Swap panes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button
            className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
            onClick={() => openNote(secondaryNote.path)}
            title="Open in primary pane"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
            onClick={closeSecondaryNote}
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {/* Preview */}
      <div className="flex-1 overflow-auto">
        <PreviewPane content={secondaryEditorContent} />
      </div>
    </div>
  );
}

// Main content area (notes with optional secondary pane)
function NotesContentArea() {
  const { currentNote, secondaryNote } = useNoteStore();

  // If neither note is open, show empty state
  if (!currentNote && !secondaryNote) {
    return <EmptyState />;
  }

  // If only primary note is open, show simple view
  if (!secondaryNote) {
    return <PrimaryNotePane />;
  }

  // Both panes - show split view
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={50} minSize={30}>
        <div className="h-full border-r border-dark-800">
          <PrimaryNotePane />
        </div>
      </Panel>
      <PanelResizeHandle className="w-1 bg-dark-800 hover:bg-accent-primary transition-colors cursor-col-resize" />
      <Panel defaultSize={50} minSize={20}>
        <SecondaryNotePane />
      </Panel>
    </PanelGroup>
  );
}

function NotesView() {
  const { sidePaneContent } = useUIStore();

  // If side pane is open, show with resizable panel
  if (sidePaneContent) {
    return (
      <div className="h-full bg-dark-950 overflow-hidden flex flex-col">
        {/* Tab bar at the top */}
        <TabBar />

        {/* Content area with side pane */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={70} minSize={40}>
              <NotesContentArea />
            </Panel>
            <PanelResizeHandle className="w-1 bg-dark-700 hover:bg-accent-primary transition-colors cursor-col-resize" />
            <Panel defaultSize={30} minSize={15} maxSize={50}>
              <SidePane />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    );
  }

  // No side pane
  return (
    <div className="h-full bg-dark-950 overflow-hidden flex flex-col">
      {/* Tab bar at the top */}
      <TabBar />

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        <NotesContentArea />
      </div>
    </div>
  );
}

export function MainPanel() {
  const { mainViewMode, setMainViewMode } = useUIStore();

  if (mainViewMode === "graph") {
    return (
      <div className="h-full">
        <GraphViewPanel />
      </div>
    );
  }

  if (mainViewMode === "vault-health") {
    return (
      <div className="h-full bg-dark-950">
        <VaultHealthPanel onClose={() => setMainViewMode("notes")} />
      </div>
    );
  }

  return <NotesView />;
}
