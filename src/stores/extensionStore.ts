import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { usePluginStore, Plugin, PluginManifest } from "@/plugins/api";

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

interface ExtensionState {
  // Extension registry
  extensions: Map<string, Extension>;

  // Debug console
  logs: ExtensionLog[];
  maxLogs: number;
  consoleOpen: boolean;

  // Actions
  loadExtensionsFromFolder: (folderPath: string) => Promise<void>;
  loadExtension: (extensionPath: string) => Promise<void>;
  unloadExtension: (extensionId: string) => void;
  enableExtension: (extensionId: string) => void;
  disableExtension: (extensionId: string) => void;

  // Console actions
  log: (level: ExtensionLog["level"], extensionId: string, message: string, details?: string) => void;
  clearLogs: () => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
}

export const useExtensionStore = create<ExtensionState>((set, get) => ({
  extensions: new Map(),
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

      // Check if already loaded
      if (extensions.has(manifest.id)) {
        log("warn", manifest.id, "Extension already loaded, skipping");
        return;
      }

      log("info", manifest.id, `Loading extension: ${manifest.name} v${manifest.version}`);

      // Read the main entry point
      const mainPath = `${extensionPath}/${manifest.main}`;
      const mainCode = await invoke<string>("read_file_text", { path: mainPath });

      // Create extension record
      const extension: Extension = {
        manifest,
        path: extensionPath,
        loaded: false,
        enabled: true,
      };

      // Try to execute the extension code in a sandboxed way
      try {
        // Create a sandboxed API object that extensions can use
        const extensionApi = createExtensionApi(manifest.id, log);

        // Execute the extension code with the API
        const extensionModule = evaluateExtensionCode(mainCode, extensionApi, manifest.id);

        // If the module exports an initialize function, call it
        if (typeof extensionModule.initialize === "function") {
          await extensionModule.initialize();
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
            ? extensionModule.cleanup
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

  enableExtension: (extensionId: string) => {
    const { log, extensions } = get();
    const extension = extensions.get(extensionId);

    if (!extension) return;

    usePluginStore.getState().enablePlugin(extensionId);

    set((state) => {
      const newExtensions = new Map(state.extensions);
      const ext = newExtensions.get(extensionId);
      if (ext) ext.enabled = true;
      return { extensions: newExtensions };
    });

    log("info", extensionId, "Extension enabled");
  },

  disableExtension: (extensionId: string) => {
    const { log, extensions } = get();
    const extension = extensions.get(extensionId);

    if (!extension) return;

    usePluginStore.getState().disablePlugin(extensionId);

    set((state) => {
      const newExtensions = new Map(state.extensions);
      const ext = newExtensions.get(extensionId);
      if (ext) ext.enabled = false;
      return { extensions: newExtensions };
    });

    log("info", extensionId, "Extension disabled");
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

    // Command registration - uses pre-imported module to avoid require() in sandbox
    registerCommand: (command: {
      id: string;
      name: string;
      description?: string;
      shortcut?: string;
      category?: string;
      execute: () => void;
    }) => {
      // Import is handled at module level, not via require
      import("@/plugins/api").then(({ registerCommand }) => {
        registerCommand({
          ...command,
          id: `${extensionId}.${command.id}`,
          pluginId: extensionId,
        });
      });
    },

    // Hook registration
    registerHook: (type: string, callback: (...args: unknown[]) => void) => {
      import("@/plugins/api").then(({ registerHook }) => {
        registerHook(type as any, callback, extensionId);
      });
    },

    // Filter registration
    registerFilter: <T>(type: string, callback: (data: T) => T) => {
      import("@/plugins/api").then(({ registerFilter }) => {
        registerFilter(type as any, callback, extensionId);
      });
    },

    // Logging
    log: {
      info: (message: string, details?: string) => log("info", extensionId, message, details),
      warn: (message: string, details?: string) => log("warn", extensionId, message, details),
      error: (message: string, details?: string) => log("error", extensionId, message, details),
      debug: (message: string, details?: string) => log("debug", extensionId, message, details),
    },

    // Store access (limited)
    getState: () => ({
      // Could expose specific store states here
    }),
  };
}

// Blocked dangerous globals that extensions should not access
const BLOCKED_GLOBALS = [
  'eval', 'Function', 'fetch', 'XMLHttpRequest', 'WebSocket',
  'localStorage', 'sessionStorage', 'indexedDB',
  'document', 'window', 'globalThis', 'self',
  'process', 'require', 'module', '__dirname', '__filename',
  'Deno', 'Bun'
];

// Evaluate extension code with restricted scope
function evaluateExtensionCode(
  code: string,
  api: ReturnType<typeof createExtensionApi>,
  extensionId: string
): { initialize?: () => void | Promise<void>; cleanup?: () => void } {
  const moduleExports: { initialize?: () => void | Promise<void>; cleanup?: () => void } = {};

  try {
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
    const argNames = ['kairo', 'exports', ...BLOCKED_GLOBALS];
    const argValues = [api, moduleExports, ...BLOCKED_GLOBALS.map(() => undefined)];

    // Wrap code to prevent breaking out of the function scope
    const wrappedCode = `
      "use strict";
      ${code}
    `;

    // Create and execute the sandboxed function
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
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      console.warn(`[Extension:${extensionId}] Blocked: dangerous pattern detected`);
      return `Extension contains blocked code pattern: ${pattern.source}`;
    }
  }

  return null;
}
