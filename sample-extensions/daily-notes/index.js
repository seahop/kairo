// Daily Notes Extension
// Demonstrates: Custom menu category, onNoteCreate hook, context menus, filterNoteContent

const DAILY_NOTE_TEMPLATE = `# {{date}}

## Morning
- [ ] Review yesterday's notes
- [ ] Set today's priorities
- [ ] Check calendar

## Tasks
- [ ]

## Notes


## Evening Reflection
- What went well today?
- What could be improved?
- Tomorrow's priorities:

---
*Created: {{time}}*
`;

function getDateString(date) {
  return date.toISOString().split("T")[0];
}

function getFormattedDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function getDailyNotePath(date) {
  const dateStr = getDateString(date);
  return `daily/${dateStr}.md`;
}

function initialize(kairo) {
  kairo.log.info("Daily Notes extension loaded");

  // Add styles for daily notes
  kairo.addStyles(`
    .daily-note-badge {
      display: inline-block;
      padding: 2px 8px;
      background: rgba(34, 197, 94, 0.2);
      color: rgb(134, 239, 172);
      border-radius: 4px;
      font-size: 11px;
      margin-left: 8px;
    }

    .daily-note-header {
      border-bottom: 2px solid rgba(34, 197, 94, 0.3);
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
  `);

  // Create a custom menu category
  kairo.registerMenuCategory({
    id: "daily",
    label: "Daily",
    priority: 100  // Appear between Tools and Help
  });

  // Add items to our custom menu
  kairo.registerCustomMenuItem("daily", {
    id: "today",
    label: "Go to Today",
    shortcut: "Ctrl+D",
    execute: () => {
      window.dispatchEvent(new CustomEvent("kairo:daily-note"));
      kairo.log.info("Opening today's daily note");
    }
  });

  kairo.registerCustomMenuItem("daily", {
    id: "yesterday",
    label: "Yesterday's Note",
    execute: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      kairo.log.info(`Opening yesterday: ${getDateString(yesterday)}`);
      // Would open the note here
    }
  });

  kairo.registerCustomMenuItem("daily", {
    id: "tomorrow",
    label: "Tomorrow's Note",
    execute: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      kairo.log.info(`Opening tomorrow: ${getDateString(tomorrow)}`);
      // Would open the note here
    }
  });

  kairo.registerCustomMenuItem("daily", {
    id: "this-week",
    label: "This Week",
    divider: true,
    execute: () => {
      kairo.log.info("Showing this week's daily notes");
    }
  });

  kairo.registerCustomMenuItem("daily", {
    id: "calendar",
    label: "Calendar View",
    execute: () => {
      kairo.log.info("Opening calendar view");
    }
  });

  // Track when notes are created
  kairo.registerHook("onNoteCreate", (data) => {
    const path = data.path || "";

    // Check if it's a daily note
    if (path.startsWith("daily/") && path.endsWith(".md")) {
      kairo.log.info("Daily note created", path);
    }
  });

  // Track when daily notes are opened
  kairo.registerHook("onNoteOpen", (data) => {
    const path = data.path || "";

    if (path.startsWith("daily/")) {
      const dateMatch = path.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const noteDate = new Date(dateMatch[1]);
        const today = new Date();
        const diffDays = Math.floor((today - noteDate) / (1000 * 60 * 60 * 24));

        let label = "";
        if (diffDays === 0) label = "today";
        else if (diffDays === 1) label = "yesterday";
        else if (diffDays === -1) label = "tomorrow";
        else if (diffDays > 0) label = `${diffDays} days ago`;
        else label = `in ${-diffDays} days`;

        kairo.log.info(`Opened daily note: ${label}`, path);
      }
    }
  });

  // Filter to enhance daily note content
  kairo.registerFilter("filterNoteContent", (content) => {
    const state = kairo.getState();
    const currentPath = state.notes?.current?.path || "";

    // Only process daily notes
    if (!currentPath.startsWith("daily/")) {
      return content;
    }

    // If it's a new daily note (empty), insert template
    if (!content || content.trim() === "") {
      const now = new Date();
      const template = DAILY_NOTE_TEMPLATE
        .replace("{{date}}", getFormattedDate(now))
        .replace("{{time}}", now.toLocaleTimeString());

      kairo.log.info("Inserting daily note template");
      return template;
    }

    return content;
  });

  // Commands
  kairo.registerCommand({
    id: "create-today",
    name: "Create Today's Daily Note",
    description: "Create or open today's daily note",
    category: "Daily Notes",
    shortcut: "Ctrl+Alt+D",
    execute: () => {
      window.dispatchEvent(new CustomEvent("kairo:daily-note"));
      kairo.log.info("Daily note command executed");
    }
  });

  kairo.registerCommand({
    id: "weekly-review",
    name: "Weekly Review",
    description: "Create a weekly review note",
    category: "Daily Notes",
    execute: () => {
      const now = new Date();
      const weekNum = Math.ceil((now.getDate() - now.getDay()) / 7);
      kairo.log.info(`Creating weekly review for week ${weekNum}`);
    }
  });

  kairo.registerCommand({
    id: "copy-template",
    name: "Copy Daily Template",
    description: "Copy the daily note template to clipboard",
    category: "Daily Notes",
    execute: async () => {
      const now = new Date();
      const template = DAILY_NOTE_TEMPLATE
        .replace("{{date}}", getFormattedDate(now))
        .replace("{{time}}", now.toLocaleTimeString());

      await navigator.clipboard.writeText(template);
      kairo.log.info("Daily template copied to clipboard");
    }
  });

  // Add context menu items
  kairo.registerContextMenuItem("note-tree", {
    id: "mark-as-daily",
    label: "Create Daily Link",
    icon: "📅",
    when: (context) => {
      // Only show for non-daily notes
      return !context.notePath?.startsWith("daily/");
    },
    execute: async (context) => {
      const today = getDateString(new Date());
      const link = `[[daily/${today}|Today's Note]]`;
      await navigator.clipboard.writeText(link);
      kairo.log.info("Daily link copied", link);
    }
  });
}

function cleanup(kairo) {
  kairo.removeStyles();
  kairo.log.info("Daily Notes extension unloaded");
}

exports.initialize = initialize;
exports.cleanup = cleanup;
