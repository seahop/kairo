import { useState, useMemo } from "react";
import { usePluginStore, Plugin } from "@/plugins/api";
import { useHooks, HookType, FilterType } from "@/plugins/api";
import { SlotType } from "@/plugins/api";
import { useCommands } from "@/plugins/api";

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

interface PluginManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Wrapper component that handles the early return
// This prevents hooks from running when the modal is closed
export function PluginManager({ isOpen, onClose }: PluginManagerProps) {
  if (!isOpen) return null;
  return <PluginManagerContent onClose={onClose} />;
}

// Inner component that only mounts when modal is open
function PluginManagerContent({ onClose }: { onClose: () => void }) {
  const { plugins, enablePlugin, disablePlugin } = usePluginStore();
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);

  // Subscribe to the commands Map directly and derive array with useMemo
  const commandsMap = useCommands((state) => state.commands);
  const commands = useMemo(() => Array.from(commandsMap.values()), [commandsMap]);

  const pluginList = Array.from(plugins.values());

  // Get hooks registered by selected plugin
  const getPluginHookInfo = (pluginId: string) => {
    return useHooks.getState().getPluginHooks(pluginId);
  };

  // All available hooks for documentation
  const getAllHookTypes = (): HookType[] => {
    return [
      "onVaultOpen",
      "onVaultClose",
      "onNoteCreate",
      "onNoteSave",
      "onNoteDelete",
      "onNoteOpen",
      "onNoteClose",
      "onSearch",
      "onSearchResult",
      "onAppInit",
      "onAppClose",
      "onEditorReady",
      "onEditorChange",
      "onPreviewRender",
      "onCommandExecute",
      "onPluginLoad",
      "onPluginUnload",
      "onSettingsChange",
    ];
  };

  // All available filter types
  const getAllFilterTypes = (): FilterType[] => {
    return [
      "filterNoteContent",
      "filterSearchResults",
      "filterPreviewHtml",
      "filterCommands",
      "filterSidebarItems",
      "filterStatusbarItems",
    ];
  };

  // Get slots info
  const getSlotTypes = (): SlotType[] => {
    return [
      "sidebar",
      "sidebar-footer",
      "toolbar",
      "statusbar",
      "editor-toolbar",
      "editor-footer",
      "preview-footer",
      "modal",
    ];
  };

  // Get commands for a plugin
  const getPluginCommands = (pluginId: string) => {
    return commands.filter(cmd => cmd.pluginId === pluginId);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800">
          <h2 className="text-lg font-semibold text-dark-100">Extension Manager</h2>
          <button className="btn-icon" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Plugin List */}
          <div className="w-72 border-r border-dark-800 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-dark-400 mb-3">Installed Extensions</h3>
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

            {/* Extension Points Info */}
            <div className="p-4 border-t border-dark-800">
              <h3 className="text-sm font-medium text-dark-400 mb-3">Action Hooks</h3>
              <div className="text-xs text-dark-500 space-y-1 max-h-32 overflow-y-auto">
                {getAllHookTypes().map(hook => (
                  <div key={hook} className="font-mono">{hook}</div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-dark-800">
              <h3 className="text-sm font-medium text-dark-400 mb-3">Filter Hooks</h3>
              <div className="text-xs text-dark-500 space-y-1">
                {getAllFilterTypes().map(filter => (
                  <div key={filter} className="font-mono">{filter}</div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-dark-800">
              <h3 className="text-sm font-medium text-dark-400 mb-3">UI Slots</h3>
              <div className="text-xs text-dark-500 space-y-1">
                {getSlotTypes().map(slot => (
                  <div key={slot} className="font-mono">{slot}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Plugin Details */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedPlugin ? (
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-dark-100">
                      {selectedPlugin.manifest.name}
                    </h3>
                    <p className="text-dark-400 text-sm mt-1">
                      {selectedPlugin.manifest.description || "No description available"}
                    </p>
                  </div>
                  <button
                    className={selectedPlugin.enabled ? "btn-secondary" : "btn-primary"}
                    onClick={() => {
                      if (selectedPlugin.enabled) {
                        disablePlugin(selectedPlugin.manifest.id);
                      } else {
                        enablePlugin(selectedPlugin.manifest.id);
                      }
                    }}
                  >
                    {selectedPlugin.enabled ? "Disable" : "Enable"}
                  </button>
                </div>

                {/* Plugin Info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="card">
                      <div className="text-sm text-dark-400">Version</div>
                      <div className="text-dark-100">{selectedPlugin.manifest.version}</div>
                    </div>
                    <div className="card">
                      <div className="text-sm text-dark-400">Status</div>
                      <div className={selectedPlugin.enabled ? "text-accent-success" : "text-dark-500"}>
                        {selectedPlugin.enabled ? "Enabled" : "Disabled"}
                      </div>
                    </div>
                    {selectedPlugin.manifest.author && (
                      <div className="card">
                        <div className="text-sm text-dark-400">Author</div>
                        <div className="text-dark-100">{selectedPlugin.manifest.author}</div>
                      </div>
                    )}
                    <div className="card">
                      <div className="text-sm text-dark-400">ID</div>
                      <div className="text-dark-100 font-mono text-sm">{selectedPlugin.manifest.id}</div>
                    </div>
                  </div>

                  {/* Plugin Commands */}
                  {getPluginCommands(selectedPlugin.manifest.id).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-dark-400 mb-2">Commands</h4>
                      <div className="space-y-2">
                        {getPluginCommands(selectedPlugin.manifest.id).map(cmd => (
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

                  {/* Plugin Hooks & Filters */}
                  {(() => {
                    const hookInfo = getPluginHookInfo(selectedPlugin.manifest.id);
                    const hasHooks = hookInfo.hooks.length > 0 || hookInfo.filters.length > 0;
                    return hasHooks ? (
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
                    ) : null;
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-dark-500">
                <div className="text-center">
                  <div className="text-6xl mb-4">
                    <PluginIcon />
                  </div>
                  <p>Select an extension to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center justify-between">
            <div className="text-xs text-dark-500">
              {pluginList.length} extension{pluginList.length !== 1 ? "s" : ""} installed
              {" • "}
              {pluginList.filter(p => p.enabled).length} enabled
            </div>
            <div className="text-xs text-dark-500">
              Extensions can hook into: hooks, slots, and commands
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
