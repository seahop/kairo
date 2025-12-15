// Activity Log Extension
// Demonstrates: ALL available hooks - comprehensive logging of app activity

const activityLog = [];
const MAX_LOG_ENTRIES = 100;

function logActivity(kairo, type, message, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    details
  };

  activityLog.unshift(entry);
  if (activityLog.length > MAX_LOG_ENTRIES) {
    activityLog.pop();
  }

  kairo.log.debug(`[${type}] ${message}`, details ? JSON.stringify(details) : undefined);
}

function initialize(kairo) {
  kairo.log.info("Activity Log extension loaded - tracking all hooks");

  // ==========================================
  // VAULT HOOKS
  // ==========================================

  kairo.registerHook("onVaultOpen", (data) => {
    logActivity(kairo, "VAULT", "Vault opened", {
      name: data.vault?.name,
      path: data.path,
      noteCount: data.vault?.note_count
    });
  });

  kairo.registerHook("onVaultClose", (data) => {
    logActivity(kairo, "VAULT", "Vault closed", {
      name: data.vault?.name,
      path: data.path
    });
  });

  // ==========================================
  // NOTE LIFECYCLE HOOKS
  // ==========================================

  kairo.registerHook("onNoteCreate", (data) => {
    logActivity(kairo, "NOTE", "Note created", {
      path: data.path,
      contentLength: data.content?.length || 0
    });
  });

  kairo.registerHook("onNoteSave", (data) => {
    logActivity(kairo, "NOTE", "Note saved", {
      path: data.path,
      contentLength: data.content?.length || 0
    });
  });

  kairo.registerHook("onNoteDelete", (data) => {
    logActivity(kairo, "NOTE", "Note deleted", {
      path: data.path
    });
  });

  kairo.registerHook("onNoteOpen", (data) => {
    logActivity(kairo, "NOTE", "Note opened", {
      title: data.note?.title,
      path: data.path
    });
  });

  kairo.registerHook("onNoteClose", (data) => {
    logActivity(kairo, "NOTE", "Note closed", {
      path: data.path
    });
  });

  // ==========================================
  // SEARCH HOOKS
  // ==========================================

  kairo.registerHook("onSearch", (data) => {
    logActivity(kairo, "SEARCH", "Search initiated", {
      query: data.query
    });
  });

  kairo.registerHook("onSearchResult", (data) => {
    logActivity(kairo, "SEARCH", "Search completed", {
      query: data.query,
      resultCount: data.results?.length || 0
    });
  });

  // ==========================================
  // APP LIFECYCLE HOOKS
  // ==========================================

  kairo.registerHook("onAppInit", (data) => {
    logActivity(kairo, "APP", "Application initialized", data);
  });

  kairo.registerHook("onAppClose", (data) => {
    logActivity(kairo, "APP", "Application closing", data);
  });

  // ==========================================
  // EDITOR HOOKS
  // ==========================================

  let lastEditorChange = 0;
  kairo.registerHook("onEditorChange", (data) => {
    // Throttle to once per second to avoid spam
    const now = Date.now();
    if (now - lastEditorChange > 1000) {
      lastEditorChange = now;
      logActivity(kairo, "EDITOR", "Content changed", {
        contentLength: data.content?.length || 0
      });
    }
  });

  kairo.registerHook("onEditorReady", (data) => {
    logActivity(kairo, "EDITOR", "Editor ready", data);
  });

  // ==========================================
  // PREVIEW HOOKS
  // ==========================================

  kairo.registerHook("onPreviewRender", (data) => {
    logActivity(kairo, "PREVIEW", "Preview rendered", {
      htmlLength: data.html?.length || 0
    });
  });

  // ==========================================
  // COMMAND HOOKS
  // ==========================================

  kairo.registerHook("onCommandExecute", (data) => {
    logActivity(kairo, "COMMAND", "Command executed", {
      commandId: data.commandId
    });
  });

  // ==========================================
  // PLUGIN HOOKS
  // ==========================================

  kairo.registerHook("onPluginLoad", (data) => {
    logActivity(kairo, "PLUGIN", "Plugin loaded", {
      pluginId: data.pluginId
    });
  });

  kairo.registerHook("onPluginUnload", (data) => {
    logActivity(kairo, "PLUGIN", "Plugin unloaded", {
      pluginId: data.pluginId
    });
  });

  // ==========================================
  // SETTINGS HOOKS
  // ==========================================

  kairo.registerHook("onSettingsChange", (data) => {
    logActivity(kairo, "SETTINGS", "Settings changed", {
      settings: data.settings
    });
  });

  // ==========================================
  // COMMANDS
  // ==========================================

  // Simple test command to verify alert works
  kairo.registerCommand({
    id: "test-alert",
    name: "Test Alert",
    description: "Test if alerts work",
    category: "Activity Log",
    execute: () => {
      kairo.log.info("Test alert command executed");
      window.alert("Alert test - if you see this, alerts work!");
    }
  });

  kairo.registerCommand({
    id: "show-log",
    name: "Show Activity Log",
    description: "Display recent activity",
    category: "Activity Log",
    shortcut: "Ctrl+Alt+L",
    execute: () => {
      kairo.log.info("Show Activity Log command executed", `Log has ${activityLog.length} entries`);

      if (activityLog.length === 0) {
        window.alert("No activity logged yet.\n\nTry opening notes, searching, or executing commands.");
        return;
      }

      const summary = activityLog.slice(0, 15).map((entry, i) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        return `${i + 1}. [${time}] ${entry.type}: ${entry.message}`;
      }).join("\n");

      window.alert(`Recent Activity (${activityLog.length} total):\n\n${summary}`);
    }
  });

  kairo.registerCommand({
    id: "clear-log",
    name: "Clear Activity Log",
    description: "Clear the activity log",
    category: "Activity Log",
    execute: () => {
      const count = activityLog.length;
      activityLog.length = 0;
      window.alert(`Activity log cleared (${count} entries removed)`);
    }
  });

  kairo.registerCommand({
    id: "export-log",
    name: "Export Activity Log",
    description: "Copy activity log to clipboard",
    category: "Activity Log",
    execute: async () => {
      if (activityLog.length === 0) {
        window.alert("No activity to export.");
        return;
      }

      const logText = activityLog
        .map(e => `[${e.timestamp}] [${e.type}] ${e.message} ${e.details ? JSON.stringify(e.details) : ""}`)
        .join("\n");

      await navigator.clipboard.writeText(logText);
      window.alert(`Activity log copied to clipboard (${activityLog.length} entries)`);
    }
  });

  kairo.registerCommand({
    id: "stats",
    name: "Activity Statistics",
    description: "Show statistics about logged activities",
    category: "Activity Log",
    execute: () => {
      const stats = {};
      activityLog.forEach(entry => {
        stats[entry.type] = (stats[entry.type] || 0) + 1;
      });

      const summary = Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `${type}: ${count}`)
        .join("\n");

      kairo.log.info("Activity Statistics:\n" + summary);
      window.alert("Activity Statistics:\n\n" + summary + "\n\nTotal: " + activityLog.length + " events");
    }
  });

  // Add to Tools menu
  kairo.registerMenuItem("tools", {
    id: "show-activity-log",
    label: "Activity Log",
    shortcut: "Ctrl+Alt+L",
    priority: 20,
    divider: true,
    execute: () => {
      // Toggle debug console to show log
      window.dispatchEvent(new CustomEvent("kairo:toggle-debug"));
    }
  });
}

function cleanup(kairo) {
  kairo.log.info("Activity Log unloaded", `Logged ${activityLog.length} events`);
}

exports.initialize = initialize;
exports.cleanup = cleanup;
