import { registerPlugin, registerCommand } from "@/plugins/api";
import { create } from "zustand";
import { useNoteStore } from "@/stores/noteStore";
import { invoke } from "@tauri-apps/api/core";

export type TemplateCategory = 'general' | 'daily' | 'zettelkasten' | 'moc' | 'para' | 'work' | 'security' | 'custom';

export interface Template {
  id: string;
  name: string;
  description?: string;
  content: string;
  category?: TemplateCategory | string;
  pathPrefix?: string;  // Where to create the note (e.g., "notes/daily")
  filenamePattern?: string;  // Pattern for filename (supports {date}, {time}, {zettel}, {title})
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
  createFromTemplate: (template: Template, customTitle?: string) => void;
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
          content: "# New Template\n<br>\n",
          category: "Custom",
          isBuiltin: false,
        },
        isEditorMode: true,
      });
    }
  },

  closeEditor: () => set({ isEditorMode: false, editingTemplate: null }),

  createFromTemplate: (template: Template, customTitle?: string) => {
    const { createNote } = useNoteStore.getState();

    // Generate filename using pattern or fallback
    const fileName = generateFilename(template, customTitle);

    // Process template variables
    const content = processTemplateVariables(template.content, customTitle);
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

// Generate Zettelkasten-style ID (YYYYMMDDHHmmss)
function generateZettelId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

// Get date info for template processing
function getDateInfo() {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],  // YYYY-MM-DD
    time: now.toTimeString().split(' ')[0].slice(0, 5),  // HH:mm
    datetime: now.toISOString(),
    weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
    monthName: now.toLocaleDateString('en-US', { month: 'long' }),
    year: now.getFullYear().toString(),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
    zettel: generateZettelId(),
  };
}

// Process template content with placeholders
// Supports both {{var}} and {var} syntax for compatibility
function processTemplateVariables(content: string, customTitle?: string): string {
  const info = getDateInfo();
  let result = content
    // {{var}} syntax (plugin templates)
    .replace(/\{\{date\}\}/g, info.date)
    .replace(/\{\{datetime\}\}/g, info.datetime)
    .replace(/\{\{time\}\}/g, info.time)
    .replace(/\{\{year\}\}/g, info.year)
    .replace(/\{\{month\}\}/g, info.month)
    .replace(/\{\{day\}\}/g, info.day)
    .replace(/\{\{weekday\}\}/g, info.weekday)
    .replace(/\{\{monthName\}\}/g, info.monthName)
    .replace(/\{\{zettel\}\}/g, info.zettel)
    // {var} syntax (note templates)
    .replace(/\{date\}/g, info.date)
    .replace(/\{datetime\}/g, info.datetime)
    .replace(/\{time\}/g, info.time)
    .replace(/\{year\}/g, info.year)
    .replace(/\{month\}/g, info.monthName)
    .replace(/\{weekday\}/g, info.weekday)
    .replace(/\{zettel\}/g, info.zettel);

  if (customTitle) {
    result = result
      .replace(/\{\{title\}\}/g, customTitle)
      .replace(/\{title\}/g, customTitle);
  }

  return result;
}

// Generate filename from template pattern
function generateFilename(template: Template, customTitle?: string): string {
  if (template.filenamePattern) {
    const processed = processTemplateVariables(template.filenamePattern, customTitle || 'untitled');
    const prefix = template.pathPrefix || 'notes';
    return `${prefix}/${processed}.md`;
  }

  // Fallback: use name-based filename
  const timestamp = Date.now();
  const safeName = template.name.toLowerCase().replace(/\s+/g, "-");
  return `notes/${safeName}-${timestamp}.md`;
}

// Check if a template needs a custom title input
export function templateNeedsTitle(template: Template): boolean {
  if (!template.filenamePattern) return false;
  return template.filenamePattern.includes('{title}') || template.filenamePattern.includes('{{title}}');
}

