import { registerPlugin, registerCommand } from "@/plugins/api";
import { create } from "zustand";
import { useNoteStore } from "@/stores/noteStore";
import { invoke } from "@tauri-apps/api/core";

export interface Template {
  id: string;
  name: string;
  content: string;
  category?: string;
  isBuiltin?: boolean;
}

interface TemplateState {
  templates: Template[];
  customTemplates: Template[];
  showModal: boolean;
  editingTemplate: Template | null;
  isEditorMode: boolean;
  loadTemplates: () => Promise<void>;
  saveCustomTemplates: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  openEditor: (template?: Template) => void;
  closeEditor: () => void;
  createFromTemplate: (template: Template) => void;
  saveTemplate: (template: Template) => void;
  deleteTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  customTemplates: [],
  showModal: false,
  editingTemplate: null,
  isEditorMode: false,

  loadTemplates: async () => {
    // Load custom templates from vault
    let customTemplates: Template[] = [];
    try {
      const data = await invoke<string>("read_plugin_data", {
        pluginId: "templates",
        key: "custom_templates"
      });
      if (data) {
        customTemplates = JSON.parse(data);
      }
    } catch {
      // No custom templates yet
    }

    const allTemplates = [
      ...getBuiltinTemplates(),
      ...customTemplates.map(t => ({ ...t, isBuiltin: false })),
    ];

    set({ templates: allTemplates, customTemplates });
  },

  saveCustomTemplates: async () => {
    const { customTemplates } = get();
    try {
      await invoke("write_plugin_data", {
        pluginId: "templates",
        key: "custom_templates",
        data: JSON.stringify(customTemplates),
      });
    } catch (err) {
      console.error("Failed to save custom templates:", err);
    }
  },

  openModal: () => set({ showModal: true, isEditorMode: false, editingTemplate: null }),
  closeModal: () => set({ showModal: false, isEditorMode: false, editingTemplate: null }),

  openEditor: (template?: Template) => {
    if (template) {
      set({ editingTemplate: { ...template }, isEditorMode: true });
    } else {
      // New template
      set({
        editingTemplate: {
          id: `custom-${Date.now()}`,
          name: "",
          content: "# New Template\n\n",
          category: "Custom",
          isBuiltin: false,
        },
        isEditorMode: true,
      });
    }
  },

  closeEditor: () => set({ isEditorMode: false, editingTemplate: null }),

  createFromTemplate: (template: Template) => {
    const { createNote } = useNoteStore.getState();
    const timestamp = Date.now();
    const fileName = `notes/${template.name.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.md`;

    // Process template variables
    const content = processTemplateVariables(template.content);
    createNote(fileName, content);
    set({ showModal: false });
  },

  saveTemplate: (template: Template) => {
    const { customTemplates, saveCustomTemplates } = get();

    // Find existing or add new
    const existingIndex = customTemplates.findIndex(t => t.id === template.id);
    let newCustomTemplates: Template[];

    if (existingIndex >= 0) {
      newCustomTemplates = [...customTemplates];
      newCustomTemplates[existingIndex] = { ...template, isBuiltin: false };
    } else {
      newCustomTemplates = [...customTemplates, { ...template, isBuiltin: false }];
    }

    set({ customTemplates: newCustomTemplates, isEditorMode: false, editingTemplate: null });

    // Refresh all templates and save
    const allTemplates = [
      ...getBuiltinTemplates(),
      ...newCustomTemplates.map(t => ({ ...t, isBuiltin: false })),
    ];
    set({ templates: allTemplates });
    saveCustomTemplates();
  },

  deleteTemplate: (id: string) => {
    const { customTemplates, saveCustomTemplates } = get();
    const newCustomTemplates = customTemplates.filter(t => t.id !== id);

    set({ customTemplates: newCustomTemplates });

    const allTemplates = [
      ...getBuiltinTemplates(),
      ...newCustomTemplates.map(t => ({ ...t, isBuiltin: false })),
    ];
    set({ templates: allTemplates });
    saveCustomTemplates();
  },
}));

function processTemplateVariables(content: string): string {
  const now = new Date();
  return content
    .replace(/\{\{date\}\}/g, now.toISOString().split("T")[0])
    .replace(/\{\{datetime\}\}/g, now.toISOString())
    .replace(/\{\{time\}\}/g, now.toTimeString().split(" ")[0])
    .replace(/\{\{year\}\}/g, String(now.getFullYear()))
    .replace(/\{\{month\}\}/g, String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{\{day\}\}/g, String(now.getDate()).padStart(2, "0"));
}

function getBuiltinTemplates(): Template[] {
  return [
    {
      id: "meeting",
      name: "Meeting Notes",
      category: "Work",
      isBuiltin: true,
      content: `# Meeting Notes - {{date}}

## Attendees
-

## Agenda
1.

## Discussion


## Action Items
- [ ]

## Next Steps

`,
    },
    {
      id: "runbook",
      name: "Runbook",
      category: "Red Team",
      isBuiltin: true,
      content: `# Runbook: [Title]

## Overview
Brief description of the technique/procedure.

## Prerequisites
-

## Steps

### 1. [Step Name]
\`\`\`bash
# Commands here
\`\`\`

### 2. [Step Name]
\`\`\`powershell
# Commands here
\`\`\`

## Expected Output


## Troubleshooting


## References
-

---
Tags: #runbook #redteam
`,
    },
    {
      id: "incident",
      name: "Incident Report",
      category: "Security",
      isBuiltin: true,
      content: `# Incident Report - {{date}}

## Summary
| Field | Value |
|-------|-------|
| Incident ID | INC-{{date}} |
| Severity | |
| Status | Open |
| Reported By | |

## Timeline
- **{{datetime}}** -

## Description


## Affected Systems
-

## Root Cause


## Remediation Steps
1.

## Lessons Learned


---
Tags: #incident #security
`,
    },
    {
      id: "standup",
      name: "Standup Notes",
      category: "Work",
      isBuiltin: true,
      content: `# Standup - {{date}}

## Yesterday
-

## Today
-

## Blockers
-

`,
    },
    {
      id: "tool",
      name: "Tool Documentation",
      category: "Red Team",
      isBuiltin: true,
      content: `# Tool: [Name]

## Overview
What the tool does and when to use it.

## Installation
\`\`\`bash
# Installation commands
\`\`\`

## Basic Usage
\`\`\`bash
# Basic usage example
\`\`\`

## Common Options
| Option | Description |
|--------|-------------|
| \`-h\` | Help |

## Examples

### Example 1: [Description]
\`\`\`bash
# Command
\`\`\`

## Detection
How this tool might be detected.

## References
-

---
Tags: #tool #redteam
`,
    },
  ];
}

export { TemplateModal } from "./TemplateModal";

export function initTemplatesPlugin() {
  registerPlugin({
    manifest: {
      id: "kairo-templates",
      name: "Templates",
      version: "1.0.0",
      description: "Note templates for quick creation",
    },
    enabled: true,
    initialize: () => {
      // Load templates on init
      useTemplateStore.getState().loadTemplates();

      registerCommand({
        id: "templates.open",
        name: "Templates: New from Template",
        description: "Create a new note from a template",
        shortcut: "Ctrl+Shift+N",
        category: "Templates",
        execute: () => useTemplateStore.getState().openModal(),
      });

      registerCommand({
        id: "templates.create",
        name: "Templates: Create New Template",
        description: "Create a custom template",
        category: "Templates",
        execute: () => {
          useTemplateStore.getState().openModal();
          useTemplateStore.getState().openEditor();
        },
      });
    },
  });
}
