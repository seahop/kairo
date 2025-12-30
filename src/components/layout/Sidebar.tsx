import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { FixedSizeList as List } from "react-window";
import { useNoteStore, NoteMetadata } from "@/stores/noteStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { usePaneStore } from "@/stores/paneStore";
import { useContextMenuStore, ContextMenuContext } from "@/plugins/api/contextMenu";
import { TrashModal } from "@/components/common/TrashModal";
import { TagPane } from "@/components/layout/TagPane";
import clsx from "clsx";

// Context menu state
interface ContextMenuState {
  x: number;
  y: number;
  note: NoteMetadata | null;
  isMultiSelect?: boolean; // True when multiple notes are selected
}

// Context Menu Component
function NoteContextMenu({
  state,
  onClose,
  onDelete,
  onRename,
  onArchive,
  onStar,
  onOpenInNewTab,
  selectedCount,
  onDeleteMultiple,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onDelete: (note: NoteMetadata) => void;
  onRename: (note: NoteMetadata) => void;
  onArchive: (note: NoteMetadata) => void;
  onStar: (note: NoteMetadata) => void;
  onOpenInNewTab: (note: NoteMetadata) => void;
  selectedCount: number;
  onDeleteMultiple: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Get extension items for the note-tree context menu
  // Subscribe to menus state for reactivity
  const menus = useContextMenuStore((s) => s.menus);
  void menus; // Subscribe to changes

  const context: ContextMenuContext = {
    type: "note-tree",
    notePath: state.note?.path,
    noteTitle: state.note?.title,
    event: { clientX: state.x, clientY: state.y },
  };
  const extensionItems = useContextMenuStore.getState().getMenuItems("note-tree", context);

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

  if (!state.note) return null;

  // Multi-select mode: show simplified menu for bulk operations
  if (state.isMultiSelect && selectedCount > 1) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 min-w-48 bg-dark-850 border border-dark-700 rounded-lg shadow-xl py-1"
        style={{ left: state.x, top: state.y }}
      >
        <div className="px-4 py-2 text-xs text-dark-400 border-b border-dark-700">
          {selectedCount} notes selected
        </div>
        <button
          className="w-full px-4 py-2 text-left text-sm text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 flex items-center gap-2"
          onClick={() => {
            onDeleteMultiple();
            onClose();
          }}
        >
          <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">🗑</span>
          Move {selectedCount} to Trash
          <span className="ml-auto text-xs text-dark-500">Del</span>
        </button>
      </div>
    );
  }

  // Single note menu
  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-dark-850 border border-dark-700 rounded-lg shadow-xl py-1"
      style={{ left: state.x, top: state.y }}
    >
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onOpenInNewTab(state.note!);
          onClose();
        }}
      >
        <span className="w-4 h-4 flex items-center justify-center text-base leading-none font-bold">+</span>
        Open in New Tab
        <span className="ml-auto text-xs text-dark-500">Ctrl+Click</span>
      </button>
      <div className="border-t border-dark-700 my-1" />
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onRename(state.note!);
          onClose();
        }}
      >
        <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">✏</span>
        Rename
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          navigator.clipboard.writeText(`[[${state.note!.title}]]`);
          onClose();
        }}
      >
        <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">🔗</span>
        Copy Link
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onStar(state.note!);
          onClose();
        }}
      >
        <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">{state.note?.starred ? "★" : "☆"}</span>
        {state.note?.starred ? "Unstar" : "Star"}
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onArchive(state.note!);
          onClose();
        }}
      >
        <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">📦</span>
        {state.note?.archived ? "Unarchive" : "Archive"}
      </button>
      {/* Extension menu items */}
      {extensionItems.length > 0 && (
        <>
          <div className="border-t border-dark-700 my-1" />
          {extensionItems.map((item) => (
            <button
              key={item.id}
              className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
              onClick={() => {
                item.execute(context);
                onClose();
              }}
            >
              {item.icon && <span className="w-4 text-center">{item.icon}</span>}
              {item.label}
              {item.shortcut && <span className="ml-auto text-xs text-dark-500">{item.shortcut}</span>}
            </button>
          ))}
        </>
      )}
      <div className="border-t border-dark-700 my-1" />
      <button
        className="w-full px-4 py-2 text-left text-sm text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 flex items-center gap-2"
        onClick={() => {
          onDelete(state.note!);
          onClose();
        }}
      >
        <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">🗑</span>
        Move to Trash
        <span className="ml-auto text-xs text-dark-500">Del</span>
      </button>
    </div>
  );
}

