import { useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { usePaneStore } from "@/stores/paneStore";
import { useUIStore } from "@/stores/uiStore";
import { GraphViewPanel } from "@/plugins/builtin";
import { VaultHealthPanel } from "@/components/vault/VaultHealthPanel";
import { SidePane } from "./SidePane";
import { TabBar } from "./TabBar";
import { PaneContainer } from "./PaneContainer";

// Fallback empty state when pane system is not initialized
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

// Main content area using the new pane system
function PaneContentArea() {
  const root = usePaneStore((s) => s.root);
  const initializePane = usePaneStore((s) => s.initializePane);

  // Initialize pane system if not already done
  useEffect(() => {
    if (!root) {
      initializePane();
    }
  }, [root, initializePane]);

  if (!root) {
    return <EmptyState />;
  }

  return <PaneContainer node={root} />;
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
              <PaneContentArea />
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
        <PaneContentArea />
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
