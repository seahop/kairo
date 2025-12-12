import { useState, useMemo, useEffect } from "react";
import { usePluginStore, Plugin } from "@/plugins/api";
import { useHooks, HookType, FilterType } from "@/plugins/api";
import { SlotType } from "@/plugins/api";
import { useCommands } from "@/plugins/api";
import { useExtensionStore, Extension } from "@/stores/extensionStore";
import { useVaultStore } from "@/stores/vaultStore";
import { invoke } from "@tauri-apps/api/core";

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PluginIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const TerminalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface PluginManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "builtin" | "user" | "develop";

export function PluginManager({ isOpen, onClose }: PluginManagerProps) {
  if (!isOpen) return null;
  return <PluginManagerContent onClose={onClose} />;
}

function PluginManagerContent({ onClose }: { onClose: () => void }) {
  const { plugins, enablePlugin, disablePlugin } = usePluginStore();
  const { extensions, loadExtensionsFromFolder, unloadExtension, setConsoleOpen, logs } = useExtensionStore();
  const { vault } = useVaultStore();
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("builtin");
  const [extensionsPath, setExtensionsPath] = useState<string>("");

  const commandsMap = useCommands((state) => state.commands);
  const commands = useMemo(() => Array.from(commandsMap.values()), [commandsMap]);

  const pluginList = Array.from(plugins.values());
  const extensionList = Array.from(extensions.values());

  // Get extensions path on mount
  useEffect(() => {
    const getPath = async () => {
      if (vault) {
        try {
          const path = await invoke<string>("get_extensions_path", { vaultPath: vault.path });
          setExtensionsPath(path);
        } catch (err) {
          console.error("Failed to get extensions path:", err);
        }
      }
    };
    getPath();
  }, [vault]);

  const handleLoadExtensions = async () => {
    if (vault) {
      try {
        await invoke("ensure_extensions_directory", { vaultPath: vault.path });
        await loadExtensionsFromFolder(extensionsPath);
      } catch (err) {
        console.error("Failed to load extensions:", err);
      }
    }
  };

  const getPluginHookInfo = (pluginId: string) => {
    return useHooks.getState().getPluginHooks(pluginId);
  };

  const getAllHookTypes = (): HookType[] => {
    return [
      "onVaultOpen", "onVaultClose", "onNoteCreate", "onNoteSave", "onNoteDelete",
      "onNoteOpen", "onNoteClose", "onSearch", "onSearchResult", "onAppInit",
      "onAppClose", "onEditorReady", "onEditorChange", "onPreviewRender",
      "onCommandExecute", "onPluginLoad", "onPluginUnload", "onSettingsChange",
    ];
  };

  const getAllFilterTypes = (): FilterType[] => {
    return [
      "filterNoteContent", "filterSearchResults", "filterPreviewHtml",
      "filterCommands", "filterSidebarItems", "filterStatusbarItems",
    ];
  };

  const getSlotTypes = (): SlotType[] => {
    return [
      "sidebar", "sidebar-footer", "toolbar", "statusbar",
      "editor-toolbar", "editor-footer", "preview-footer", "modal",
    ];
  };

  const getPluginCommands = (pluginId: string) => {
    return commands.filter(cmd => cmd.pluginId === pluginId);
  };

  const errorCount = logs.filter(l => l.level === "error").length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800">
          <h2 className="text-lg font-semibold text-dark-100">Extension Manager</h2>
          <div className="flex items-center gap-2">
            <button
              className="btn-icon relative"
              onClick={() => setConsoleOpen(true)}
              title="Open debug console"
            >
              <TerminalIcon />
              {errorCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                  {errorCount > 9 ? "9+" : errorCount}
                </span>
              )}
            </button>
            <button className="btn-icon" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-800">
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "builtin"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => { setActiveTab("builtin"); setSelectedExtension(null); }}
          >
            Built-in ({pluginList.length})
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "user"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => { setActiveTab("user"); setSelectedPlugin(null); }}
          >
            User Extensions ({extensionList.length})
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "develop"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setActiveTab("develop")}
          >
            Develop
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {activeTab === "builtin" && (
            <>
              {/* Plugin List */}
              <div className="w-72 border-r border-dark-800 overflow-y-auto">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-dark-400 mb-3">Built-in Extensions</h3>
                  {pluginList.length === 0 ? (
                    <p className="text-sm text-dark-500">No extensions installed</p>
                  ) : (
                    <div className="space-y-2">
                      {pluginList.map((plugin) => (
                        <button
                          key={plugin.manifest.id}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                            selectedPlugin?.manifest.id === plugin.manifest.id
                              ? "bg-dark-700"
                              : "hover:bg-dark-800"
                          }`}
                          onClick={() => setSelectedPlugin(plugin)}
                        >
                          <div className={plugin.enabled ? "text-accent-success" : "text-dark-500"}>
                            <PluginIcon />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-dark-100 truncate">
                              {plugin.manifest.name}
                            </div>
                            <div className="text-xs text-dark-500">
                              v{plugin.manifest.version}
                            </div>
                          </div>
                          {plugin.enabled && (
                            <div className="text-accent-success">
                              <CheckIcon />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Plugin Details */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedPlugin ? (
                  <PluginDetails
                    plugin={selectedPlugin}
                    onEnable={() => enablePlugin(selectedPlugin.manifest.id)}
                    onDisable={() => disablePlugin(selectedPlugin.manifest.id)}
                    getPluginCommands={getPluginCommands}
                    getPluginHookInfo={getPluginHookInfo}
                  />
                ) : (
                  <EmptyState message="Select an extension to view details" />
                )}
              </div>
            </>
          )}

          {activeTab === "user" && (
            <>
              {/* User Extension List */}
              <div className="w-72 border-r border-dark-800 overflow-y-auto">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-dark-400">User Extensions</h3>
                    <button
                      className="btn-icon text-dark-400 hover:text-dark-200"
                      onClick={handleLoadExtensions}
                      title="Reload extensions"
                    >
                      <RefreshIcon />
                    </button>
                  </div>

                  {/* Extensions folder info */}
                  <div className="mb-4 p-3 bg-dark-800 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-dark-400 mb-1">
                      <FolderIcon />
                      <span>Extensions folder:</span>
                    </div>
                    <div className="text-xs text-dark-500 font-mono break-all">
                      {extensionsPath || "No vault open"}
                    </div>
                  </div>

                  {extensionList.length === 0 ? (
                    <div className="text-sm text-dark-500 text-center py-4">
                      <p className="mb-2">No user extensions loaded</p>
                      <p className="text-xs">
                        Place extensions in the extensions folder and click refresh
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {extensionList.map((ext) => (
                        <button
                          key={ext.manifest.id}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                            selectedExtension?.manifest.id === ext.manifest.id
                              ? "bg-dark-700"
                              : "hover:bg-dark-800"
                          }`}
                          onClick={() => setSelectedExtension(ext)}
                        >
                          <div className={ext.error ? "text-red-400" : ext.enabled ? "text-accent-success" : "text-dark-500"}>
                            {ext.error ? <ErrorIcon /> : <PluginIcon />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-dark-100 truncate">
                              {ext.manifest.name}
                            </div>
                            <div className="text-xs text-dark-500">
                              v{ext.manifest.version}
                            </div>
                          </div>
                          {ext.loaded && ext.enabled && (
                            <div className="text-accent-success">
                              <CheckIcon />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Extension Details */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedExtension ? (
                  <ExtensionDetails
                    extension={selectedExtension}
                    onUnload={() => unloadExtension(selectedExtension.manifest.id)}
                  />
                ) : (
                  <EmptyState message="Select a user extension to view details" />
                )}
              </div>
            </>
          )}

          {activeTab === "develop" && (
            <div className="flex-1 overflow-y-auto p-6">
              <DevelopTab
                getAllHookTypes={getAllHookTypes}
                getAllFilterTypes={getAllFilterTypes}
                getSlotTypes={getSlotTypes}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center justify-between">
            <div className="text-xs text-dark-500">
              {pluginList.length} built-in, {extensionList.length} user extension{extensionList.length !== 1 ? "s" : ""}
              {" • "}
              {pluginList.filter(p => p.enabled).length + extensionList.filter(e => e.enabled).length} enabled
            </div>
            <div className="text-xs text-dark-500">
              Press <kbd className="px-1 bg-dark-800 rounded">Ctrl+`</kbd> to open debug console
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PluginDetails({
  plugin,
  onEnable,
  onDisable,
  getPluginCommands,
  getPluginHookInfo,
}: {
  plugin: Plugin;
  onEnable: () => void;
  onDisable: () => void;
  getPluginCommands: (id: string) => any[];
  getPluginHookInfo: (id: string) => { hooks: HookType[]; filters: FilterType[] };
}) {
  const hookInfo = getPluginHookInfo(plugin.manifest.id);
  const pluginCommands = getPluginCommands(plugin.manifest.id);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-dark-100">
            {plugin.manifest.name}
          </h3>
          <p className="text-dark-400 text-sm mt-1">
            {plugin.manifest.description || "No description available"}
          </p>
        </div>
        <button
          className={plugin.enabled ? "btn-secondary" : "btn-primary"}
          onClick={plugin.enabled ? onDisable : onEnable}
        >
          {plugin.enabled ? "Disable" : "Enable"}
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm text-dark-400">Version</div>
            <div className="text-dark-100">{plugin.manifest.version}</div>
          </div>
          <div className="card">
            <div className="text-sm text-dark-400">Status</div>
            <div className={plugin.enabled ? "text-accent-success" : "text-dark-500"}>
              {plugin.enabled ? "Enabled" : "Disabled"}
            </div>
          </div>
          {plugin.manifest.author && (
            <div className="card">
              <div className="text-sm text-dark-400">Author</div>
              <div className="text-dark-100">{plugin.manifest.author}</div>
            </div>
          )}
          <div className="card">
            <div className="text-sm text-dark-400">ID</div>
            <div className="text-dark-100 font-mono text-sm">{plugin.manifest.id}</div>
          </div>
        </div>

        {pluginCommands.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-dark-400 mb-2">Commands</h4>
            <div className="space-y-2">
              {pluginCommands.map(cmd => (
                <div key={cmd.id} className="card flex items-center justify-between">
                  <div>
                    <div className="text-dark-100">{cmd.name}</div>
                    {cmd.description && (
                      <div className="text-xs text-dark-500">{cmd.description}</div>
                    )}
                  </div>
                  {cmd.shortcut && (
                    <kbd className="px-2 py-1 bg-dark-800 rounded text-xs text-dark-300">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(hookInfo.hooks.length > 0 || hookInfo.filters.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {hookInfo.hooks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-400 mb-2">Registered Hooks</h4>
                <div className="space-y-1">
                  {hookInfo.hooks.map(hook => (
                    <div key={hook} className="text-xs text-dark-300 font-mono bg-dark-800 px-2 py-1 rounded">
                      {hook}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hookInfo.filters.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-dark-400 mb-2">Registered Filters</h4>
                <div className="space-y-1">
                  {hookInfo.filters.map(filter => (
                    <div key={filter} className="text-xs text-dark-300 font-mono bg-dark-800 px-2 py-1 rounded">
                      {filter}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ExtensionDetails({
  extension,
  onUnload,
}: {
  extension: Extension;
  onUnload: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-dark-100">
            {extension.manifest.name}
          </h3>
          <p className="text-dark-400 text-sm mt-1">
            {extension.manifest.description || "No description available"}
          </p>
        </div>
        <button className="btn-secondary" onClick={onUnload}>
          Unload
        </button>
      </div>

      {extension.error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <ErrorIcon />
            <span className="font-medium">Error loading extension</span>
          </div>
          <pre className="text-xs text-red-300 whitespace-pre-wrap">{extension.error}</pre>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <div className="text-sm text-dark-400">Version</div>
            <div className="text-dark-100">{extension.manifest.version}</div>
          </div>
          <div className="card">
            <div className="text-sm text-dark-400">Status</div>
            <div className={extension.loaded ? "text-accent-success" : "text-red-400"}>
              {extension.loaded ? "Loaded" : "Failed"}
            </div>
          </div>
          {extension.manifest.author && (
            <div className="card">
              <div className="text-sm text-dark-400">Author</div>
              <div className="text-dark-100">{extension.manifest.author}</div>
            </div>
          )}
          <div className="card">
            <div className="text-sm text-dark-400">ID</div>
            <div className="text-dark-100 font-mono text-sm">{extension.manifest.id}</div>
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-dark-400 mb-1">Path</div>
          <div className="text-dark-300 font-mono text-xs break-all">{extension.path}</div>
        </div>

        <div className="card">
          <div className="text-sm text-dark-400 mb-1">Entry Point</div>
          <div className="text-dark-300 font-mono text-xs">{extension.manifest.main}</div>
        </div>
      </div>
    </div>
  );
}

function DevelopTab({
  getAllHookTypes,
  getAllFilterTypes,
  getSlotTypes,
}: {
  getAllHookTypes: () => HookType[];
  getAllFilterTypes: () => FilterType[];
  getSlotTypes: () => SlotType[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-dark-100 mb-4">Extension Development</h3>
        <p className="text-dark-400 text-sm mb-4">
          Create your own extensions to add custom functionality to Kairo.
        </p>
      </div>

      <div className="card">
        <h4 className="font-medium text-dark-200 mb-3">Quick Start</h4>
        <ol className="text-sm text-dark-400 space-y-2 list-decimal list-inside">
          <li>Create a folder in <code className="bg-dark-800 px-1 rounded">.kairo/extensions/</code></li>
          <li>Add a <code className="bg-dark-800 px-1 rounded">manifest.json</code> file</li>
          <li>Create your entry point JavaScript file</li>
          <li>Reload extensions from the User Extensions tab</li>
        </ol>
      </div>

      <div className="card">
        <h4 className="font-medium text-dark-200 mb-3">manifest.json Example</h4>
        <pre className="text-xs text-dark-300 bg-dark-800 p-3 rounded overflow-x-auto">
{`{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "A custom extension",
  "author": "Your Name",
  "main": "index.js"
}`}
        </pre>
      </div>

      <div className="card">
        <h4 className="font-medium text-dark-200 mb-3">index.js Example</h4>
        <pre className="text-xs text-dark-300 bg-dark-800 p-3 rounded overflow-x-auto">
{`// Initialize your extension
exports.initialize = function() {
  kairo.log.info("Extension loaded!");

  // Register a command
  kairo.registerCommand({
    id: "hello",
    name: "Say Hello",
    description: "Displays a greeting",
    execute: () => {
      kairo.log.info("Hello from my extension!");
    }
  });

  // Register a hook
  kairo.registerHook("onNoteOpen", (note) => {
    kairo.log.debug("Note opened: " + note.title);
  });
};

// Cleanup when extension is unloaded
exports.cleanup = function() {
  kairo.log.info("Extension unloaded!");
};`}
        </pre>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <h4 className="text-sm font-medium text-dark-400 mb-3">Action Hooks</h4>
          <div className="text-xs text-dark-500 space-y-1 max-h-48 overflow-y-auto">
            {getAllHookTypes().map(hook => (
              <div key={hook} className="font-mono bg-dark-800 px-2 py-1 rounded">{hook}</div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-dark-400 mb-3">Filter Hooks</h4>
          <div className="text-xs text-dark-500 space-y-1">
            {getAllFilterTypes().map(filter => (
              <div key={filter} className="font-mono bg-dark-800 px-2 py-1 rounded">{filter}</div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-dark-400 mb-3">UI Slots</h4>
          <div className="text-xs text-dark-500 space-y-1">
            {getSlotTypes().map(slot => (
              <div key={slot} className="font-mono bg-dark-800 px-2 py-1 rounded">{slot}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full text-dark-500">
      <div className="text-center">
        <div className="text-6xl mb-4">
          <PluginIcon />
        </div>
        <p>{message}</p>
      </div>
    </div>
  );
}
