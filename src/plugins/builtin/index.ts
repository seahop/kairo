// Built-in plugins initialization with lazy loading for heavy components
import { lazy } from "react";

import { initGitPlugin } from "./git";
import { initKanbanPlugin } from "./kanban";
import { initDiagramPlugin } from "./diagram";
import { initDailyNotesPlugin } from "./daily-notes";
import { initTemplatesPlugin } from "./templates";
import { initSnippetsPlugin } from "./snippets";
import { initGraphPlugin } from "./graph";

export function initBuiltinPlugins() {
  // Initialize all built-in plugins
  // This registers commands but doesn't load heavy components yet
  initGitPlugin();
  initKanbanPlugin();
  initDiagramPlugin();
  initDailyNotesPlugin();
  initTemplatesPlugin();
  initSnippetsPlugin();
  initGraphPlugin();

  console.log("Built-in plugins initialized");
}

// Re-export lightweight plugin components and stores
// Git components are used frequently, so we don't lazy load them
export { GitStatusBar, GitModal, GitPassphraseModal, useGitStore } from "./git";

// Templates and snippets are relatively small, keep them eager
export { TemplateModal, useTemplateStore } from "./templates";
export { SnippetModal, useSnippetStore } from "./snippets";

// Export stores - these are always needed for commands to work
export { useKanbanStore } from "./kanban";
export { useDiagramStore } from "./diagram";
export { useGraphStore } from "./graph";

// Lazy load heavy components that are used less frequently
// These only load when first rendered, reducing initial bundle size

// Kanban board with full drag-and-drop functionality
export const KanbanBoard = lazy(() =>
  import("./kanban/KanbanBoard").then((mod) => ({ default: mod.KanbanBoard }))
);

// Kanban sidebar (also lazy since it's part of kanban feature)
export const KanbanSidebar = lazy(() =>
  import("./kanban/KanbanSidebar").then((mod) => ({ default: mod.KanbanSidebar }))
);

// Diagram editor with react-flow
export const DiagramEditor = lazy(() =>
  import("./diagram/DiagramEditor").then((mod) => ({ default: mod.DiagramEditor }))
);

// Diagram sidebar (also lazy since it's part of diagram feature)
export const DiagramSidebar = lazy(() =>
  import("./diagram/DiagramSidebar").then((mod) => ({ default: mod.DiagramSidebar }))
);

// Graph visualization with d3-force
export const GraphView = lazy(() =>
  import("./graph/GraphView").then((mod) => ({ default: mod.GraphView }))
);

// Graph panel wrapping GraphView
export const GraphViewPanel = lazy(() =>
  import("./graph/GraphView").then((mod) => ({ default: mod.GraphViewPanel }))
);
