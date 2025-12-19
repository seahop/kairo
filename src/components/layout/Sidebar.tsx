import { useEffect, useState, useRef, useMemo } from "react";
import { useNoteStore, NoteMetadata } from "@/stores/noteStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import { useContextMenuStore, ContextMenuContext } from "@/plugins/api/contextMenu";
import clsx from "clsx";

// Context menu state
interface ContextMenuState {
  x: number;
  y: number;
  note: NoteMetadata | null;
}

// Context Menu Component
function NoteContextMenu({
  state,
  onClose,
  onDelete,
  onRename,
  onArchive,
  onStar,
  onOpenInNewPane,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onDelete: (note: NoteMetadata) => void;
  onRename: (note: NoteMetadata) => void;
  onArchive: (note: NoteMetadata) => void;
  onStar: (note: NoteMetadata) => void;
  onOpenInNewPane: (note: NoteMetadata) => void;
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

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-48 bg-dark-850 border border-dark-700 rounded-lg shadow-xl py-1"
      style={{ left: state.x, top: state.y }}
    >
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onOpenInNewPane(state.note!);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        Open
      </button>
      <div className="border-t border-dark-700 my-1" />
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onRename(state.note!);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Rename
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          navigator.clipboard.writeText(`[[${state.note!.title}]]`);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Copy Link
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onStar(state.note!);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill={state.note?.starred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        {state.note?.starred ? "Unstar" : "Star"}
      </button>
      <button
        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex items-center gap-2"
        onClick={() => {
          onArchive(state.note!);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
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
        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"
        onClick={() => {
          onDelete(state.note!);
          onClose();
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
        <span className="ml-auto text-xs text-dark-500">Del</span>
      </button>
    </div>
  );
}

// Icons (simple SVG components)
const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const GraphIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="2.5" strokeWidth={2} />
    <circle cx="5" cy="5" r="1.5" strokeWidth={2} />
    <circle cx="19" cy="5" r="1.5" strokeWidth={2} />
    <circle cx="5" cy="19" r="1.5" strokeWidth={2} />
    <circle cx="19" cy="19" r="1.5" strokeWidth={2} />
    <path strokeLinecap="round" strokeWidth={2} d="M9.5 10L6.5 6.5M14.5 10L17.5 6.5M9.5 14L6.5 17.5M14.5 14L17.5 17.5" />
  </svg>
);

const HealthIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CollapseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const ExpandIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={clsx("w-3 h-3 transition-transform", expanded && "rotate-90")}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const StarIcon = ({ filled, className = "w-3 h-3" }: { filled?: boolean; className?: string }) => (
  <svg
    className={className}
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
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

interface FolderItemProps {
  folder: FolderNode;
  level: number;
  selectedNote: NoteMetadata | null;
  onSelectNote: (note: NoteMetadata | null) => void;
  onContextMenu: (e: React.MouseEvent, note: NoteMetadata) => void;
}

function FolderItem({ folder, level, selectedNote, onSelectNote, onContextMenu }: FolderItemProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const { currentNote, openNote } = useNoteStore();

  const hasChildren = folder.children.size > 0 || folder.notes.length > 0;

  return (
    <div>
      {/* Folder header */}
      <div
        className={clsx(
          "flex items-center gap-1 px-2 py-1 cursor-pointer rounded hover:bg-dark-800",
          "text-dark-400 hover:text-dark-200"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren && <ChevronIcon expanded={expanded} />}
        <FolderIcon />
        <span className="text-sm truncate">{folder.name}</span>
      </div>

      {/* Children */}
      {expanded && (
        <div>
          {/* Subfolders */}
          {Array.from(folder.children.values()).map((child) => (
            <FolderItem
              key={child.path}
              folder={child}
              level={level + 1}
              selectedNote={selectedNote}
              onSelectNote={onSelectNote}
              onContextMenu={onContextMenu}
            />
          ))}

          {/* Notes in this folder */}
          {folder.notes.map((note) => (
            <div
              key={note.id}
              className={clsx(
                "flex items-center gap-2 px-2 py-1 cursor-pointer rounded",
                "text-dark-300 hover:bg-dark-800 hover:text-dark-100",
                currentNote?.path === note.path && "bg-dark-800 text-accent-primary",
                selectedNote?.id === note.id && currentNote?.path !== note.path && "ring-1 ring-accent-primary/50",
                note.archived && "opacity-50"
              )}
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  // Ctrl+click to select without opening
                  onSelectNote(selectedNote?.id === note.id ? null : note);
                } else {
                  openNote(note.path);
                  onSelectNote(null);
                }
              }}
              onContextMenu={(e) => onContextMenu(e, note)}
            >
              <FileIcon />
              <span className="text-sm truncate flex-1">{note.title}</span>
              {note.starred && (
                <StarIcon filled className="w-3 h-3 text-yellow-500 shrink-0" />
              )}
              {note.archived && (
                <svg className="w-3 h-3 text-dark-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  // Use selective Zustand subscriptions to prevent unnecessary re-renders
  const vault = useVaultStore((state) => state.vault);
  const notes = useNoteStore((state) => state.notes);
  const loadNotes = useNoteStore((state) => state.loadNotes);
  const createNote = useNoteStore((state) => state.createNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const setNoteArchived = useNoteStore((state) => state.setNoteArchived);
  const setNoteStarred = useNoteStore((state) => state.setNoteStarred);
  const getStarredNotes = useNoteStore((state) => state.getStarredNotes);
  const showArchived = useNoteStore((state) => state.showArchived);
  const setShowArchived = useNoteStore((state) => state.setShowArchived);
  const openNoteInSecondary = useNoteStore((state) => state.openNoteInSecondary);
  const setSearchOpen = useUIStore((state) => state.setSearchOpen);
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const mainViewMode = useUIStore((state) => state.mainViewMode);
  const setMainViewMode = useUIStore((state) => state.setMainViewMode);
  const showConfirmDialog = useUIStore((state) => state.showConfirmDialog);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, note: null });
  const [selectedNote, setSelectedNote] = useState<NoteMetadata | null>(null);
  const [renamingNote, setRenamingNote] = useState<NoteMetadata | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (vault) {
      loadNotes();
    }
  }, [vault, loadNotes]);

  // Keyboard handler for Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if sidebar is focused or selected note exists
      if (e.key === "Delete" && selectedNote && !renamingNote) {
        e.preventDefault();
        handleDeleteNote(selectedNote);
      }
      // Escape to deselect
      if (e.key === "Escape") {
        setSelectedNote(null);
        setContextMenu({ x: 0, y: 0, note: null });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNote, renamingNote]);

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

  const handleNewNote = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `notes/new-note-${timestamp}.md`;
    createNote(fileName);
  };

  const handleContextMenu = (e: React.MouseEvent, note: NoteMetadata) => {
    e.preventDefault();
    // Offset y to align menu with cursor (accounts for Tauri window chrome + menu padding)
    setContextMenu({ x: e.clientX, y: e.clientY - 16, note });
    setSelectedNote(note);
  };

  const handleDeleteNote = (note: NoteMetadata) => {
    showConfirmDialog({
      title: "Delete Note",
      message: `Are you sure you want to delete "${note.title}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: () => {
        deleteNote(note.path);
        setSelectedNote(null);
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
        setSelectedNote(null);
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

  const handleOpenInNewPane = (note: NoteMetadata) => {
    // Open in secondary/split pane
    openNoteInSecondary(note.path);
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
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2" ref={sidebarRef} tabIndex={0}>
        {/* Starred Notes Section */}
        {getStarredNotes().length > 0 && (
          <div className="mb-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-dark-400 text-xs font-medium uppercase tracking-wider"
            >
              <StarIcon filled className="w-3 h-3 text-yellow-500" />
              <span>Starred</span>
            </div>
            {getStarredNotes().map((note) => (
              <div
                key={`starred-${note.id}`}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded mx-2",
                  "text-dark-300 hover:bg-dark-800 hover:text-dark-100",
                  useNoteStore.getState().currentNote?.path === note.path && "bg-dark-800 text-accent-primary",
                  selectedNote?.id === note.id && "ring-1 ring-accent-primary/50"
                )}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    setSelectedNote(selectedNote?.id === note.id ? null : note);
                  } else {
                    useNoteStore.getState().openNote(note.path);
                    setSelectedNote(null);
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

        {folderTree.children.size > 0 || folderTree.notes.length > 0 ? (
          <FolderItem
            folder={folderTree}
            level={0}
            selectedNote={selectedNote}
            onSelectNote={setSelectedNote}
            onContextMenu={handleContextMenu}
          />
        ) : (
          <div className="px-4 py-8 text-center text-dark-500 text-sm">
            No notes yet. Create your first note!
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-dark-800">
        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-dark-600 bg-dark-800 text-accent-primary focus:ring-accent-primary/50 focus:ring-offset-0"
          />
          <span className="text-xs text-dark-400">Show archived</span>
        </label>
        <div className="text-xs text-dark-500">
          {visibleNotes.length} notes{showArchived ? "" : ` (${notes.filter(n => n.archived).length} archived)`}
          {selectedNote && (
            <span className="ml-2 text-accent-primary">• {selectedNote.title} selected</span>
          )}
        </div>
      </div>

      {/* Context Menu */}
      <NoteContextMenu
        state={contextMenu}
        onClose={() => setContextMenu({ x: 0, y: 0, note: null })}
        onDelete={handleDeleteNote}
        onRename={handleRenameNote}
        onArchive={handleArchiveNote}
        onStar={handleStarNote}
        onOpenInNewPane={handleOpenInNewPane}
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
    </div>
  );
}
