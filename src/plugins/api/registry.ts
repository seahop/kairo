import { create } from "zustand";
import { useCommands } from "./commands";
import { useHooks } from "./hooks";
import { useSlots } from "./slots";
import { useMenuBarStore } from "./menuBar";
import { useContextMenuStore } from "./contextMenu";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export interface Plugin {
  manifest: PluginManifest;
  enabled: boolean;
  initialize?: () => void | Promise<void>;
  cleanup?: () => void;
}

// Helper to clean up all artifacts registered by a plugin
function cleanupPluginArtifacts(pluginId: string) {
  // Clean up commands
  useCommands.getState().unregisterPluginCommands(pluginId);
  // Clean up hooks and filters
  useHooks.getState().unregisterPluginHooks(pluginId);
  // Clean up slots
  useSlots.getState().unregisterPluginSlots(pluginId);
  // Clean up menu bar items
  useMenuBarStore.getState().unregisterPluginMenuItems(pluginId);
  // Clean up context menu items
  useContextMenuStore.getState().unregisterPluginMenuItems(pluginId);
}

interface PluginState {
  plugins: Map<string, Plugin>;
  registerPlugin: (plugin: Plugin) => void;
  unregisterPlugin: (id: string) => void;
  enablePlugin: (id: string) => void;
  disablePlugin: (id: string) => void;
  getPlugin: (id: string) => Plugin | undefined;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: new Map(),

  registerPlugin: (plugin: Plugin) => {
    set((state) => {
      const newPlugins = new Map(state.plugins);
      newPlugins.set(plugin.manifest.id, plugin);
      return { plugins: newPlugins };
    });

    // Initialize plugin if enabled
    if (plugin.enabled && plugin.initialize) {
      plugin.initialize();
    }
  },

  unregisterPlugin: (id: string) => {
    const plugin = get().plugins.get(id);

    // Call plugin's cleanup function first
    if (plugin?.cleanup) {
      plugin.cleanup();
    }

    // Clean up all registered artifacts (commands, hooks, menus, etc.)
    cleanupPluginArtifacts(id);

    set((state) => {
      const newPlugins = new Map(state.plugins);
      newPlugins.delete(id);
      return { plugins: newPlugins };
    });
  },

  enablePlugin: (id: string) => {
    set((state) => {
      const newPlugins = new Map(state.plugins);
      const plugin = newPlugins.get(id);
      if (plugin) {
        plugin.enabled = true;
        if (plugin.initialize) {
          plugin.initialize();
        }
      }
      return { plugins: newPlugins };
    });
  },

  disablePlugin: (id: string) => {
    const plugin = get().plugins.get(id);

    if (plugin) {
      // Call plugin's cleanup function
      if (plugin.cleanup) {
        plugin.cleanup();
      }

      // Clean up all registered artifacts
      cleanupPluginArtifacts(id);
    }

    set((state) => {
      const newPlugins = new Map(state.plugins);
      const p = newPlugins.get(id);
      if (p) {
        p.enabled = false;
      }
      return { plugins: newPlugins };
    });
  },

  getPlugin: (id: string) => get().plugins.get(id),
}));

export function registerPlugin(plugin: Plugin) {
  usePluginStore.getState().registerPlugin(plugin);
}
