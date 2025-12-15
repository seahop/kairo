import { useState, useMemo, useEffect } from "react";
import { usePluginStore, Plugin } from "@/plugins/api";
import { useHooks, HookType, FilterType } from "@/plugins/api";
import { SlotType } from "@/plugins/api";
import { useCommands } from "@/plugins/api";
import { useExtensionStore, Extension, ExtensionManifest } from "@/stores/extensionStore";
import { useVaultStore } from "@/stores/vaultStore";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ImportIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
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

// Import confirmation dialog state
interface ImportConfirmState {
  isOpen: boolean;
  sourcePath: string;
  manifest: ExtensionManifest | null;
  existingExtension: Extension | null;
}

// Delete confirmation dialog state
interface DeleteConfirmState {
  isOpen: boolean;
  extensionId: string;
  extensionName: string;
}

function PluginManagerContent({ onClose }: { onClose: () => void }) {
  const { plugins, enablePlugin, disablePlugin } = usePluginStore();
  const {
    extensions,
    loadExtensionsFromFolder,
    unloadExtension,
    enableExtension,
    disableExtension,
    removeExtension,
    setConsoleOpen,
    logs
  } = useExtensionStore();
  const { vault } = useVaultStore();
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("builtin");
  const [extensionsPath, setExtensionsPath] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importConfirm, setImportConfirm] = useState<ImportConfirmState>({
    isOpen: false,
    sourcePath: "",
    manifest: null,
    existingExtension: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    extensionId: "",
    extensionName: "",
  });

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

  // Handle importing an extension from disk
  const handleImportExtension = async () => {
    if (!vault) return;

    try {
      // Open folder picker
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Extension Folder",
      });

      if (!selected || typeof selected !== "string") return;

      setIsImporting(true);

      // Read manifest from selected folder
      const manifestJson = await invoke<string>("read_extension_manifest_from_path", {
        path: selected,
      });
      const manifest: ExtensionManifest = JSON.parse(manifestJson);

      // Check if extension with this ID already exists
      const exists = await invoke<boolean>("extension_exists", {
        vaultPath: vault.path,
        extensionId: manifest.id,
      });

      if (exists) {
        // Show confirmation dialog for overwrite
        const existingExt = extensions.get(manifest.id) || null;
        setImportConfirm({
          isOpen: true,
          sourcePath: selected,
          manifest,
          existingExtension: existingExt,
        });
        setIsImporting(false);
      } else {
        // Import directly
        await performImport(selected, manifest.id, false);
      }
    } catch (err) {
      console.error("Failed to import extension:", err);
      alert(`Failed to import extension: ${err}`);
      setIsImporting(false);
    }
  };

  // Perform the actual import
  const performImport = async (sourcePath: string, extensionId: string, overwrite: boolean) => {
    if (!vault) return;

    try {
      setIsImporting(true);

      // If overwriting, unload the existing extension first
      if (overwrite && extensions.has(extensionId)) {
        unloadExtension(extensionId);
      }

      // Import the extension
      await invoke("import_extension", {
        sourcePath,
        vaultPath: vault.path,
        extensionId,
        overwrite,
      });

      // Reload extensions to load the new one
      await handleLoadExtensions();

      setImportConfirm({ isOpen: false, sourcePath: "", manifest: null, existingExtension: null });
      setIsImporting(false);
    } catch (err) {
      console.error("Failed to import extension:", err);
      alert(`Failed to import extension: ${err}`);
      setIsImporting(false);
    }
  };

  const handleConfirmOverwrite = () => {
    if (importConfirm.manifest) {
      performImport(importConfirm.sourcePath, importConfirm.manifest.id, true);
    }
  };

  const handleCancelImport = () => {
    setImportConfirm({ isOpen: false, sourcePath: "", manifest: null, existingExtension: null });
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
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-icon text-dark-400 hover:text-dark-200"
                        onClick={handleImportExtension}
                        disabled={isImporting || !vault}
                        title="Import extension from disk"
                      >
                        <ImportIcon />
                      </button>
                      <button
                        className="btn-icon text-dark-400 hover:text-dark-200"
                        onClick={handleLoadExtensions}
                        title="Reload extensions"
                      >
                        <RefreshIcon />
                      </button>
                    </div>
                  </div>

                  {/* Import button */}
                  <button
                    className="w-full mb-4 flex items-center justify-center gap-2 px-3 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    onClick={handleImportExtension}
                    disabled={isImporting || !vault}
                  >
                    <ImportIcon />
                    {isImporting ? "Importing..." : "Import Extension"}
                  </button>

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
                        Import an extension or place one in the extensions folder
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
                          } ${!ext.enabled ? "opacity-60" : ""}`}
                          onClick={() => setSelectedExtension(ext)}
                        >
                          <div className={
                            ext.error
                              ? "text-red-400"
                              : !ext.enabled
                                ? "text-dark-600"
                                : ext.loaded
                                  ? "text-accent-success"
                                  : "text-dark-500"
                          }>
                            {ext.error ? <ErrorIcon /> : <PluginIcon />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium truncate ${ext.enabled ? "text-dark-100" : "text-dark-400"}`}>
                              {ext.manifest.name}
                            </div>
                            <div className="text-xs text-dark-500">
                              v{ext.manifest.version}
                              {!ext.enabled && <span className="ml-2 text-dark-600">(disabled)</span>}
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
                    onEnable={() => enableExtension(selectedExtension.manifest.id)}
                    onDisable={() => disableExtension(selectedExtension.manifest.id)}
                    onRemove={() => {
                      // Show custom delete confirmation dialog
                      setDeleteConfirm({
                        isOpen: true,
                        extensionId: selectedExtension.manifest.id,
                        extensionName: selectedExtension.manifest.name,
                      });
                    }}
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

      {/* Import Confirmation Dialog */}
      {importConfirm.isOpen && importConfirm.manifest && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center" onClick={handleCancelImport}>
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md border border-dark-700 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-dark-100 mb-2">Extension Already Exists</h3>
            <p className="text-dark-400 text-sm mb-4">
              An extension with ID <code className="bg-dark-800 px-1.5 py-0.5 rounded text-accent-primary">{importConfirm.manifest.id}</code> already exists.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="card">
                <div className="text-xs text-dark-500 mb-1">Existing</div>
                <div className="text-sm text-dark-200">{importConfirm.existingExtension?.manifest.name || importConfirm.manifest.id}</div>
                <div className="text-xs text-dark-500">v{importConfirm.existingExtension?.manifest.version || "?"}</div>
              </div>
              <div className="card border-accent-primary/30">
                <div className="text-xs text-accent-primary mb-1">New</div>
                <div className="text-sm text-dark-200">{importConfirm.manifest.name}</div>
                <div className="text-xs text-dark-500">v{importConfirm.manifest.version}</div>
              </div>
            </div>

            <p className="text-dark-500 text-xs mb-4">
              Replacing will remove the existing extension and import the new one in its place.
            </p>

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={handleCancelImport}>
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                onClick={handleConfirmOverwrite}
                disabled={isImporting}
              >
                {isImporting ? "Replacing..." : "Replace Extension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.isOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center"
          onClick={() => setDeleteConfirm({ isOpen: false, extensionId: "", extensionName: "" })}
        >
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md border border-dark-700 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-dark-100 mb-2">Remove Extension</h3>
            <p className="text-dark-400 text-sm mb-4">
              Are you sure you want to remove <span className="text-dark-200 font-medium">"{deleteConfirm.extensionName}"</span>?
            </p>
            <p className="text-dark-500 text-xs mb-4">
              This will permanently delete the extension files from your vault.
            </p>

            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => setDeleteConfirm({ isOpen: false, extensionId: "", extensionName: "" })}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                onClick={() => {
                  const { extensionId } = deleteConfirm;
                  setDeleteConfirm({ isOpen: false, extensionId: "", extensionName: "" });
                  removeExtension(extensionId).then(() => {
                    setSelectedExtension(null);
                  });
                }}
              >
                Remove Extension
              </button>
            </div>
          </div>
        </div>
      )}
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
  onEnable,
  onDisable,
  onRemove,
}: {
  extension: Extension;
  onEnable: () => void;
  onDisable: () => void;
  onRemove: () => void;
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
        <div className="flex items-center gap-2">
          <button
            className={extension.enabled ? "btn-secondary" : "btn-primary"}
            onClick={extension.enabled ? onDisable : onEnable}
          >
            {extension.enabled ? "Disable" : "Enable"}
          </button>
          <button
            className="btn-icon text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove extension"
          >
            <TrashIcon />
          </button>
        </div>
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
            <div className={
              !extension.enabled
                ? "text-dark-500"
                : extension.loaded
                  ? "text-accent-success"
                  : "text-red-400"
            }>
              {!extension.enabled ? "Disabled" : extension.loaded ? "Loaded" : "Failed"}
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
