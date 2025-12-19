# Slash Commands in Kairo

Slash commands provide quick insertion of common markdown elements and templates. Simply type `/` followed by the command name to see suggestions.

## Using Slash Commands

1. Type `/` at the start of a line or after a space
2. Start typing the command name
3. Select from the autocomplete suggestions with arrow keys
4. Press Enter or Tab to insert

---

## Headings

Quickly insert markdown headings.

| Command | Description | Output |
|---------|-------------|--------|
| `/h1` | Heading 1 | `# ` |
| `/h2` | Heading 2 | `## ` |
| `/h3` | Heading 3 | `### ` |
| `/h4` | Heading 4 | `#### ` |
| `/h5` | Heading 5 | `##### ` |
| `/h6` | Heading 6 | `###### ` |

---

## Lists

Create different types of lists.

| Command | Description | Output |
|---------|-------------|--------|
| `/list` | Bullet list | `- Item 1`<br>`- Item 2`<br>`- Item 3` |
| `/numbered` | Numbered list | `1. First item`<br>`2. Second item`<br>`3. Third item` |
| `/todo` | Task list | `- [ ] Task 1`<br>`- [ ] Task 2`<br>`- [ ] Task 3` |
| `/toggle` | Toggle list (nested) | `- Parent item`<br>`  - [ ] Sub-task 1`<br>`  - [ ] Sub-task 2` |

---

## Callouts

Insert Obsidian-compatible callout blocks for highlighting important information.

| Command | Description | Example Output |
|---------|-------------|----------------|
| `/note` | Note callout | `> [!note]`<br>`> Your note here` |
| `/tip` | Tip callout | `> [!tip]`<br>`> Your tip here` |
| `/info` | Info callout | `> [!info]`<br>`> Your info here` |
| `/warning` | Warning callout | `> [!warning]`<br>`> Your warning here` |
| `/danger` | Danger callout | `> [!danger]`<br>`> Critical warning here` |
| `/success` | Success callout | `> [!success]`<br>`> Success message here` |
| `/question` | Question callout | `> [!question]`<br>`> Your question here` |
| `/quote` | Quote callout | `> [!quote]`<br>`> Your quote here` |
| `/example` | Example callout | `> [!example]`<br>`> Your example here` |
| `/bug` | Bug callout | `> [!bug]`<br>`> Bug description here` |
| `/abstract` | Abstract/Summary | `> [!abstract]`<br>`> Summary here` |

---

## Code Blocks

Insert code blocks with syntax highlighting for various languages.

| Command | Description | Output |
|---------|-------------|--------|
| `/code` | Inline code | `` `code` `` |
| `/codeblock` | Generic code block | ` ``` `<br><br>` ``` ` |
| `/js` | JavaScript code | ` ```javascript `<br><br>` ``` ` |
| `/ts` | TypeScript code | ` ```typescript `<br><br>` ``` ` |
| `/python` | Python code | ` ```python `<br><br>` ``` ` |
| `/rust` | Rust code | ` ```rust `<br><br>` ``` ` |
| `/bash` | Bash/Shell code | ` ```bash `<br><br>` ``` ` |
| `/sql` | SQL code | ` ```sql `<br><br>` ``` ` |
| `/json` | JSON code | ` ```json `<br><br>` ``` ` |
| `/html` | HTML code | ` ```html `<br><br>` ``` ` |
| `/css` | CSS code | ` ```css `<br><br>` ``` ` |
| `/math` | Math block (LaTeX) | `$$`<br><br>`$$` |

---

## Tables

Quickly insert table structures.

| Command | Description | Output |
|---------|-------------|--------|
| `/table` | 3-column table | Standard markdown table with 3 columns |
| `/table2` | 2-column table | Compact 2-column table |
| `/table4` | 4-column table | Wide 4-column table |
| `/tasktable` | Task tracking table | Table with Status, Task, Due, and Notes columns |

### Example: /table

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

### Example: /tasktable

```markdown
| Status | Task | Due | Notes |
|--------|------|-----|-------|
| [ ]    |      |     |       |
| [ ]    |      |     |       |
```

---

## Insert Elements

Insert common markdown elements.

| Command | Description | Output |
|---------|-------------|--------|
| `/hr` | Horizontal rule | `---` |
| `/divider` | Divider line | `---` |
| `/br` | Line break | Two newlines |
| `/blockquote` | Block quote | `> ` |
| `/link` | Hyperlink | `[text](url)` |
| `/image` | Image | `![alt text](image-url)` |
| `/wikilink` | Wiki link | `[[` |
| `/embed` | Embed note | `![[` |

---

## Date & Time

Insert dynamic date and time values. These insert the current date/time when used.

| Command | Description | Example Output |
|---------|-------------|----------------|
| `/date` | Current date | `2024-12-19` |
| `/today` | Today's date | `2024-12-19` |
| `/time` | Current time | `14:30` |
| `/datetime` | Date and time | `2024-12-19 14:30` |
| `/timestamp` | ISO timestamp | `2024-12-19T14:30:00` |

---

## Text Formatting

Quick formatting shortcuts.

| Command | Description | Output |
|---------|-------------|--------|
| `/bold` | Bold text | `**text**` |
| `/italic` | Italic text | `*text*` |
| `/strike` | Strikethrough | `~~text~~` |
| `/highlight` | Highlight text | `==text==` |
| `/sub` | Subscript | `~text~` |
| `/sup` | Superscript | `^text^` |

---

## Templates

Pre-built templates for common note types.

### /meeting

Creates a meeting note template:

```markdown
## Meeting: [Title]
**Date:** [Current Date]
**Attendees:**

### Agenda
-

### Notes
-

### Action Items
- [ ]
```

### /daily

Creates a daily note template:

```markdown
# [Current Date]

## Today's Goals
- [ ]

## Notes


## Reflections

```

### /project

Creates a project note template:

```markdown
# Project: [Name]

## Overview


## Goals
-

## Tasks
- [ ]

## Resources
-

## Notes

```

---

## Tips

- **Quick Access**: Type just `/` to see all available commands
- **Fuzzy Search**: Type partial command names (e.g., `/warn` matches `/warning`)
- **Keyboard Navigation**: Use arrow keys to navigate, Enter to select
- **Cancel**: Press Escape to dismiss the autocomplete menu
- **Inline Use**: Slash commands work anywhere, not just at line starts

---

## Related

- [Linking](linking.md) - Wiki links and card links
- [Kanban](kanban.md) - Kanban board features
