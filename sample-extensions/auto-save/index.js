// Auto Save Extension
// Demonstrates: onEditorChange hook, onNoteSave hook, debouncing

let saveTimeout = null;
let lastContent = "";
let saveCount = 0;
const AUTO_SAVE_DELAY = 3000; // 3 seconds of inactivity

function initialize(kairo) {
  kairo.log.info("Auto Save extension loaded");

  // Track editor changes with debounced auto-save
  kairo.registerHook("onEditorChange", (data) => {
    const content = data.content || "";

    // Skip if content hasn't changed
    if (content === lastContent) {
      return;
    }

    lastContent = content;

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Set new timeout for auto-save
    saveTimeout = setTimeout(() => {
      const state = kairo.getState();

      // Only save if there's a current note and unsaved changes
      if (state.notes?.current && state.notes?.hasUnsavedChanges) {
        kairo.log.debug("Auto-saving note after inactivity...");

        // Trigger save via keyboard shortcut event
        window.dispatchEvent(new KeyboardEvent("keydown", {
          key: "s",
          ctrlKey: true,
          bubbles: true
        }));
      }
    }, AUTO_SAVE_DELAY);
  });

  // Track when notes are saved (both manual and auto)
  kairo.registerHook("onNoteSave", (data) => {
    saveCount++;
    kairo.log.info(`Note saved: ${data.path}`, `Total saves this session: ${saveCount}`);
  });

  // Track when notes are opened (reset lastContent)
  kairo.registerHook("onNoteOpen", (data) => {
    lastContent = "";
    kairo.log.debug(`Note opened: ${data.path}`);
  });

  // Command to check auto-save status
  kairo.registerCommand({
    id: "status",
    name: "Auto Save Status",
    description: "Show auto-save statistics",
    category: "Auto Save",
    execute: () => {
      const state = kairo.getState();
      const status = {
        enabled: true,
        delay: AUTO_SAVE_DELAY + "ms",
        pendingSave: saveTimeout !== null,
        totalSaves: saveCount,
        hasUnsavedChanges: state.notes?.hasUnsavedChanges || false,
        currentNote: state.notes?.current?.title || "None"
      };

      kairo.log.info("Auto Save Status", JSON.stringify(status, null, 2));
      window.alert(
        "Auto Save Status\n\n" +
        "Delay: " + status.delay + "\n" +
        "Total Saves: " + status.totalSaves + "\n" +
        "Pending Save: " + (status.pendingSave ? "Yes" : "No") + "\n" +
        "Unsaved Changes: " + (status.hasUnsavedChanges ? "Yes" : "No")
      );
    }
  });

  // Command to force save now
  kairo.registerCommand({
    id: "save-now",
    name: "Save Now",
    description: "Immediately save the current note",
    category: "Auto Save",
    shortcut: "Ctrl+Alt+S",
    execute: () => {
      // Clear pending auto-save
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }

      // Trigger immediate save
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "s",
        ctrlKey: true,
        bubbles: true
      }));
    }
  });
}

function cleanup(kairo) {
  // Clear any pending save timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  kairo.log.info("Auto Save extension unloaded", `Total saves: ${saveCount}`);
}

exports.initialize = initialize;
exports.cleanup = cleanup;
