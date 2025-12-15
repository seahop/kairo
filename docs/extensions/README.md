# Kairo Extension Development Guide

This guide covers everything you need to know to create extensions for Kairo. Extensions allow you to customize and extend Kairo's functionality with custom commands, keyboard shortcuts, context menus, menu items, UI components, and more.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Extension Structure](#extension-structure)
3. [Extension Lifecycle](#extension-lifecycle)
4. [The Kairo API Object](#the-kairo-api-object)
5. [Commands & Keyboard Shortcuts](#commands--keyboard-shortcuts)
6. [Hooks & Filters](#hooks--filters)
7. [Context Menus](#context-menus)
8. [Menu Bar Items](#menu-bar-items)
9. [UI Slots](#ui-slots)
10. [Custom Styling](#custom-styling)
11. [State Access](#state-access)
12. [Logging & Debugging](#logging--debugging)
13. [Best Practices](#best-practices)
14. [Example Extensions](#example-extensions)

---

## Getting Started

### Creating Your First Extension

1. Create a folder in your vault's `.kairo/extensions/` directory with your extension ID
2. Create a `manifest.json` file with extension metadata
3. Create a JavaScript entry point file (e.g., `main.js`)

```
your-vault/
├── .kairo/
│   └── extensions/
│       └── my-extension/
│           ├── manifest.json
│           └── main.js
```

### manifest.json

```json
{
  "id": "my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "A helpful description of what your extension does",
  "author": "Your Name",
  "main": "main.js"
}
```

**Required fields:**
- `id` - Unique identifier (use lowercase with hyphens)
- `name` - Display name for your extension
- `version` - Semantic version (e.g., "1.0.0")
- `main` - Path to the entry point file (relative to extension folder)

**Optional fields:**
- `description` - What your extension does
- `author` - Your name or organization
- `dependencies` - Array of other extension IDs this depends on

---

## Extension Structure

### Entry Point (main.js)

Your extension's entry point receives a `kairo` API object and can export two functions:

```javascript
// Initialize is called when the extension loads
exports.initialize = function(kairo) {
  kairo.log.info("Extension loaded!");

  // Register commands, hooks, menus, etc.
  kairo.registerCommand({
    id: "hello",
    name: "Say Hello",
    execute: () => {
      kairo.log.info("Hello, World!");
    }
  });
};

// Cleanup is called when the extension unloads
exports.cleanup = function(kairo) {
  kairo.log.info("Extension unloading...");
  // Clean up any resources, remove styles, etc.
};
```

---

## Extension Lifecycle

Understanding the extension lifecycle is important for building robust extensions that clean up properly and don't cause issues when reloaded or disabled.

### Loading

Extensions are automatically loaded when a vault is opened. Kairo scans the `.kairo/extensions/` directory and loads each extension that has a valid `manifest.json`.

**Load order:**
1. Manifest is validated
2. Extension JavaScript is loaded and sandboxed
3. `initialize(kairo)` is called
4. Extension registers its commands, hooks, menus, etc.

### Unloading & Disabling

When an extension is unloaded (removed) or disabled:

1. The `cleanup(kairo)` function is called (if exported)
2. **All registered artifacts are automatically cleaned up**, including:
   - Commands (removed from command palette)
   - Hooks and filters (unsubscribed)
   - Menu bar items (removed from menus)
   - Context menu items (removed from right-click menus)
   - UI slot components (removed from UI)

**Important:** While Kairo automatically cleans up registered artifacts, you should still implement `cleanup()` for:
- Removing custom styles (`kairo.removeStyles()`)
- Unsubscribing from state changes
- Clearing intervals/timeouts
- Cleaning up any DOM elements you created directly

```javascript
let intervalId;

exports.initialize = function(kairo) {
  intervalId = setInterval(() => {
    kairo.log.debug("Heartbeat");
  }, 60000);

  kairo.addStyles(".my-widget { color: red; }");
};

exports.cleanup = function(kairo) {
  // Clean up resources not automatically handled
  clearInterval(intervalId);
  kairo.removeStyles();
  kairo.log.info("Extension cleaned up");
};
```

### Reloading

When you reload an extension (e.g., after updating its code):

1. The existing extension is **fully unloaded first** (cleanup + artifact removal)
2. The updated extension is loaded fresh
3. This prevents duplicate menu items, commands, etc.

This means you can safely iterate on your extension code - just reload and your changes will take effect without duplicates.

### Debug Console

To debug your extensions, use the Debug Console accessible via:
- **Keyboard:** `Ctrl+`` (backtick) or `Ctrl+Shift+D`
- **Menu:** Tools > Extensions > Debug Console

The Debug Console shows all `kairo.log.*` output from your extensions.

### Visible Feedback

Since Kairo runs in a Tauri webview (not a browser), `console.log()` output isn't visible to users. For user-facing feedback:

```javascript
// For debugging (visible in Debug Console only)
kairo.log.info("Processing started");

// For user feedback (shows a dialog)
window.alert("Operation completed!");

// For confirmation dialogs
if (window.confirm("Delete this item?")) {
  // User clicked OK
}

// For user input
const name = window.prompt("Enter name:");
```

**Note:** Always use `window.alert()`, `window.confirm()`, and `window.prompt()` explicitly with the `window.` prefix for reliable operation.

---

## The Kairo API Object

The `kairo` object is passed to your extension and provides access to all Kairo APIs:

```javascript
kairo = {
  // Registration APIs
  registerPlugin(plugin)
  registerCommand(command)
  registerHook(type, callback)
  registerFilter(type, callback)
  registerSlot(slotType, component)
  registerContextMenuItem(menuType, item)
  registerMenuItem(category, item)
  registerMenuCategory(category)
  registerCustomMenuItem(categoryId, item)

  // Unregistration APIs
  unregisterSlot(slotType, componentId)
  unregisterContextMenuItem(menuType, itemId)
  unregisterMenuItem(category, itemId)
  unregisterMenuCategory(categoryId)

  // Styling
  addStyles(css)
  removeStyles()

  // Logging
  log: {
    info(message, details?)
    warn(message, details?)
    error(message, details?)
    debug(message, details?)
  }

  // State
  getState()
  subscribe(storeName, callback)
}
```

---

## Commands & Keyboard Shortcuts

Commands appear in the command palette (Ctrl+K) and can be triggered via keyboard shortcuts.

```javascript
kairo.registerCommand({
  id: "my-command",           // Required: unique within your extension
  name: "My Command",          // Required: display name in command palette
  description: "Does something cool",  // Optional
  shortcut: "Ctrl+Shift+M",    // Optional: keyboard shortcut
  category: "My Extension",     // Optional: groups commands in palette
  execute: () => {
    // Your command logic here
    kairo.log.info("Command executed!");
  }
});
```

### Keyboard Shortcut Format

Shortcuts use a `+` separated format:
- Modifiers: `Ctrl`, `Cmd`, `Shift`, `Alt`
- Keys: `A`-`Z`, `0`-`9`, `F1`-`F12`, `Enter`, `Space`, `Tab`, `Escape`

Examples:
- `Ctrl+K` - Ctrl and K
- `Ctrl+Shift+P` - Ctrl, Shift, and P
- `Alt+Enter` - Alt and Enter

**Note:** `Ctrl` and `Cmd` are treated as equivalent for cross-platform compatibility.

---

## Hooks & Filters

### Action Hooks

Hooks let you respond to events in the application:

```javascript
kairo.registerHook("onNoteOpen", (data) => {
  kairo.log.info(`Opened note: ${data.path}`);
});
```

**Available Hooks:**

| Hook | Description | Data |
|------|-------------|------|
| `onVaultOpen` | Vault was opened | `{ vault, path }` |
| `onVaultClose` | Vault was closed | `{ vault, path }` |
| `onNoteCreate` | Note was created | `{ path, content }` |
| `onNoteSave` | Note was saved | `{ path, content }` |
| `onNoteDelete` | Note was deleted | `{ path }` |
| `onNoteOpen` | Note was opened | `{ path, note }` |
| `onNoteClose` | Note was closed | `{ path }` |
| `onSearch` | Search was performed | `{ query }` |
| `onSearchResult` | Search results returned | `{ query, results }` |
| `onAppInit` | App initialized | `{}` |
| `onAppClose` | App is closing | `{}` |
| `onEditorReady` | Editor is ready | `{ editor }` |
| `onEditorChange` | Editor content changed | `{ content }` |
| `onPreviewRender` | Preview was rendered | `{ html }` |
| `onCommandExecute` | Command was executed | `{ commandId }` |
| `onPluginLoad` | Plugin was loaded | `{ pluginId }` |
| `onPluginUnload` | Plugin was unloaded | `{ pluginId }` |
| `onSettingsChange` | Settings changed | `{ settings }` |

### Filters

Filters let you modify data as it passes through the system:

```javascript
kairo.registerFilter("filterNoteContent", (content) => {
  // Add a timestamp header to all notes
  return `Last viewed: ${new Date().toISOString()}\n\n${content}`;
});
```

**Available Filters:**

| Filter | Description | Input |
|--------|-------------|-------|
| `filterNoteContent` | Modify note content before display | `string` |
| `filterSearchResults` | Modify search results | `SearchResult[]` |
| `filterPreviewHtml` | Modify preview HTML | `string` |
| `filterCommands` | Modify command list | `Command[]` |
| `filterSidebarItems` | Modify sidebar items | `SidebarItem[]` |
| `filterStatusbarItems` | Modify statusbar items | `StatusBarItem[]` |

---

## Context Menus

Add items to right-click context menus throughout the application.

```javascript
kairo.registerContextMenuItem("note-tree", {
  id: "copy-path",
  label: "Copy Full Path",
  icon: "📋",                    // Optional: emoji or text icon
  shortcut: "Ctrl+Shift+C",      // Optional
  priority: 10,                   // Optional: higher = appears first
  divider: true,                  // Optional: show divider above
  execute: (context) => {
    navigator.clipboard.writeText(context.notePath);
    kairo.log.info("Path copied!");
  },
  when: (context) => {
    // Optional: only show when condition is met
    return context.notePath !== undefined;
  }
});
```

### Context Menu Types

| Type | Description | Context Data |
|------|-------------|--------------|
| `note-tree` | Right-click on note in sidebar | `notePath`, `noteTitle` |
| `folder-tree` | Right-click on folder in sidebar | `folderPath` |
| `editor` | Right-click in the editor | `selectedText`, `cursorPosition` |
| `preview` | Right-click in the preview pane | `selectedText` |
| `wiki-link` | Right-click on a wiki link | `linkTarget`, `linkText` |
| `external-link` | Right-click on an external link | `linkTarget`, `linkText` |
| `kanban-card` | Right-click on a kanban card | `cardId`, `boardId`, `columnId` |
| `tab` | Right-click on a tab | `notePath`, `noteTitle` |
| `graph-node` | Right-click on a graph node | `nodeId`, `notePath` |

### Context Object

```typescript
interface ContextMenuContext {
  type: ContextMenuType;
  notePath?: string;
  noteTitle?: string;
  folderPath?: string;
  linkTarget?: string;
  linkText?: string;
  selectedText?: string;
  cursorPosition?: { line: number; column: number };
  cardId?: string;
  boardId?: string;
  columnId?: string;
  nodeId?: string;
  event?: { clientX: number; clientY: number };
}
```

---

## Menu Bar Items

Add items to the application's top menu bar.

### Adding to Built-in Menus

```javascript
kairo.registerMenuItem("tools", {
  id: "my-tool",
  label: "My Tool",
  shortcut: "Ctrl+Shift+T",      // Optional
  priority: 10,                   // Optional
  divider: true,                  // Optional
  execute: () => {
    kairo.log.info("Tool activated!");
  },
  when: () => {
    // Optional: only show when condition is met
    return true;
  }
});
```

**Available Categories:**
- `file` - File menu (New, Open, Save, etc.)
- `edit` - Edit menu (Undo, Redo, Cut, Copy, Paste)
- `view` - View menu (Command Palette, Sidebar, Preview)
- `tools` - Tools menu (Git, Kanban, Templates)
- `help` - Help menu (Shortcuts, Documentation, About)

### Creating Custom Menu Categories

```javascript
// Create a new menu category
kairo.registerMenuCategory({
  id: "my-menu",
  label: "My Menu",
  priority: 50  // Higher = appears more to the left
});

// Add items to your custom menu
kairo.registerCustomMenuItem("my-menu", {
  id: "action-1",
  label: "Action 1",
  execute: () => {
    kairo.log.info("Action 1!");
  }
});

kairo.registerCustomMenuItem("my-menu", {
  id: "action-2",
  label: "Action 2",
  divider: true,  // Show divider above
  execute: () => {
    kairo.log.info("Action 2!");
  }
});
```

---

## UI Slots

Register React components to render in specific UI locations.

```javascript
kairo.registerSlot("statusbar", {
  id: "my-widget",
  component: MyStatusBarWidget,
  priority: 10  // Higher = rendered first
});
```

**Available Slots:**

| Slot | Location |
|------|----------|
| `sidebar` | Main sidebar area |
| `sidebar-footer` | Bottom of sidebar |
| `toolbar` | Main toolbar |
| `statusbar` | Status bar at bottom |
| `editor-toolbar` | Editor toolbar |
| `editor-footer` | Footer below editor |
| `preview-footer` | Footer below preview |
| `modal` | Full-screen modal layer |

**Note:** Slot components receive a `data` prop with context information.

---

## Custom Styling

Inject custom CSS to style Kairo or your extension's UI.

```javascript
kairo.addStyles(`
  /* Custom CSS */
  .my-extension-widget {
    background: var(--dark-800);
    padding: 8px;
    border-radius: 4px;
  }

  /* Override Kairo styles */
  .editor-container {
    font-family: "JetBrains Mono", monospace;
  }
`);
```

**CSS Variables Available:**

```css
/* Dark theme colors */
--dark-50: #f9fafb;
--dark-100: #f3f4f6;
--dark-200: #e5e7eb;
--dark-300: #d1d5db;
--dark-400: #9ca3af;
--dark-500: #6b7280;
--dark-600: #4b5563;
--dark-700: #374151;
--dark-800: #1f2937;
--dark-850: #18202f;
--dark-900: #111827;
--dark-950: #0b0f19;

/* Accent colors */
--accent-primary: #6366f1;
--accent-secondary: #818cf8;
```

Remove styles during cleanup:

```javascript
exports.cleanup = function(kairo) {
  kairo.removeStyles();
};
```

---

## State Access

Access Kairo's application state (read-only).

```javascript
const state = kairo.getState();

console.log(state.notes.list);      // Array of all notes
console.log(state.notes.current);   // Currently open note
console.log(state.notes.editorContent);  // Current editor content
console.log(state.vault);           // Vault info { path, name, note_count }
console.log(state.ui.mainViewMode); // "notes" | "graph" | etc.
console.log(state.search.query);    // Current search query
```

### Subscribing to State Changes

```javascript
const unsubscribe = kairo.subscribe("notes", (state) => {
  console.log("Notes state changed:", state);
});

// In cleanup:
exports.cleanup = function(kairo) {
  unsubscribe();
};
```

**Available Stores:**
- `notes` - Note list, current note, editor content
- `vault` - Vault information
- `ui` - UI state (sidebar, view mode)
- `search` - Search query and results

---

## Logging & Debugging

Use the logging API for debugging. Logs appear in the Debug Console.

```javascript
kairo.log.info("Extension loaded successfully");
kairo.log.debug("Processing data", JSON.stringify(data));
kairo.log.warn("This feature is deprecated");
kairo.log.error("Failed to load", error.message);
```

### Opening the Debug Console

Access the Debug Console via:
- **Keyboard:** `Ctrl+`` (backtick) or `Ctrl+Shift+D`
- **Menu:** Tools > Extensions > Debug Console

The Debug Console shows timestamped logs from all extensions, color-coded by level (info, debug, warn, error).

### User-Facing Feedback

For feedback that users should see (not just developers), use dialog functions:

```javascript
// Show information
window.alert("Export completed successfully!");

// Ask yes/no question
if (window.confirm("Are you sure you want to delete this?")) {
  // proceed with deletion
}

// Get user input
const filename = window.prompt("Enter filename:", "untitled");
```

**Note:** Always prefix with `window.` (e.g., `window.alert()` not just `alert()`) for reliable behavior in Tauri.

---

## Best Practices

### 1. Clean Up Resources

Always implement the `cleanup` function to remove resources when your extension unloads:

```javascript
let unsubscribe;

exports.initialize = function(kairo) {
  unsubscribe = kairo.subscribe("notes", handler);
  kairo.addStyles(myStyles);
};

exports.cleanup = function(kairo) {
  if (unsubscribe) unsubscribe();
  kairo.removeStyles();
};
```

### 2. Use Unique IDs

Prefix all IDs with your extension ID to avoid conflicts:

```javascript
kairo.registerCommand({
  id: "my-extension.my-command",  // Automatically prefixed, but be descriptive
  // ...
});
```

### 3. Handle Errors Gracefully

Wrap potentially failing code in try-catch:

```javascript
exports.initialize = function(kairo) {
  try {
    // Your initialization code
  } catch (error) {
    kairo.log.error("Failed to initialize", error.message);
  }
};
```

### 4. Keep Extensions Small

Each extension runs in a sandboxed environment. Keep your code focused and modular.

### 5. Use Conditional Features

Use the `when` callback to conditionally show menu items:

```javascript
kairo.registerContextMenuItem("note-tree", {
  id: "archive",
  label: "Archive Note",
  when: (context) => !context.notePath?.includes("/archive/")
  // ...
});
```

---

## Example Extensions

### Word Counter

Shows word count in the status bar:

```javascript
// manifest.json
{
  "id": "word-counter",
  "name": "Word Counter",
  "version": "1.0.0",
  "main": "main.js"
}

// main.js
exports.initialize = function(kairo) {
  let wordCount = 0;

  kairo.registerHook("onEditorChange", (data) => {
    wordCount = data.content?.split(/\s+/).filter(Boolean).length || 0;
  });

  kairo.addStyles(`
    .word-count-widget {
      font-size: 12px;
      color: var(--dark-400);
      padding: 0 8px;
    }
  `);
};

exports.cleanup = function(kairo) {
  kairo.removeStyles();
};
```

### Quick Note Creator

Adds a command to create a quick note:

```javascript
// manifest.json
{
  "id": "quick-note",
  "name": "Quick Note",
  "version": "1.0.0",
  "main": "main.js"
}

// main.js
exports.initialize = function(kairo) {
  kairo.registerCommand({
    id: "create-quick-note",
    name: "Create Quick Note",
    shortcut: "Ctrl+Shift+Q",
    category: "Notes",
    execute: () => {
      const timestamp = new Date().toISOString().split("T")[0];
      const title = prompt("Quick note title:");
      if (title) {
        kairo.log.info(`Creating quick note: ${title}`);
        // Note: Actual note creation would require additional API access
      }
    }
  });

  kairo.registerMenuItem("file", {
    id: "quick-note",
    label: "Quick Note",
    shortcut: "Ctrl+Shift+Q",
    priority: 100,
    execute: () => {
      kairo.log.info("Quick note from menu!");
    }
  });
};
```

### Context Menu Extension

Adds custom context menu items:

```javascript
// manifest.json
{
  "id": "context-actions",
  "name": "Context Actions",
  "version": "1.0.0",
  "main": "main.js"
}

// main.js
exports.initialize = function(kairo) {
  // Add to note right-click menu
  kairo.registerContextMenuItem("note-tree", {
    id: "open-in-new-window",
    label: "Open in External Editor",
    icon: "🔗",
    priority: 5,
    execute: (context) => {
      kairo.log.info(`Opening ${context.notePath} in external editor`);
      // Implementation would open file externally
    }
  });

  // Add to wiki link right-click menu
  kairo.registerContextMenuItem("wiki-link", {
    id: "copy-link-text",
    label: "Copy Link Text",
    execute: (context) => {
      navigator.clipboard.writeText(context.linkText || "");
      kairo.log.info("Copied link text!");
    }
  });
};
```

---

## Security Notes

Extensions run in a sandboxed environment with the following restrictions:

**Blocked:**
- `fetch`, `XMLHttpRequest`, `WebSocket` (network access)
- `eval`, `Function` constructor (dynamic code execution)
- `process`, `require` (Node.js access)
- `indexedDB` (large storage)

**Allowed:**
- `document`, `window` (DOM manipulation)
- `localStorage` (limited storage)
- All Kairo API methods

---

## Troubleshooting

### Extension not loading?

1. Check the Debug Console for error messages
2. Verify `manifest.json` has all required fields
3. Ensure the `main` path is correct and file exists
4. Check for JavaScript syntax errors in your code

### Command not appearing?

1. Verify `registerCommand` was called in `initialize`
2. Check the command palette (Ctrl+K) and search for your command
3. Ensure the command ID is unique

### Styles not applying?

1. Check the CSS for syntax errors
2. Use browser DevTools to inspect elements
3. Try more specific CSS selectors

### Duplicate menu items or commands?

This usually happens when an extension is reloaded without proper cleanup:

1. Ensure you're using the latest version of Kairo (automatic cleanup was added recently)
2. Try disabling and re-enabling the extension
3. If you're developing, restart the app to clear state

### Menu items not removed after disabling extension?

1. Check that your extension ID matches across all registrations
2. Kairo automatically cleans up artifacts tied to your `pluginId`
3. Restart the app if issues persist after updating Kairo

### Alert dialogs not showing?

1. Use `window.alert()` instead of just `alert()`
2. Same for `window.confirm()` and `window.prompt()`
3. This is required for Tauri webview compatibility

---

## Getting Help

- View the [sample extensions](../sample-extensions/) for working examples
- Check the Debug Console for logs and errors
- File issues at the Kairo GitHub repository
