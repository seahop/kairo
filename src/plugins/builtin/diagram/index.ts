import { registerPlugin, registerCommand } from "@/plugins/api";
import { useDiagramStore } from "./store";

export { DiagramEditor } from "./DiagramEditor";
export { DiagramSidebar } from "./DiagramSidebar";
export { useDiagramStore } from "./store";

export function initDiagramPlugin() {
  registerPlugin({
    manifest: {
      id: "kairo-diagram",
      name: "Diagram Editor",
      version: "1.0.0",
      description: "Create flowcharts, network diagrams, and visual documentation",
    },
    enabled: true,
    initialize: () => {
      // Register commands
      registerCommand({
        id: "diagram.create",
        name: "Diagram: Create New",
        description: "Create a new diagram",
        category: "Diagram",
        execute: () => useDiagramStore.getState().openCreateModal(),
      });

      registerCommand({
        id: "diagram.open",
        name: "Diagram: Open Editor",
        description: "Open diagram editor view",
        shortcut: "Ctrl+Shift+D",
        category: "Diagram",
        execute: () => useDiagramStore.getState().toggleView(),
      });

      // Load boards on init
      useDiagramStore.getState().loadBoards();
    },
  });
}
