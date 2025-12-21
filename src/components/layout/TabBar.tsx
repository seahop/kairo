import { useRef, useState, useEffect } from "react";
import { useUIStore, TabInfo } from "@/stores/uiStore";
import { useNoteStore } from "@/stores/noteStore";
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

interface TabContextMenuState {
  x: number;
  y: number;
  tabId: string | null;
}

function TabContextMenu({
  state,
  onClose,
}: {
  state: TabContextMenuState;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { openTabs, closeTab, closeOtherTabs, closeAllTabs, pinTab, unpinTab } = useUIStore();

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
          closeTab(state.tabId!);
          onClose();
        }}
      >
        Close Tab
        <span className="float-right text-dark-500 text-xs">Ctrl+W</span>
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50"
        onClick={() => {
          closeOtherTabs(state.tabId!);
          onClose();
        }}
      >
        Close Other Tabs
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50"
        onClick={() => {
          closeAllTabs();
          onClose();
        }}
      >
        Close All Tabs
      </button>
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
  const { openTabs, activeTabId, setActiveTab, closeTab } = useUIStore();
  const { notes, openNote, createNote, hasDraft } = useNoteStore();
  const [contextMenu, setContextMenu] = useState<TabContextMenuState>({ x: 0, y: 0, tabId: null });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get note title from path
  const getNoteTitle = (notePath: string): string => {
    const note = notes.find(n => n.path === notePath);
    return note?.title ?? notePath.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled";
  };

  // Check if tab has unsaved changes
  const hasUnsavedChanges = (notePath: string): boolean => {
    return hasDraft(notePath);
  };

  const handleTabActivate = (tab: TabInfo) => {
    setActiveTab(tab.id);
    openNote(tab.notePath);
  };

  const handleTabClose = (tabId: string) => {
    closeTab(tabId);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const handleNewTab = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `notes/new-note-${timestamp}-${Date.now()}.md`;
    // Create tab FIRST, then create note (so openNote finds the tab already exists)
    useUIStore.getState().openTab(fileName);
    createNote(fileName);
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
            noteTitle={getNoteTitle(tab.notePath)}
            hasUnsavedChanges={hasUnsavedChanges(tab.notePath)}
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
      />
    </div>
  );
}
