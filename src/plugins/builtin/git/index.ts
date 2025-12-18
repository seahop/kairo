import { registerPlugin, registerCommand, registerHook } from "@/plugins/api";
import { useGitStore } from "./store";

export { GitStatusBar } from "./GitStatusBar";
export { GitModal } from "./GitModal";
export { GitPassphraseModal } from "./GitPassphraseModal";
export { useGitStore } from "./store";

export function initGitPlugin() {
  registerPlugin({
    manifest: {
      id: "kairo-git",
      name: "Git Sync",
      version: "1.0.0",
      description: "Git integration for syncing your vault",
    },
    enabled: true,
    initialize: () => {
      const { checkStatus } = useGitStore.getState();

      // Register commands
      registerCommand({
        id: "git.pull",
        name: "Git: Pull",
        description: "Pull changes from remote",
        shortcut: "Ctrl+Shift+P",
        category: "Git",
        execute: () => useGitStore.getState().pull(),
      });

      registerCommand({
        id: "git.commit",
        name: "Git: Commit",
        description: "Commit staged changes",
        shortcut: "Ctrl+Shift+C",
        category: "Git",
        execute: () => useGitStore.getState().openCommitModal(),
      });

      registerCommand({
        id: "git.push",
        name: "Git: Push",
        description: "Push changes to remote",
        shortcut: "Ctrl+Shift+U",
        category: "Git",
        execute: () => useGitStore.getState().push(),
      });

      registerCommand({
        id: "git.status",
        name: "Git: Show Status",
        description: "Show git status",
        category: "Git",
        execute: () => checkStatus(),
      });

      registerCommand({
        id: "git.stageAll",
        name: "Git: Stage All Changes",
        description: "Stage all modified files",
        category: "Git",
        execute: () => useGitStore.getState().stageAll(),
      });

      registerCommand({
        id: "git.settings",
        name: "Git: Settings",
        description: "Configure SSH keys and git identity",
        category: "Git",
        execute: () => useGitStore.getState().openSettings(),
      });

      // Check status on init
      checkStatus();

      // Refresh git status when notes are saved
      registerHook("onNoteSave", () => {
        checkStatus();
      }, "kairo-git");

      // Also refresh on note create/delete
      registerHook("onNoteCreate", () => {
        checkStatus();
      }, "kairo-git");

      registerHook("onNoteDelete", () => {
        checkStatus();
      }, "kairo-git");
    },
  });
}
