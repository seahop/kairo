import { CompletionContext, CompletionResult, Completion, autocompletion, startCompletion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore, NoteMetadata } from "@/stores/noteStore";

// Card summary type for autocomplete
interface KanbanCardSummary {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  columnName: string | null;
}

// Diagram summary type for autocomplete
interface DiagramBoardSummary {
  id: string;
  name: string;
}

// Alias info type for autocomplete
interface AliasInfo {
  alias: string;
  note_path: string;
  note_title: string;
}

// Cache for autocomplete data
let noteCache: NoteMetadata[] = [];
let tagCache: string[] = [];
let mentionCache: string[] = [];
let cardCache: KanbanCardSummary[] = [];
let diagramCache: DiagramBoardSummary[] = [];
let aliasCache: AliasInfo[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 5000; // 5 seconds

async function refreshCache() {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL) {
    return;
  }

  try {
    // Get notes from store
    noteCache = useNoteStore.getState().notes;

    // Fetch tags, mentions, cards, diagrams, and aliases from backend
    const [tags, mentions, cards, diagrams, aliases] = await Promise.all([
      invoke<string[]>("get_all_tags").catch(() => []),
      invoke<string[]>("get_all_mentions").catch(() => []),
      invoke<KanbanCardSummary[]>("kanban_get_all_cards").catch(() => []),
      invoke<DiagramBoardSummary[]>("diagram_list_boards").catch(() => []),
      invoke<AliasInfo[]>("get_all_aliases").catch(() => []),
    ]);

    tagCache = tags;
    mentionCache = mentions;
    cardCache = cards;
    diagramCache = diagrams;
    aliasCache = aliases;
    lastCacheUpdate = now;
  } catch (err) {
    console.error("Failed to refresh autocomplete cache:", err);
  }
}

// Link type prefix definitions for autocomplete suggestions
const LINK_PREFIXES = [
  { prefix: "diagram:", label: "diagram:", detail: "Link to a diagram", type: "namespace" as const, icon: "📊" },
  { prefix: "kanban:", label: "kanban:", detail: "Link to a kanban card", type: "class" as const, icon: "🎯" },
  { prefix: "card:", label: "card:", detail: "Link to a kanban card", type: "class" as const, icon: "🎯" },
];

// Wiki link completion: triggered by [[
function wikiLinkCompletion(context: CompletionContext): CompletionResult | null {
  // Look for [[ before the cursor
  const before = context.matchBefore(/\[\[[^\]]*$/);
  console.log("[autocomplete] wikiLink matchBefore:", before ? `matched "${before.text}"` : "no match");
  if (!before) return null;

  // Extract the query (text after [[)
  const query = before.text.slice(2).toLowerCase();

  // Don't trigger for card, kanban, or diagram links - those are handled separately
  if (query.startsWith("card:") || query.startsWith("kanban:") || query.startsWith("diagram:")) return null;

  const options: Completion[] = [];

  // Add prefix suggestions that match the query (shown at top with boost)
  // Only show if query could be the start of a prefix
  const matchingPrefixes = LINK_PREFIXES.filter(p =>
    p.prefix.toLowerCase().startsWith(query) || query === ""
  );

  for (const prefixDef of matchingPrefixes) {
    options.push({
      label: prefixDef.label,
      detail: prefixDef.detail,
      type: prefixDef.type,
      boost: 10, // Higher priority than notes
      apply: (view, _completion, _from, to) => {
        // Insert the prefix after [[, keeping cursor after the :
        const insertText = `[[${prefixDef.prefix}`;
        view.dispatch({
          changes: { from: before.from, to, insert: insertText },
          selection: { anchor: before.from + insertText.length },
        });
        // Trigger completion again to show diagrams/cards
        setTimeout(() => startCompletion(view), 0);
      },
    });
  }

  // Filter and sort notes - active notes first, then archived
  const matches = noteCache
    .filter(note => {
      const title = note.title.toLowerCase();
      const path = note.path.toLowerCase();
      return title.includes(query) || path.includes(query);
    })
    .sort((a, b) => {
      // Active notes before archived
      if (a.archived !== b.archived) {
        return a.archived ? 1 : -1;
      }
      // Then prioritize title matches over path matches
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aStartsWith = aTitle.startsWith(query);
      const bStartsWith = bTitle.startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.title.localeCompare(b.title);
    });

  // Split into active and archived, limit each
  const activeMatches = matches.filter(n => !n.archived).slice(0, 15);
  const archivedMatches = matches.filter(n => n.archived).slice(0, 5);

  // Add active note options
  for (const note of activeMatches) {
    options.push({
      label: note.title,
      detail: note.path,
      type: "text",
      apply: (view, _completion, _from, to) => {
        // Replace from [[ to cursor with [[title]]
        const insertText = `[[${note.title}]]`;
        view.dispatch({
          changes: { from: before.from, to, insert: insertText },
          selection: { anchor: before.from + insertText.length },
        });
      },
    });
  }

  // Add archived note options with lower boost and suffix
  for (const note of archivedMatches) {
    options.push({
      label: note.title,
      detail: `${note.path} (archived)`,
      type: "text",
      boost: -5, // Lower priority
      apply: (view, _completion, _from, to) => {
        // Replace from [[ to cursor with [[title]]
        const insertText = `[[${note.title}]]`;
        view.dispatch({
          changes: { from: before.from, to, insert: insertText },
          selection: { anchor: before.from + insertText.length },
        });
      },
    });
  }

  return {
    from: before.from,
    options,
    // Don't allow : in validFor to trigger re-evaluation for card: and diagram: links
    validFor: /^[^\]:]*$/,
  };
}