// Icons using text characters to avoid WebKitGTK SVG rendering bugs
// (same approach used for window controls - see Icons.tsx)
const FolderIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">📁</span>
);

const FileIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">📄</span>
);

const PlusIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-base leading-none font-bold">+</span>
);

const SearchIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">🔍</span>
);

const GraphIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">🔗</span>
);

const HealthIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">✓</span>
);

const TrashIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">🗑</span>
);

const TagsIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-sm leading-none">🏷</span>
);

const CollapseIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-base leading-none">«</span>
);

const ExpandIcon = () => (
  <span className="w-4 h-4 flex items-center justify-center text-base leading-none">»</span>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <span className={clsx("w-3 h-3 flex items-center justify-center text-xs leading-none transition-transform", expanded && "rotate-90")}>
    ›
  </span>
);

const StarIcon = ({ filled, className = "w-3 h-3" }: { filled?: boolean; className?: string }) => (
  <span className={clsx(className, "flex items-center justify-center leading-none", filled ? "text-yellow-500" : "text-current")}>
    {filled ? "★" : "☆"}
  </span>
);

interface FolderNode {
  name: string;
  path: string;
  notes: NoteMetadata[];
  children: Map<string, FolderNode>;
}

function buildFolderTree(notes: NoteMetadata[]): FolderNode {
  const root: FolderNode = {
    name: "notes",
    path: "notes",
    notes: [],
    children: new Map(),
  };

  for (const note of notes) {
    const parts = note.path.split("/");
    let current = root;

    // Navigate/create folder structure
    // Start at index 1 to skip "notes" since root already represents it
    const startIndex = parts[0] === "notes" ? 1 : 0;
    for (let i = startIndex; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          notes: [],
          children: new Map(),
        });
      }
      current = current.children.get(part)!;
    }

    // Add note to its folder
    current.notes.push(note);
  }

  return root;
}

// Flattened item types for virtual scrolling
type FlatItem =
  | { type: 'folder'; folder: FolderNode; level: number; hasChildren: boolean }
  | { type: 'note'; note: NoteMetadata; level: number };

// Flatten tree to list based on expanded folders
function flattenTree(
  folder: FolderNode,
  level: number,
  expandedFolders: Set<string>
): FlatItem[] {
  const items: FlatItem[] = [];

  const hasChildren = folder.children.size > 0 || folder.notes.length > 0;

  // Add folder header (skip root folder display)
  if (level > 0) {
    items.push({ type: 'folder', folder, level, hasChildren });
  }

  // If folder is expanded (or is root), add children
  const isExpanded = level === 0 || expandedFolders.has(folder.path);
  if (isExpanded) {
    // Sort and add subfolders
    const sortedChildren = Array.from(folder.children.values()).sort((a, b) =>
      naturalSort(a.name.toLowerCase(), b.name.toLowerCase())
    );
    for (const child of sortedChildren) {
      items.push(...flattenTree(child, level + 1, expandedFolders));
    }

    // Sort and add notes
    const sortedNotes = [...folder.notes].sort((a, b) =>
      naturalSort(a.title.toLowerCase(), b.title.toLowerCase())
    );
    for (const note of sortedNotes) {
      items.push({ type: 'note', note, level: level + 1 });
    }
  }

  return items;
}

// Constants for virtual scrolling
const ROW_HEIGHT = 28;
const OVERSCAN_COUNT = 10;


