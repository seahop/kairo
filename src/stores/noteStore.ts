import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

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
  saveNote: () => Promise<void>;
  createNote: (path: string, content?: string) => Promise<void>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (oldPath: string, newPath: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  setEditorContent: (content: string) => void;
  closeNote: () => void;
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
    // Check for unsaved changes
    const { hasUnsavedChanges, currentNote } = get();
    if (hasUnsavedChanges && currentNote) {
      // TODO: Show confirmation dialog
      console.warn("Unsaved changes will be lost");
    }

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
}));
