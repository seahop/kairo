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

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen?

## Actual Behavior
What actually happens?

## Environment
- OS:
- Version:
- Browser (if applicable):

## Screenshots
<!-- Attach screenshots if applicable -->

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

## Problem Statement
What problem does this solve?

## Proposed Solution
How should this feature work?

## Alternatives Considered
What other approaches were considered?

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

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Task 4

## Notes
<!-- Additional notes or context -->

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

## Agenda
1. Topic 1
2. Topic 2
3. Topic 3

## Discussion Notes
<!-- Key points from the meeting -->

## Action Items
- [ ] @person: Action item 1
- [ ] @person: Action item 2

## Next Steps
<!-- What happens next? -->

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

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Technical Notes
<!-- Implementation details or constraints -->

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

## Background
<!-- Context and why this research is needed -->

## Scope
- In scope:
- Out of scope:

## Methodology
How will this research be conducted?

## Findings
<!-- Document findings here -->

## Conclusions
<!-- Summary and recommendations -->

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
