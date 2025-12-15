// Themes Pack Extension
// Demonstrates: CSS injection, theme switching, localStorage for preferences

let currentTheme = null;
let styleElement = null;

const THEMES = {
  default: {
    name: "Default Dark",
    css: "" // No override, use default
  },

  nord: {
    name: "Nord",
    css: `
      :root {
        /* Nord Color Palette */
        --nord0: #2E3440;
        --nord1: #3B4252;
        --nord2: #434C5E;
        --nord3: #4C566A;
        --nord4: #D8DEE9;
        --nord5: #E5E9F0;
        --nord6: #ECEFF4;
        --nord7: #8FBCBB;
        --nord8: #88C0D0;
        --nord9: #81A1C1;
        --nord10: #5E81AC;
        --nord11: #BF616A;
        --nord12: #D08770;
        --nord13: #EBCB8B;
        --nord14: #A3BE8C;
        --nord15: #B48EAD;
      }

      body, .bg-dark-950 { background-color: var(--nord0) !important; }
      .bg-dark-900 { background-color: var(--nord1) !important; }
      .bg-dark-800 { background-color: var(--nord2) !important; }
      .bg-dark-700 { background-color: var(--nord3) !important; }

      .text-dark-100 { color: var(--nord6) !important; }
      .text-dark-200 { color: var(--nord5) !important; }
      .text-dark-300 { color: var(--nord4) !important; }
      .text-dark-400 { color: #A5B4CB !important; }
      .text-dark-500 { color: #8695AB !important; }

      .border-dark-700, .border-dark-800 { border-color: var(--nord3) !important; }

      .text-accent-primary, .bg-accent-primary {
        color: var(--nord8) !important;
      }

      .hover\\:bg-dark-800:hover { background-color: var(--nord2) !important; }

      /* Syntax highlighting adjustments */
      .cm-editor { background-color: var(--nord0) !important; }
      .cm-gutters { background-color: var(--nord1) !important; border-color: var(--nord2) !important; }
      .cm-activeLineGutter, .cm-activeLine { background-color: var(--nord1) !important; }
    `
  },

  dracula: {
    name: "Dracula",
    css: `
      :root {
        --dracula-bg: #282a36;
        --dracula-current: #44475a;
        --dracula-fg: #f8f8f2;
        --dracula-comment: #6272a4;
        --dracula-cyan: #8be9fd;
        --dracula-green: #50fa7b;
        --dracula-orange: #ffb86c;
        --dracula-pink: #ff79c6;
        --dracula-purple: #bd93f9;
        --dracula-red: #ff5555;
        --dracula-yellow: #f1fa8c;
      }

      body, .bg-dark-950 { background-color: var(--dracula-bg) !important; }
      .bg-dark-900 { background-color: #21222c !important; }
      .bg-dark-800 { background-color: var(--dracula-current) !important; }
      .bg-dark-700 { background-color: #545777 !important; }

      .text-dark-100 { color: var(--dracula-fg) !important; }
      .text-dark-200 { color: #e0e0e0 !important; }
      .text-dark-300 { color: #c0c0c0 !important; }
      .text-dark-400 { color: var(--dracula-comment) !important; }
      .text-dark-500 { color: #5a6591 !important; }

      .border-dark-700, .border-dark-800 { border-color: var(--dracula-current) !important; }

      .text-accent-primary { color: var(--dracula-purple) !important; }
      .bg-accent-primary { background-color: var(--dracula-purple) !important; }

      .hover\\:bg-dark-800:hover { background-color: var(--dracula-current) !important; }

      .cm-editor { background-color: var(--dracula-bg) !important; }
      .cm-gutters { background-color: #21222c !important; border-color: var(--dracula-current) !important; }
    `
  },

  solarized: {
    name: "Solarized Dark",
    css: `
      :root {
        --sol-base03: #002b36;
        --sol-base02: #073642;
        --sol-base01: #586e75;
        --sol-base00: #657b83;
        --sol-base0: #839496;
        --sol-base1: #93a1a1;
        --sol-base2: #eee8d5;
        --sol-base3: #fdf6e3;
        --sol-yellow: #b58900;
        --sol-orange: #cb4b16;
        --sol-red: #dc322f;
        --sol-magenta: #d33682;
        --sol-violet: #6c71c4;
        --sol-blue: #268bd2;
        --sol-cyan: #2aa198;
        --sol-green: #859900;
      }

      body, .bg-dark-950 { background-color: var(--sol-base03) !important; }
      .bg-dark-900 { background-color: var(--sol-base02) !important; }
      .bg-dark-800 { background-color: #094554 !important; }
      .bg-dark-700 { background-color: #0b5363 !important; }

      .text-dark-100 { color: var(--sol-base1) !important; }
      .text-dark-200 { color: var(--sol-base0) !important; }
      .text-dark-300 { color: var(--sol-base00) !important; }
      .text-dark-400 { color: var(--sol-base01) !important; }
      .text-dark-500 { color: #4a5d64 !important; }

      .border-dark-700, .border-dark-800 { border-color: var(--sol-base02) !important; }

      .text-accent-primary { color: var(--sol-cyan) !important; }
      .bg-accent-primary { background-color: var(--sol-cyan) !important; }

      .cm-editor { background-color: var(--sol-base03) !important; }
      .cm-gutters { background-color: var(--sol-base02) !important; }
    `
  },

  monokai: {
    name: "Monokai Pro",
    css: `
      :root {
        --mono-bg: #2d2a2e;
        --mono-fg: #fcfcfa;
        --mono-comment: #727072;
        --mono-red: #ff6188;
        --mono-orange: #fc9867;
        --mono-yellow: #ffd866;
        --mono-green: #a9dc76;
        --mono-blue: #78dce8;
        --mono-purple: #ab9df2;
      }

      body, .bg-dark-950 { background-color: var(--mono-bg) !important; }
      .bg-dark-900 { background-color: #221f22 !important; }
      .bg-dark-800 { background-color: #403e41 !important; }
      .bg-dark-700 { background-color: #525053 !important; }

      .text-dark-100 { color: var(--mono-fg) !important; }
      .text-dark-200 { color: #e3e3e1 !important; }
      .text-dark-300 { color: #c1c0c0 !important; }
      .text-dark-400 { color: var(--mono-comment) !important; }
      .text-dark-500 { color: #5b595c !important; }

      .border-dark-700, .border-dark-800 { border-color: #403e41 !important; }

      .text-accent-primary { color: var(--mono-yellow) !important; }
      .bg-accent-primary { background-color: var(--mono-yellow) !important; color: #2d2a2e !important; }

      .cm-editor { background-color: var(--mono-bg) !important; }
      .cm-gutters { background-color: #221f22 !important; }
    `
  },

  light: {
    name: "Light Mode",
    css: `
      body, .bg-dark-950 { background-color: #ffffff !important; }
      .bg-dark-900 { background-color: #f5f5f5 !important; }
      .bg-dark-800 { background-color: #e8e8e8 !important; }
      .bg-dark-700 { background-color: #d4d4d4 !important; }

      .text-dark-100 { color: #1a1a1a !important; }
      .text-dark-200 { color: #333333 !important; }
      .text-dark-300 { color: #4a4a4a !important; }
      .text-dark-400 { color: #666666 !important; }
      .text-dark-500 { color: #888888 !important; }
      .text-dark-600 { color: #aaaaaa !important; }

      .border-dark-700, .border-dark-800 { border-color: #d4d4d4 !important; }

      .text-accent-primary { color: #0066cc !important; }
      .bg-accent-primary { background-color: #0066cc !important; }

      .hover\\:bg-dark-800:hover { background-color: #e0e0e0 !important; }
      .hover\\:bg-dark-800\\/50:hover { background-color: rgba(224, 224, 224, 0.5) !important; }

      .cm-editor { background-color: #ffffff !important; color: #1a1a1a !important; }
      .cm-gutters { background-color: #f5f5f5 !important; border-color: #e8e8e8 !important; color: #888888 !important; }
      .cm-activeLineGutter, .cm-activeLine { background-color: #f0f0f0 !important; }
      .cm-cursor { border-color: #1a1a1a !important; }
      .cm-selectionBackground { background-color: #b3d7ff !important; }

      /* Scrollbars for light mode */
      ::-webkit-scrollbar-track { background: #f5f5f5; }
      ::-webkit-scrollbar-thumb { background: #cccccc; }
      ::-webkit-scrollbar-thumb:hover { background: #aaaaaa; }

      /* Modal overlays */
      .modal-overlay { background-color: rgba(0, 0, 0, 0.3) !important; }
      .modal-content { background-color: #ffffff !important; border-color: #d4d4d4 !important; }
    `
  }
};

