// Note templates for different organizational methods

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'zettelkasten' | 'para' | 'moc' | 'daily';
  pathPrefix?: string;  // Where to create the note
  filenamePattern: string;  // Pattern for filename (supports {date}, {time}, {zettel}, {title})
  content: string;  // Template content (supports same placeholders)
}

// Generate Zettelkasten-style ID (YYYYMMDDHHmmss)
export function generateZettelId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

// Get current date in various formats
export function getDateInfo() {
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

// Process template with placeholders
export function processTemplate(template: string, customTitle?: string): string {
  const info = getDateInfo();
  let result = template
    .replace(/\{date\}/g, info.date)
    .replace(/\{time\}/g, info.time)
    .replace(/\{datetime\}/g, info.datetime)
    .replace(/\{weekday\}/g, info.weekday)
    .replace(/\{month\}/g, info.monthName)
    .replace(/\{year\}/g, info.year)
    .replace(/\{zettel\}/g, info.zettel);

  if (customTitle) {
    result = result.replace(/\{title\}/g, customTitle);
  }

  return result;
}

// Generate filename from template
export function generateFilename(template: NoteTemplate, customTitle?: string): string {
  const processed = processTemplate(template.filenamePattern, customTitle);
  const prefix = template.pathPrefix ? `${template.pathPrefix}/` : 'notes/';
  return `${prefix}${processed}.md`;
}

// Default templates
export const defaultTemplates: NoteTemplate[] = [
  // General templates
  {
    id: 'quick-note',
    name: 'Quick Note',
    description: 'A simple note for quick capture',
    category: 'general',
    pathPrefix: 'notes/inbox',
    filenamePattern: '{date}-{time}',
    content: `# Quick Note

{datetime}

---

`,
  },
  {
    id: 'standard-note',
    name: 'Standard Note',
    description: 'A basic note with title',
    category: 'general',
    pathPrefix: 'notes',
    filenamePattern: '{title}',
    content: `# {title}

Created: {date}

---

`,
  },

  // Daily notes
  {
    id: 'daily-note',
    name: 'Daily Note',
    description: 'Daily journal and task tracking',
    category: 'daily',
    pathPrefix: 'notes/daily',
    filenamePattern: '{date}',
    content: `# {weekday}, {month} {day}, {year}

## Tasks
- [ ]

## Notes


## Links
- [[{date}|Yesterday]]

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
    content: `# Weekly Review - {date}

## What went well?


## What could be improved?


## Key learnings


## Next week's priorities
1.
2.
3.

## Notes to review
-

---
*Created: {datetime}*
`,
  },

  // Zettelkasten templates
  {
    id: 'zettel',
    name: 'Zettel (Atomic Note)',
    description: 'Single-idea note for Zettelkasten method',
    category: 'zettelkasten',
    pathPrefix: 'notes',
    filenamePattern: '{zettel}-{title}',
    content: `# {title}

<!-- Single idea goes here -->



---

## References
-

## Links
-

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
    content: `# {title}

**Source:**
**Author:**
**Date Read:** {date}

---

## Summary


## Key Ideas
1.
2.
3.

## Quotes


## My Thoughts


## Links to Permanent Notes
-

---
*Created: {datetime}*
`,
  },

  // MOC (Maps of Content) templates
  {
    id: 'moc',
    name: 'Map of Content (MOC)',
    description: 'Index note that links related notes',
    category: 'moc',
    pathPrefix: 'notes/moc',
    filenamePattern: 'moc-{title}',
    content: `# {title} - Map of Content

> This MOC organizes notes related to **{title}**.

---

## Overview


## Core Concepts
-

## Related Notes
-

## Questions to Explore
- [ ]

## Resources
-

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
    content: `# {title} Index

## Quick Links


## Categories


## Recently Added


---
*Updated: {date}*
`,
  },

  // PARA templates
  {
    id: 'project',
    name: 'Project Note',
    description: 'Active project with deadline (PARA)',
    category: 'para',
    pathPrefix: 'notes/1-projects',
    filenamePattern: '{title}',
    content: `# Project: {title}

**Status:** Active
**Deadline:**
**Created:** {date}

---

## Objective


## Key Results
- [ ]
- [ ]
- [ ]

## Tasks
- [ ]

## Notes


## Resources
-

## Related
-

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
    content: `# Area: {title}

**Category:**
**Created:** {date}

---

## Overview


## Standards/Goals


## Active Projects
-

## Key Resources
-

## Notes
-

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
    content: `# Resource: {title}

**Topic:**
**Created:** {date}

---

## Summary


## Key Points
1.
2.
3.

## Useful Links
-

## Related Notes
-

---
*Last updated: {date}*
`,
  },

  // Meeting note
  {
    id: 'meeting',
    name: 'Meeting Note',
    description: 'Notes from a meeting',
    category: 'general',
    pathPrefix: 'notes/meetings',
    filenamePattern: '{date}-{title}',
    content: `# Meeting: {title}

**Date:** {date} {time}
**Attendees:**

---

## Agenda
1.

## Discussion Notes


## Action Items
- [ ] @person -

## Decisions Made


## Follow-up
-

---
*Created: {datetime}*
`,
  },
];

// Get templates by category
export function getTemplatesByCategory(category: NoteTemplate['category']): NoteTemplate[] {
  return defaultTemplates.filter(t => t.category === category);
}

// Get template by ID
export function getTemplateById(id: string): NoteTemplate | undefined {
  return defaultTemplates.find(t => t.id === id);
}
