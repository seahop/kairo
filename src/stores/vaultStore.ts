import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface VaultInfo {
  path: string;
  name: string;
  note_count: number;
  created_at: number | null;
}

interface VaultState {
  vault: VaultInfo | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  openVault: (path: string) => Promise<void>;
  createVault: (path: string, name: string) => Promise<void>;
  closeVault: () => Promise<void>;
  refreshVaultInfo: () => Promise<void>;
}

export const useVaultStore = create<VaultState>((set) => ({
  vault: null,
  isLoading: false,
  error: null,

  openVault: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const vault = await invoke<VaultInfo>("open_vault", { path });
      set({ vault, isLoading: false });

      // Store in localStorage for auto-open on next launch
      localStorage.setItem("kairo:lastVault", path);
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  createVault: async (path: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const vault = await invoke<VaultInfo>("create_vault", { path, name });
      set({ vault, isLoading: false });

      // Store in localStorage
      localStorage.setItem("kairo:lastVault", path);
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  closeVault: async () => {
    try {
      await invoke("close_vault");
      set({ vault: null });
      localStorage.removeItem("kairo:lastVault");
    } catch (error) {
      set({ error: String(error) });
    }
  },

  refreshVaultInfo: async () => {
    try {
      const vault = await invoke<VaultInfo | null>("get_vault_info");
      if (vault) {
        set({ vault });
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },
}));
