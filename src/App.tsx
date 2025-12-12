import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
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

// Plugin components
import {
  initBuiltinPlugins,
  GitModal,
  KanbanBoard,
  TemplateModal,
  SnippetModal,
  useGitStore,
  useKanbanStore,
  useTemplateStore,
  useSnippetStore,
  useGraphStore,
} from "./plugins/builtin";

// Initialize plugins on app load
let pluginsInitialized = false;

// Keyboard Shortcuts Modal
function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: "Ctrl+K", action: "Command Palette" },
    { key: "Ctrl+P", action: "Command Palette" },
    { key: "Ctrl+Shift+F", action: "Global Search" },
    { key: "Ctrl+N", action: "New Note" },
    { key: "Ctrl+Shift+N", action: "New Note (Templates)" },
    { key: "Ctrl+D", action: "Daily Note" },
    { key: "Ctrl+S", action: "Save Note" },
    { key: "Ctrl+B", action: "Toggle Sidebar" },
    { key: "Ctrl+Shift+V", action: "Cycle View Mode" },
    { key: "Ctrl+Shift+G", action: "Graph View" },
    { key: "Ctrl+G", action: "Local Graph" },
    { key: "Ctrl+Shift+K", action: "Kanban Board" },
    { key: "Ctrl+Shift+P", action: "Git Pull" },
    { key: "Ctrl+Shift+C", action: "Git Commit" },
    { key: "Ctrl+Shift+U", action: "Git Push" },
    { key: "Ctrl+Click", action: "Follow Wiki Link" },
    { key: "Escape", action: "Close Modal" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md border border-dark-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-dark-100 mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-dark-400">{s.action}</span>
              <kbd className="px-2 py-0.5 bg-dark-800 rounded text-dark-200 text-xs">{s.key}</kbd>
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

function App() {
  const { vault, isLoading, openVault, tryOpenLastVault, loadRecentVaults } = useVaultStore();
  const { isSearchOpen, setSearchOpen, toggleSidebar, mainViewMode, setMainViewMode, openModal } = useUIStore();
  const { createNote, createFolder, openDailyNote } = useNoteStore();
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setShortcutsOpen] = useState(false);
  const [isAboutOpen, setAboutOpen] = useState(false);
  const [isPluginManagerOpen, setPluginManagerOpen] = useState(false);
  const [hasTriedAutoOpen, setHasTriedAutoOpen] = useState(false);

  // Plugin states (used by plugin modals)
  const gitStore = useGitStore();
  const kanbanStore = useKanbanStore();
  const templateStore = useTemplateStore();
  const snippetStore = useSnippetStore();
  const graphStore = useGraphStore();
  const { cycleEditorViewMode } = useUIStore();

  // Initialize plugins and try to auto-open last vault
  useEffect(() => {
    if (!pluginsInitialized) {
      initBuiltinPlugins();
      pluginsInitialized = true;
    }

    // Load recent vaults and try to open last vault
    loadRecentVaults();
    if (!hasTriedAutoOpen && !vault && !isLoading) {
      setHasTriedAutoOpen(true);
      tryOpenLastVault();
    }
  }, [hasTriedAutoOpen, vault, isLoading, tryOpenLastVault, loadRecentVaults]);

  // Menu event handlers
  useEffect(() => {
    const handleOpenVault = async () => {
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
    };

    const handleNewFolder = () => {
      const folderName = prompt("Folder name:");
      if (folderName) {
        createFolder(`notes/${folderName.trim()}`);
      }
    };

    const handlers: Record<string, () => void> = {
      "kairo:new-note": () => {
        const timestamp = new Date().toISOString().split("T")[0];
        createNote(`notes/new-note-${timestamp}.md`);
      },
      "kairo:new-folder": handleNewFolder,
      "kairo:open-vault": handleOpenVault,
      "kairo:search": () => setSearchOpen(true),
      "kairo:command-palette": () => setCommandPaletteOpen(true),
      "kairo:toggle-sidebar": () => toggleSidebar(),
      "kairo:toggle-preview": () => cycleEditorViewMode(),
      "kairo:kanban": () => kanbanStore.toggleView(),
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

    const listeners = Object.entries(handlers).map(([event, handler]) => {
      window.addEventListener(event, handler);
      return () => window.removeEventListener(event, handler);
    });

    return () => listeners.forEach((cleanup) => cleanup());
  }, [createNote, createFolder, openVault, setSearchOpen, toggleSidebar, cycleEditorViewMode, kanbanStore, gitStore, templateStore, snippetStore, graphStore, setMainViewMode, openDailyNote, openModal]);

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
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <MainPanel />
      </div>
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
    </div>
  );
}

export default App;
