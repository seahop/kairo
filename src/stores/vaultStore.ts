import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { triggerHook } from "@/plugins/api/hooks";

export interface VaultInfo {
  path: string;
  name: string;
  note_count: number;
  created_at: number | null;
}

export interface RecentVault {
  path: string;
  name: string;
  lastOpened: number;
}

interface VaultState {
  vault: VaultInfo | null;
  recentVaults: RecentVault[];
  isLoading: boolean;
  error: string | null;

  // Actions
  openVault: (path: string) => Promise<void>;
  createVault: (path: string, name: string) => Promise<void>;
  closeVault: () => Promise<void>;
  refreshVaultInfo: () => Promise<void>;
  loadRecentVaults: () => Promise<void>;
  tryOpenLastVault: () => Promise<boolean>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vault: null,
  recentVaults: [],
  isLoading: false,
  error: null,

  loadRecentVaults: async () => {
    try {
      const recent = await invoke<RecentVault[]>("get_recent_vaults");
      set({ recentVaults: recent });
    } catch (error) {
      console.error("Failed to load recent vaults:", error);
      set({ recentVaults: [] });
    }
  },

  tryOpenLastVault: async () => {
    try {
      const lastPath = await invoke<string | null>("get_last_vault");
      if (!lastPath) return false;

      await get().openVault(lastPath);
      return true;
    } catch {
      // Vault doesn't exist anymore or failed to open
      return false;
    }
  },

  openVault: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const vault = await invoke<VaultInfo>("open_vault", { path });
      set({ vault, isLoading: false });

      // Add to recent vaults (stored in ~/.kairo/settings.json)
      const recentVaults = await invoke<RecentVault[]>("add_recent_vault", {
        path: vault.path,
        name: vault.name,
      });
      set({ recentVaults });

      // Trigger hook for extensions
      triggerHook("onVaultOpen", { vault, path });
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

      // Add to recent vaults (stored in ~/.kairo/settings.json)
      const recentVaults = await invoke<RecentVault[]>("add_recent_vault", {
        path: vault.path,
        name: vault.name,
      });
      set({ recentVaults });

      // Trigger hook for extensions
      triggerHook("onVaultOpen", { vault, path });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  closeVault: async () => {
    const { vault } = get();
    try {
      // Trigger hook before closing
      if (vault) {
        triggerHook("onVaultClose", { vault, path: vault.path });
      }
      await invoke("close_vault");
      set({ vault: null });
      // Don't remove from recent - just close
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
