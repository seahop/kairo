import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore } from "@/stores/noteStore";

/**
 * Hook to listen for file system events from the backend watcher
 * and automatically refresh the notes list when files change externally
 */
export function useFileWatcher() {
  const loadNotes = useNoteStore((state) => state.loadNotes);
  const openNote = useNoteStore((state) => state.openNote);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // Reindex vault and then refresh notes list
    const reindexAndRefresh = async () => {
      try {
        await invoke("reindex_vault");
        await loadNotes();
      } catch (err) {
        console.error("Failed to reindex vault:", err);
      }
    };

    // Set up listeners
    const setupListeners = async () => {
      // File created externally
      const unlisten1 = await listen<string>("file-created", (event) => {
        console.log("File created:", event.payload);
        reindexAndRefresh();
      });
      unlisteners.push(unlisten1);

      // File modified externally
      const unlisten2 = await listen<string>("file-modified", (event) => {
        console.log("File modified:", event.payload);
        // Reindex and refresh notes list
        reindexAndRefresh().then(() => {
          // If the modified file is currently open, reload it
          // (but only if there are no unsaved changes)
          const state = useNoteStore.getState();
          if (state.currentNote && !state.hasUnsavedChanges) {
            // Check if the modified path matches the current note
            const modifiedPath = event.payload;
            if (modifiedPath.endsWith(state.currentNote.path) ||
                state.currentNote.path.endsWith(modifiedPath.split("/").pop() || "")) {
              openNote(state.currentNote.path);
            }
          }
        });
      });
      unlisteners.push(unlisten2);

      // File deleted externally
      const unlisten3 = await listen<string>("file-deleted", (event) => {
        console.log("File deleted:", event.payload);
        // Reindex to remove deleted file from database
        reindexAndRefresh().then(() => {
          // If the deleted file is currently open, close it
          const state = useNoteStore.getState();
          if (state.currentNote) {
            const deletedPath = event.payload;
            if (deletedPath.endsWith(state.currentNote.path) ||
                state.currentNote.path.endsWith(deletedPath.split("/").pop() || "")) {
              state.closeNote();
            }
          }
        });
      });
      unlisteners.push(unlisten3);
    };

    setupListeners();

    // Cleanup listeners on unmount
    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [loadNotes, openNote]);
}
