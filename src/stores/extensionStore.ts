import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { usePluginStore, Plugin, PluginManifest, registerCommand, registerHook, registerFilter } from "@/plugins/api";
import { useNoteStore } from "./noteStore";
import { useVaultStore } from "./vaultStore";
import { useUIStore } from "./uiStore";
import { useSearchStore } from "./searchStore";
import { useSlots, SlotType } from "@/plugins/api/slots";
import {
  useContextMenuStore,
  ContextMenuType,
  ContextMenuItem,
  ContextMenuContext,
} from "@/plugins/api/contextMenu";
import {
  useMenuBarStore,
  MenuCategory,
  MenuBarItem,
  CustomMenuCategory,
} from "@/plugins/api/menuBar";

// Theme/CSS management
const extensionStyles = new Map<string, HTMLStyleElement>();

function addExtensionStyles(extensionId: string, css: string): void {
  // Remove existing styles for this extension
  removeExtensionStyles(extensionId);

  // Add new styles
  const styleEl = document.createElement("style");
  styleEl.id = `extension-styles-${extensionId}`;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  extensionStyles.set(extensionId, styleEl);
}

function removeExtensionStyles(extensionId: string): void {
  const existing = extensionStyles.get(extensionId);
  if (existing) {
    existing.remove();
    extensionStyles.delete(extensionId);
  }
}

export interface ExtensionLog {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "debug";
  extensionId: string;
  message: string;
  details?: string;
}

export interface ExtensionManifest extends PluginManifest {
  main: string; // Entry point file (relative to extension folder)
  dependencies?: string[];
}

export interface Extension {
  manifest: ExtensionManifest;
  path: string; // Full path to the extension folder
  loaded: boolean;
  enabled: boolean;
  error?: string;
}

// Settings persisted to .kairo/extension-settings.json
export interface ExtensionSettings {
  // Map of extension ID to enabled state
  enabled: Record<string, boolean>;
}

interface ExtensionState {
  // Extension registry
  extensions: Map<string, Extension>;

  // Persisted settings
  settings: ExtensionSettings;
  settingsLoaded: boolean;

  // Debug console
  logs: ExtensionLog[];
  maxLogs: number;
  consoleOpen: boolean;

  // Actions
  loadExtensionsFromFolder: (folderPath: string) => Promise<void>;
  loadExtension: (extensionPath: string) => Promise<void>;
  unloadExtension: (extensionId: string) => void;
  enableExtension: (extensionId: string) => Promise<void>;
  disableExtension: (extensionId: string) => Promise<void>;
  removeExtension: (extensionId: string) => Promise<void>;

  // Settings actions
  loadSettings: (vaultPath: string) => Promise<void>;
  saveSettings: (vaultPath: string) => Promise<void>;

  // Console actions
  log: (level: ExtensionLog["level"], extensionId: string, message: string, details?: string) => void;
  clearLogs: () => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
}

