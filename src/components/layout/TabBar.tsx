import { useRef, useState, useEffect, useCallback } from "react";
import { useUIStore, TabInfo } from "@/stores/uiStore";
import { useNoteStore } from "@/stores/noteStore";
import { usePaneStore, PaneNode } from "@/stores/paneStore";
import clsx from "clsx";

// Icons
const FileIcon = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PinIcon = () => (
  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M16 4l4 4-1.5 1.5-1-1L14 12l1.5 4.5-1.5 1.5-4-4-5 5-1-1 5-5-4-4 1.5-1.5L11 10l3.5-3.5-1-1L16 4z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

// Helper to find first leaf with a file in a pane tree
const findFirstFileInTree = (node: PaneNode): string | null => {
  if (node.type === 'leaf') {
    return node.notePath;
  }
  // Check left child first, then right
  const leftResult = findFirstFileInTree(node.children[0]);
  if (leftResult) return leftResult;
  return findFirstFileInTree(node.children[1]);
};

// Helper to collect all leaf paths from a pane tree
const collectLeafPaths = (node: PaneNode): string[] => {
  if (node.type === 'leaf') {
    return node.notePath ? [node.notePath] : [];
  }
  return [...collectLeafPaths(node.children[0]), ...collectLeafPaths(node.children[1])];
};

interface TabContextMenuState {
  x: number;
  y: number;
  tabId: string | null;
}

function TabContextMenu({
  state,
  onClose,
  onRename,
}: {
  state: TabContextMenuState;
  onClose: () => void;
  onRename: (tabId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { openTabs, closeTab, closeOtherTabs, closeAllTabs, pinTab, unpinTab } = useUIStore();
  const { removeTabLayout, clearAllLayouts } = usePaneStore();

  const tab = openTabs.find(t => t.id === state.tabId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  if (!state.tabId || !tab) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-44 bg-dark-850 border border-dark-700 rounded-lg shadow-xl py-1"
      style={{ left: state.x, top: state.y }}
    >
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onRename(state.tabId!);
          onClose();
        }}
      >
        <EditIcon />
        Rename Tab
      </button>
      {tab.isPinned ? (
        <button
          className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
          onClick={() => {
            unpinTab(state.tabId!);
            onClose();
          }}
        >
          <PinIcon />
          Unpin Tab
        </button>
      ) : (
        <button
          className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
          onClick={() => {
            pinTab(state.tabId!);
            onClose();
          }}
        >
          <PinIcon />
          Pin Tab
        </button>
      )}
      <div className="border-t border-dark-700 my-1" />
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50"
        onClick={() => {
          removeTabLayout(state.tabId!);
          closeTab(state.tabId!);
          // If this was the last non-pinned tab, clear layouts
          const remainingTabs = openTabs.filter(t => t.id !== state.tabId);
          if (remainingTabs.length === 0) {
            clearAllLayouts();
          }
          onClose();
        }}
      >
        Close Tab
        <span className="float-right text-dark-500 text-xs">Ctrl+W</span>
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50"
        onClick={() => {
          // Remove layouts for all tabs except the current one and pinned tabs
          openTabs.forEach(t => {
            if (t.id !== state.tabId && !t.isPinned) {
              removeTabLayout(t.id);
            }
          });
          closeOtherTabs(state.tabId!);
          onClose();
        }}
      >
        Close Other Tabs
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50"
        onClick={() => {
          // Check if there will be any pinned tabs remaining
          const pinnedTabs = openTabs.filter(t => t.isPinned);
          if (pinnedTabs.length === 0) {
            clearAllLayouts();
          } else {
            // Remove layouts for non-pinned tabs only
            openTabs.forEach(t => {
              if (!t.isPinned) {
                removeTabLayout(t.id);
              }
            });
          }
          closeAllTabs();
          onClose();
        }}
      >
        Close All Tabs
      </button>
    </div>
  );
}

// Rename Tab Modal
function RenameTabModal({
  tabId,
  currentName,
  onClose,
  onRename,
}: {
  tabId: string;
  currentName: string;
  onClose: () => void;
  onRename: (tabId: string, name: string | undefined) => void;
}) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRename(tabId, name || undefined);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-dark-850 border border-dark-700 rounded-lg p-4 w-80 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-medium text-dark-100 mb-3">Rename Tab</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tab name (leave empty for default)"
            className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-primary"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-dark-300 hover:text-dark-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-accent-primary text-white rounded hover:bg-accent-primary/80"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TabItemProps {
  tab: TabInfo;
  isActive: boolean;
  noteTitle: string;
  hasUnsavedChanges: boolean;
  onActivate: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMiddleClick: () => void;
}

function TabItem({
  tab,
  isActive,
  noteTitle,
  hasUnsavedChanges,
  onActivate,
  onClose,
  onContextMenu,
  onMiddleClick,
}: TabItemProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click to close
    if (e.button === 1) {
      e.preventDefault();
      onMiddleClick();
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className={clsx(
        "group flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm cursor-pointer select-none",
        "border-b-2 transition-colors",
        isActive
          ? "bg-dark-800 text-dark-100 border-accent-primary"
          : "text-dark-400 hover:bg-dark-850 hover:text-dark-200 border-transparent",
        tab.isPinned && "pl-2"
      )}
      style={{ maxWidth: tab.isPinned ? "120px" : "180px", minWidth: tab.isPinned ? "auto" : "100px" }}
      onClick={onActivate}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
      title={noteTitle}
    >
      {/* Unsaved indicator */}
      {hasUnsavedChanges && (
        <span className="w-2 h-2 rounded-full bg-accent-primary shrink-0" />
      )}

      {/* Pin icon for pinned tabs */}
      {tab.isPinned && !hasUnsavedChanges && (
        <PinIcon />
      )}

      {/* File icon for unpinned tabs */}
      {!tab.isPinned && !hasUnsavedChanges && (
        <FileIcon />
      )}

      {/* Title - truncated */}
      <span className={clsx("truncate flex-1", tab.isPinned && "sr-only")}>
        {noteTitle}
      </span>

      {/* Close button - hidden for pinned, visible on hover for others */}
      {!tab.isPinned && (
        <button
          className={clsx(
            "p-0.5 rounded transition-colors shrink-0",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-dark-700 text-dark-400 hover:text-dark-200"
          )}
          onClick={handleCloseClick}
          title="Close tab"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

export function TabBar() {
  const { openTabs, activeTabId, setActiveTab, closeTab, renameTab } = useUIStore();
  const { notes } = useNoteStore();
  const paneState = usePaneStore();
  const { switchToTab, createLayoutForTab, removeTabLayout, clearAllLayouts, getAllLeafPanes, root, currentTabId, tabLayouts } = paneState;
  const [contextMenu, setContextMenu] = useState<TabContextMenuState>({ x: 0, y: 0, tabId: null });
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get note title from path
  const getNoteTitleFromPath = useCallback((notePath: string): string => {
    if (!notePath) return "New Tab";
    const note = notes.find(n => n.path === notePath);
    return note?.title ?? notePath.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled";
  }, [notes]);

  // Get the pane tree for a tab
  const getPaneTreeForTab = useCallback((tabId: string): PaneNode | null => {
    if (currentTabId === tabId && root) {
      return root;
    }
    const savedLayout = tabLayouts.get(tabId);
    return savedLayout?.root ?? null;
  }, [currentTabId, root, tabLayouts]);

  // Get tab title - check custom name first, then derive from panes
  const getTabTitle = useCallback((tab: TabInfo): string => {
    // Custom name takes priority
    if (tab.customName) {
      return tab.customName;
    }

    // Try to derive from pane tree
    const paneTree = getPaneTreeForTab(tab.id);
    if (paneTree) {
      const paths = collectLeafPaths(paneTree);
      if (paths.length === 0) {
        return "New Tab";
      } else if (paths.length === 1) {
        return getNoteTitleFromPath(paths[0]);
      } else {
        // Multiple files - show first file + count
        const firstTitle = getNoteTitleFromPath(paths[0]);
        return `${firstTitle} +${paths.length - 1}`;
      }
    }

    // Fallback to legacy notePath on tab
    return getNoteTitleFromPath(tab.notePath);
  }, [getPaneTreeForTab, getNoteTitleFromPath]);

  // Check if tab has unsaved changes (check all panes in the tab's layout)
  const hasUnsavedChanges = useCallback((tabId: string): boolean => {
    const paneTree = getPaneTreeForTab(tabId);
    if (!paneTree) return false;

    // Check current panes for the active tab
    if (currentTabId === tabId) {
      const panes = getAllLeafPanes();
      return panes.some(p => p.hasUnsavedChanges);
    }

    // For inactive tabs, we can't easily check - would need to store state
    return false;
  }, [getPaneTreeForTab, currentTabId, getAllLeafPanes]);

  const handleTabActivate = (tab: TabInfo) => {
    setActiveTab(tab.id);
    // Switch to this tab's pane layout
    switchToTab(tab.id);
  };

  const handleTabClose = (tabId: string) => {
    // Remove the tab's pane layout
    removeTabLayout(tabId);
    closeTab(tabId);
    // If this was the last tab, clear all layouts
    const remainingTabs = openTabs.filter(t => t.id !== tabId);
    if (remainingTabs.length === 0) {
      clearAllLayouts();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleNewTab = () => {
    // Create a new empty tab (no file creation)
    const newTabId = useUIStore.getState().openTab("", { forceNew: true });
    // Create a fresh pane layout for this tab
    createLayoutForTab(newTabId);
  };

  // If no tabs, show empty state
  if (openTabs.length === 0) {
    return (
      <div className="flex items-center h-9 bg-dark-900 border-b border-dark-800 px-2">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-400 hover:text-dark-200 hover:bg-dark-850 rounded"
          onClick={handleNewTab}
          title="New Tab (Ctrl+T)"
        >
          <PlusIcon />
          <span>New Tab</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center h-9 bg-dark-900 border-b border-dark-800">
      {/* Scrollable tab container */}
      <div
        ref={scrollContainerRef}
        className="flex items-end gap-0.5 flex-1 overflow-x-auto scrollbar-none px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {openTabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            noteTitle={getTabTitle(tab)}
            hasUnsavedChanges={hasUnsavedChanges(tab.id)}
            onActivate={() => handleTabActivate(tab)}
            onClose={() => handleTabClose(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            onMiddleClick={() => handleTabClose(tab.id)}
          />
        ))}
      </div>

      {/* New tab button */}
      <button
        className="flex items-center justify-center w-8 h-8 text-dark-400 hover:text-dark-200 hover:bg-dark-850 rounded mx-1 shrink-0"
        onClick={handleNewTab}
        title="New Tab (Ctrl+T)"
      >
        <PlusIcon />
      </button>

      {/* Context menu */}
      <TabContextMenu
        state={contextMenu}
        onClose={() => setContextMenu({ x: 0, y: 0, tabId: null })}
        onRename={(tabId) => setRenamingTabId(tabId)}
      />

      {/* Rename tab modal */}
      {renamingTabId && (
        <RenameTabModal
          tabId={renamingTabId}
          currentName={openTabs.find(t => t.id === renamingTabId)?.customName ?? getTabTitle(openTabs.find(t => t.id === renamingTabId)!)}
          onClose={() => setRenamingTabId(null)}
          onRename={renameTab}
        />
      )}
    </div>
  );
}
