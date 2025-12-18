import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "@/components/common/Toast";

export interface GitStatus {
  isRepo: boolean;
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  hasRemote: boolean;
}

// Error type from backend
interface GitError {
  type: string;
  keyPath?: string;
  message?: string;
}

export type GitModalTab = "changes" | "settings";
export type GitModalMode = "commit" | "settings";

interface GitState {
  status: GitStatus | null;
  isLoading: boolean;
  error: string | null;
  showCommitModal: boolean;
  modalMode: GitModalMode;
  commitMessage: string;

  // Passphrase modal state
  passphraseRequired: boolean;
  pendingKeyPath: string | null;
  pendingOperation: ((passphrase: string) => Promise<void>) | null;

  // Actions
  checkStatus: () => Promise<void>;
  pull: (passphrase?: string) => Promise<void>;
  push: (passphrase?: string) => Promise<void>;
  stageAll: () => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  commit: (message: string) => Promise<void>;
  commitAndPush: (message: string, passphrase?: string) => Promise<void>;
  openCommitModal: () => void;
  openSettings: () => void;
  closeCommitModal: () => void;
  setCommitMessage: (message: string) => void;

  // Passphrase handling
  submitPassphrase: (passphrase: string, remember: boolean) => Promise<void>;
  cancelPassphrase: () => void;
}

function parseGitError(error: unknown): GitError | null {
  try {
    const errorStr = String(error);
    // Try to parse as JSON (backend sends structured errors)
    const parsed = JSON.parse(errorStr);
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return parsed as GitError;
    }
  } catch {
    // Not a JSON error
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  const gitError = parseGitError(error);
  if (gitError) {
    return gitError.message || gitError.type;
  }
  return String(error);
}

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  isLoading: false,
  error: null,
  showCommitModal: false,
  modalMode: "commit" as GitModalMode,
  commitMessage: "",

  // Passphrase state
  passphraseRequired: false,
  pendingKeyPath: null,
  pendingOperation: null,

  checkStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await invoke<GitStatus>("git_status");
      set({ status, isLoading: false });
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  pull: async (passphrase?: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke<string>("git_pull", { passphrase });
      await get().checkStatus();
      set({ isLoading: false });
      toast.success("Pull successful", result);
    } catch (error) {
      const gitError = parseGitError(error);

      // Check if passphrase is required
      if (gitError?.type === "passphraseRequired" && gitError.keyPath) {
        set({
          passphraseRequired: true,
          pendingKeyPath: gitError.keyPath,
          pendingOperation: (p: string) => get().pull(p),
          isLoading: false,
        });
        return;
      }

      const errorMsg = getErrorMessage(error);
      set({ error: errorMsg, isLoading: false });
      toast.error("Pull failed", errorMsg);
    }
  },

  push: async (passphrase?: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke<string>("git_push", { passphrase });
      await get().checkStatus();
      set({ isLoading: false });
      toast.success("Push successful", result);
    } catch (error) {
      const gitError = parseGitError(error);

      // Check if passphrase is required
      if (gitError?.type === "passphraseRequired" && gitError.keyPath) {
        set({
          passphraseRequired: true,
          pendingKeyPath: gitError.keyPath,
          pendingOperation: (p: string) => get().push(p),
          isLoading: false,
        });
        return;
      }

      const errorMsg = getErrorMessage(error);
      set({ error: errorMsg, isLoading: false });
      toast.error("Push failed", errorMsg);
    }
  },

  stageAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("git_stage_all");
      await get().checkStatus();
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  stageFile: async (path: string) => {
    try {
      await invoke("git_stage_file", { path });
      await get().checkStatus();
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }
  },

  unstageFile: async (path: string) => {
    try {
      await invoke("git_unstage_file", { path });
      await get().checkStatus();
    } catch (error) {
      set({ error: getErrorMessage(error) });
    }
  },

  commit: async (message: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke<string>("git_commit", { message });
      set({ showCommitModal: false, commitMessage: "", isLoading: false });
      await get().checkStatus();
      toast.success("Commit successful", result);
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      set({ error: errorMsg, isLoading: false });
      toast.error("Commit failed", errorMsg);
    }
  },

  commitAndPush: async (message: string, passphrase?: string) => {
    set({ isLoading: true, error: null });
    try {
      // First commit
      await invoke<string>("git_commit", { message });
      set({ commitMessage: "" });

      // Then push
      const pushResult = await invoke<string>("git_push", { passphrase });
      set({ showCommitModal: false, isLoading: false });
      await get().checkStatus();
      toast.success("Commit & push successful", pushResult);
    } catch (error) {
      const gitError = parseGitError(error);

      // Check if passphrase is required for push
      if (gitError?.type === "passphraseRequired" && gitError.keyPath) {
        set({
          passphraseRequired: true,
          pendingKeyPath: gitError.keyPath,
          pendingOperation: (p: string) => get().push(p),
          isLoading: false,
        });
        // Commit succeeded, just need passphrase for push
        await get().checkStatus();
        toast.success("Commit successful", "Enter passphrase to push");
        return;
      }

      const errorMsg = getErrorMessage(error);
      set({ error: errorMsg, isLoading: false });
      toast.error("Operation failed", errorMsg);
    }
  },

  openCommitModal: () => set({ showCommitModal: true, modalMode: "commit" }),
  openSettings: () => set({ showCommitModal: true, modalMode: "settings" }),
  closeCommitModal: () => set({ showCommitModal: false, commitMessage: "", modalMode: "commit" }),
  setCommitMessage: (message: string) => set({ commitMessage: message }),

  submitPassphrase: async (passphrase: string, remember: boolean) => {
    const { pendingKeyPath, pendingOperation } = get();

    if (!pendingKeyPath) return;

    try {
      // Store passphrase for session if requested (for future operations)
      if (remember) {
        await invoke("git_set_session_passphrase", {
          keyPath: pendingKeyPath,
          passphrase,
        });
      }

      // Clear passphrase modal state
      set({
        passphraseRequired: false,
        pendingKeyPath: null,
        pendingOperation: null,
      });

      // Retry the operation with the passphrase
      if (pendingOperation) {
        set({ isLoading: true });
        await pendingOperation(passphrase);
      }
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false });
    }
  },

  cancelPassphrase: () => {
    set({
      passphraseRequired: false,
      pendingKeyPath: null,
      pendingOperation: null,
      isLoading: false,
    });
  },
}));
