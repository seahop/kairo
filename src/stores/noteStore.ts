import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useUIStore } from "./uiStore";
import { triggerHook } from "@/plugins/api/hooks";

export interface NoteMetadata {
  id: string;
  path: string;
  title: string;
  modified_at: number;
  created_at: number;
  archived: boolean;
  starred: boolean;
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

  // Navigation history
  navigationHistory: string[]; // Stack of note paths
  navigationIndex: number; // Current position in history (-1 means no history)
  isNavigating: boolean; // Flag to prevent adding to history during back/forward

  // Secondary pane support (for preview/split view)
  secondaryNote: Note | null;
  secondaryEditorContent: string;
  hasSecondaryUnsavedChanges: boolean;
  isSecondaryLoading: boolean;

  // Archive visibility
  showArchived: boolean;

  // Actions
  loadNotes: () => Promise<void>;
  openNote: (path: string) => Promise<void>;
  openNoteByReference: (reference: string) => Promise<boolean>;
  openNoteByReferenceInSecondary: (reference: string) => Promise<boolean>;
  resolveNoteReference: (reference: string) => NoteMetadata | null;
  saveNote: () => Promise<void>;
  createNote: (path: string, content?: string) => Promise<void>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (oldPath: string, newPath: string) => Promise<void>;
  setNoteArchived: (path: string, archived: boolean) => Promise<void>;
  setNoteStarred: (path: string, starred: boolean) => Promise<void>;
  getStarredNotes: () => NoteMetadata[];
  createFolder: (path: string) => Promise<void>;
  setEditorContent: (content: string) => void;
  closeNote: () => void;
  openDailyNote: () => Promise<void>;
  setShowArchived: (show: boolean) => void;
  getVisibleNotes: () => NoteMetadata[];

  // Navigation actions
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  canGoBack: () => boolean;
  canGoForward: () => boolean;

  // Secondary pane actions
  openNoteInSecondary: (path: string) => Promise<void>;
  closeSecondaryNote: () => void;
  setSecondaryEditorContent: (content: string) => void;
  saveSecondaryNote: () => Promise<void>;
  swapPanes: () => void;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  currentNote: null,
  isLoading: false,
  isSaving: false,
  error: null,
  hasUnsavedChanges: false,
  editorContent: "",

  // Navigation history state
  navigationHistory: [],
  navigationIndex: -1,
  isNavigating: false,

  // Secondary pane state
  secondaryNote: null,
  secondaryEditorContent: "",
  hasSecondaryUnsavedChanges: false,
  isSecondaryLoading: false,

  // Archive visibility
  showArchived: false,

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
      const { isNavigating, navigationHistory, navigationIndex, currentNote: prevNote } = get();

      set({ isLoading: true, error: null });
      try {
        const note = await invoke<Note>("read_note", { path });

        // Update navigation history (only if not navigating via back/forward)
        let newHistory = navigationHistory;
        let newIndex = navigationIndex;

        if (!isNavigating && prevNote && prevNote.path !== path) {
          // Trim any forward history when navigating to a new note
          newHistory = navigationHistory.slice(0, navigationIndex + 1);
          // Add the new path to history
          newHistory.push(path);
          newIndex = newHistory.length - 1;

          // Limit history size to prevent memory issues
          if (newHistory.length > 50) {
            newHistory = newHistory.slice(-50);
            newIndex = newHistory.length - 1;
          }
        } else if (!isNavigating && !prevNote) {
          // First note opened - start history
          newHistory = [path];
          newIndex = 0;
        }

        set({
          currentNote: note,
          editorContent: note.content,
          hasUnsavedChanges: false,
          isLoading: false,
          isNavigating: false,
          navigationHistory: newHistory,
          navigationIndex: newIndex,
        });
        // Trigger hook for extensions
        triggerHook("onNoteOpen", { note, path });
      } catch (error) {
        set({ error: String(error), isLoading: false, isNavigating: false });
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
    // First try direct resolution (path, title, filename)
    const resolved = get().resolveNoteReference(reference);
    if (resolved) {
      await get().openNote(resolved.path);
      return true;
    }

    // Then try alias resolution via backend
    try {
      const aliasPath = await invoke<string | null>("resolve_alias", { alias: reference });
      if (aliasPath) {
        await get().openNote(aliasPath);
        return true;
      }
    } catch (err) {
      console.warn(`Alias resolution failed for: ${reference}`, err);
    }

    console.warn(`Could not resolve note reference: ${reference}`);
    return false;
  },