export const useExtensionStore = create<ExtensionState>((set, get) => ({
  extensions: new Map(),
  settings: { enabled: {} },
  settingsLoaded: false,
  logs: [],
  maxLogs: 500,
  consoleOpen: false,

  loadExtensionsFromFolder: async (folderPath: string) => {
    const { log } = get();
    log("info", "system", `Scanning for extensions in: ${folderPath}`);

    try {
      // Call Tauri backend to list extension folders
      const extensionFolders = await invoke<string[]>("list_extension_folders", {
        path: folderPath
      });

      log("info", "system", `Found ${extensionFolders.length} extension(s)`);

      for (const extPath of extensionFolders) {
        try {
          await get().loadExtension(extPath);
        } catch (err) {
          log("error", "system", `Failed to load extension from ${extPath}`, String(err));
        }
      }
    } catch (err) {
      log("error", "system", `Failed to scan extensions folder`, String(err));
    }
  },

  loadExtension: async (extensionPath: string) => {
    const { log, extensions } = get();

    try {
      // Read manifest.json from the extension folder
      const manifestJson = await invoke<string>("read_extension_manifest", {
        path: extensionPath
      });

      const manifest: ExtensionManifest = JSON.parse(manifestJson);

      // Validate manifest
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.main) {
        throw new Error("Invalid manifest: missing required fields (id, name, version, main)");
      }

      // If already loaded, unload first (handles reloading/updating extensions)
      if (extensions.has(manifest.id)) {
        log("info", manifest.id, "Extension already loaded, unloading before reload");
        get().unloadExtension(manifest.id);
      }

      log("info", manifest.id, `Loading extension: ${manifest.name} v${manifest.version}`);

      // Read the main entry point
      const mainPath = `${extensionPath}/${manifest.main}`;
      const mainCode = await invoke<string>("read_file_text", { path: mainPath });

      // Check if extension is disabled in settings
      const { settings } = get();
      const isEnabled = settings.enabled[manifest.id] !== false; // Default to enabled

      // Create extension record
      const extension: Extension = {
        manifest,
        path: extensionPath,
        loaded: false,
        enabled: isEnabled,
      };

      // If disabled, just register it without loading
      if (!isEnabled) {
        log("info", manifest.id, `Extension ${manifest.name} is disabled, skipping initialization`);
        set((state) => {
          const newExtensions = new Map(state.extensions);
          newExtensions.set(manifest.id, extension);
          return { extensions: newExtensions };
        });
        return;
      }

      // Try to execute the extension code in a sandboxed way
      try {
        // Create a sandboxed API object that extensions can use
        const extensionApi = createExtensionApi(manifest.id, log);

        // Execute the extension code with the API
        const extensionModule = evaluateExtensionCode(mainCode, extensionApi, manifest.id);

        // If the module exports an initialize function, call it with the API
        if (typeof extensionModule.initialize === "function") {
          await extensionModule.initialize(extensionApi);
        }

        // Register as a plugin
        const plugin: Plugin = {
          manifest: {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            author: manifest.author,
          },
          enabled: true,
          cleanup: typeof extensionModule.cleanup === "function"
            ? () => extensionModule.cleanup!(extensionApi)
            : undefined,
        };

        usePluginStore.getState().registerPlugin(plugin);

        extension.loaded = true;
        log("info", manifest.id, `Successfully loaded extension: ${manifest.name}`);

      } catch (err) {
        extension.error = String(err);
        extension.loaded = false;
        log("error", manifest.id, `Failed to initialize extension`, String(err));
      }

      // Add to registry
      set((state) => {
        const newExtensions = new Map(state.extensions);
        newExtensions.set(manifest.id, extension);
        return { extensions: newExtensions };
      });

    } catch (err) {
      log("error", "system", `Failed to load extension from ${extensionPath}`, String(err));
    }
  },

  unloadExtension: (extensionId: string) => {
    const { log, extensions } = get();
    const extension = extensions.get(extensionId);

    if (!extension) {
      log("warn", "system", `Extension ${extensionId} not found`);
      return;
    }

    // Clean up extension styles
    removeExtensionStyles(extensionId);

    // Unregister from plugin system
    usePluginStore.getState().unregisterPlugin(extensionId);

    // Remove from registry
    set((state) => {
      const newExtensions = new Map(state.extensions);
      newExtensions.delete(extensionId);
      return { extensions: newExtensions };
    });

    log("info", extensionId, "Extension unloaded");
  },

  enableExtension: async (extensionId: string) => {
    const { log, extensions, loadExtension } = get();
    const extension = extensions.get(extensionId);

    if (!extension) return;

    // Update settings
    set((state) => ({
      settings: {
        ...state.settings,
        enabled: { ...state.settings.enabled, [extensionId]: true }
      }
    }));

    // If extension wasn't loaded, load it now
    if (!extension.loaded) {
      await loadExtension(extension.path);
    } else {
      usePluginStore.getState().enablePlugin(extensionId);
    }

    set((state) => {
      const newExtensions = new Map(state.extensions);
      const ext = newExtensions.get(extensionId);
      if (ext) ext.enabled = true;
      return { extensions: newExtensions };
    });

    // Save settings to disk
    const vaultPath = useVaultStore.getState().vault?.path;
    if (vaultPath) {
      await get().saveSettings(vaultPath);
    }

    log("info", extensionId, "Extension enabled");
  },

  disableExtension: async (extensionId: string) => {
    const { log, extensions } = get();
    const extension = extensions.get(extensionId);

    if (!extension) return;

    // Update settings
    set((state) => ({
      settings: {
        ...state.settings,
        enabled: { ...state.settings.enabled, [extensionId]: false }
      }
    }));

    // Unload extension if loaded
    if (extension.loaded) {
      // Clean up extension styles
      removeExtensionStyles(extensionId);

      // Disable in plugin system
      usePluginStore.getState().disablePlugin(extensionId);
    }

    set((state) => {
      const newExtensions = new Map(state.extensions);
      const ext = newExtensions.get(extensionId);
      if (ext) {
        ext.enabled = false;
        ext.loaded = false;
      }
      return { extensions: newExtensions };
    });

    // Save settings to disk
    const vaultPath = useVaultStore.getState().vault?.path;
    if (vaultPath) {
      await get().saveSettings(vaultPath);
    }

    log("info", extensionId, "Extension disabled");
  },

  removeExtension: async (extensionId: string) => {
    const { log, extensions, unloadExtension } = get();
    const extension = extensions.get(extensionId);

    if (!extension) {
      log("warn", "system", `Extension ${extensionId} not found`);
      return;
    }

    const vaultPath = useVaultStore.getState().vault?.path;
    if (!vaultPath) {
      log("error", "system", "No vault open");
      return;
    }

    // Unload extension first
    if (extension.loaded) {
      unloadExtension(extensionId);
    }

    try {
      // Remove from disk
      await invoke("remove_extension", {
        vaultPath,
        extensionId
      });

      // Remove from registry
      set((state) => {
        const newExtensions = new Map(state.extensions);
        newExtensions.delete(extensionId);
        // Also remove from settings
        const newEnabled = { ...state.settings.enabled };
        delete newEnabled[extensionId];
        return {
          extensions: newExtensions,
          settings: { ...state.settings, enabled: newEnabled }
        };
      });

      // Save updated settings
      await get().saveSettings(vaultPath);

      log("info", "system", `Extension ${extensionId} removed`);
    } catch (err) {
      log("error", "system", `Failed to remove extension ${extensionId}`, String(err));
    }
  },

  loadSettings: async (vaultPath: string) => {
    const { log } = get();

    try {
      const settingsJson = await invoke<string>("read_extension_settings", {
        vaultPath
      });

      const settings: ExtensionSettings = JSON.parse(settingsJson);

      // Ensure enabled object exists
      if (!settings.enabled) {
        settings.enabled = {};
      }

      set({ settings, settingsLoaded: true });
      log("debug", "system", "Extension settings loaded", JSON.stringify(settings));
    } catch (err) {
      log("warn", "system", "Failed to load extension settings, using defaults", String(err));
      set({ settings: { enabled: {} }, settingsLoaded: true });
    }
  },

  saveSettings: async (vaultPath: string) => {
    const { log, settings } = get();

    try {
      await invoke("save_extension_settings", {
        vaultPath,
        settingsJson: JSON.stringify(settings)
      });
      log("debug", "system", "Extension settings saved");
    } catch (err) {
      log("error", "system", "Failed to save extension settings", String(err));
    }
  },

  log: (level, extensionId, message, details) => {
    set((state) => {
      const newLog: ExtensionLog = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: Date.now(),
        level,
        extensionId,
        message,
        details,
      };

      const newLogs = [newLog, ...state.logs].slice(0, state.maxLogs);
      return { logs: newLogs };
    });

    // Also log to browser console
    const prefix = `[Extension:${extensionId}]`;
    switch (level) {
      case "error":
        console.error(prefix, message, details || "");
        break;
      case "warn":
        console.warn(prefix, message, details || "");
        break;
      case "debug":
        console.debug(prefix, message, details || "");
        break;
      default:
        console.log(prefix, message, details || "");
    }
  },

  clearLogs: () => set({ logs: [] }),

  toggleConsole: () => set((state) => ({ consoleOpen: !state.consoleOpen })),

  setConsoleOpen: (open) => set({ consoleOpen: open }),
}));

