// Quick Actions Extension
// Demonstrates: Commands, keyboard shortcuts, context menus, menu bar items

function initialize(kairo) {
  kairo.log.info("Quick Actions extension loaded");

  // ==========================================
  // COMMANDS WITH KEYBOARD SHORTCUTS
  // ==========================================

  // Date/Time insertion commands
  kairo.registerCommand({
    id: "insert-date",
    name: "Copy Current Date",
    description: "Copy today's date to clipboard (YYYY-MM-DD)",
    category: "Insert",
    execute: async () => {
      const date = new Date().toISOString().split("T")[0];
      await navigator.clipboard.writeText(date);
      kairo.log.info("Copied date to clipboard", date);
    }
  });

  kairo.registerCommand({
    id: "insert-datetime",
    name: "Copy Date & Time",
    description: "Copy current date and time to clipboard",
    category: "Insert",
    execute: async () => {
      const datetime = new Date().toLocaleString();
      await navigator.clipboard.writeText(datetime);
      kairo.log.info("Copied datetime to clipboard", datetime);
    }
  });

  kairo.registerCommand({
    id: "insert-timestamp",
    name: "Copy Unix Timestamp",
    description: "Copy Unix timestamp to clipboard",
    category: "Insert",
    execute: async () => {
      const timestamp = Date.now().toString();
      await navigator.clipboard.writeText(timestamp);
      kairo.log.info("Copied timestamp", timestamp);
    }
  });

  kairo.registerCommand({
    id: "insert-uuid",
    name: "Copy UUID",
    description: "Generate and copy a UUID v4",
    category: "Insert",
    shortcut: "Ctrl+Shift+U",  // Keyboard shortcut example
    execute: async () => {
      const uuid = crypto.randomUUID();
      await navigator.clipboard.writeText(uuid);
      kairo.log.info("Copied UUID", uuid);
    }
  });

  // Markdown helpers
  kairo.registerCommand({
    id: "markdown-table",
    name: "Copy Markdown Table Template",
    description: "Copy a basic markdown table to clipboard",
    category: "Markdown",
    execute: async () => {
      const table = `| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;
      await navigator.clipboard.writeText(table);
      kairo.log.info("Copied markdown table template");
    }
  });

  kairo.registerCommand({
    id: "markdown-checklist",
    name: "Copy Checklist Template",
    description: "Copy a task checklist template",
    category: "Markdown",
    execute: async () => {
      const checklist = `## Tasks

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Task 4`;
      await navigator.clipboard.writeText(checklist);
      kairo.log.info("Copied checklist template");
    }
  });

  kairo.registerCommand({
    id: "markdown-code-block",
    name: "Copy Code Block Template",
    description: "Copy a fenced code block",
    category: "Markdown",
    execute: async () => {
      const codeBlock = "```javascript\n// Your code here\n```";
      await navigator.clipboard.writeText(codeBlock);
      kairo.log.info("Copied code block template");
    }
  });

  // Utility commands
  kairo.registerCommand({
    id: "clear-clipboard",
    name: "Clear Clipboard",
    description: "Clear the system clipboard",
    category: "Utility",
    execute: async () => {
      await navigator.clipboard.writeText("");
      kairo.log.info("Clipboard cleared");
    }
  });

  kairo.registerCommand({
    id: "open-devtools",
    name: "Toggle Debug Console",
    description: "Show/hide the debug console (Ctrl+Shift+D)",
    category: "Developer",
    shortcut: "Ctrl+Shift+D",
    execute: () => {
      const event = new CustomEvent("kairo:toggle-debug");
      window.dispatchEvent(event);
      kairo.log.info("Toggled debug console");
    }
  });

  // ==========================================
  // CONTEXT MENU ITEMS (Right-click menus)
  // ==========================================

  // Add "Copy Note Path" to note right-click menu
  kairo.registerContextMenuItem("note-tree", {
    id: "copy-note-path",
    label: "Copy Full Path",
    icon: "📋",
    priority: 5,
    execute: async (context) => {
      if (context.notePath) {
        await navigator.clipboard.writeText(context.notePath);
        kairo.log.info("Copied note path", context.notePath);
      }
    }
  });

  // Add "Copy as Wiki Link" to note right-click menu
  kairo.registerContextMenuItem("note-tree", {
    id: "copy-wiki-link",
    label: "Copy as Wiki Link",
    icon: "🔗",
    priority: 4,
    execute: async (context) => {
      if (context.noteTitle) {
        const wikiLink = `[[${context.noteTitle}]]`;
        await navigator.clipboard.writeText(wikiLink);
        kairo.log.info("Copied wiki link", wikiLink);
      }
    }
  });

  // Add "Insert Timestamp" to editor right-click menu
  kairo.registerContextMenuItem("editor", {
    id: "insert-timestamp-here",
    label: "Insert Timestamp",
    icon: "⏰",
    execute: async () => {
      const timestamp = new Date().toLocaleString();
      await navigator.clipboard.writeText(timestamp);
      kairo.log.info("Timestamp copied - paste to insert", timestamp);
    }
  });

  // Add "Copy Link Target" to wiki link right-click menu
  kairo.registerContextMenuItem("wiki-link", {
    id: "copy-link-target",
    label: "Copy Link Target",
    icon: "📄",
    execute: async (context) => {
      if (context.linkTarget) {
        await navigator.clipboard.writeText(context.linkTarget);
        kairo.log.info("Copied link target", context.linkTarget);
      }
    }
  });

  // ==========================================
  // MENU BAR ITEMS (Top menu)
  // ==========================================

  // Add items to the Tools menu
  kairo.registerMenuItem("tools", {
    id: "copy-uuid",
    label: "Generate UUID",
    shortcut: "Ctrl+Shift+U",
    priority: 50,
    divider: true,
    execute: async () => {
      const uuid = crypto.randomUUID();
      await navigator.clipboard.writeText(uuid);
      kairo.log.info("Copied UUID", uuid);
    }
  });

  kairo.registerMenuItem("tools", {
    id: "copy-date",
    label: "Copy Today's Date",
    priority: 49,
    execute: async () => {
      const date = new Date().toISOString().split("T")[0];
      await navigator.clipboard.writeText(date);
      kairo.log.info("Copied date", date);
    }
  });

  // Add to Edit menu
  kairo.registerMenuItem("edit", {
    id: "clear-clipboard",
    label: "Clear Clipboard",
    priority: 10,
    execute: async () => {
      await navigator.clipboard.writeText("");
      kairo.log.info("Clipboard cleared");
    }
  });

  // ==========================================
  // HOOKS (Respond to app events)
  // ==========================================

  kairo.registerHook("onNoteOpen", (data) => {
    kairo.log.debug("Note opened via Quick Actions hook", data.path || "unknown");
  });
}

function cleanup(kairo) {
  kairo.log.info("Quick Actions extension unloaded");
  // Context menu items and menu bar items are automatically cleaned up
  // when the extension unloads
}

exports.initialize = initialize;
exports.cleanup = cleanup;
