// Focus Mode Extension
// Demonstrates: Storage API, CSS injection, state management

let focusStyleElement = null;
let isActive = false;

const FOCUS_STYLES = `
  /* Focus Mode Styles */
  .focus-mode-active .sidebar,
  .focus-mode-active [class*="Sidebar"] {
    display: none !important;
  }

  .focus-mode-active .status-bar,
  .focus-mode-active [class*="StatusBar"] {
    display: none !important;
  }

  .focus-mode-active .title-bar,
  .focus-mode-active [class*="TitleBar"] {
    opacity: 0.3;
    transition: opacity 0.3s ease;
  }

  .focus-mode-active .title-bar:hover,
  .focus-mode-active [class*="TitleBar"]:hover {
    opacity: 1;
  }

  .focus-mode-active .main-panel,
  .focus-mode-active [class*="MainPanel"],
  .focus-mode-active [class*="editor"] {
    max-width: 800px !important;
    margin: 0 auto !important;
  }

  /* Dim everything except the editor */
  .focus-mode-active::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.1);
    pointer-events: none;
    z-index: 1;
  }

  .focus-mode-active .cm-editor,
  .focus-mode-active [class*="CodeMirror"],
  .focus-mode-active [class*="preview"] {
    position: relative;
    z-index: 2;
  }
`;

function injectStyles() {
  if (!focusStyleElement) {
    focusStyleElement = document.createElement("style");
    focusStyleElement.id = "focus-mode-styles";
    focusStyleElement.textContent = FOCUS_STYLES;
    document.head.appendChild(focusStyleElement);
  }
}

function removeStyles() {
  if (focusStyleElement) {
    focusStyleElement.remove();
    focusStyleElement = null;
  }
}

function enableFocusMode(kairo) {
  injectStyles();
  document.body.classList.add("focus-mode-active");
  isActive = true;
  kairo.log.info("Focus mode enabled");

  // Dispatch event for sidebar toggle
  window.dispatchEvent(new CustomEvent("kairo:toggle-sidebar"));
}

function disableFocusMode(kairo) {
  document.body.classList.remove("focus-mode-active");
  isActive = false;
  kairo.log.info("Focus mode disabled");

  // Restore sidebar
  window.dispatchEvent(new CustomEvent("kairo:toggle-sidebar"));
}

function toggleFocusMode(kairo) {
  if (isActive) {
    disableFocusMode(kairo);
  } else {
    enableFocusMode(kairo);
  }
}

function initialize(kairo) {
  kairo.log.info("Focus Mode extension loaded");

  // Inject base styles (hidden until activated)
  injectStyles();

  kairo.registerCommand({
    id: "toggle",
    name: "Toggle Focus Mode",
    description: "Enter/exit distraction-free writing mode",
    category: "View",
    shortcut: "Ctrl+Shift+F",
    execute: () => toggleFocusMode(kairo)
  });

  kairo.registerCommand({
    id: "enable",
    name: "Enable Focus Mode",
    description: "Enter distraction-free writing mode",
    category: "View",
    execute: () => {
      if (!isActive) enableFocusMode(kairo);
    }
  });

  kairo.registerCommand({
    id: "disable",
    name: "Disable Focus Mode",
    description: "Exit distraction-free writing mode",
    category: "View",
    execute: () => {
      if (isActive) disableFocusMode(kairo);
    }
  });

  // Listen for Escape to exit focus mode
  const handleEscape = (e) => {
    if (e.key === "Escape" && isActive) {
      disableFocusMode(kairo);
    }
  };

  window.addEventListener("keydown", handleEscape);

  // Store cleanup reference
  kairo._focusModeCleanup = () => {
    window.removeEventListener("keydown", handleEscape);
  };
}

function cleanup(kairo) {
  // Disable focus mode if active
  if (isActive) {
    document.body.classList.remove("focus-mode-active");
  }

  // Remove injected styles
  removeStyles();

  // Remove event listener
  if (kairo._focusModeCleanup) {
    kairo._focusModeCleanup();
  }

  kairo.log.info("Focus Mode extension unloaded");
}

exports.initialize = initialize;
exports.cleanup = cleanup;
