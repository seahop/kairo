import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useUIStore } from "./uiStore";

export interface NoteMetadata {
  id: string;
  path: string;
  title: string;
  modified_at: number;
  created_at: number;
}

export interface Note {
  id: string;
  path: string;
  title: string;
  content: string;
  modified_at: number;
  created_at: number;
}

interface NoteState {
  notes: NoteMetadata[];
  currentNote: Note | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;

  // Local editor content (for tracking changes)
  editorContent: string;

  // Actions
  loadNotes: () => Promise<void>;
  openNote: (path: string) => Promise<void>;
  openNoteByReference: (reference: string) => Promise<boolean>;
  resolveNoteReference: (reference: string) => NoteMetadata | null;
  saveNote: () => Promise<void>;
  createNote: (path: string, content?: string) => Promise<void>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (oldPath: string, newPath: string) => Promise<void>;
  archiveNote: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  setEditorContent: (content: string) => void;
  closeNote: () => void;
  openDailyNote: () => Promise<void>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  currentNote: null,
  isLoading: false,
  isSaving: false,
  error: null,
  hasUnsavedChanges: false,
  editorContent: "",

  loadNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const notes = await invoke<NoteMetadata[]>("list_notes");
      set({ notes, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  openNote: async (path: string) => {
    // Internal function to actually open the note
    const doOpenNote = async () => {
      set({ isLoading: true, error: null });
      try {
        const note = await invoke<Note>("read_note", { path });
        set({
          currentNote: note,
          editorContent: note.content,
          hasUnsavedChanges: false,
          isLoading: false,
        });
      } catch (error) {
        set({ error: String(error), isLoading: false });
      }
    };

    // Check for unsaved changes
    const { hasUnsavedChanges, currentNote } = get();
    if (hasUnsavedChanges && currentNote && currentNote.path !== path) {
      // Show confirmation dialog
      useUIStore.getState().showConfirmDialog({
        title: "Unsaved Changes",
        message: `You have unsaved changes in "${currentNote.title}". Do you want to discard them and open the new note?`,
        confirmText: "Discard",
        cancelText: "Cancel",
        variant: "warning",
        onConfirm: () => {
          doOpenNote();
        },
      });
      return;
    }

    await doOpenNote();
  },

  // Resolve a wiki-style reference [[note]] to a note
  resolveNoteReference: (reference: string): NoteMetadata | null => {
    const { notes } = get();
    const ref = reference.trim();

    // 1. Exact path match (with or without .md extension)
    const exactPath = notes.find(
      n => n.path === ref ||
           n.path === `${ref}.md` ||
           n.path === `notes/${ref}` ||
           n.path === `notes/${ref}.md`
    );
    if (exactPath) return exactPath;

    // 2. Title match (case-insensitive)
    const titleMatch = notes.find(
      n => n.title.toLowerCase() === ref.toLowerCase()
    );
    if (titleMatch) return titleMatch;

    // 3. Partial path match (filename without extension)
    const filename = ref.split('/').pop()?.replace(/\.md$/, '').toLowerCase();
    if (filename) {
      const partialMatch = notes.find(n => {
        const noteFilename = n.path.split('/').pop()?.replace(/\.md$/, '').toLowerCase();
        return noteFilename === filename;
      });
      if (partialMatch) return partialMatch;
    }

    return null;
  },

  // Open a note by wiki-style reference
  openNoteByReference: async (reference: string): Promise<boolean> => {
    const resolved = get().resolveNoteReference(reference);
    if (resolved) {
      await get().openNote(resolved.path);
      return true;
    }
    console.warn(`Could not resolve note reference: ${reference}`);
    return false;
  },

  saveNote: async () => {
    const { currentNote, editorContent } = get();
    if (!currentNote) return;

    set({ isSaving: true, error: null });
    try {
      const metadata = await invoke<NoteMetadata>("write_note", {
        path: currentNote.path,
        content: editorContent,
        createIfMissing: false,
      });

      // Update current note with new metadata
      set({
        currentNote: { ...currentNote, content: editorContent, ...metadata },
        hasUnsavedChanges: false,
        isSaving: false,
      });

      // Refresh notes list
      get().loadNotes();
    } catch (error) {
      set({ error: String(error), isSaving: false });
    }
  },

  createNote: async (path: string, content: string = "# New Note\n\n") => {
    set({ isLoading: true, error: null });
    try {
      await invoke<NoteMetadata>("write_note", {
        path,
        content,
        createIfMissing: true,
      });

      // Refresh notes list and open the new note
      await get().loadNotes();
      await get().openNote(path);
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  deleteNote: async (path: string) => {
    try {
      await invoke("delete_note", { path });

      // If this was the current note, close it
      const { currentNote } = get();
      if (currentNote?.path === path) {
        set({ currentNote: null, editorContent: "", hasUnsavedChanges: false });
      }

      // Refresh notes list
      get().loadNotes();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  renameNote: async (oldPath: string, newPath: string) => {
    try {
      const metadata = await invoke<NoteMetadata>("rename_note", {
        oldPath,
        newPath,
      });

      // If this was the current note, update it
      const { currentNote } = get();
      if (currentNote?.path === oldPath) {
        set({
          currentNote: {
            ...currentNote,
            path: metadata.path,
            title: metadata.title,
          },
        });
      }

      // Refresh notes list
      get().loadNotes();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  archiveNote: async (path: string) => {
    try {
      // Extract just the filename
      const filename = path.split('/').pop() || path;

      // Create archive path - preserving date for context
      const archivePath = `notes/archive/${filename}`;

      // Use rename to move to archive folder
      await invoke<NoteMetadata>("rename_note", {
        oldPath: path,
        newPath: archivePath,
      });

      // If this was the current note, close it
      const { currentNote } = get();
      if (currentNote?.path === path) {
        set({ currentNote: null, editorContent: "", hasUnsavedChanges: false });
      }

      // Refresh notes list
      get().loadNotes();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createFolder: async (path: string) => {
    try {
      await invoke("create_folder", { path });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  setEditorContent: (content: string) => {
    const { currentNote } = get();
    set({
      editorContent: content,
      hasUnsavedChanges: currentNote ? content !== currentNote.content : false,
    });
  },

  closeNote: () => {
    set({
      currentNote: null,
      editorContent: "",
      hasUnsavedChanges: false,
    });
  },

  openDailyNote: async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const weekday = today.toLocaleDateString("en-US", { weekday: "long" });

    const dailyNotePath = `notes/daily/${dateStr}.md`;

    // Check if the note already exists
    const { notes } = get();
    const existing = notes.find((n) => n.path === dailyNotePath);

    if (existing) {
      // Open existing daily note
      await get().openNote(dailyNotePath);
    } else {
      // Create new daily note with template
      const content = `# ${weekday}, ${today.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}

## Tasks
- [ ]

## Notes


## Links
- [[${year}-${month}-${String(today.getDate() - 1).padStart(2, "0")}|Yesterday]]

---
*Created: ${today.toLocaleTimeString()}*
`;
      await get().createNote(dailyNotePath, content);
    }
  },
}));
