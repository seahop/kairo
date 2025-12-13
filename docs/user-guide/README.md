# Kairo User Guide

Welcome to the Kairo User Guide. This documentation covers all the features and functionality of Kairo.

## Table of Contents

### Getting Started
- [Quick Start](#quick-start)
- [Creating Your First Vault](#creating-your-first-vault)

### Core Features
- [Linking](linking.md) - Wiki links, card links, and autocomplete
- [Kanban Boards](kanban.md) - Visual task management
- [Graph View](#graph-view) - Visualize note connections
- [Search](#search) - Find anything in your vault

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command Palette |
| `Ctrl+P` | Command Palette (alt) |
| `Ctrl+Shift+F` | Global Search |
| `Ctrl+N` | New Note |
| `Ctrl+Shift+N` | New Note (with templates) |
| `Ctrl+D` | Daily Note |
| `Ctrl+S` | Save Note |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+Shift+V` | Cycle Editor View Mode |
| `Ctrl+Shift+G` | Global Graph View |
| `Ctrl+G` | Local Graph View |
| `Ctrl+Shift+K` | Toggle Kanban View |
| `Ctrl+Click` | Follow Wiki Link (in editor) |
| `Escape` | Close Modal / Back to Notes |

---

## Quick Start

1. **Open a Vault**: Launch Kairo and select a folder to use as your vault
2. **Create a Note**: Press `Ctrl+N` or click "New Note"
3. **Write in Markdown**: Use standard markdown with wiki-link extensions
4. **Link Notes**: Type `[[` to create links between notes
5. **Explore**: Use the graph view (`Ctrl+Shift+G`) to see connections

---

## Creating Your First Vault

A vault is simply a folder on your computer where Kairo stores your notes.

1. Launch Kairo
2. Click "Open Vault" or "Create New Vault"
3. Select or create a folder
4. Kairo creates a `.kairo` folder for configuration and indexing

### Vault Structure

```
my-vault/
├── .kairo/
│   ├── config.json      # Vault settings
│   ├── index.db         # Search index
│   └── extensions/      # User extensions
├── notes/               # Your notes (recommended)
│   ├── daily/           # Daily notes
│   ├── projects/        # Project notes
│   └── ...
└── attachments/         # Images and files
```

---

## Graph View

Visualize connections between your notes.

### Global Graph
- Press `Ctrl+Shift+G`
- Shows all notes and their connections
- Filter by search query
- Click nodes to open notes

### Local Graph
- Press `Ctrl+G`
- Shows notes connected to the current note
- Great for exploring related content

---

## Search

Kairo provides powerful full-text search.

### Quick Search
- Press `Ctrl+Shift+F`
- Type your query
- Results update as you type
- Click results to open notes

### Search Syntax
- `word` - Find notes containing "word"
- `"exact phrase"` - Find exact phrase
- `tag:#project` - Find notes with tag
- `path:daily/` - Find notes in path

---

## Editor Modes

Toggle between different editor views:

- **Editor Only**: Full markdown editing
- **Preview Only**: Rendered markdown view
- **Split View**: Side-by-side editing and preview

Use `Ctrl+Shift+V` to cycle through modes, or click the view buttons in the toolbar.

---

## Need Help?

- Check the [Keyboard Shortcuts](#keyboard-shortcuts) for quick actions
- Use the Command Palette (`Ctrl+K`) to discover features
- Right-click on elements for context-specific options
