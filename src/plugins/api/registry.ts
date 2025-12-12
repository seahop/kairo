import { create } from "zustand";

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
    if (plugin?.cleanup) {
      plugin.cleanup();
    }

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
    set((state) => {
      const newPlugins = new Map(state.plugins);
      const plugin = newPlugins.get(id);
      if (plugin) {
        if (plugin.cleanup) {
          plugin.cleanup();
        }
        plugin.enabled = false;
      }
      return { plugins: newPlugins };
    });
  },

  getPlugin: (id: string) => get().plugins.get(id),
}));

export function registerPlugin(plugin: Plugin) {
  usePluginStore.getState().registerPlugin(plugin);
}