function applyTheme(themeName, kairo) {
  const theme = THEMES[themeName];
  if (!theme) {
    kairo.log.error("Theme not found", { themeName });
    return;
  }

  // Remove existing theme styles
  if (styleElement) {
    styleElement.remove();
  }

  // Apply new theme
  if (theme.css) {
    styleElement = document.createElement("style");
    styleElement.id = "kairo-theme-" + themeName;
    styleElement.textContent = theme.css;
    document.head.appendChild(styleElement);
  }

  currentTheme = themeName;

  // Save preference
  try {
    localStorage.setItem("kairo-theme", themeName);
  } catch (e) {
    // localStorage might not be available in sandbox
  }

  kairo.log.info("Theme applied", { theme: theme.name });
}

function initialize(kairo) {
  kairo.log.info("Themes Pack extension loaded");

  // Load saved theme preference
  try {
    const savedTheme = localStorage.getItem("kairo-theme");
    if (savedTheme && THEMES[savedTheme]) {
      applyTheme(savedTheme, kairo);
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  // Register theme commands
  Object.entries(THEMES).forEach(([id, theme]) => {
    kairo.registerCommand({
      id: "theme-" + id,
      name: "Theme: " + theme.name,
      description: "Switch to " + theme.name + " theme",
      category: "Themes",
      execute: () => applyTheme(id, kairo)
    });
  });

  // Theme cycle command
  const themeIds = Object.keys(THEMES);
  kairo.registerCommand({
    id: "cycle-theme",
    name: "Cycle Theme",
    description: "Switch to next theme",
    category: "Themes",
    shortcut: "Ctrl+Shift+T",
    execute: () => {
      const currentIndex = themeIds.indexOf(currentTheme || "default");
      const nextIndex = (currentIndex + 1) % themeIds.length;
      applyTheme(themeIds[nextIndex], kairo);
    }
  });

  // Reset theme command
  kairo.registerCommand({
    id: "reset-theme",
    name: "Reset Theme",
    description: "Reset to default theme",
    category: "Themes",
    execute: () => {
      if (styleElement) {
        styleElement.remove();
        styleElement = null;
      }
      currentTheme = "default";
      try {
        localStorage.removeItem("kairo-theme");
      } catch (e) {}
      kairo.log.info("Theme reset to default");
    }
  });
}

function cleanup(kairo) {
  // Remove theme styles on unload
  if (styleElement) {
    styleElement.remove();
    styleElement = null;
  }
  kairo.log.info("Themes Pack extension unloaded");
}

exports.initialize = initialize;
exports.cleanup = cleanup;