// Create a sandboxed API object for extensions
function createExtensionApi(
  extensionId: string,
  log: ExtensionState["log"]
) {
  return {
    // Plugin registration
    registerPlugin: (plugin: Plugin) => {
      usePluginStore.getState().registerPlugin({
        ...plugin,
        manifest: { ...plugin.manifest, id: extensionId },
      });
    },

    // Command registration - synchronous using module-level import
    registerCommand: (command: {
      id: string;
      name: string;
      description?: string;
      shortcut?: string;
      category?: string;
      execute: () => void;
    }) => {
      registerCommand({
        ...command,
        id: `${extensionId}.${command.id}`,
        pluginId: extensionId,
      });
      log("debug", extensionId, `Registered command: ${command.id}`);
    },

    // Hook registration - synchronous
    registerHook: (type: string, callback: (...args: unknown[]) => void) => {
      registerHook(type as any, callback, extensionId);
      log("debug", extensionId, `Registered hook: ${type}`);
    },

    // Filter registration - synchronous
    registerFilter: <T>(type: string, callback: (data: T) => T) => {
      registerFilter(type as any, callback, extensionId);
      log("debug", extensionId, `Registered filter: ${type}`);
    },

    // Logging
    log: {
      info: (message: string, details?: string) => log("info", extensionId, message, details),
      warn: (message: string, details?: string) => log("warn", extensionId, message, details),
      error: (message: string, details?: string) => log("error", extensionId, message, details),
      debug: (message: string, details?: string) => log("debug", extensionId, message, details),
    },

    // Store access (read-only snapshots)
    getState: () => {
      const noteState = useNoteStore.getState();
      const vaultState = useVaultStore.getState();
      const uiState = useUIStore.getState();
      const searchState = useSearchStore.getState();

      return {
        notes: {
          list: noteState.notes,
          current: noteState.currentNote,
          editorContent: noteState.editorContent,
          hasUnsavedChanges: noteState.hasUnsavedChanges,
        },
        vault: vaultState.vault,
        ui: {
          isSidebarCollapsed: uiState.isSidebarCollapsed,
          mainViewMode: uiState.mainViewMode,
          editorViewMode: uiState.editorViewMode,
        },
        search: {
          query: searchState.query,
          results: searchState.results,
          filters: searchState.filters,
        },
      };
    },

    // Subscribe to state changes
    subscribe: (storeName: string, callback: (state: unknown) => void) => {
      switch (storeName) {
        case "notes":
          return useNoteStore.subscribe(callback);
        case "vault":
          return useVaultStore.subscribe(callback);
        case "ui":
          return useUIStore.subscribe(callback);
        case "search":
          return useSearchStore.subscribe(callback);
        default:
          log("warn", extensionId, `Unknown store: ${storeName}`);
          return () => {};
      }
    },

    // CSS/Theme API
    addStyles: (css: string) => {
      addExtensionStyles(extensionId, css);
      log("debug", extensionId, "Added custom styles");
    },

    removeStyles: () => {
      removeExtensionStyles(extensionId);
      log("debug", extensionId, "Removed custom styles");
    },

    // UI Slot registration
    registerSlot: (slot: string, component: { id: string; component: React.ComponentType<{ data?: unknown }>; priority?: number }) => {
      useSlots.getState().registerSlot(slot as SlotType, {
        id: `${extensionId}.${component.id}`,
        pluginId: extensionId,
        component: component.component,
        priority: component.priority,
      });
      log("debug", extensionId, `Registered slot component: ${slot}/${component.id}`);
    },

    unregisterSlot: (slot: string, componentId: string) => {
      useSlots.getState().unregisterSlot(slot as SlotType, `${extensionId}.${componentId}`);
      log("debug", extensionId, `Unregistered slot component: ${slot}/${componentId}`);
    },

    // Context menu registration
    registerContextMenuItem: (
      menuType: string,
      item: {
        id: string;
        label: string;
        icon?: string;
        shortcut?: string;
        execute: (context: ContextMenuContext) => void | Promise<void>;
        when?: (context: ContextMenuContext) => boolean;
        priority?: number;
        divider?: boolean;
      }
    ) => {
      useContextMenuStore.getState().registerMenuItem(
        menuType as ContextMenuType,
        item as Omit<ContextMenuItem, "pluginId">,
        extensionId
      );
      log("debug", extensionId, `Registered context menu item: ${menuType}/${item.id}`);
    },

    unregisterContextMenuItem: (menuType: string, itemId: string) => {
      useContextMenuStore.getState().unregisterMenuItem(
        menuType as ContextMenuType,
        `${extensionId}.${itemId}`
      );
      log("debug", extensionId, `Unregistered context menu item: ${menuType}/${itemId}`);
    },

    // Menu bar registration
    registerMenuItem: (
      category: string,
      item: {
        id: string;
        label: string;
        shortcut?: string;
        icon?: string;
        execute: () => void | Promise<void>;
        when?: () => boolean;
        priority?: number;
        divider?: boolean;
      }
    ) => {
      useMenuBarStore.getState().registerMenuItem(
        category as MenuCategory,
        item as Omit<MenuBarItem, "pluginId">,
        extensionId
      );
      log("debug", extensionId, `Registered menu item: ${category}/${item.id}`);
    },

    unregisterMenuItem: (category: string, itemId: string) => {
      useMenuBarStore.getState().unregisterMenuItem(
        category as MenuCategory,
        `${extensionId}.${itemId}`
      );
      log("debug", extensionId, `Unregistered menu item: ${category}/${itemId}`);
    },

    // Custom menu category registration
    registerMenuCategory: (category: {
      id: string;
      label: string;
      priority?: number;
    }) => {
      useMenuBarStore.getState().registerCategory(
        category as Omit<CustomMenuCategory, "pluginId">,
        extensionId
      );
      log("debug", extensionId, `Registered menu category: ${category.id}`);
    },

    unregisterMenuCategory: (categoryId: string) => {
      useMenuBarStore.getState().unregisterCategory(`${extensionId}.${categoryId}`);
      log("debug", extensionId, `Unregistered menu category: ${categoryId}`);
    },

    registerCustomMenuItem: (
      categoryId: string,
      item: {
        id: string;
        label: string;
        shortcut?: string;
        icon?: string;
        execute: () => void | Promise<void>;
        when?: () => boolean;
        priority?: number;
        divider?: boolean;
      }
    ) => {
      useMenuBarStore.getState().registerCustomMenuItem(
        `${extensionId}.${categoryId}`,
        item as Omit<MenuBarItem, "pluginId">,
        extensionId
      );
      log("debug", extensionId, `Registered custom menu item: ${categoryId}/${item.id}`);
    },
  };
}

