// Card template definitions for Kairo kanban

export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  content: string;  // Markdown content
  boardId?: string; // null = global template
  isBuiltin?: boolean;
}

// Built-in templates available to all boards
export const BUILTIN_TEMPLATES: CardTemplate[] = [
  {
    id: "bug-report",
    name: "Bug Report",
    description: "Template for reporting bugs and issues",
    isBuiltin: true,
    content: `## Description
Brief description of the bug.
<br>
## Steps to Reproduce
1. Step one
2. Step two
3. Step three
<br>
## Expected Behavior
What should happen?
<br>
## Actual Behavior
What actually happens?
<br>
## Environment
- OS:
- Version:
- Browser (if applicable):
<br>
## Screenshots
<!-- Attach screenshots if applicable -->
<br>
## Additional Context
<!-- Any other relevant information -->
`,
  },
  {
    id: "feature-request",
    name: "Feature Request",
    description: "Template for proposing new features",
    isBuiltin: true,
    content: `## Feature Summary
Brief description of the proposed feature.
<br>
## Problem Statement
What problem does this solve?
<br>
## Proposed Solution
How should this feature work?
<br>
## Alternatives Considered
What other approaches were considered?
<br>
## Additional Context
<!-- User stories, mockups, or other details -->
`,
  },
  {
    id: "task-checklist",
    name: "Task Checklist",
    description: "Simple task with checklist items",
    isBuiltin: true,
    content: `## Objective
What needs to be accomplished?
<br>
## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Task 4
<br>
## Notes
<!-- Additional notes or context -->
<br>
## Dependencies
<!-- List any dependencies or blockers -->
`,
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Template for capturing meeting notes",
    isBuiltin: true,
    content: `## Meeting Details
- **Date**:
- **Attendees**:
- **Duration**:
<br>
## Agenda
1. Topic 1
2. Topic 2
3. Topic 3
<br>
## Discussion Notes
<!-- Key points from the meeting -->
<br>
## Action Items
- [ ] @person: Action item 1
- [ ] @person: Action item 2
<br>
## Next Steps
<!-- What happens next? -->
<br>
## Follow-up Date
<!-- When to follow up -->
`,
  },
  {
    id: "user-story",
    name: "User Story",
    description: "Agile user story format",
    isBuiltin: true,
    content: `## User Story
As a **[type of user]**,
I want **[goal/desire]**,
So that **[benefit/reason]**.
<br>
## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
<br>
## Technical Notes
<!-- Implementation details or constraints -->
<br>
## Definition of Done
- [ ] Code complete
- [ ] Tests written
- [ ] Documentation updated
- [ ] Code reviewed
`,
  },
  {
    id: "research",
    name: "Research Task",
    description: "Template for research and investigation tasks",
    isBuiltin: true,
    content: `## Research Question
What are we trying to learn or understand?
<br>
## Background
<!-- Context and why this research is needed -->
<br>
## Scope
- In scope:
- Out of scope:
<br>
## Methodology
How will this research be conducted?
<br>
## Findings
<!-- Document findings here -->
<br>
## Conclusions
<!-- Summary and recommendations -->
<br>
## Related Links
-
`,
  },
  {
    id: "blank",
    name: "Blank Card",
    description: "Start with an empty card",
    isBuiltin: true,
    content: "",
  },
];

// Template storage key for custom templates
export const TEMPLATE_STORAGE_KEY = "card_templates";

// Get all available templates (builtin + custom)
export function getAllTemplates(customTemplates: CardTemplate[] = []): CardTemplate[] {
  return [...BUILTIN_TEMPLATES, ...customTemplates];
}

// Get templates for a specific board (global + board-specific)
export function getTemplatesForBoard(
  boardId: string,
  customTemplates: CardTemplate[] = []
): CardTemplate[] {
  const allTemplates = getAllTemplates(customTemplates);
  return allTemplates.filter(
    (t) => t.boardId === undefined || t.boardId === null || t.boardId === boardId
  );
}
