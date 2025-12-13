# Linking in Kairo

Kairo supports powerful bi-directional linking between notes and kanban cards. This guide covers all the linking features available.

## Wiki Links (Note-to-Note)

Wiki links create connections between your notes using double bracket syntax.

### Basic Syntax

```markdown
[[note-name]]
```

This creates a link to a note called "note-name.md" in your vault.

### Path-Based Links

You can link to notes in specific folders:

```markdown
[[folder/subfolder/note-name]]
```

### Custom Display Text

Use a pipe `|` to show different text than the file path:

```markdown
[[path/to/technical-spec|the spec document]]
```

This displays as "the spec document" but links to `path/to/technical-spec.md`.

### Link Appearance

- **Existing notes**: Purple/accent colored, underlined with dotted line
- **Missing notes**: Red, struck-through (the note doesn't exist yet)

### Following Links

- **Click**: Opens the linked note
- **Ctrl+Click** (in editor): Follow the link while editing
- **Right-click**: Opens context menu with options

---

## Card Links (Note-to-Kanban Card)

Link directly to kanban board cards from your notes.

### Basic Syntax

```markdown
[[card:BoardName/CardTitle]]
```

Example:
```markdown
See the task [[card:Sprint-1/Implement login feature]] for details.
```

### How It Works

1. `card:` prefix indicates this is a card link (not a note link)
2. `BoardName` is the name of your kanban board
3. `CardTitle` is the title of the card

### Link Appearance

Card links are styled distinctly:
- Orange text with light orange background
- Target emoji prefix
- Dotted underline

### Following Card Links

- **Click**: Opens the kanban board and displays the card detail panel
- **Right-click**: Opens context menu with:
  - **Open in Kanban** - Navigate to the full kanban view
  - **Open in Side Pane** - View card details in a resizable side panel (doesn't leave your current view)
  - **Copy Link** - Copy the `[[card:...]]` syntax to clipboard

---

## Autocomplete

Kairo provides autocomplete suggestions as you type links.

### Wiki Links

1. Type `[[`
2. Start typing the note name
3. Select from suggestions with arrow keys
4. Press Enter or Tab to complete

### Card Links

1. Type `[[card:`
2. Start typing the card or board name
3. Suggestions show as `BoardName/CardTitle`
4. Select and press Enter to complete

### Tags

1. Type `#`
2. Start typing the tag name
3. Select from existing tags

### Mentions

1. Type `@`
2. Start typing a name
3. Select from existing mentions

---

## Backlinks

Kairo automatically tracks which notes link to others.

### Viewing Backlinks

At the bottom of the editor, the **Backlinks Panel** shows:
- All notes that link to the current note
- Preview of the linking context
- Click to navigate to the source note

### Card Backlinks

When viewing a kanban card, you can see which notes reference that card via `[[card:...]]` links.

---

## Side Pane

The side pane allows viewing content without leaving your current view.

### Opening the Side Pane

1. Right-click on a card link
2. Select "Open in Side Pane"
3. The card details appear in a resizable panel on the right

### Resizing

Drag the divider between the main content and side pane to adjust widths.

### Closing

Click the X button in the side pane header, or press Escape.

---

## Link Context Menu

Right-click on any link for additional options:

### Card Links
- Open in Kanban
- Open in Side Pane
- Copy Link

### Wiki Links
- Open Note
- Copy Link

### External Links
- Open in Browser
- Copy URL

---

## Best Practices

### Naming Conventions

For kanban card links to work reliably:
1. Use unique, descriptive card titles
2. Always include the board name: `[[card:BoardName/CardTitle]]`
3. Avoid special characters that might conflict with the syntax

### Organizing with Links

- Use a **Map of Content (MOC)** note to organize related notes
- Link between meeting notes and project notes
- Reference kanban cards from daily notes for task tracking

### Link Discovery

- Use the **Graph View** (`Ctrl+Shift+G`) to visualize connections
- Check the **Backlinks Panel** to see what links to the current note
- Use **Global Search** to find notes containing specific links