function getBuiltinTemplates(): Template[] {
  return [
    // === General Templates ===
    {
      id: 'quick-note',
      name: 'Quick Note',
      description: 'A simple note for quick capture',
      category: 'general',
      pathPrefix: 'notes/inbox',
      filenamePattern: '{date}-{time}',
      isBuiltin: true,
      content: `# Quick Note
<br>
{datetime}
<br>
---
<br>
`,
    },
    {
      id: 'standard-note',
      name: 'Standard Note',
      description: 'A basic note with title',
      category: 'general',
      pathPrefix: 'notes',
      filenamePattern: '{title}',
      isBuiltin: true,
      content: `# {title}
<br>
Created: {date}
<br>
---
<br>
`,
    },
    {
      id: 'meeting',
      name: 'Meeting Notes',
      description: 'Notes from a meeting',
      category: 'general',
      pathPrefix: 'notes/meetings',
      filenamePattern: '{date}-{title}',
      isBuiltin: true,
      content: `# Meeting: {title}
<br>
**Date:** {date} {time}
**Attendees:**
<br>
---
<br>
## Agenda
1.
<br>
## Discussion Notes
<br>
<br>
## Action Items
- [ ] @person -
<br>
## Decisions Made
<br>
<br>
## Follow-up
-
<br>
---
*Created: {datetime}*
`,
    },

    // === Daily Notes ===
    {
      id: 'daily-note',
      name: 'Daily Note',
      description: 'Daily journal and task tracking',
      category: 'daily',
      pathPrefix: 'notes/daily',
      filenamePattern: '{date}',
      isBuiltin: true,
      content: `# {weekday}, {month} {day}, {year}
<br>
## Tasks
- [ ]
<br>
## Notes
<br>
<br>
## Links
- [[{date}|Yesterday]]
<br>
---
*Created: {time}*
`,
    },
    {
      id: 'weekly-review',
      name: 'Weekly Review',
      description: 'Weekly reflection and planning',
      category: 'daily',
      pathPrefix: 'notes/reviews',
      filenamePattern: 'week-{date}',
      isBuiltin: true,
      content: `# Weekly Review - {date}
<br>
## What went well?
<br>
<br>
## What could be improved?
<br>
<br>
## Key learnings
<br>
<br>
## Next week's priorities
1.
2.
3.
<br>
## Notes to review
-
<br>
---
*Created: {datetime}*
`,
    },
    {
      id: 'standup',
      name: 'Standup Notes',
      description: 'Daily standup summary',
      category: 'daily',
      pathPrefix: 'notes/standups',
      filenamePattern: 'standup-{date}',
      isBuiltin: true,
      content: `# Standup - {date}
<br>
## Yesterday
-
<br>
## Today
-
<br>
## Blockers
-
<br>
`,
    },

    // === Zettelkasten Templates ===
    {
      id: 'zettel',
      name: 'Zettel (Atomic Note)',
      description: 'Single-idea note for Zettelkasten method',
      category: 'zettelkasten',
      pathPrefix: 'notes',
      filenamePattern: '{zettel}-{title}',
      isBuiltin: true,
      content: `# {title}
<br>
<!-- Single idea goes here -->
<br>
<br>
<br>
---
<br>
## References
-
<br>
## Links
-
<br>
---
*ID: {zettel}*
*Created: {datetime}*
`,
    },
    {
      id: 'literature-note',
      name: 'Literature Note',
      description: 'Notes from a book, article, or video',
      category: 'zettelkasten',
      pathPrefix: 'notes/literature',
      filenamePattern: '{title}',
      isBuiltin: true,
      content: `# {title}
<br>
**Source:**
**Author:**
**Date Read:** {date}
<br>
---
<br>
## Summary
<br>
<br>
## Key Ideas
1.
2.
3.
<br>
## Quotes
<br>
<br>
## My Thoughts
<br>
<br>
## Links to Permanent Notes
-
<br>
---
*Created: {datetime}*
`,
    },

    // === MOC (Maps of Content) Templates ===
    {
      id: 'moc',
      name: 'Map of Content (MOC)',
      description: 'Index note that links related notes',
      category: 'moc',
      pathPrefix: 'notes/moc',
      filenamePattern: 'moc-{title}',
      isBuiltin: true,
      content: `# {title} - Map of Content
<br>
> This MOC organizes notes related to **{title}**.
<br>
---
<br>
## Overview
<br>
<br>
## Core Concepts
-
<br>
## Related Notes
-
<br>
## Questions to Explore
- [ ]
<br>
## Resources
-
<br>
---
*Last updated: {date}*
`,
    },
    {
      id: 'index',
      name: 'Index Note',
      description: 'Top-level navigation note',
      category: 'moc',
      pathPrefix: 'notes',
      filenamePattern: 'index-{title}',
      isBuiltin: true,
      content: `# {title} Index
<br>
## Quick Links
<br>
<br>
## Categories
<br>
<br>
## Recently Added
<br>
<br>
---
*Updated: {date}*
`,
    },

    // === PARA Templates ===
    {
      id: 'project',
      name: 'Project Note',
      description: 'Active project with deadline (PARA)',
      category: 'para',
      pathPrefix: 'notes/1-projects',
      filenamePattern: '{title}',
      isBuiltin: true,
      content: `# Project: {title}
<br>
**Status:** Active
**Deadline:**
**Created:** {date}
<br>
---
<br>
## Objective
<br>
<br>
## Key Results
- [ ]
- [ ]
- [ ]
<br>
## Tasks
- [ ]
<br>
## Notes
<br>
<br>
## Resources
-
<br>
## Related
-
<br>
---
*Last updated: {date}*
`,
    },
    {
      id: 'area',
      name: 'Area Note',
      description: 'Ongoing responsibility area (PARA)',
      category: 'para',
      pathPrefix: 'notes/2-areas',
      filenamePattern: '{title}',
      isBuiltin: true,
      content: `# Area: {title}
<br>
**Category:**
**Created:** {date}
<br>
---
<br>
## Overview
<br>
<br>
## Standards/Goals
<br>
<br>
## Active Projects
-
<br>
## Key Resources
-
<br>
## Notes
-
<br>
---
*Last updated: {date}*
`,
    },
    {
      id: 'resource',
      name: 'Resource Note',
      description: 'Reference material (PARA)',
      category: 'para',
      pathPrefix: 'notes/3-resources',
      filenamePattern: '{title}',
      isBuiltin: true,
      content: `# Resource: {title}
<br>
**Topic:**
**Created:** {date}
<br>
---
<br>
## Summary
<br>
<br>
## Key Points
1.
2.
3.
<br>
## Useful Links
-
<br>
## Related Notes
-
<br>
---
*Last updated: {date}*
`,
    },

    // === Security/Red Team Templates ===
    {
      id: 'runbook',
      name: 'Runbook',
      description: 'Red Team procedure documentation',
      category: 'security',
      pathPrefix: 'notes/runbooks',
      filenamePattern: 'runbook-{title}',
      isBuiltin: true,
      content: `# Runbook: {title}
<br>
## Overview
Brief description of the technique/procedure.
<br>
## Prerequisites
-
<br>
## Steps
<br>
### 1. [Step Name]
\`\`\`bash
# Commands here
\`\`\`
<br>
### 2. [Step Name]
\`\`\`powershell
# Commands here
\`\`\`
<br>
## Expected Output
<br>
<br>
## Troubleshooting
<br>
<br>
## References
-
<br>
---
Tags: #runbook #redteam
`,
    },
    {
      id: 'incident',
      name: 'Incident Report',
      description: 'Security incident documentation',
      category: 'security',
      pathPrefix: 'notes/incidents',
      filenamePattern: 'INC-{date}-{title}',
      isBuiltin: true,
      content: `# Incident Report - {title}
<br>
## Summary
| Field | Value |
|-------|-------|
| Incident ID | INC-{date} |
| Severity | |
| Status | Open |
| Reported By | |
<br>
## Timeline
- **{datetime}** -
<br>
## Description
<br>
<br>
## Affected Systems
-
<br>
## Root Cause
<br>
<br>
## Remediation Steps
1.
<br>
## Lessons Learned
<br>
<br>
---
Tags: #incident #security
`,
    },
    {
      id: 'tool',
      name: 'Tool Documentation',
      description: 'Security tool reference',
      category: 'security',
      pathPrefix: 'notes/tools',
      filenamePattern: 'tool-{title}',
      isBuiltin: true,
      content: `# Tool: {title}
<br>
## Overview
What the tool does and when to use it.
<br>
## Installation
\`\`\`bash
# Installation commands
\`\`\`
<br>
## Basic Usage
\`\`\`bash
# Basic usage example
\`\`\`
<br>
## Common Options
| Option | Description |
|--------|-------------|
| \`-h\` | Help |
<br>
## Examples
<br>
### Example 1: [Description]
\`\`\`bash
# Command
\`\`\`
<br>
## Detection
How this tool might be detected.
<br>
## References
-
<br>
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
        name: "Templates: Manage Templates",
        description: "Open the templates manager",
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
