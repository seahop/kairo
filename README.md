<p align="center">
  <img src="docs/images/kairo.png" alt="Kairo" width="500">
</p>

<p align="center">
  <strong>Team note-taking, reimagined.</strong>
</p>

<p align="center">
  A powerful desktop knowledge management application built for technical teams.<br>
  Combine notes, kanban boards, diagrams, and git—all in one place.
</p>

---

## Features

### Core Note-Taking
- **Markdown Editor** - Split-pane editor with live preview, syntax highlighting, and GFM support
- **Wiki-Style Linking** - Connect notes with `[[wiki links]]` and see backlinks automatically
- **Frontmatter Support** - YAML frontmatter for metadata, tags, and custom fields
- **Templates** - Built-in templates (Zettelkasten, PARA, Daily Notes) plus custom templates
- **Snippets** - Quick insertion with `/` trigger for boilerplate content
- **Daily Notes** - One-click creation of date-stamped journal entries

### Kanban Boards
- **Personal Boards** - Each team member gets their own board automatically
- **Pool Board** - Shared board for unassigned tasks
- **Card Linking** - Reference cards from notes with `[[card:Title]]` syntax
- **Take/Give Cards** - Transfer card ownership between team members
- **Labels & Priorities** - Organize cards with custom labels, due dates, and priority levels
- **Card Archiving** - Archive completed cards without deleting

### Diagram Editor
- **Visual Diagrams** - Node-based diagram editor with drag-and-drop
- **Multiple Node Types** - Text, shapes, and custom styled nodes
- **Diagram Linking** - Reference diagrams from notes with `[[diagram:Name]]`
- **Export** - Export diagrams as PNG images

### Git Integration (Native)
- **Built-in Git** - Pull, commit, and push without leaving the app
- **SSH Authentication** - Native SSH key support via git2-rs (no shell dependency)
- **Per-User Config** - Each team member configures their own SSH key (gitignored)
- **Note History** - View and restore previous versions of any note
- **Passphrase Caching** - Optional session-based passphrase caching

### Graph View
- **Knowledge Graph** - Interactive force-directed visualization of note connections
- **Global & Local Views** - See the full vault or focus on a single note's connections
- **Search Filtering** - Filter the graph by note title
- **Click to Navigate** - Open any note by clicking its node

### Search & Discovery
- **Full-Text Search** - Powered by SQLite FTS5 for fast, accurate results
- **Code Block Search** - Search specifically within code blocks
- **Backlinks Panel** - See all notes that reference the current note
- **Unlinked Mentions** - Discover notes that mention a title without linking

### Vault Health
- **Statistics Dashboard** - Note count, link count, tag overview
- **Orphan Detection** - Find notes with no connections
- **Broken Link Detection** - Identify links to non-existent notes
- **MOC Candidates** - Discover notes that could serve as Maps of Content

### Dataview Queries
- **Query Your Notes** - SQL-like syntax inspired by Obsidian Dataview
- **TABLE & LIST Views** - Display query results as tables or lists
- **Filter & Sort** - Query by folder, tags, frontmatter fields

### Extension System
- **Plugin Architecture** - Extend functionality with custom extensions
- **Built-in Plugins** - Git, Kanban, Graph, Templates, Snippets, Daily Notes, Diagrams
- **Extension API** - Register commands, hooks, and filters

---

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/your-username/kairo/releases) page:

- **Linux**: `.deb` (Debian/Ubuntu) or `.AppImage` (portable)
- **macOS**: `.dmg`
- **Windows**: `.msi`

### Build from Source

All development is done via Docker—no local Rust, Node.js, or pnpm installation required.

#### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

#### Development

```bash
# Clone the repository
git clone https://github.com/your-username/kairo.git
cd kairo

# Start development environment (hot-reload enabled)
./docker/build.sh dev
```

#### Production Build

```bash
# Build release artifacts (.deb, .AppImage, binary)
./docker/build.sh release
```

#### Other Commands

```bash
./docker/build.sh dev      # Start dev environment with hot-reload
./docker/build.sh shell    # Open shell in build container
./docker/build.sh fmt      # Format Rust code
./docker/build.sh check    # Run cargo check
./docker/build.sh clippy   # Run clippy lints
```

Build artifacts are output to the `dist/` folder.

---

## Usage

### Getting Started

1. **Launch Kairo** and create a new vault or open an existing folder
2. **Set your username** in the Kanban settings (creates your personal board)
3. **Start creating notes** with `Ctrl+N` or use templates with `Ctrl+Shift+N`

### Link Syntax

