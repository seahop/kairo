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
  loadRecentVaults: () => void;
  tryOpenLastVault: () => Promise<boolean>;
}

// Helper to manage recent vaults in localStorage
const RECENT_VAULTS_KEY = "kairo:recentVaults";
const LAST_VAULT_KEY = "kairo:lastVault";
const MAX_RECENT_VAULTS = 10;

function getStoredRecentVaults(): RecentVault[] {
  try {
    const stored = localStorage.getItem(RECENT_VAULTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addToRecentVaults(vault: VaultInfo): void {
  const recent = getStoredRecentVaults();

  // Remove if already exists
  const filtered = recent.filter(v => v.path !== vault.path);

  // Add to front
  const updated: RecentVault[] = [
    { path: vault.path, name: vault.name, lastOpened: Date.now() },
    ...filtered,
  ].slice(0, MAX_RECENT_VAULTS);

  localStorage.setItem(RECENT_VAULTS_KEY, JSON.stringify(updated));
  localStorage.setItem(LAST_VAULT_KEY, vault.path);
}

export const useVaultStore = create<VaultState>((set, get) => ({
  vault: null,
  recentVaults: [],
  isLoading: false,
  error: null,

  loadRecentVaults: () => {
    const recent = getStoredRecentVaults();
    set({ recentVaults: recent });
  },

  tryOpenLastVault: async () => {
    const lastPath = localStorage.getItem(LAST_VAULT_KEY);
    if (!lastPath) return false;

    try {
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

      // Add to recent vaults
      addToRecentVaults(vault);
      set({ recentVaults: getStoredRecentVaults() });

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

      // Add to recent vaults
      addToRecentVaults(vault);
      set({ recentVaults: getStoredRecentVaults() });

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
