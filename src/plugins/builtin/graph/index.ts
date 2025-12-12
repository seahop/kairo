import { registerPlugin, registerCommand } from "@/plugins/api";
import { useGraphStore } from "./store";
import { useUIStore } from "@/stores/uiStore";

export { GraphView, GraphViewPanel } from "./GraphView";
export { useGraphStore } from "./store";

export function initGraphPlugin() {
  registerPlugin({
    manifest: {
      id: "kairo-graph",
      name: "Graph View",
      version: "1.0.0",
      description: "Visualize connections between notes",
    },
    enabled: true,
    initialize: () => {
      // Register commands
      registerCommand({
        id: "graph.open",
        name: "Graph: Open Graph View",
        description: "Open the note relationship graph",
        shortcut: "Ctrl+Shift+G",
        category: "Graph",
        execute: () => {
          const graphStore = useGraphStore.getState();
          const uiStore = useUIStore.getState();
          graphStore.setViewMode("global");
          uiStore.setMainViewMode("graph");
        },
      });

      registerCommand({
        id: "graph.openLocal",
        name: "Graph: Show Local Graph",
        description: "Show graph centered on current note",
        shortcut: "Ctrl+G",
        category: "Graph",
        execute: () => {
          const graphStore = useGraphStore.getState();
          const uiStore = useUIStore.getState();
          graphStore.setViewMode("local");
          uiStore.setMainViewMode("graph");
        },
      });

      registerCommand({
        id: "graph.refresh",
        name: "Graph: Refresh Graph Data",
        description: "Reload graph data from database",
        category: "Graph",
        execute: () => useGraphStore.getState().loadGraphData(),
      });

      registerCommand({
        id: "graph.backToNotes",
        name: "Graph: Back to Notes",
        description: "Return to notes view",
        shortcut: "Escape",
        category: "Graph",
        execute: () => {
          const uiStore = useUIStore.getState();
          if (uiStore.mainViewMode === "graph") {
            uiStore.setMainViewMode("notes");
          }
        },
      });
    },
  });
}
