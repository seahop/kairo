import { registerPlugin, registerCommand } from "@/plugins/api";
import { useKanbanStore } from "./store";

export { KanbanBoard } from "./KanbanBoard";
export { KanbanSidebar } from "./KanbanSidebar";
export { useKanbanStore } from "./store";

export function initKanbanPlugin() {
  registerPlugin({
    manifest: {
      id: "kairo-kanban",
      name: "Kanban Boards",
      version: "1.0.0",
      description: "Visual kanban boards for task management",
    },
    enabled: true,
    initialize: () => {
      // Register commands
      registerCommand({
        id: "kanban.create",
        name: "Kanban: Create Board",
        description: "Create a new kanban board",
        category: "Kanban",
        execute: () => useKanbanStore.getState().openCreateModal(),
      });

      registerCommand({
        id: "kanban.open",
        name: "Kanban: Open Board",
        description: "Open kanban board view",
        shortcut: "Ctrl+Shift+K",
        category: "Kanban",
        execute: () => useKanbanStore.getState().toggleView(),
      });

      // Load boards on init
      useKanbanStore.getState().loadBoards();
    },
  });
}