// Card/Kanban link completion: triggered by [[card: or [[kanban:
function cardLinkCompletion(context: CompletionContext): CompletionResult | null {
  // Look for [[card: or [[kanban: before the cursor
  const beforeCard = context.matchBefore(/\[\[card:[^\]]*$/);
  const beforeKanban = context.matchBefore(/\[\[kanban:[^\]]*$/);
  const before = beforeCard || beforeKanban;
  if (!before) return null;

  // Determine which prefix was used
  const prefix = beforeCard ? "card" : "kanban";
  const prefixLen = prefix === "card" ? 7 : 9; // "[[card:" = 7, "[[kanban:" = 9

  // Extract the query (text after the prefix)
  const query = before.text.slice(prefixLen).toLowerCase();

  // Filter and sort cards
  const matches = cardCache
    .filter(card => {
      const title = card.title.toLowerCase();
      const boardName = card.boardName.toLowerCase();
      // Support "board/title" search format
      const fullRef = `${boardName}/${title}`;
      return title.includes(query) || fullRef.includes(query);
    })
    .sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aStartsWith = aTitle.startsWith(query);
      const bStartsWith = bTitle.startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 20);

  const options: Completion[] = matches.map(card => ({
    label: `${card.boardName}/${card.title}`,
    detail: card.columnName || "",
    type: "class", // Using "class" type for distinct styling
    apply: (view, _completion, _from, to) => {
      // Use the same prefix that was typed: [[card:...]] or [[kanban:...]]
      const insertText = `[[${prefix}:${card.boardName}/${card.title}]]`;
      view.dispatch({
        changes: { from: before.from, to, insert: insertText },
        selection: { anchor: before.from + insertText.length },
      });
    },
  }));

  return {
    from: before.from,
    options,
    validFor: /^[^\]]*$/,
  };
}

// Diagram link completion: triggered by [[diagram:
function diagramLinkCompletion(context: CompletionContext): CompletionResult | null {
  // Look for [[diagram: before the cursor
  const before = context.matchBefore(/\[\[diagram:[^\]]*$/);
  if (!before) return null;

  // Extract the query (text after [[diagram:)
  const query = before.text.slice(10).toLowerCase(); // "[[diagram:" is 10 chars

  // Filter and sort diagrams
  const matches = diagramCache
    .filter(diagram => {
      const name = diagram.name.toLowerCase();
      return name.includes(query);
    })
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStartsWith = aName.startsWith(query);
      const bStartsWith = bName.startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 20);

  const options: Completion[] = matches.map(diagram => ({
    label: diagram.name,
    type: "namespace", // Using "namespace" type for diagram styling
    apply: (view, _completion, _from, to) => {
      const insertText = `[[diagram:${diagram.name}]]`;
      view.dispatch({
        changes: { from: before.from, to, insert: insertText },
        selection: { anchor: before.from + insertText.length },
      });
    },
  }));

  return {
    from: before.from,
    options,
    validFor: /^[^\]]*$/,
  };
}