// Blocked dangerous globals that extensions should not access
// Note: 'eval' and 'arguments' cannot be used as function parameter names in strict mode,
// so we handle them separately in the wrapper code
//
// We allow: document, window, localStorage (needed for DOM manipulation and preferences)
// We block: network access, eval-like functions, Node.js globals
const BLOCKED_GLOBALS = [
  'Function',  // Prevents dynamic code generation
  'fetch', 'XMLHttpRequest', 'WebSocket',  // Network access
  'indexedDB',  // Large storage that could be abused
  'globalThis', 'self',  // Alternative global access
  'process', 'require', 'module', '__dirname', '__filename',  // Node.js
  'Deno', 'Bun'  // Other runtimes
];

// Check if dynamic code execution is allowed by CSP
function isDynamicCodeAllowed(): boolean {
  try {
    // Try to create a simple function - this will fail if CSP blocks 'unsafe-eval'
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function('return true');
    return true;
  } catch {
    return false;
  }
}

// Cache the CSP check result
let dynamicCodeAllowed: boolean | null = null;

// Evaluate extension code with restricted scope
function evaluateExtensionCode(
  code: string,
  api: ReturnType<typeof createExtensionApi>,
  extensionId: string
): { initialize?: (api: ReturnType<typeof createExtensionApi>) => void | Promise<void>; cleanup?: (api: ReturnType<typeof createExtensionApi>) => void } {
  const moduleExports: { initialize?: (api: ReturnType<typeof createExtensionApi>) => void | Promise<void>; cleanup?: (api: ReturnType<typeof createExtensionApi>) => void } = {};

  try {
    // Check CSP once and cache result
    if (dynamicCodeAllowed === null) {
      dynamicCodeAllowed = isDynamicCodeAllowed();
    }

    // If CSP blocks dynamic code execution, extensions cannot run
    // This is intentional for security - extensions require 'unsafe-eval' which is dangerous
    if (!dynamicCodeAllowed) {
      api.log.warn(
        `Extension ${extensionId} cannot run: dynamic code execution is blocked by Content Security Policy. ` +
        `This is a security feature. Custom extensions are disabled for security.`
      );
      console.warn(
        `[Security] Extension "${extensionId}" blocked: CSP prevents dynamic code execution. ` +
        `Extensions require 'unsafe-eval' which is disabled for security. ` +
        `Only built-in plugins are available.`
      );
      return moduleExports;
    }

    // Validate extension code before execution
    const validationError = validateExtensionCode(code, extensionId);
    if (validationError) {
      throw new Error(validationError);
    }

    // Create a restricted scope object that blocks dangerous globals
    const blockedScope: Record<string, undefined> = {};
    for (const name of BLOCKED_GLOBALS) {
      blockedScope[name] = undefined;
    }

    // Use Function constructor instead of eval - it's slightly safer as it creates
    // a new function scope and doesn't have access to local variables
    // The blocked scope prevents access to dangerous globals
    // NOTE: This still requires 'unsafe-eval' in CSP and is not fully secure
    const argNames = ['kairo', 'exports', ...BLOCKED_GLOBALS];
    const argValues = [api, moduleExports, ...BLOCKED_GLOBALS.map(() => undefined)];

    // Wrap code to prevent breaking out of the function scope
    const wrappedCode = `
      "use strict";
      ${code}
    `;

    // Create and execute the sandboxed function
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const sandboxedFn = new Function(...argNames, wrappedCode);
    sandboxedFn(...argValues);

    return moduleExports;
  } catch (err) {
    api.log.error(`Failed to evaluate extension code`, String(err));
    throw err;
  }
}