  // Open a note by wiki-style reference in the secondary pane
  openNoteByReferenceInSecondary: async (reference: string): Promise<boolean> => {
    // First try direct resolution (path, title, filename)
    const resolved = get().resolveNoteReference(reference);
    if (resolved) {
      await get().openNoteInSecondary(resolved.path);
      return true;
    }

    // Then try alias resolution via backend
    try {
      const aliasPath = await invoke<string | null>("resolve_alias", { alias: reference });
      if (aliasPath) {
        await get().openNoteInSecondary(aliasPath);
        return true;
      }
    } catch (err) {
      console.warn(`Alias resolution failed for secondary pane: ${reference}`, err);
    }

    console.warn(`Could not resolve note reference for secondary pane: ${reference}`);
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
      const updatedNote = { ...currentNote, content: editorContent, ...metadata };
      set({
        currentNote: updatedNote,
        hasUnsavedChanges: false,
        isSaving: false,
      });

      // Trigger hook for extensions
      triggerHook("onNoteSave", { note: updatedNote, path: currentNote.path });

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

      // Trigger hook for extensions
      triggerHook("onNoteCreate", { path, content });

      // Refresh notes list and open the new note
      await get().loadNotes();
      await get().openNote(path);
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  deleteNote: async (path: string) => {
    try {
      // Get note info before deletion for the hook
      const { notes, currentNote } = get();
      const noteToDelete = notes.find(n => n.path === path);

      await invoke("delete_note", { path });

      // Trigger hook for extensions
      triggerHook("onNoteDelete", { path, note: noteToDelete });

      // If this was the current note, close it
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

  setNoteArchived: async (path: string, archived: boolean) => {
    try {
      const metadata = await invoke<NoteMetadata>("set_note_archived", {
        path,
        archived,
      });

      // Update the note in the list
      const { notes, currentNote } = get();
      const updatedNotes = notes.map(n =>
        n.path === path ? { ...n, archived: metadata.archived } : n
      );
      set({ notes: updatedNotes });

      // Update current note if it's the one being archived
      if (currentNote?.path === path) {
        // If archiving the current note and not showing archived, close it
        const { showArchived } = get();
        if (archived && !showArchived) {
          set({ currentNote: null, editorContent: "", hasUnsavedChanges: false });
        }
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  setNoteStarred: async (path: string, starred: boolean) => {
    try {
      const metadata = await invoke<NoteMetadata>("set_note_starred", {
        path,
        starred,
      });

      // Update the note in the list
      const { notes } = get();
      const updatedNotes = notes.map(n =>
        n.path === path ? { ...n, starred: metadata.starred } : n
      );
      set({ notes: updatedNotes });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  getStarredNotes: () => {
    const { notes, showArchived } = get();
    return notes.filter(n => n.starred && (showArchived || !n.archived));
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
    const { currentNote } = get();
    // Trigger hook for extensions before closing
    if (currentNote) {
      triggerHook("onNoteClose", { note: currentNote, path: currentNote.path });
    }
    set({
      currentNote: null,
      editorContent: "",
      hasUnsavedChanges: false,
    });
  },

  setShowArchived: (show: boolean) => {
    set({ showArchived: show });
  },

  getVisibleNotes: () => {
    const { notes, showArchived } = get();
    if (showArchived) {
      return notes;
    }
    return notes.filter(n => !n.archived);
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

  // Secondary pane actions
  openNoteInSecondary: async (path: string) => {
    set({ isSecondaryLoading: true, error: null });
    try {
      const note = await invoke<Note>("read_note", { path });
      set({
        secondaryNote: note,
        secondaryEditorContent: note.content,
        hasSecondaryUnsavedChanges: false,
        isSecondaryLoading: false,
      });
    } catch (error) {
      set({ error: String(error), isSecondaryLoading: false });
    }
  },

  closeSecondaryNote: () => {
    set({
      secondaryNote: null,
      secondaryEditorContent: "",
      hasSecondaryUnsavedChanges: false,
    });
  },

  setSecondaryEditorContent: (content: string) => {
    const { secondaryNote } = get();
    set({
      secondaryEditorContent: content,
      hasSecondaryUnsavedChanges: secondaryNote ? content !== secondaryNote.content : false,
    });
  },

  saveSecondaryNote: async () => {
    const { secondaryNote, secondaryEditorContent } = get();
    if (!secondaryNote) return;

    set({ isSaving: true, error: null });
    try {
      const metadata = await invoke<NoteMetadata>("write_note", {
        path: secondaryNote.path,
        content: secondaryEditorContent,
        createIfMissing: false,
      });

      set({
        secondaryNote: { ...secondaryNote, content: secondaryEditorContent, ...metadata },
        hasSecondaryUnsavedChanges: false,
        isSaving: false,
      });

      get().loadNotes();
    } catch (error) {
      set({ error: String(error), isSaving: false });
    }
  },

  swapPanes: () => {
    const { currentNote, editorContent, hasUnsavedChanges, secondaryNote, secondaryEditorContent, hasSecondaryUnsavedChanges } = get();
    set({
      currentNote: secondaryNote,
      editorContent: secondaryEditorContent,
      hasUnsavedChanges: hasSecondaryUnsavedChanges,
      secondaryNote: currentNote,
      secondaryEditorContent: editorContent,
      hasSecondaryUnsavedChanges: hasUnsavedChanges,
    });
  },

  // Navigation actions
  canGoBack: () => {
    const { navigationIndex } = get();
    return navigationIndex > 0;
  },

  canGoForward: () => {
    const { navigationHistory, navigationIndex } = get();
    return navigationIndex < navigationHistory.length - 1;
  },

  goBack: async () => {
    const { navigationHistory, navigationIndex, hasUnsavedChanges, currentNote } = get();

    if (navigationIndex <= 0) return;

    const previousPath = navigationHistory[navigationIndex - 1];

    // Handle unsaved changes
    if (hasUnsavedChanges && currentNote) {
      useUIStore.getState().showConfirmDialog({
        title: "Unsaved Changes",
        message: `You have unsaved changes in "${currentNote.title}". Do you want to discard them?`,
        confirmText: "Discard",
        cancelText: "Cancel",
        variant: "warning",
        onConfirm: async () => {
          set({ isNavigating: true, navigationIndex: navigationIndex - 1 });
          await get().openNote(previousPath);
        },
      });
      return;
    }

    set({ isNavigating: true, navigationIndex: navigationIndex - 1 });
    await get().openNote(previousPath);
  },

  goForward: async () => {
    const { navigationHistory, navigationIndex, hasUnsavedChanges, currentNote } = get();

    if (navigationIndex >= navigationHistory.length - 1) return;

    const nextPath = navigationHistory[navigationIndex + 1];

    // Handle unsaved changes
    if (hasUnsavedChanges && currentNote) {
      useUIStore.getState().showConfirmDialog({
        title: "Unsaved Changes",
        message: `You have unsaved changes in "${currentNote.title}". Do you want to discard them?`,
        confirmText: "Discard",
        cancelText: "Cancel",
        variant: "warning",
        onConfirm: async () => {
          set({ isNavigating: true, navigationIndex: navigationIndex + 1 });
          await get().openNote(nextPath);
        },
      });
      return;
    }

    set({ isNavigating: true, navigationIndex: navigationIndex + 1 });
    await get().openNote(nextPath);
  },
}));