```markdown
<!-- Note links -->
[[Another Note]]
[[folder/nested-note]]
[[note|Custom Display Text]]

<!-- Card links -->
[[card:Task Title]]
[[card:Board Name/Task Title]]

<!-- Diagram links -->
[[diagram:Architecture Diagram]]
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command Palette |
| `Ctrl+N` | New Note |
| `Ctrl+Shift+N` | New Note from Template |
| `Ctrl+S` | Save Note |
| `Ctrl+Shift+F` | Global Search |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+Shift+G` | Graph View |
| `Ctrl+G` | Local Graph (current note) |
| `Ctrl+Shift+K` | Kanban Board |
| `Ctrl+Shift+D` | Diagram Editor |
| `Escape` | Close Modal / Back |

### Dataview Queries

Query your notes using code blocks:

~~~markdown
```dataview
TABLE title, status, file.mtime
FROM "projects"
WHERE status = "active"
SORT file.mtime DESC
LIMIT 10
```

```dataview
LIST FROM #todo WHERE !completed
```
~~~

---

## Project Structure

```
kairo/
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── editor/               # Markdown editor & preview
│   │   ├── layout/               # App layout components
│   │   ├── modals/               # Modal dialogs
│   │   ├── search/               # Search interface
│   │   └── vault/                # Vault health & management
│   ├── stores/                   # Zustand state stores
│   ├── plugins/                  # Plugin system
│   │   ├── api/                  # Plugin API
│   │   └── builtin/              # Built-in plugins
│   │       ├── kanban/           # Kanban boards
│   │       ├── diagram/          # Diagram editor
│   │       ├── git/              # Git integration
│   │       ├── graph/            # Graph visualization
│   │       ├── templates/        # Note templates
│   │       ├── snippets/         # Text snippets
│   │       └── daily-notes/      # Daily notes
│   ├── lib/                      # Shared utilities
│   │   └── dataview/             # Dataview query parser
│   └── styles/                   # Global CSS
│
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── commands/             # Tauri command handlers
│       │   ├── kanban.rs         # Kanban operations
│       │   ├── diagram.rs        # Diagram operations
│       │   ├── notes.rs          # Note CRUD
│       │   ├── search.rs         # Search queries
│       │   └── vault.rs          # Vault management
│       ├── db/                   # SQLite database
│       │   ├── schema.rs         # Table definitions
│       │   ├── indexer.rs        # Note indexing
│       │   ├── search.rs         # FTS5 search
│       │   └── dataview.rs       # Dataview query execution
│       └── git/                  # Git operations (git2-rs)
│           ├── operations.rs     # Pull, push, commit
│           ├── config.rs         # User SSH config
│           └── credentials.rs    # Passphrase caching
│
├── docker/                       # Docker build environment
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── build.sh                  # Build script
│
├── docs/                         # Documentation
│   ├── images/                   # Screenshots & assets
│   ├── extensions/               # Extension development guide
│   └── user-guide/               # User documentation
│
└── sample-extensions/            # Example extensions
    ├── word-count/
    ├── focus-mode/
    └── ...
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | [Tauri 2.0](https://tauri.app/) |
| **Frontend** | React 18 + TypeScript + Vite |
| **Backend** | Rust |
| **Database** | SQLite with FTS5 |
| **State** | Zustand |
| **Styling** | Tailwind CSS |
| **Editor** | CodeMirror 6 |
| **Git** | git2-rs (libgit2) |
| **Graphs** | React Flow, D3-force |

---

## Extensions

Kairo supports user-created extensions. Place extensions in `.kairo/extensions/` within your vault.

### Creating an Extension

1. Create a folder: `.kairo/extensions/my-extension/`

2. Add `manifest.json`:
```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "A custom extension",
  "author": "Your Name",
  "main": "index.js"
}
```

3. Create `index.js`:
```javascript
exports.initialize = function() {
  kairo.log.info("Extension loaded!");

  kairo.registerCommand({
    id: "my-command",
    name: "My Custom Command",
    execute: () => {
      kairo.log.info("Command executed!");
    }
  });
};

exports.cleanup = function() {
  kairo.log.info("Extension unloaded!");
};
```

4. Reload extensions from `View > Extensions`

See `sample-extensions/` for more examples.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Tips

```bash
# Format Rust code
./docker/build.sh fmt

# Run Rust lints
./docker/build.sh clippy

# Type-check frontend
./docker/build.sh typecheck

# Lint frontend
./docker/build.sh lint
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Markdown editing powered by [CodeMirror](https://codemirror.net/)
- Graph visualization with [React Flow](https://reactflow.dev/) and [D3](https://d3js.org/)
- Git operations via [git2-rs](https://github.com/rust-lang/git2-rs)
