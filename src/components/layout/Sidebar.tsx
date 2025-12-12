import { useEffect, useState } from "react";
import { useNoteStore, NoteMetadata } from "@/stores/noteStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useUIStore } from "@/stores/uiStore";
import clsx from "clsx";

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
    for (let i = 0; i < parts.length - 1; i++) {
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
}

function FolderItem({ folder, level }: FolderItemProps) {
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
            <FolderItem key={child.path} folder={child} level={level + 1} />
          ))}

          {/* Notes in this folder */}
          {folder.notes.map((note) => (
            <div
              key={note.id}
              className={clsx(
                "flex items-center gap-2 px-2 py-1 cursor-pointer rounded",
                "text-dark-300 hover:bg-dark-800 hover:text-dark-100",
                currentNote?.path === note.path && "bg-dark-800 text-accent-primary"
              )}
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
              onClick={() => openNote(note.path)}
            >
              <FileIcon />
              <span className="text-sm truncate">{note.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { vault } = useVaultStore();
  const { notes, loadNotes, createNote } = useNoteStore();
  const { setSearchOpen, isSidebarCollapsed, sidebarWidth, mainViewMode, setMainViewMode } = useUIStore();

  useEffect(() => {
    if (vault) {
      loadNotes();
    }
  }, [vault, loadNotes]);

  const folderTree = buildFolderTree(notes);

  const handleNewNote = () => {
    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `notes/new-note-${timestamp}.md`;
    createNote(fileName);
  };

  if (isSidebarCollapsed) {
    return (
      <div className="w-12 bg-dark-900 border-r border-dark-800 flex flex-col items-center py-4 gap-4">
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
      </div>
    );
  }

  return (
    <div
      className="bg-dark-900 border-r border-dark-800 flex flex-col h-full"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="p-4 border-b border-dark-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-dark-100 truncate">{vault?.name}</h2>
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
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {folderTree.children.size > 0 || folderTree.notes.length > 0 ? (
          <FolderItem folder={folderTree} level={0} />
        ) : (
          <div className="px-4 py-8 text-center text-dark-500 text-sm">
            No notes yet. Create your first note!
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-dark-800">
        <div className="text-xs text-dark-500">
          {vault?.note_count ?? 0} notes
        </div>
      </div>
    </div>
  );
}
