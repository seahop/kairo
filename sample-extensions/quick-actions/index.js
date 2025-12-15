// Quick Actions Extension
// Demonstrates: Multiple commands, categories, storage API

function initialize(kairo) {
  kairo.log.info("Quick Actions extension loaded");

  // Date/Time insertion commands
  kairo.registerCommand({
    id: "insert-date",
    name: "Copy Current Date",
    description: "Copy today's date to clipboard (YYYY-MM-DD)",
    category: "Insert",
    execute: async () => {
      const date = new Date().toISOString().split("T")[0];
      await navigator.clipboard.writeText(date);
      kairo.log.info("Copied date to clipboard", { date });
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
      kairo.log.info("Copied datetime to clipboard", { datetime });
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
      kairo.log.info("Copied timestamp", { timestamp });
    }
  });

  kairo.registerCommand({
    id: "insert-uuid",
    name: "Copy UUID",
    description: "Generate and copy a UUID v4",
    category: "Insert",
    execute: async () => {
      const uuid = crypto.randomUUID();
      await navigator.clipboard.writeText(uuid);
      kairo.log.info("Copied UUID", { uuid });
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
      // Dispatch custom event that App.tsx listens for
      const event = new CustomEvent("kairo:toggle-debug");
      window.dispatchEvent(event);
      kairo.log.info("Toggled debug console");
    }
  });
}

function cleanup(kairo) {
  kairo.log.info("Quick Actions extension unloaded");
}

exports.initialize = initialize;
exports.cleanup = cleanup;
