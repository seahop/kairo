// Note Statistics Extension
// Demonstrates: Hooks, State Access, CSS API, Store Subscriptions

let unsubscribe = null;
let notesCreatedToday = 0;
let notesSavedToday = 0;

// Custom styles for the extension
const CUSTOM_STYLES = `
  .note-stats-highlight {
    background: linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, transparent 100%);
    border-left: 2px solid rgb(99, 102, 241);
    padding-left: 8px;
    margin-left: -10px;
  }

  .note-stats-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    background: rgba(99, 102, 241, 0.2);
    border-radius: 9999px;
    font-size: 10px;
    color: rgb(165, 180, 252);
  }
`;

function initialize(kairo) {
  kairo.log.info("Note Statistics extension loaded");

  // Add custom styles
  kairo.addStyles(CUSTOM_STYLES);

  // Register hooks to track activity
  kairo.registerHook("onNoteCreate", (data) => {
    notesCreatedToday++;
    kairo.log.info("Note created", JSON.stringify({
      path: data.path,
      totalCreatedToday: notesCreatedToday
    }));
  });

  kairo.registerHook("onNoteSave", (data) => {
    notesSavedToday++;
    kairo.log.info("Note saved", JSON.stringify({
      path: data.path,
      totalSavedToday: notesSavedToday
    }));
  });

  kairo.registerHook("onNoteOpen", (data) => {
    kairo.log.debug("Note opened", JSON.stringify({
      title: data.note?.title,
      path: data.path
    }));
  });

  kairo.registerHook("onVaultOpen", (data) => {
    kairo.log.info("Vault opened", JSON.stringify({
      name: data.vault?.name,
      noteCount: data.vault?.note_count
    }));

    // Reset daily counters
    notesCreatedToday = 0;
    notesSavedToday = 0;
  });

  kairo.registerHook("onSearch", (data) => {
    kairo.log.debug("Search initiated", JSON.stringify({ query: data.query }));
  });

  kairo.registerHook("onSearchResult", (data) => {
    kairo.log.debug("Search completed", JSON.stringify({
      query: data.query,
      resultCount: data.results?.length || 0
    }));
  });

  // Subscribe to note store changes
  unsubscribe = kairo.subscribe("notes", (state) => {
    // This fires on every note store change
    // We could use this for real-time UI updates
  });

  // Register commands
  kairo.registerCommand({
    id: "show-stats",
    name: "Show Note Statistics",
    description: "Display current vault and session statistics",
    category: "Statistics",
    execute: () => {
      const state = kairo.getState();

      const stats = {
        vault: state.vault?.name || "No vault open",
        totalNotes: state.notes?.list?.length || 0,
        currentNote: state.notes?.current?.title || "None",
        hasUnsavedChanges: state.notes?.hasUnsavedChanges || false,
        editorContentLength: state.notes?.editorContent?.length || 0,
        notesCreatedThisSession: notesCreatedToday,
        notesSavedThisSession: notesSavedToday,
        sidebarCollapsed: state.ui?.isSidebarCollapsed,
        viewMode: state.ui?.mainViewMode,
      };

      kairo.log.info("Current Statistics", JSON.stringify(stats, null, 2));
      alert("Statistics logged to debug console!\n\n" +
        "Vault: " + stats.vault + "\n" +
        "Total Notes: " + stats.totalNotes + "\n" +
        "Created Today: " + stats.notesCreatedThisSession + "\n" +
        "Saved Today: " + stats.notesSavedThisSession
      );
    }
  });

  kairo.registerCommand({
    id: "show-current-note",
    name: "Show Current Note Info",
    description: "Display information about the currently open note",
    category: "Statistics",
    execute: () => {
      const state = kairo.getState();
      const note = state.notes?.current;

      if (!note) {
        alert("No note is currently open.");
        return;
      }

      const content = state.notes?.editorContent || "";
      const words = content.trim().split(/\s+/).filter(w => w).length;
      const lines = content.split("\n").length;
      const headings = (content.match(/^#+\s/gm) || []).length;
      const links = (content.match(/\[\[.*?\]\]/g) || []).length;
      const tasks = (content.match(/- \[ \]/g) || []).length;
      const completedTasks = (content.match(/- \[x\]/gi) || []).length;

      const info = {
        title: note.title,
        path: note.path,
        words,
        lines,
        characters: content.length,
        headings,
        wikiLinks: links,
        openTasks: tasks,
        completedTasks,
        hasUnsavedChanges: state.notes?.hasUnsavedChanges,
      };

      kairo.log.info("Current Note Info", JSON.stringify(info, null, 2));

      alert(
        "Note: " + info.title + "\n\n" +
        "Words: " + info.words + "\n" +
        "Lines: " + info.lines + "\n" +
        "Headings: " + info.headings + "\n" +
        "Wiki Links: " + info.wikiLinks + "\n" +
        "Tasks: " + info.completedTasks + "/" + (info.openTasks + info.completedTasks) + " done"
      );
    }
  });

  kairo.registerCommand({
    id: "toggle-highlight",
    name: "Toggle Note Highlight Style",
    description: "Toggle a highlight effect on the current note (CSS demo)",
    category: "View",
    execute: () => {
      const editor = document.querySelector(".cm-editor");
      if (editor) {
        editor.classList.toggle("note-stats-highlight");
        kairo.log.info("Toggled highlight style");
      }
    }
  });
}

function cleanup(kairo) {
  // Clean up subscription
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // Styles are automatically removed by the extension system
  kairo.log.info("Note Statistics extension unloaded");
}

exports.initialize = initialize;
exports.cleanup = cleanup;
