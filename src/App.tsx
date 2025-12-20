import { useEffect, useState, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Sidebar } from "./components/layout/Sidebar";
import { MainPanel } from "./components/layout/MainPanel";
import { StatusBar } from "./components/layout/StatusBar";
import { TitleBar } from "./components/layout/TitleBar";
import { SearchModal } from "./components/search/SearchModal";
import { WelcomeScreen } from "./components/layout/WelcomeScreen";
import { CommandPalette } from "./components/common/CommandPalette";
import { PluginManager } from "./components/common/PluginManager";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { DebugConsole } from "./components/common/DebugConsole";
import { CreateNoteModal } from "./components/modals/CreateNoteModal";
import { useVaultStore } from "./stores/vaultStore";
import { useUIStore } from "./stores/uiStore";
import { useNoteStore } from "./stores/noteStore";
import { useExtensionStore } from "./stores/extensionStore";
import { useCommands } from "./plugins/api";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { invoke } from "@tauri-apps/api/core";
import { preloadDictionary } from "./components/editor/spellcheck";

// Plugin components
import {
  initBuiltinPlugins,
  GitModal,
  GitPassphraseModal,
  KanbanBoard,
  DiagramEditor,
  TemplateModal,
  SnippetModal,
  useGitStore,
  useKanbanStore,
  useDiagramStore,
  useTemplateStore,
  useSnippetStore,
  useGraphStore,
} from "./plugins/builtin";
import { ToastContainer } from "./components/common/Toast";

// Initialize plugins on app load
let pluginsInitialized = false;

