// Built-in plugins initialization

import { initGitPlugin } from "./git";
import { initKanbanPlugin } from "./kanban";
import { initDiagramPlugin } from "./diagram";
import { initDailyNotesPlugin } from "./daily-notes";
import { initTemplatesPlugin } from "./templates";
import { initSnippetsPlugin } from "./snippets";
import { initGraphPlugin } from "./graph";

export function initBuiltinPlugins() {
  // Initialize all built-in plugins
  initGitPlugin();
  initKanbanPlugin();
  initDiagramPlugin();
  initDailyNotesPlugin();
  initTemplatesPlugin();
  initSnippetsPlugin();
  initGraphPlugin();

  console.log("Built-in plugins initialized");
}

// Re-export plugin components
export { GitStatusBar, GitModal, useGitStore } from "./git";
export { KanbanBoard, KanbanSidebar, useKanbanStore } from "./kanban";
export { DiagramEditor, DiagramSidebar, useDiagramStore } from "./diagram";
export { TemplateModal, useTemplateStore } from "./templates";
export { SnippetModal, useSnippetStore } from "./snippets";
export { GraphView, GraphViewPanel, useGraphStore } from "./graph";
