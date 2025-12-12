import { create } from "zustand";

// Action hooks - called at specific events
export type HookType =
  | "onVaultOpen"
  | "onVaultClose"
  | "onNoteCreate"
  | "onNoteSave"
  | "onNoteDelete"
  | "onNoteOpen"
  | "onNoteClose"
  | "onSearch"
  | "onSearchResult"
  | "onAppInit"
  | "onAppClose"
  | "onEditorReady"
  | "onEditorChange"
  | "onPreviewRender"
  | "onCommandExecute"
  | "onPluginLoad"
  | "onPluginUnload"
  | "onSettingsChange";

// Filter hooks - can modify data passing through
export type FilterType =
  | "filterNoteContent"
  | "filterSearchResults"
  | "filterPreviewHtml"
  | "filterCommands"
  | "filterSidebarItems"
  | "filterStatusbarItems";

export type HookCallback<T = unknown> = (...args: T[]) => void | Promise<void>;
export type FilterCallback<T = unknown> = (data: T, ...args: unknown[]) => T | Promise<T>;

interface HookRegistration {
  pluginId: string;
  callback: HookCallback;
  priority: number;
}

interface FilterRegistration<T = unknown> {
  pluginId: string;
  callback: FilterCallback<T>;
  priority: number;
}

interface HooksState {
  hooks: Map<HookType, HookRegistration[]>;
  filters: Map<FilterType, FilterRegistration[]>;

  // Action hooks
  registerHook: (type: HookType, callback: HookCallback, pluginId?: string, priority?: number) => void;
  unregisterHook: (type: HookType, callback: HookCallback) => void;
  unregisterPluginHooks: (pluginId: string) => void;
  triggerHook: (type: HookType, ...args: unknown[]) => Promise<void>;

  // Filter hooks
  registerFilter: <T>(type: FilterType, callback: FilterCallback<T>, pluginId?: string, priority?: number) => void;
  unregisterFilter: <T>(type: FilterType, callback: FilterCallback<T>) => void;
  applyFilter: <T>(type: FilterType, data: T, ...args: unknown[]) => Promise<T>;

  // Inspection
  getHookRegistrations: (type: HookType) => HookRegistration[];
  getFilterRegistrations: (type: FilterType) => FilterRegistration[];
  getPluginHooks: (pluginId: string) => { hooks: HookType[]; filters: FilterType[] };
}

export const useHooks = create<HooksState>((set, get) => ({
  hooks: new Map(),
  filters: new Map(),

  // Register an action hook
  registerHook: (type: HookType, callback: HookCallback, pluginId = "core", priority = 10) => {
    set((state) => {
      const newHooks = new Map(state.hooks);
      if (!newHooks.has(type)) {
        newHooks.set(type, []);
      }
      const registrations = [...newHooks.get(type)!, { pluginId, callback, priority }];
      // Sort by priority (higher = runs first)
      registrations.sort((a, b) => b.priority - a.priority);
      newHooks.set(type, registrations);
      return { hooks: newHooks };
    });
  },

  // Unregister a specific hook callback
  unregisterHook: (type: HookType, callback: HookCallback) => {
    set((state) => {
      const newHooks = new Map(state.hooks);
      const registrations = newHooks.get(type);
      if (registrations) {
        newHooks.set(type, registrations.filter((r) => r.callback !== callback));
      }
      return { hooks: newHooks };
    });
  },

  // Unregister all hooks for a plugin
  unregisterPluginHooks: (pluginId: string) => {
    set((state) => {
      const newHooks = new Map(state.hooks);
      const newFilters = new Map(state.filters);

      // Remove action hooks
      for (const [type, registrations] of newHooks) {
        newHooks.set(type, registrations.filter((r) => r.pluginId !== pluginId));
      }

      // Remove filter hooks
      for (const [type, registrations] of newFilters) {
        newFilters.set(type, registrations.filter((r) => r.pluginId !== pluginId));
      }

      return { hooks: newHooks, filters: newFilters };
    });
  },

  // Trigger an action hook - runs all callbacks in priority order
  triggerHook: async (type: HookType, ...args: unknown[]) => {
    const registrations = get().hooks.get(type);
    if (registrations) {
      for (const registration of registrations) {
        try {
          await registration.callback(...args);
        } catch (error) {
          console.error(`Hook ${type} from plugin ${registration.pluginId} threw error:`, error);
        }
      }
    }
  },

  // Register a filter hook
  registerFilter: <T>(type: FilterType, callback: FilterCallback<T>, pluginId = "core", priority = 10) => {
    set((state) => {
      const newFilters = new Map(state.filters);
      if (!newFilters.has(type)) {
        newFilters.set(type, []);
      }
      const registrations = [...newFilters.get(type)!, { pluginId, callback: callback as FilterCallback, priority }];
      registrations.sort((a, b) => b.priority - a.priority);
      newFilters.set(type, registrations);
      return { filters: newFilters };
    });
  },

  // Unregister a filter callback
  unregisterFilter: <T>(type: FilterType, callback: FilterCallback<T>) => {
    set((state) => {
      const newFilters = new Map(state.filters);
      const registrations = newFilters.get(type);
      if (registrations) {
        newFilters.set(type, registrations.filter((r) => r.callback !== callback));
      }
      return { filters: newFilters };
    });
  },

  // Apply filter - passes data through all filter callbacks
  applyFilter: async <T>(type: FilterType, data: T, ...args: unknown[]): Promise<T> => {
    const registrations = get().filters.get(type);
    if (!registrations || registrations.length === 0) {
      return data;
    }

    let result = data;
    for (const registration of registrations) {
      try {
        result = await registration.callback(result, ...args) as T;
      } catch (error) {
        console.error(`Filter ${type} from plugin ${registration.pluginId} threw error:`, error);
      }
    }
    return result;
  },

  // Get all registrations for a hook type
  getHookRegistrations: (type: HookType) => get().hooks.get(type) ?? [],

  // Get all registrations for a filter type
  getFilterRegistrations: (type: FilterType) => get().filters.get(type) ?? [],

  // Get all hooks/filters registered by a plugin
  getPluginHooks: (pluginId: string) => {
    const hooks: HookType[] = [];
    const filters: FilterType[] = [];

    for (const [type, registrations] of get().hooks) {
      if (registrations.some((r) => r.pluginId === pluginId)) {
        hooks.push(type);
      }
    }

    for (const [type, registrations] of get().filters) {
      if (registrations.some((r) => r.pluginId === pluginId)) {
        filters.push(type);
      }
    }

    return { hooks, filters };
  },
}));

// Convenience functions for registering hooks/filters
export function registerHook(type: HookType, callback: HookCallback, pluginId?: string, priority?: number) {
  useHooks.getState().registerHook(type, callback, pluginId, priority);
}

export function registerFilter<T>(type: FilterType, callback: FilterCallback<T>, pluginId?: string, priority?: number) {
  useHooks.getState().registerFilter(type, callback, pluginId, priority);
}

export function triggerHook(type: HookType, ...args: unknown[]) {
  return useHooks.getState().triggerHook(type, ...args);
}

export function applyFilter<T>(type: FilterType, data: T, ...args: unknown[]) {
  return useHooks.getState().applyFilter(type, data, ...args);
}