// Keyboard Shortcuts Modal
function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcutGroups = [
    {
      title: "General",
      shortcuts: [
        { key: "Ctrl+K / Ctrl+P", action: "Command Palette" },
        { key: "Ctrl+Shift+F", action: "Global Search" },
        { key: "Ctrl+B", action: "Toggle Sidebar" },
        { key: "Ctrl+/", action: "Keyboard Shortcuts" },
        { key: "Escape", action: "Close Modal / Exit View" },
      ],
    },
    {
      title: "Notes",
      shortcuts: [
        { key: "Ctrl+N", action: "New Note" },
        { key: "Ctrl+Shift+N", action: "New Note (Templates)" },
        { key: "Ctrl+D", action: "Daily Note" },
        { key: "Ctrl+S", action: "Save Note" },
        { key: "Ctrl+Shift+V", action: "Cycle View Mode" },
        { key: "Ctrl+Shift+H", action: "Version History" },
        { key: "Alt+Left", action: "Navigate Back" },
        { key: "Alt+Right", action: "Navigate Forward" },
        { key: "Ctrl+Click", action: "Follow Wiki Link" },
      ],
    },
    {
      title: "Views",
      shortcuts: [
        { key: "Ctrl+Shift+G", action: "Graph View" },
        { key: "Ctrl+G", action: "Local Graph" },
        { key: "Ctrl+Shift+K", action: "Kanban Board" },
        { key: "Ctrl+Shift+D", action: "Diagram Editor" },
        { key: "Ctrl+Shift+S", action: "Snippets Library" },
      ],
    },
    {
      title: "Git",
      shortcuts: [
        { key: "Ctrl+Shift+P", action: "Git Pull" },
        { key: "Ctrl+Shift+C", action: "Git Commit" },
        { key: "Ctrl+Shift+U", action: "Git Push" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-dark-900 rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-dark-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-dark-100 mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-dark-500 uppercase mb-2">{group.title}</h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-dark-400">{s.action}</span>
                    <kbd className="px-2 py-0.5 bg-dark-800 rounded text-dark-200 text-xs font-mono">{s.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button className="btn-secondary w-full mt-6" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// About Modal
function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-dark-900 rounded-lg p-6 w-full max-w-sm border border-dark-700 text-center" onClick={e => e.stopPropagation()}>
        <img
          src="/icon.png"
          alt="Kairo"
          className="w-16 h-16 rounded-xl mx-auto mb-4"
        />
        <h2 className="text-xl font-semibold text-dark-100">Kairo</h2>
        <p className="text-dark-400 text-sm mt-1">Version 0.1.0</p>
        <p className="text-dark-500 text-xs mt-4">Team note-taking, reimagined.</p>
        <p className="text-dark-600 text-xs mt-2">Built with Tauri + React</p>
        <button className="btn-secondary w-full mt-6" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// Helper to match keyboard shortcuts from commands
function matchShortcut(e: KeyboardEvent, shortcut: string): boolean {
  // Parse shortcut string like "Ctrl+Shift+W" or "Cmd+K"
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const needsCtrl = parts.includes("ctrl") || parts.includes("cmd");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");

  const pressedKey = e.key.toLowerCase();
  const ctrlPressed = e.ctrlKey || e.metaKey;

  return (
    pressedKey === key &&
    ctrlPressed === needsCtrl &&
    e.shiftKey === needsShift &&
    e.altKey === needsAlt
  );
}

function App() {
  const { vault, isLoading, openVault, tryOpenLastVault, loadRecentVaults } = useVaultStore();
  const { isSearchOpen, setSearchOpen, toggleSidebar, mainViewMode, setMainViewMode, openModal, isSidebarCollapsed, setSidebarWidth } = useUIStore();
  const { createNote, createFolder, openDailyNote } = useNoteStore();
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setShortcutsOpen] = useState(false);
  const [isAboutOpen, setAboutOpen] = useState(false);
  const [isPluginManagerOpen, setPluginManagerOpen] = useState(false);
  const [hasTriedAutoOpen, setHasTriedAutoOpen] = useState(false);

  // Plugin states (used by plugin modals)
  const gitStore = useGitStore();
  const kanbanStore = useKanbanStore();
  const diagramStore = useDiagramStore();
  const templateStore = useTemplateStore();
  const snippetStore = useSnippetStore();
  const graphStore = useGraphStore();
  const { cycleEditorViewMode } = useUIStore();

  // Handle sidebar panel resize - convert percentage to pixels
  const handleSidebarResize = useCallback((size: number) => {
    // Size is in percentage, convert to approximate pixel width based on viewport
    const pixelWidth = Math.round((size / 100) * window.innerWidth);
    setSidebarWidth(pixelWidth);
  }, [setSidebarWidth]);

  // Extension store
  const { loadSettings, loadExtensionsFromFolder } = useExtensionStore();

  // File watcher for external file changes
  useFileWatcher();

  // Initialize plugins and try to auto-open last vault
  useEffect(() => {
    if (!pluginsInitialized) {
      initBuiltinPlugins();
      pluginsInitialized = true;

      // Preload spellcheck dictionary during startup (runs in parallel)
      preloadDictionary().catch(err => {
        console.warn("Failed to preload dictionary:", err);
      });
    }

    // Load recent vaults and try to open last vault
    loadRecentVaults();
    if (!hasTriedAutoOpen && !vault && !isLoading) {
      setHasTriedAutoOpen(true);
      tryOpenLastVault();
    }
  }, [hasTriedAutoOpen, vault, isLoading, tryOpenLastVault, loadRecentVaults]);

  // Auto-load extensions when vault opens
  useEffect(() => {
    if (!vault?.path) return;

    const loadExtensions = async () => {
      try {
        // First load settings (to know which extensions are enabled/disabled)
        await loadSettings(vault.path);

        // Get the extensions folder path
        const extensionsPath = await invoke<string>("get_extensions_path", {
          vaultPath: vault.path
        });

        // Load all extensions from the folder
        await loadExtensionsFromFolder(extensionsPath);
      } catch (err) {
        console.error("Failed to auto-load extensions:", err);
      }
    };

    loadExtensions();
  }, [vault?.path, loadSettings, loadExtensionsFromFolder]);

  // Use refs to store current values of handlers to avoid recreating event listeners
  const handlersRef = useRef<Record<string, () => void>>({});

  // Update refs on each render (refs don't cause re-renders)
  handlersRef.current = {
    "kairo:new-note": () => {
      const timestamp = new Date().toISOString().split("T")[0];
      createNote(`notes/new-note-${timestamp}.md`);
    },
    "kairo:new-folder": () => {
      const folderName = prompt("Folder name:");
      if (folderName) {
        createFolder(`notes/${folderName.trim()}`);
      }
    },
    "kairo:open-vault": async () => {
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          title: "Select Vault Folder",
        });
        if (selected && typeof selected === "string") {
          await openVault(selected);
        }
      } catch (err) {
        console.error("Failed to open vault:", err);
      }
    },
    "kairo:search": () => setSearchOpen(true),
    "kairo:command-palette": () => setCommandPaletteOpen(true),
    "kairo:toggle-sidebar": () => toggleSidebar(),
    "kairo:toggle-preview": () => cycleEditorViewMode(),
    "kairo:kanban": () => kanbanStore.toggleView(),
    "kairo:diagram": () => diagramStore.toggleView(),
    "kairo:git-pull": () => gitStore.pull(),
    "kairo:git-commit": () => gitStore.openCommitModal(),
    "kairo:git-push": () => gitStore.push(),
    "kairo:templates": () => templateStore.openModal(),
    "kairo:snippets": () => snippetStore.openModal(),
    "kairo:graph": () => {
      graphStore.setViewMode("global");
      setMainViewMode("graph");
    },
    "kairo:shortcuts": () => setShortcutsOpen(true),
    "kairo:about": () => setAboutOpen(true),
    "kairo:extensions": () => setPluginManagerOpen(true),
    "kairo:daily-note": () => openDailyNote(),
    "kairo:create-note": () => openModal("create-note"),
  };

  // Menu event handlers - using refs to avoid dependency array issues
  useEffect(() => {
    // Create stable event handlers that call through to the ref
    const createHandler = (eventName: string) => () => {
      handlersRef.current[eventName]?.();
    };

    const eventNames = Object.keys(handlersRef.current);
    const cleanups = eventNames.map((eventName) => {
      const handler = createHandler(eventName);
      window.addEventListener(eventName, handler);
      return () => window.removeEventListener(eventName, handler);
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []); // Empty deps - handlers are accessed via ref

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Ctrl/Cmd + Shift + F: Open search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setSearchOpen(true);
      }

      // Ctrl/Cmd + P: Also open command palette (like VSCode)
      if ((e.ctrlKey || e.metaKey) && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Ctrl/Cmd + D: Open daily note
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && !e.shiftKey) {
        e.preventDefault();
        openDailyNote();
      }

      // Ctrl/Cmd + Shift + N: Open create note modal (templates)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        openModal("create-note");
      }

      // Ctrl/Cmd + N: Quick new note (no template)
      if ((e.ctrlKey || e.metaKey) && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        const timestamp = Date.now();
        createNote(`notes/new-note-${timestamp}.md`);
      }

      // Ctrl/Cmd + B: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
      }

      // Ctrl/Cmd + Shift + V: Cycle editor view mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        cycleEditorViewMode();
      }

      // Ctrl/Cmd + /: Show keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(true);
      }

      // Escape: Close modals or return to notes view
      if (e.key === "Escape") {
        if (isSearchOpen) {
          setSearchOpen(false);
        } else if (isCommandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (mainViewMode === "graph") {
          setMainViewMode("notes");
        }
      }

      // Clipboard operations - handle explicitly for non-input elements (like preview mode)
      // Don't prevent default - let native handling work if available, but also trigger execCommand as backup
      const activeElement = document.activeElement;
      const isInEditor = activeElement?.closest('.cm-editor') !== null;
      const isInInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || (activeElement as HTMLElement)?.isContentEditable;

      if (!isInEditor && !isInInput) {
        if ((e.ctrlKey || e.metaKey) && e.key === "c" && !e.shiftKey) {
          // Copy - use clipboard API for better compatibility
          const selection = window.getSelection();
          if (selection && selection.toString()) {
            navigator.clipboard.writeText(selection.toString()).catch(() => {
              // Fallback to execCommand
              document.execCommand("copy");
            });
          }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "v" && !e.shiftKey) {
          // Paste is only meaningful in editable contexts, skip for preview
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "x" && !e.shiftKey) {
          // Cut is only meaningful in editable contexts, skip for preview
        }
      }

      // Check registered commands for matching shortcuts (extensions, plugins)
      const commands = useCommands.getState().getCommands();
      for (const command of commands) {
        if (command.shortcut && matchShortcut(e, command.shortcut)) {
          e.preventDefault();
          try {
            const result = command.execute();
            // Handle async commands
            if (result instanceof Promise) {
              result.catch((err) => {
                console.error(`Command shortcut ${command.id} failed:`, err);
              });
            }
          } catch (err) {
            console.error(`Command shortcut ${command.id} failed:`, err);
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSearchOpen, isSearchOpen, isCommandPaletteOpen, mainViewMode, setMainViewMode, openDailyNote, openModal]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-dark-950">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">K</div>
            <div className="text-dark-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="h-screen flex flex-col bg-dark-950">
        <TitleBar />
        <WelcomeScreen />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TitleBar />
      <PanelGroup direction="horizontal" className="flex-1">
        {!isSidebarCollapsed && (
          <>
            <Panel
              defaultSize={15}
              minSize={10}
              maxSize={40}
              onResize={handleSidebarResize}
            >
              <Sidebar />
            </Panel>
            <PanelResizeHandle className="w-1 bg-dark-800 hover:bg-accent-primary/50 transition-colors cursor-col-resize" />
          </>
        )}
        {isSidebarCollapsed && <Sidebar />}
        <Panel defaultSize={isSidebarCollapsed ? 100 : 85}>
          <MainPanel />
        </Panel>
      </PanelGroup>
      <StatusBar />

      {/* Modals */}
      {isSearchOpen && (
        <SearchModal onClose={() => setSearchOpen(false)} />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Plugin modals */}
      <GitModal />
      <KanbanBoard />
      <DiagramEditor />
      <TemplateModal />
      <SnippetModal />
      <CreateNoteModal />

      {/* App modals */}
      {isShortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      {isAboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      <PluginManager isOpen={isPluginManagerOpen} onClose={() => setPluginManagerOpen(false)} />

      {/* Confirm dialog */}
      <ConfirmDialog />

      {/* Debug console */}
      <DebugConsole />

      {/* Global passphrase modal - renders on top of everything */}
      <GitPassphraseModal />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}

export default App;