// Natural sort comparator - handles numbers in strings correctly (e.g., "note2" before "note10")
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function Sidebar() {
  // Use selective Zustand subscriptions to prevent unnecessary re-renders
  const vault = useVaultStore((state) => state.vault);
  const notes = useNoteStore((state) => state.notes);
  const loadNotes = useNoteStore((state) => state.loadNotes);
  const createNote = useNoteStore((state) => state.createNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const renameNote = useNoteStore((state) => state.renameNote);
  const setNoteArchived = useNoteStore((state) => state.setNoteArchived);
  const setNoteStarred = useNoteStore((state) => state.setNoteStarred);
  const getStarredNotes = useNoteStore((state) => state.getStarredNotes);
  const showArchived = useNoteStore((state) => state.showArchived);
  const setShowArchived = useNoteStore((state) => state.setShowArchived);
  const setSearchOpen = useUIStore((state) => state.setSearchOpen);
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const mainViewMode = useUIStore((state) => state.mainViewMode);
  const setMainViewMode = useUIStore((state) => state.setMainViewMode);
  const showConfirmDialog = useUIStore((state) => state.showConfirmDialog);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, note: null });
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [renamingNote, setRenamingNote] = useState<NoteMetadata | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [sidebarView, setSidebarView] = useState<"files" | "tags">("files");
  // Drag and drop state
  const [draggedNotes, setDraggedNotes] = useState<Set<string>>(new Set());
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  // Virtual scrolling - track expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['notes']));
  const renameInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  const trashItemCount = useNoteStore((state) => state.trashItems.length);

  useEffect(() => {
    if (vault) {
      loadNotes();
    }
  }, [vault, loadNotes]);

  // Keyboard handler for Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if sidebar is focused or selected notes exist
      if (e.key === "Delete" && selectedNotes.size > 0 && !renamingNote) {
        e.preventDefault();
        handleDeleteMultiple();
      }
      // Escape to deselect
      if (e.key === "Escape") {
        setSelectedNotes(new Set());
        setLastSelectedPath(null);
        setContextMenu({ x: 0, y: 0, note: null });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNotes, renamingNote]);

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renamingNote && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingNote]);

  // Memoize the folder tree to prevent expensive O(n) rebuild on every render
  // Filter notes based on showArchived setting
  const visibleNotes = useMemo(
    () => showArchived ? notes : notes.filter(n => !n.archived),
    [notes, showArchived]
  );
  const folderTree = useMemo(() => buildFolderTree(visibleNotes), [visibleNotes]);

  // Flatten tree for virtual scrolling
  const flattenedItems = useMemo(
    () => flattenTree(folderTree, 0, expandedFolders),
    [folderTree, expandedFolders]
  );

  // Measure list container height for virtual scrolling
  useEffect(() => {
    if (!listContainerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });
    resizeObserver.observe(listContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Toggle folder expanded state
  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  // Memoize sorted starred notes
  const sortedStarredNotes = useMemo(
    () => getStarredNotes().sort((a, b) => naturalSort(a.title.toLowerCase(), b.title.toLowerCase())),
    [getStarredNotes, notes] // Re-sort when notes change
  );

  const handleNewNote = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `notes/new-note-${timestamp}.md`;
    createNote(fileName);
  };

  // Create a flat list of notes for range selection (sorted alphabetically)
  const flatNoteList = useMemo(() => {
    const allNotes: NoteMetadata[] = [];
    // Add starred notes first
    allNotes.push(...sortedStarredNotes);
    // Then add all visible notes (they may overlap with starred, but we use paths for selection)
    allNotes.push(...visibleNotes.sort((a, b) => naturalSort(a.title.toLowerCase(), b.title.toLowerCase())));
    // Deduplicate by path
    const seen = new Set<string>();
    return allNotes.filter(note => {
      if (seen.has(note.path)) return false;
      seen.add(note.path);
      return true;
    });
  }, [sortedStarredNotes, visibleNotes]);

  // Handle note click with multi-select support
  const handleNoteClick = (e: React.MouseEvent, note: NoteMetadata) => {
    if (e.shiftKey && lastSelectedPath) {
      // Shift+click: select range
      e.preventDefault();
      const lastIndex = flatNoteList.findIndex(n => n.path === lastSelectedPath);
      const currentIndex = flatNoteList.findIndex(n => n.path === note.path);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const newSelection = new Set(selectedNotes);
        for (let i = start; i <= end; i++) {
          newSelection.add(flatNoteList[i].path);
        }
        setSelectedNotes(newSelection);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle selection
      e.preventDefault();
      const newSelection = new Set(selectedNotes);
      if (newSelection.has(note.path)) {
        newSelection.delete(note.path);
      } else {
        newSelection.add(note.path);
      }
      setSelectedNotes(newSelection);
      setLastSelectedPath(note.path);
    } else {
      // Regular click: open note and clear selection, but keep as anchor for shift-select
      usePaneStore.getState().openNoteInActivePane(note.path);
      setSelectedNotes(new Set());
      setLastSelectedPath(note.path); // Keep as anchor for shift-click range selection
    }
  };

  const handleContextMenu = (e: React.MouseEvent, note: NoteMetadata) => {
    e.preventDefault();
    // If right-clicking on a note that's not in the selection, select just that note
    if (!selectedNotes.has(note.path)) {
      setSelectedNotes(new Set([note.path]));
      setLastSelectedPath(note.path);
    }
    // Offset y to align menu with cursor (accounts for Tauri window chrome + menu padding)
    setContextMenu({
      x: e.clientX,
      y: e.clientY - 16,
      note,
      isMultiSelect: selectedNotes.size > 1 || (selectedNotes.size === 1 && !selectedNotes.has(note.path))
    });
  };

  const handleDeleteNote = (note: NoteMetadata) => {
    showConfirmDialog({
      title: "Move to Trash",
      message: `Move "${note.title}" to trash? You can restore it later from the trash.`,
      confirmText: "Move to Trash",
      cancelText: "Cancel",
      variant: "warning",
      onConfirm: () => {
        deleteNote(note.path);
        setSelectedNotes(new Set());
        setLastSelectedPath(null);
      },
    });
  };

  const handleDeleteMultiple = () => {
    const count = selectedNotes.size;
    if (count === 0) return;

    const notePaths = Array.from(selectedNotes);
    const noteNames = notePaths.map(path => {
      const note = notes.find(n => n.path === path);
      return note?.title || path.split("/").pop()?.replace(/\.md$/, "") || "Unknown";
    });

    showConfirmDialog({
      title: "Move to Trash",
      message: count === 1
        ? `Move "${noteNames[0]}" to trash?`
        : `Move ${count} notes to trash?\n\n${noteNames.slice(0, 5).join(", ")}${count > 5 ? `, and ${count - 5} more...` : ""}`,
      confirmText: "Move to Trash",
      cancelText: "Cancel",
      variant: "warning",
      onConfirm: () => {
        notePaths.forEach(path => deleteNote(path));
        setSelectedNotes(new Set());
        setLastSelectedPath(null);
      },
    });
  };

  const handleArchiveNote = (note: NoteMetadata) => {
    const isArchived = note.archived;
    const action = isArchived ? "Unarchive" : "Archive";
    const message = isArchived
      ? `Restore "${note.title}" from archive?`
      : `Archive "${note.title}"? This will mark it as archived in the frontmatter.`;

    showConfirmDialog({
      title: `${action} Note`,
      message,
      confirmText: action,
      cancelText: "Cancel",
      variant: "warning",
      onConfirm: () => {
        setNoteArchived(note.path, !isArchived);
        setSelectedNotes(new Set());
        setLastSelectedPath(null);
      },
    });
  };

  const handleStarNote = (note: NoteMetadata) => {
    setNoteStarred(note.path, !note.starred);
  };

  const handleRenameNote = (note: NoteMetadata) => {
    setRenamingNote(note);
    // Extract just the filename without extension
    const filename = note.path.split("/").pop()?.replace(/\.md$/, "") || note.title;
    setRenameValue(filename);
  };

  const handleRenameSubmit = async () => {
    if (!renamingNote || !renameValue.trim()) {
      setRenamingNote(null);
      return;
    }

    const oldPath = renamingNote.path;
    const directory = oldPath.substring(0, oldPath.lastIndexOf("/"));
    const newPath = `${directory}/${renameValue.trim()}.md`;

    if (newPath !== oldPath) {
      try {
        const { renameNote } = useNoteStore.getState();
        await renameNote(oldPath, newPath);
      } catch (err) {
        console.error("Failed to rename note:", err);
      }
    }

    setRenamingNote(null);
    setRenameValue("");
  };

  const handleOpenInNewTab = (note: NoteMetadata) => {
    // Open in new background tab (forceNew allows duplicate tabs of same note)
    useUIStore.getState().openTab(note.path, { background: true, forceNew: true });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, note: NoteMetadata) => {
    // If dragging a note that's already selected, drag all selected notes
    // Otherwise, just drag this one note
    if (selectedNotes.has(note.path)) {
      setDraggedNotes(new Set(selectedNotes));
      e.dataTransfer.setData("text/plain", `Moving ${selectedNotes.size} notes`);
    } else {
      setDraggedNotes(new Set([note.path]));
      e.dataTransfer.setData("text/plain", note.title);
    }
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedNotes(new Set());
    setDropTargetFolder(null);
  };

  const handleDrop = async (targetFolder: string) => {
    if (draggedNotes.size === 0) return;

    const notesToMove = Array.from(draggedNotes);
    const movePromises: Promise<void>[] = [];

    for (const notePath of notesToMove) {
      const fileName = notePath.split("/").pop();
      if (!fileName) continue;

      // Check if the note is already in this folder
      const currentFolder = notePath.substring(0, notePath.lastIndexOf("/"));
      if (currentFolder === targetFolder) continue;

      const newPath = `${targetFolder}/${fileName}`;
      movePromises.push(renameNote(notePath, newPath));
    }

    try {
      await Promise.all(movePromises);
      setSelectedNotes(new Set());
      setLastSelectedPath(null);
    } catch (error) {
      console.error("Failed to move notes:", error);
    }

    setDraggedNotes(new Set());
    setDropTargetFolder(null);
  };

  if (isSidebarCollapsed) {
    return (
      <div className="w-12 bg-dark-900 border-r border-dark-800 flex flex-col items-center py-4 gap-4">
        <button className="btn-icon" title="Expand Sidebar (Ctrl+B)" onClick={toggleSidebar}>
          <ExpandIcon />
        </button>
        <div className="w-6 h-px bg-dark-700" />
        <button className="btn-icon" title="Search" onClick={() => setSearchOpen(true)}>
          <SearchIcon />
        </button>
        <button className="btn-icon" title="New Note" onClick={handleNewNote}>
          <PlusIcon />
        </button>
        <button
          className={clsx("btn-icon", mainViewMode === "graph" && "text-accent-primary")}
          title="Graph View"
          onClick={() => setMainViewMode(mainViewMode === "graph" ? "notes" : "graph")}
        >
          <GraphIcon />
        </button>
        <button
          className={clsx("btn-icon", mainViewMode === "vault-health" && "text-accent-primary")}
          title="Vault Health"
          onClick={() => setMainViewMode(mainViewMode === "vault-health" ? "notes" : "vault-health")}
        >
          <HealthIcon />
        </button>
        <button
          className={clsx("btn-icon", sidebarView === "tags" && "text-accent-primary")}
          title="Tags"
          onClick={() => setSidebarView(sidebarView === "tags" ? "files" : "tags")}
        >
          <TagsIcon />
        </button>
        <div className="flex-1" />
        <button
          className="btn-icon relative"
          title="Trash"
          onClick={() => setShowTrashModal(true)}
        >
          <TrashIcon />
          {trashItemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {trashItemCount > 9 ? "9+" : trashItemCount}
            </span>
          )}
        </button>
        <TrashModal isOpen={showTrashModal} onClose={() => setShowTrashModal(false)} />
      </div>
    );
  }

  return (
    <div className="bg-dark-900 flex flex-col h-full w-full">
      {/* Header */}
      <div className="p-4 border-b border-dark-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-dark-100 truncate flex-1">{vault?.name}</h2>
          <button
            className="btn-icon ml-2 shrink-0"
            title="Collapse Sidebar (Ctrl+B)"
            onClick={toggleSidebar}
          >
            <CollapseIcon />
          </button>
        </div>

        {/* Search button */}
        <button
          className="w-full flex items-center gap-2 px-3 py-2 bg-dark-800 rounded-lg text-dark-400 hover:text-dark-200 transition-colors"
          onClick={() => setSearchOpen(true)}
        >
          <SearchIcon />
          <span className="text-sm">Search...</span>
          <span className="ml-auto text-xs text-dark-500">Ctrl+K</span>
        </button>
      </div>

      {/* View Switcher */}
      <div className="px-4 py-2 border-b border-dark-800">
        <div className="flex bg-dark-800 rounded-lg p-1 mb-3">
          <button
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              mainViewMode === "notes"
                ? "bg-dark-700 text-dark-100"
                : "text-dark-400 hover:text-dark-200"
            )}
            onClick={() => setMainViewMode("notes")}
          >
            <FileIcon />
            <span>Notes</span>
          </button>
          <button
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              mainViewMode === "graph"
                ? "bg-accent-primary text-white"
                : "text-dark-400 hover:text-dark-200"
            )}
            onClick={() => setMainViewMode("graph")}
          >
            <GraphIcon />
            <span>Graph</span>
          </button>
        </div>

        {/* New Note button */}
        <button
          className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-200"
          onClick={handleNewNote}
        >
          <PlusIcon />
          <span>New Note</span>
        </button>

        {/* Vault Health button */}
        <button
          className={clsx(
            "flex items-center gap-2 text-sm mt-2",
            mainViewMode === "vault-health"
              ? "text-accent-primary"
              : "text-dark-400 hover:text-dark-200"
          )}
          onClick={() => setMainViewMode(mainViewMode === "vault-health" ? "notes" : "vault-health")}
        >
          <HealthIcon />
          <span>Vault Health</span>
        </button>

        {/* Files / Tags toggle */}
        <div className="flex bg-dark-800 rounded-lg p-0.5 mt-3">
          <button
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              sidebarView === "files"
                ? "bg-dark-700 text-dark-100"
                : "text-dark-400 hover:text-dark-200"
            )}
            onClick={() => setSidebarView("files")}
          >
            <FileIcon />
            <span>Files</span>
          </button>
          <button
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              sidebarView === "tags"
                ? "bg-dark-700 text-dark-100"
                : "text-dark-400 hover:text-dark-200"
            )}
            onClick={() => setSidebarView("tags")}
          >
            <TagsIcon />
            <span>Tags</span>
          </button>
        </div>
      </div>

      {/* Tag Pane */}
      {sidebarView === "tags" && (
        <div className="flex-1 overflow-hidden">
          <TagPane />
        </div>
      )}

      {/* File tree */}
      {sidebarView === "files" && (
      <div className="flex-1 overflow-hidden flex flex-col" ref={sidebarRef} tabIndex={0}>
        {/* Starred Notes Section - sorted alphabetically (not virtualized, usually small) */}
        {sortedStarredNotes.length > 0 && (
          <div className="mb-2 py-2 shrink-0">
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-dark-400 text-xs font-medium uppercase tracking-wider"
            >
              <StarIcon filled className="w-3 h-3 text-yellow-500" />
              <span>Starred</span>
            </div>
            {sortedStarredNotes.map((note) => (
              <div
                key={`starred-${note.id}`}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded mx-2 select-none",
                  "text-dark-300 hover:bg-dark-800 hover:text-dark-100",
                  useNoteStore.getState().currentNote?.path === note.path && "bg-dark-800 text-accent-primary",
                  selectedNotes.has(note.path) && "ring-1 ring-accent-primary/50 bg-dark-800/50",
                  draggedNotes.has(note.path) && "opacity-50"
                )}
                draggable
                onDragStart={(e) => handleDragStart(e, note)}
                onDragEnd={handleDragEnd}
                onClick={(e) => handleNoteClick(e, note)}
                onMouseDown={(e) => {
                  // Middle-click to open in background tab (forceNew allows duplicates)
                  if (e.button === 1) {
                    e.preventDefault();
                    useUIStore.getState().openTab(note.path, { background: true, forceNew: true });
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, note)}
              >
                <FileIcon />
                <span className="text-sm truncate flex-1">{note.title}</span>
                <StarIcon filled className="w-3 h-3 text-yellow-500 shrink-0" />
              </div>
            ))}
            <div className="border-b border-dark-800 mx-3 mt-2" />
          </div>
        )}

        {/* Virtualized folder tree */}
        <div className="flex-1 min-h-0" ref={listContainerRef}>
          {flattenedItems.length > 0 ? (
            <List
              ref={listRef}
              height={listHeight}
              itemCount={flattenedItems.length}
              itemSize={ROW_HEIGHT}
              width="100%"
              overscanCount={OVERSCAN_COUNT}
            >
              {({ index, style }: { index: number; style: React.CSSProperties }) => {
                const item = flattenedItems[index];
                const currentNote = useNoteStore.getState().currentNote;

                if (item.type === 'folder') {
                  const isExpanded = expandedFolders.has(item.folder.path);
                  const isDropTarget = dropTargetFolder === item.folder.path;

                  return (
                    <div
                      style={style}
                      className={clsx(
                        "flex items-center gap-1 px-2 cursor-pointer rounded hover:bg-dark-800",
                        "text-dark-400 hover:text-dark-200",
                        isDropTarget && "bg-accent-primary/20 ring-1 ring-accent-primary"
                      )}
                      onClick={() => toggleFolder(item.folder.path)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedNotes.size > 0) setDropTargetFolder(item.folder.path);
                      }}
                      onDragLeave={() => {
                        if (dropTargetFolder === item.folder.path) setDropTargetFolder(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedNotes.size > 0) handleDrop(item.folder.path);
                        setDropTargetFolder(null);
                      }}
                    >
                      <div style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }} className="flex items-center gap-1">
                        {item.hasChildren && <ChevronIcon expanded={isExpanded} />}
                        <FolderIcon />
                        <span className="text-sm truncate">{item.folder.name}</span>
                      </div>
                    </div>
                  );
                }

                // Note item
                const note = item.note;
                return (
                  <div
                    style={style}
                    className={clsx(
                      "flex items-center gap-2 px-2 cursor-pointer rounded select-none",
                      "text-dark-300 hover:bg-dark-800 hover:text-dark-100",
                      currentNote?.path === note.path && "bg-dark-800 text-accent-primary",
                      selectedNotes.has(note.path) && currentNote?.path !== note.path && "ring-1 ring-accent-primary/50 bg-dark-800/50",
                      draggedNotes.has(note.path) && "opacity-50",
                      note.archived && "opacity-50"
                    )}
                    draggable
                    onDragStart={(e) => handleDragStart(e, note)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => handleNoteClick(e, note)}
                    onMouseDown={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        useUIStore.getState().openTab(note.path, { background: true, forceNew: true });
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, note)}
                  >
                    <div style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }} className="flex items-center gap-2 flex-1 min-w-0">
                      <FileIcon />
                      <span className="text-sm truncate flex-1">{note.title}</span>
                      {note.starred && (
                        <StarIcon filled className="w-3 h-3 text-yellow-500 shrink-0" />
                      )}
                      {note.archived && (
                        <span className="w-3 h-3 flex items-center justify-center text-xs leading-none text-dark-500 shrink-0">📦</span>
                      )}
                    </div>
                  </div>
                );
              }}
            </List>
          ) : (
            <div className="px-4 py-8 text-center text-dark-500 text-sm">
              No notes yet. Create your first note!
            </div>
          )}
        </div>
      </div>
      )}

      {/* Footer */}
      {sidebarView === "files" && (
      <div className="p-4 border-t border-dark-800">
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-dark-600 bg-dark-800 text-accent-primary focus:ring-accent-primary/50 focus:ring-offset-0"
            />
            <span className="text-xs text-dark-400">Show archived</span>
          </label>
          <button
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
            onClick={() => setShowTrashModal(true)}
            title="Open Trash"
          >
            <TrashIcon />
            {trashItemCount > 0 && (
              <span className="text-red-400">{trashItemCount}</span>
            )}
          </button>
        </div>
        <div className="text-xs text-dark-500">
          {visibleNotes.length} notes{showArchived ? "" : ` (${notes.filter(n => n.archived).length} archived)`}
          {selectedNotes.size > 0 && (
            <span className="ml-2 text-accent-primary">• {selectedNotes.size} selected</span>
          )}
        </div>
      </div>
      )}

      {/* Context Menu */}
      <NoteContextMenu
        state={contextMenu}
        onClose={() => setContextMenu({ x: 0, y: 0, note: null })}
        onDelete={handleDeleteNote}
        onRename={handleRenameNote}
        onArchive={handleArchiveNote}
        onStar={handleStarNote}
        onOpenInNewTab={handleOpenInNewTab}
        selectedCount={selectedNotes.size}
        onDeleteMultiple={handleDeleteMultiple}
      />

      {/* Inline Rename Input (modal overlay) */}
      {renamingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setRenamingNote(null)}
          />
          <div className="relative bg-dark-900 border border-dark-700 rounded-lg shadow-xl p-4 w-80">
            <h3 className="text-sm font-medium text-dark-200 mb-3">Rename Note</h3>
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setRenamingNote(null);
              }}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 text-sm focus:outline-none focus:border-accent-primary"
              placeholder="Note name"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 py-1.5 text-sm text-dark-400 hover:text-dark-200"
                onClick={() => setRenamingNote(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-sm bg-accent-primary text-dark-950 rounded-lg hover:bg-accent-primary/90"
                onClick={handleRenameSubmit}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash Modal */}
      <TrashModal isOpen={showTrashModal} onClose={() => setShowTrashModal(false)} />
    </div>
  );
}
