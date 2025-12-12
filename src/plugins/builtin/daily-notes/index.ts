import { registerPlugin, registerCommand } from "@/plugins/api";
import { useNoteStore } from "@/stores/noteStore";

export function initDailyNotesPlugin() {
  registerPlugin({
    manifest: {
      id: "kairo-daily-notes",
      name: "Daily Notes",
      version: "1.0.0",
      description: "Quick access to daily journal notes",
    },
    enabled: true,
    initialize: () => {
      registerCommand({
        id: "daily.today",
        name: "Daily Note: Open Today",
        description: "Open or create today's daily note",
        shortcut: "Ctrl+D",
        category: "Daily Notes",
        execute: () => openDailyNote(new Date()),
      });

      registerCommand({
        id: "daily.yesterday",
        name: "Daily Note: Open Yesterday",
        description: "Open yesterday's daily note",
        category: "Daily Notes",
        execute: () => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          openDailyNote(yesterday);
        },
      });

      registerCommand({
        id: "daily.tomorrow",
        name: "Daily Note: Open Tomorrow",
        description: "Open or create tomorrow's daily note",
        category: "Daily Notes",
        execute: () => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          openDailyNote(tomorrow);
        },
      });
    },
  });
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
}

function formatDateReadable(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function openDailyNote(date: Date) {
  const { notes, openNote, createNote } = useNoteStore.getState();
  const dateStr = formatDate(date);
  const path = `notes/daily/${dateStr}.md`;

  // Check if note exists
  const existingNote = notes.find((n) => n.path === path);

  if (existingNote) {
    openNote(path);
  } else {
    // Create daily note with template
    const content = `# ${formatDateReadable(date)}

## Tasks
- [ ]

## Notes


## Log


---
*Daily note created by Kairo*
`;
    createNote(path, content);
  }
}