// Validate extension code for potentially dangerous patterns
function validateExtensionCode(code: string, extensionId: string): string | null {
  // Check for code size limits (prevent DoS)
  const MAX_CODE_SIZE = 500 * 1024; // 500KB
  if (code.length > MAX_CODE_SIZE) {
    return `Extension code exceeds maximum size of ${MAX_CODE_SIZE} bytes`;
  }

  // Patterns that indicate attempts to break out of sandbox
  const dangerousPatterns = [
    // Attempts to access constructor chains to get Function
    /\bconstructor\s*\[/gi,
    /\['constructor'\]/gi,
    /\["constructor"\]/gi,
    /\.__proto__/gi,
    /\[['"]__proto__['"]\]/gi,
    // Attempts to use import() which can load arbitrary modules
    /\bimport\s*\(/gi,
    // Direct process/require access attempts
    /\bprocess\s*\./gi,
    /\brequire\s*\(/gi,
    // Accessing global this in various ways
    /\bglobalThis\b/gi,
    /\bself\[/gi,
    // Direct eval usage (can't be shadowed via parameter in strict mode)
    /\beval\s*\(/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      console.warn(`[Extension:${extensionId}] Blocked: dangerous pattern detected`);
      return `Extension contains blocked code pattern: ${pattern.source}`;
    }
  }

  return null;
}
