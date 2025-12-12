<p align="center">
  <img src="docs/images/kairo.png" alt="Kairo" width="500">
</p>

<p align="center">
  <strong>Team note-taking, reimagined.</strong>
</p>

<p align="center">
  A powerful desktop note-taking application built for technical teams.
</p>

---

## Features

- **Wiki-Style Linking** - Create connections between notes using `[[wiki links]]`
- **Graph Visualization** - Interactive graph view showing relationships between notes
- **Full-Text Search** - Powerful FTS5-based search with code block filtering
- **Backlinks Panel** - See all notes that reference the current note
- **Git Integration** - Built-in pull, commit, and push functionality
- **Kanban Boards** - Organize tasks visually with drag-and-drop boards
- **Templates & Snippets** - Quickly insert boilerplate content
- **Plugin System** - Extend functionality with custom extensions
- **Cross-Platform** - Runs on Linux, macOS, and Windows

## Screenshots

<p align="center">
  <em>Coming soon</em>
</p>

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](https://github.com/your-username/kairo/releases) page.

### Build from Source

#### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- [pnpm](https://pnpm.io/) (8+)

#### Steps

```bash
# Clone the repository
git clone https://github.com/your-username/kairo.git
cd kairo

# Install dependencies
pnpm install

# Development
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Usage

### Getting Started

1. Launch Kairo
2. Create a new vault or open an existing folder
3. Start creating notes!

### Wiki Links

Create links between notes using double brackets:

```markdown
This links to [[Another Note]].
You can also use [[folder/nested-note|Custom Display Text]].
```

### Graph View

Press `Ctrl+Shift+G` to open the global graph view. Use `Ctrl+G` for a local view centered on the current note.

- **Search** - Filter the graph by note title
- **Global/Local/Search** modes for different perspectives
- Click any node to open that note

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command Palette |
| `Ctrl+Shift+F` | Global Search |
| `Ctrl+N` | New Note |
| `Ctrl+S` | Save Note |
| `Ctrl+B` | Toggle Sidebar |
| `Ctrl+Shift+G` | Graph View |
| `Ctrl+G` | Local Graph |
| `Ctrl+Shift+K` | Kanban Board |
| `Escape` | Close Modal / Back to Notes |

## Extensions

Kairo supports user-created extensions. Place your extensions in the `.kairo/extensions/` folder within your vault.

### Creating an Extension

1. Create a folder in `.kairo/extensions/my-extension/`
2. Add a `manifest.json`:

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

3. Create your `index.js`:

```javascript
exports.initialize = function() {
  kairo.log.info("Extension loaded!");

  kairo.registerCommand({
    id: "hello",
    name: "Say Hello",
    execute: () => kairo.log.info("Hello!")
  });
};

exports.cleanup = function() {
  kairo.log.info("Extension unloaded!");
};
```

4. Reload extensions from the Extension Manager (`View > Extensions`)

### Extension API

Extensions have access to:

- `kairo.registerCommand()` - Register custom commands
- `kairo.registerHook()` - Hook into app events (onNoteOpen, onNoteSave, etc.)
- `kairo.registerFilter()` - Filter content passing through the app
- `kairo.log.info/warn/error/debug()` - Logging to the debug console

## Development

### Project Structure

```
kairo/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── stores/             # Zustand state stores
│   └── plugins/            # Plugin system & built-in plugins
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   ├── db/             # SQLite database
│   │   └── git.rs          # Git operations
│   └── tauri.conf.json     # Tauri configuration
└── public/                 # Static assets
```

### Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri 2.0
- **Database**: SQLite with FTS5
- **State Management**: Zustand
- **Styling**: Tailwind CSS

### Running Tests

```bash
# Frontend tests
pnpm test

# Rust tests
cd src-tauri && cargo test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Graph visualization powered by [react-force-graph](https://github.com/vasturiano/react-force-graph)
- Markdown editing with [CodeMirror](https://codemirror.net/)
