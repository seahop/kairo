import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

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

interface GitState {
  status: GitStatus | null;
  isLoading: boolean;
  error: string | null;
  showCommitModal: boolean;
  commitMessage: string;

  // Actions
  checkStatus: () => Promise<void>;
  pull: () => Promise<void>;
  push: () => Promise<void>;
  stageAll: () => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  commit: (message: string) => Promise<void>;
  openCommitModal: () => void;
  closeCommitModal: () => void;
  setCommitMessage: (message: string) => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  status: null,
  isLoading: false,
  error: null,
  showCommitModal: false,
  commitMessage: "",

  checkStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await invoke<GitStatus>("git_status");
      set({ status, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  pull: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("git_pull");
      await get().checkStatus();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  push: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("git_push");
      await get().checkStatus();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  stageAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("git_stage_all");
      await get().checkStatus();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  stageFile: async (path: string) => {
    try {
      await invoke("git_stage_file", { path });
      await get().checkStatus();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  unstageFile: async (path: string) => {
    try {
      await invoke("git_unstage_file", { path });
      await get().checkStatus();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  commit: async (message: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("git_commit", { message });
      set({ showCommitModal: false, commitMessage: "" });
      await get().checkStatus();
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  openCommitModal: () => set({ showCommitModal: true }),
  closeCommitModal: () => set({ showCommitModal: false, commitMessage: "" }),
  setCommitMessage: (message: string) => set({ commitMessage: message }),
}));