// Tag completion: triggered by #
function tagCompletion(context: CompletionContext): CompletionResult | null {
  // Look for # followed by word characters (but not at start of line for headers)
  const before = context.matchBefore(/#\w*$/);
  console.log("[autocomplete] tag matchBefore:", before ? `matched "${before.text}"` : "no match");
  if (!before) return null;

  // Check if this is a markdown header (# at start of line)
  const line = context.state.doc.lineAt(before.from);
  const lineStart = line.from;
  const textBeforeHash = context.state.sliceDoc(lineStart, before.from);

  // If # is at start of line or preceded only by whitespace and #, it's a header
  if (/^#*\s*$/.test(textBeforeHash)) return null;

  const query = before.text.slice(1).toLowerCase();

  const matches = tagCache
    .filter(tag => tag.toLowerCase().includes(query))
    .sort((a, b) => {
      const aStartsWith = a.toLowerCase().startsWith(query);
      const bStartsWith = b.toLowerCase().startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 15);

  const options: Completion[] = matches.map(tag => ({
    label: `#${tag}`,
    type: "keyword",
    apply: `#${tag}`,
  }));

  // Allow creating new tags
  if (query && !tagCache.some(t => t.toLowerCase() === query)) {
    options.push({
      label: `#${query}`,
      detail: "(new tag)",
      type: "keyword",
      boost: -1, // Lower priority
    });
  }

  return {
    from: before.from,
    options,
    validFor: /^#\w*$/,
  };
}

// Mention completion: triggered by @
function mentionCompletion(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/@\w*$/);
  if (!before) return null;

  const query = before.text.slice(1).toLowerCase();

  const matches = mentionCache
    .filter(mention => mention.toLowerCase().includes(query))
    .sort((a, b) => {
      const aStartsWith = a.toLowerCase().startsWith(query);
      const bStartsWith = b.toLowerCase().startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 15);

  const options: Completion[] = matches.map(mention => ({
    label: `@${mention}`,
    type: "variable",
    apply: `@${mention}`,
  }));

  // Allow creating new mentions
  if (query && !mentionCache.some(m => m.toLowerCase() === query)) {
    options.push({
      label: `@${query}`,
      detail: "(new mention)",
      type: "variable",
      boost: -1,
    });
  }

  return {
    from: before.from,
    options,
    validFor: /^@\w*$/,
  };
}

// Simple test completion to verify autocomplete is working at all
function testCompletion(context: CompletionContext): CompletionResult | null {
  // Match any word character sequence
  const word = context.matchBefore(/\w+/);
  if (!word) return null;

  console.log("[autocomplete] testCompletion matched:", word.text);
  return {
    from: word.from,
    options: [
      { label: "test1", type: "text" },
      { label: "test2", type: "text" },
      { label: "test3", type: "text" },
    ],
    validFor: /^\w*$/,
  };
}

// Combined completion source (temporarily disabled for debugging - exported to avoid unused error)
export async function kairoCompletions(context: CompletionContext): Promise<CompletionResult | null> {
  console.log("[autocomplete] kairoCompletions called, explicit:", context.explicit);

  // First try the simple test completion to verify the mechanism works
  const testResult = testCompletion(context);
  if (testResult) {
    console.log("[autocomplete] testResult: returning", testResult.options.length, "options");
    return testResult;
  }

  // Refresh cache before completing
  await refreshCache();
  console.log("[autocomplete] cache refreshed, noteCache length:", noteCache.length);

  // Try each completion source (card and diagram links first as they're more specific)
  const cardResult = cardLinkCompletion(context);
  if (cardResult) {
    console.log("[autocomplete] cardResult:", cardResult.options.length, "options");
    return cardResult;
  }

  const diagramResult = diagramLinkCompletion(context);
  if (diagramResult) {
    console.log("[autocomplete] diagramResult:", diagramResult.options.length, "options");
    return diagramResult;
  }

  const wikiResult = wikiLinkCompletion(context);
  if (wikiResult) {
    console.log("[autocomplete] wikiResult:", wikiResult.options.length, "options");
    return wikiResult;
  }

  const tagResult = tagCompletion(context);
  if (tagResult) {
    console.log("[autocomplete] tagResult:", tagResult.options.length, "options");
    return tagResult;
  }

  const mentionResult = mentionCompletion(context);
  if (mentionResult) {
    console.log("[autocomplete] mentionResult:", mentionResult.options.length, "options");
    return mentionResult;
  }

  console.log("[autocomplete] no match found");
  return null;
}

// Slash command definitions
interface SlashCommand {
  label: string;
  detail: string;
  category: 'heading' | 'list' | 'callout' | 'block' | 'table' | 'insert' | 'format';
  template: string | (() => string);
  icon?: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  // Headings
  { label: "/h1", detail: "Heading 1", category: "heading", template: "# ", icon: "H1" },
  { label: "/h2", detail: "Heading 2", category: "heading", template: "## ", icon: "H2" },
  { label: "/h3", detail: "Heading 3", category: "heading", template: "### ", icon: "H3" },
  { label: "/h4", detail: "Heading 4", category: "heading", template: "#### ", icon: "H4" },
  { label: "/h5", detail: "Heading 5", category: "heading", template: "##### ", icon: "H5" },
  { label: "/h6", detail: "Heading 6", category: "heading", template: "###### ", icon: "H6" },

  // Lists
  { label: "/list", detail: "Bullet list", category: "list", template: "- Item 1\n- Item 2\n- Item 3", icon: "•" },
  { label: "/numbered", detail: "Numbered list", category: "list", template: "1. First item\n2. Second item\n3. Third item", icon: "1." },
  { label: "/todo", detail: "Task list", category: "list", template: "- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3", icon: "☐" },
  { label: "/toggle", detail: "Toggle list (nested)", category: "list", template: "- Parent item\n  - [ ] Sub-task 1\n  - [ ] Sub-task 2", icon: "▸" },

  // Callouts (Obsidian-compatible)
  { label: "/note", detail: "Note callout", category: "callout", template: "> [!note]\n> Your note here", icon: "📝" },
  { label: "/tip", detail: "Tip callout", category: "callout", template: "> [!tip]\n> Your tip here", icon: "💡" },
  { label: "/info", detail: "Info callout", category: "callout", template: "> [!info]\n> Your info here", icon: "ℹ️" },
  { label: "/warning", detail: "Warning callout", category: "callout", template: "> [!warning]\n> Your warning here", icon: "⚠️" },
  { label: "/danger", detail: "Danger callout", category: "callout", template: "> [!danger]\n> Critical warning here", icon: "🚨" },
  { label: "/success", detail: "Success callout", category: "callout", template: "> [!success]\n> Success message here", icon: "✅" },
  { label: "/question", detail: "Question callout", category: "callout", template: "> [!question]\n> Your question here", icon: "❓" },
  { label: "/quote", detail: "Quote callout", category: "callout", template: "> [!quote]\n> Your quote here", icon: "💬" },
  { label: "/example", detail: "Example callout", category: "callout", template: "> [!example]\n> Your example here", icon: "📋" },
  { label: "/bug", detail: "Bug callout", category: "callout", template: "> [!bug]\n> Bug description here", icon: "🐛" },
  { label: "/abstract", detail: "Abstract/Summary", category: "callout", template: "> [!abstract]\n> Summary here", icon: "📑" },

  // Code blocks
  { label: "/code", detail: "Inline code", category: "block", template: "`code`", icon: "</>" },
  { label: "/codeblock", detail: "Code block", category: "block", template: "```\n\n```", icon: "{ }" },
  { label: "/js", detail: "JavaScript code", category: "block", template: "```javascript\n\n```", icon: "JS" },
  { label: "/ts", detail: "TypeScript code", category: "block", template: "```typescript\n\n```", icon: "TS" },
  { label: "/python", detail: "Python code", category: "block", template: "```python\n\n```", icon: "🐍" },
  { label: "/rust", detail: "Rust code", category: "block", template: "```rust\n\n```", icon: "🦀" },
  { label: "/bash", detail: "Bash/Shell code", category: "block", template: "```bash\n\n```", icon: "$" },
  { label: "/sql", detail: "SQL code", category: "block", template: "```sql\n\n```", icon: "DB" },
  { label: "/json", detail: "JSON code", category: "block", template: "```json\n\n```", icon: "{}" },
  { label: "/html", detail: "HTML code", category: "block", template: "```html\n\n```", icon: "<>" },
  { label: "/css", detail: "CSS code", category: "block", template: "```css\n\n```", icon: "#" },
  { label: "/math", detail: "Math block (LaTeX)", category: "block", template: "$$\n\n$$", icon: "∑" },

  // Tables
  {
    label: "/table",
    detail: "3x3 table",
    category: "table",
    template: `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
| Cell 7   | Cell 8   | Cell 9   |`,
    icon: "⊞"
  },
  {
    label: "/table2",
    detail: "2 column table",
    category: "table",
    template: `| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
| Data 3   | Data 4   |`,
    icon: "⊞"
  },
  {
    label: "/table4",
    detail: "4 column table",
    category: "table",
    template: `| Header 1 | Header 2 | Header 3 | Header 4 |
|----------|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   | Cell 4   |
| Cell 5   | Cell 6   | Cell 7   | Cell 8   |`,
    icon: "⊞"
  },
  {
    label: "/tasktable",
    detail: "Task tracking table",
    category: "table",
    template: `| Task | Status | Priority |
|------|--------|----------|
| Task 1 | Pending | High |
| Task 2 | Done | Medium |
| Task 3 | Pending | Low |`,
    icon: "☑"
  },

  // Insert elements
  { label: "/hr", detail: "Horizontal rule", category: "insert", template: "\n---\n", icon: "―" },
  { label: "/divider", detail: "Divider line", category: "insert", template: "\n---\n", icon: "―" },
  { label: "/br", detail: "Line break", category: "insert", template: "\n\n", icon: "↵" },
  { label: "/blockquote", detail: "Block quote", category: "insert", template: "> ", icon: "❝" },
  { label: "/link", detail: "Hyperlink", category: "insert", template: "[text](url)", icon: "🔗" },
  { label: "/image", detail: "Image", category: "insert", template: "![alt text](image-url)", icon: "🖼️" },
  { label: "/wikilink", detail: "Wiki link", category: "insert", template: "[[", icon: "📎" },
  { label: "/embed", detail: "Embed note", category: "insert", template: "![[", icon: "📄" },

  // Date/Time inserts (dynamic)
  {
    label: "/date",
    detail: "Insert current date",
    category: "insert",
    template: () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    icon: "📅"
  },
  {
    label: "/today",
    detail: "Insert today (YYYY-MM-DD)",
    category: "insert",
    template: () => new Date().toISOString().split('T')[0],
    icon: "📅"
  },
  {
    label: "/time",
    detail: "Insert current time",
    category: "insert",
    template: () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    icon: "⏰"
  },
  {
    label: "/datetime",
    detail: "Insert date and time",
    category: "insert",
    template: () => new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    icon: "📅"
  },
  {
    label: "/timestamp",
    detail: "Insert ISO timestamp",
    category: "insert",
    template: () => new Date().toISOString(),
    icon: "🕐"
  },

  // Formatting
  { label: "/bold", detail: "Bold text", category: "format", template: "**text**", icon: "B" },
  { label: "/italic", detail: "Italic text", category: "format", template: "*text*", icon: "I" },
  { label: "/strike", detail: "Strikethrough", category: "format", template: "~~text~~", icon: "S̶" },
  { label: "/highlight", detail: "Highlight text", category: "format", template: "==text==", icon: "🖍️" },
  { label: "/sub", detail: "Subscript", category: "format", template: "~text~", icon: "₂" },
  { label: "/sup", detail: "Superscript", category: "format", template: "^text^", icon: "²" },

  // Templates
  {
    label: "/meeting",
    detail: "Meeting notes template",
    category: "insert",
    template: () => `## Meeting Notes - ${new Date().toLocaleDateString()}

**Attendees:**

**Agenda:**
1.

**Discussion:**

**Action Items:**
- [ ]

**Next Steps:**
`,
    icon: "👥"
  },
  {
    label: "/daily",
    detail: "Daily note template",
    category: "insert",
    template: () => `# ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

## Tasks
- [ ]

## Notes

## Journal

`,
    icon: "📓"
  },
  {
    label: "/project",
    detail: "Project template",
    category: "insert",
    template: `# Project Name

## Overview

## Goals
- [ ]

## Timeline

## Resources

## Notes

`,
    icon: "📁"
  },
];

// Synchronous completion source with full functionality
function syncCompletions(context: CompletionContext): CompletionResult | null {
  const pos = context.pos;
  const line = context.state.doc.lineAt(pos);
  const textBeforeCursor = line.text.slice(0, pos - line.from);

  // Trigger cache refresh in background (won't block)
  refreshCache();

  // Check for / commands at start of line or after whitespace
  const slashMatch = textBeforeCursor.match(/(^|\s)(\/\w*)$/);
  if (slashMatch) {
    const query = slashMatch[2].toLowerCase();
    const from = line.from + slashMatch.index! + slashMatch[1].length;

    // Filter commands that match the query
    const matches = SLASH_COMMANDS.filter(cmd => cmd.label.toLowerCase().startsWith(query));

    if (matches.length > 0 || query === "/") {
      // Group and sort commands: exact match first, then by category, then alphabetically
      const sortedMatches = (matches.length > 0 ? matches : SLASH_COMMANDS).sort((a, b) => {
        // Exact match gets priority
        if (a.label.toLowerCase() === query) return -1;
        if (b.label.toLowerCase() === query) return 1;
        // Sort by category priority
        const categoryOrder = { heading: 0, list: 1, callout: 2, block: 3, table: 4, insert: 5, format: 6 };
        const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
        if (catDiff !== 0) return catDiff;
        // Within category, sort alphabetically
        return a.label.localeCompare(b.label);
      }).slice(0, 25); // Limit results

      return {
        from: from,
        options: sortedMatches.map(cmd => {
          // For static templates, use string apply (more reliable with keyboard)
          // For dynamic templates (functions), use function apply
          if (typeof cmd.template === 'string') {
            return {
              label: cmd.label,
              detail: `${cmd.icon ? cmd.icon + ' ' : ''}${cmd.detail}`,
              type: "function" as const,
              apply: cmd.template,
            };
          } else {
            // Store the function reference to help TypeScript narrow the type
            const templateFn = cmd.template as () => string;
            return {
              label: cmd.label,
              detail: `${cmd.icon ? cmd.icon + ' ' : ''}${cmd.detail}`,
              type: "function" as const,
              apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
                const content = templateFn();
                view.dispatch({
                  changes: { from, to, insert: content },
                  selection: { anchor: from + content.length },
                });
              },
            };
          }
        }),
        validFor: /^\/\w*$/,
      };
    }
  }

  // Check for [[diagram: pattern FIRST (more specific) - show diagram names
  const diagramMatch = textBeforeCursor.match(/\[\[diagram:([^\]]*)$/);
  if (diagramMatch) {
    const query = diagramMatch[1].toLowerCase();
    const bracketStart = textBeforeCursor.lastIndexOf("[[");

    // Filter diagrams by query
    const matches = diagramCache
      .filter(d => d.name.toLowerCase().includes(query))
      .slice(0, 20);

    if (matches.length > 0) {
      return {
        from: line.from + bracketStart,
        options: matches.map(d => ({
          label: `[[diagram:${d.name}]]`,
          detail: "Diagram",
          type: "namespace",
        })),
      };
    }
    // If no matches yet but cache might be empty, show placeholder
    return {
      from: line.from + bracketStart,
      options: [
        { label: `[[diagram:${query || "..."}]]`, detail: "Loading diagrams...", type: "namespace" },
      ],
    };
  }

  // Check for [[kanban: pattern - show board/card options
  const kanbanMatch = textBeforeCursor.match(/\[\[kanban:([^\]]*)$/);
  if (kanbanMatch) {
    const query = kanbanMatch[1].toLowerCase();
    const bracketStart = textBeforeCursor.lastIndexOf("[[");

    // Filter cards by query (matches board/title format)
    const matches = cardCache
      .filter(c => {
        const fullRef = `${c.boardName}/${c.title}`.toLowerCase();
        return fullRef.includes(query) || c.title.toLowerCase().includes(query) || c.boardName.toLowerCase().includes(query);
      })
      .slice(0, 20);

    if (matches.length > 0) {
      return {
        from: line.from + bracketStart,
        options: matches.map(c => ({
          label: `[[kanban:${c.boardName}/${c.title}]]`,
          detail: c.columnName || c.boardName,
          type: "class",
        })),
      };
    }
    // If no matches yet, show placeholder
    return {
      from: line.from + bracketStart,
      options: [
        { label: `[[kanban:${query || "..."}]]`, detail: "Loading cards...", type: "class" },
      ],
    };
  }

  // Check for [[note: pattern - show notes and aliases
  const noteMatch = textBeforeCursor.match(/\[\[note:([^\]]*)$/);
  if (noteMatch) {
    const query = noteMatch[1].toLowerCase();
    const bracketStart = textBeforeCursor.lastIndexOf("[[");

    // Filter notes by query (title or path)
    const noteMatches = noteCache
      .filter(n => n.title.toLowerCase().includes(query) || n.path.toLowerCase().includes(query))
      .slice(0, 15)
      .map(n => ({
        label: `[[note:${n.title}]]`,
        detail: n.path,
        type: "text" as const,
      }));

    // Filter aliases by query
    const aliasMatches = aliasCache
      .filter(a => a.alias.toLowerCase().includes(query))
      .slice(0, 5)
      .map(a => ({
        label: `[[note:${a.alias}]]`,
        detail: `→ ${a.note_title} (alias)`,
        type: "text" as const,
        boost: -1, // Lower priority than direct matches
      }));

    const allMatches = [...noteMatches, ...aliasMatches];

    if (allMatches.length > 0) {
      return {
        from: line.from + bracketStart,
        options: allMatches,
      };
    }
    // If no matches yet, show placeholder
    return {
      from: line.from + bracketStart,
      options: [
        { label: `[[note:${query || "..."}]]`, detail: "Loading notes...", type: "text" },
      ],
    };
  }

  // Check for ![[  pattern (transclusion) - show notes and aliases to embed
  const transclusionMatch = textBeforeCursor.match(/!\[\[([^\]#]*)$/);
  if (transclusionMatch) {
    const query = transclusionMatch[1].toLowerCase();
    const bracketStart = textBeforeCursor.lastIndexOf("![[");

    // Filter notes by query
    const noteMatches = noteCache
      .filter(n => !n.archived && (n.title.toLowerCase().includes(query) || n.path.toLowerCase().includes(query)))
      .slice(0, 15)
      .map(n => ({
        label: `![[${n.title}]]`,
        detail: `Embed: ${n.path}`,
        type: "function" as const,
      }));

    // Filter aliases by query
    const aliasMatches = aliasCache
      .filter(a => a.alias.toLowerCase().includes(query))
      .slice(0, 5)
      .map(a => ({
        label: `![[${a.alias}]]`,
        detail: `Embed: ${a.note_title} (alias)`,
        type: "function" as const,
        boost: -1,
      }));

    const allMatches = [...noteMatches, ...aliasMatches];

    if (allMatches.length > 0) {
      return {
        from: line.from + bracketStart,
        options: allMatches,
      };
    }
    return {
      from: line.from + bracketStart,
      options: [
        { label: `![[${query || "..."}]]`, detail: "Embed note content", type: "function" },
      ],
    };
  }

  // Check for ![[note#^ or [[note#^ pattern (block reference) - show blocks
  const blockRefMatch = textBeforeCursor.match(/(!\[\[|^\[\[)([^\]#]+)#\^([a-zA-Z0-9_-]*)$/);
  if (blockRefMatch) {
    const isTransclusion = blockRefMatch[1] === "![[";
    const noteRef = blockRefMatch[2];
    const blockQuery = blockRefMatch[3].toLowerCase();
    const startPos = textBeforeCursor.lastIndexOf(blockRefMatch[1]);

    // We need to fetch blocks for this note - for now show a placeholder
    // The actual block fetching would need to be async, so we provide
    // a hint to type the block ID
    return {
      from: line.from + startPos,
      options: [
        {
          label: isTransclusion ? `![[${noteRef}#^${blockQuery || "block-id"}]]` : `[[${noteRef}#^${blockQuery || "block-id"}]]`,
          detail: "Type block ID (^block-id in target note)",
          type: "function",
        },
      ],
    };
  }

  // Check for [[ pattern (general) - show prefix options only
  const bracketIndex = textBeforeCursor.lastIndexOf("[[");
  if (bracketIndex !== -1) {
    const afterBracket = textBeforeCursor.slice(bracketIndex);
    // Only if not closed and not already a specific prefix
    if (!afterBracket.includes("]]") && !afterBracket.includes(":")) {
      const from = line.from + bracketIndex;

      return {
        from: from,
        options: [
          { label: "[[note:", detail: "Link to note", type: "text" },
          { label: "[[diagram:", detail: "Link to diagram", type: "namespace" },
          { label: "[[kanban:", detail: "Link to kanban card", type: "class" },
        ],
      };
    }
  }

  // Check for # pattern (not at start of line)
  const hashIndex = textBeforeCursor.lastIndexOf("#");
  if (hashIndex > 0) { // > 0 means not at start of line
    const beforeHash = textBeforeCursor.slice(0, hashIndex);
    // Only trigger if there's non-whitespace before the #
    if (beforeHash.trim().length > 0) {
      const from = line.from + hashIndex;
      const query = textBeforeCursor.slice(hashIndex + 1).toLowerCase();

      // Use cached tags or fallback to defaults
      const tagOptions = tagCache.length > 0
        ? tagCache
            .filter(t => t.toLowerCase().includes(query))
            .slice(0, 15)
            .map(t => ({ label: `#${t}`, type: "keyword" as const }))
        : [
            { label: "#test-tag", type: "keyword" as const },
            { label: "#example", type: "keyword" as const },
          ];

      return {
        from: from,
        options: tagOptions,
      };
    }
  }

  // Check for @ pattern
  const atIndex = textBeforeCursor.lastIndexOf("@");
  if (atIndex !== -1) {
    const from = line.from + atIndex;
    const query = textBeforeCursor.slice(atIndex + 1).toLowerCase();

    // Use cached mentions or fallback to defaults
    const mentionOptions = mentionCache.length > 0
      ? mentionCache
          .filter(m => m.toLowerCase().includes(query))
          .slice(0, 15)
          .map(m => ({ label: `@${m}`, type: "variable" as const }))
      : [
          { label: "@user1", type: "variable" as const },
          { label: "@user2", type: "variable" as const },
        ];

    return {
      from: from,
      options: mentionOptions,
    };
  }

  return null;
}

// Export the configured autocompletion extension
console.log("[autocomplete] Creating kairoAutocompletion extension");
export const kairoAutocompletion = autocompletion({
  // Use sync completion for now to test
  override: [syncCompletions],
  activateOnTyping: true,
  activateOnTypingDelay: 50, // Shorter delay
  maxRenderedOptions: 25, // Increased for slash commands
  icons: true,
  optionClass: (completion) => {
    if (completion.type === "text") return "cm-completion-note";
    if (completion.type === "class") return "cm-completion-card";
    if (completion.type === "namespace") return "cm-completion-diagram";
    if (completion.type === "keyword") return "cm-completion-tag";
    if (completion.type === "variable") return "cm-completion-mention";
    if (completion.type === "function") return "cm-completion-slash";
    return "";
  },
});

// Styling for autocomplete dropdown
export const autocompleteTheme = {
  ".cm-tooltip-autocomplete": {
    backgroundColor: "#0f172a !important",
    border: "1px solid #334155 !important",
    borderRadius: "8px !important",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5) !important",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": {
    maxHeight: "300px !important",
    fontFamily: "'Inter', system-ui, sans-serif !important",
    fontSize: "13px !important",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "8px 12px !important",
    borderBottom: "1px solid #1e293b",
  },
  ".cm-tooltip-autocomplete > ul > li:last-child": {
    borderBottom: "none",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "#1e293b !important",
    color: "#f1f5f9 !important",
  },
  ".cm-completionLabel": {
    color: "#e2e8f0",
  },
  ".cm-completionDetail": {
    color: "#64748b !important",
    marginLeft: "12px !important",
    fontStyle: "normal !important",
    fontSize: "11px !important",
  },
  ".cm-completionIcon": {
    width: "16px !important",
    marginRight: "8px !important",
  },
  ".cm-completion-note .cm-completionIcon::after": {
    content: "'📄'",
  },
  ".cm-completion-card .cm-completionIcon::after": {
    content: "'🎯'",
  },
  ".cm-completion-diagram .cm-completionIcon::after": {
    content: "'📊'",
  },
  ".cm-completion-tag .cm-completionIcon::after": {
    content: "'#'",
    color: "#6366f1",
    fontWeight: "bold",
  },
  ".cm-completion-mention .cm-completionIcon::after": {
    content: "'@'",
    color: "#22c55e",
    fontWeight: "bold",
  },
  ".cm-completion-slash .cm-completionIcon::after": {
    content: "'/'",
    color: "#a78bfa",
    fontWeight: "bold",
  },
  ".cm-completion-slash .cm-completionLabel": {
    color: "#c4b5fd",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
  },
};

// Force a cache refresh (useful when notes are added/modified)
export function invalidateAutocompleteCache() {
  lastCacheUpdate = 0;
}
