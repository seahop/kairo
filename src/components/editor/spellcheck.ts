// Note: linter was removed for performance - dict.suggest() calls were too expensive
// We just use decorations (wavy underlines) now
import { Extension } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import Typo from "typo-js";

// Typo dictionary instance (lazy loaded)
let dictionary: Typo | null = null;
let dictionaryLoading: Promise<Typo> | null = null;

// Load the dictionary from public folder
async function loadDictionary(): Promise<Typo> {
  if (dictionary) return dictionary;

  if (dictionaryLoading) {
    return dictionaryLoading;
  }

  dictionaryLoading = (async () => {
    try {
      // Fetch dictionary files from public folder
      const [affResponse, dicResponse] = await Promise.all([
        fetch('/dictionaries/en_US.aff'),
        fetch('/dictionaries/en_US.dic')
      ]);

      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error('Failed to load dictionary files');
      }

      const affData = await affResponse.text();
      const dicData = await dicResponse.text();

      // Create Typo instance with loaded dictionary data
      dictionary = new Typo("en_US", affData, dicData);
      return dictionary;
    } catch (error) {
      console.error('Failed to load spell check dictionary:', error);
      // Return a dummy dictionary that marks everything as correct
      dictionary = {
        check: () => true,
        suggest: () => [],
        loaded: false
      } as unknown as Typo;
      return dictionary;
    }
  })();

  return dictionaryLoading;
}

// Preload dictionary during app initialization (called from App.tsx)
// This loads during the loading screen so the app is ready when it appears
export function preloadDictionary(): Promise<void> {
  return loadDictionary().then(() => {});
}

// Words to ignore (common markdown/code patterns)
const ignorePatterns = [
  /^https?:\/\//,      // URLs
  /^[A-Z][a-z]*[A-Z]/, // CamelCase
  /^[A-Z]+$/,          // ALL CAPS (acronyms)
  /^\d+$/,             // Numbers
  /^[a-z]+\d+/i,       // Alphanumeric identifiers
  /^[@#]/,             // Mentions and tags
];

// Track dictionary changes to trigger decoration refresh
let dictionaryVersion = 0;

// LocalStorage key for persisted ignored words
const IGNORED_WORDS_KEY = "kairo-ignored-words";

// Load persisted ignored words from localStorage
function loadIgnoredWords(): string[] {
  try {
    const stored = localStorage.getItem(IGNORED_WORDS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load ignored words:", e);
  }
  return [];
}

// Save ignored words to localStorage
function saveIgnoredWords(words: string[]): void {
  try {
    localStorage.setItem(IGNORED_WORDS_KEY, JSON.stringify(words));
  } catch (e) {
    console.warn("Failed to save ignored words:", e);
  }
}

// User-ignored words (persisted)
const userIgnoredWords = new Set<string>(loadIgnoredWords());

// Common words to skip (proper nouns, tech terms, etc.)
const customDictionary = new Set([
  // Tech terms
  "codemirror", "typescript", "javascript", "nodejs", "npm", "pnpm",
  "webpack", "vite", "tauri", "webview", "webkit", "gtk",
  "api", "cli", "gui", "ui", "ux", "html", "css", "json", "yaml",
  "sql", "nosql", "mongodb", "postgres", "sqlite", "redis",
  "docker", "kubernetes", "linux", "macos", "ios", "android",
  "github", "gitlab", "bitbucket", "vercel", "netlify",
  "frontend", "backend", "fullstack", "devops", "middleware",
  "async", "await", "const", "useState", "useEffect", "useRef",
  "boolean", "nullable", "readonly", "enum", "struct",
  // Common abbreviations
  "etc", "eg", "ie", "vs", "misc", "config", "init", "args",
  // Markdown/Kairo specific
  "frontmatter", "wikilink", "transclusion", "backlink", "moc",
  "kanban", "dataview", "callout", "blockquote",
]);

// Check if a word should be ignored
function shouldIgnoreWord(word: string): boolean {
  // Too short
  if (word.length < 2) return true;

  // Check patterns
  for (const pattern of ignorePatterns) {
    if (pattern.test(word)) return true;
  }

  const lowerWord = word.toLowerCase();

  // Check user-ignored words (persisted)
  if (userIgnoredWords.has(lowerWord)) return true;

  // Check custom dictionary (case insensitive)
  if (customDictionary.has(lowerWord)) return true;

  return false;
}

// Extract words from text, skipping code blocks, links, etc.
function extractWords(text: string): Array<{ word: string; from: number; to: number }> {
  const words: Array<{ word: string; from: number; to: number }> = [];

  // Skip these regions
  const skipRegions: Array<{ from: number; to: number }> = [];

  // Find code blocks (``` ... ```)
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    skipRegions.push({ from: match.index, to: match.index + match[0].length });
  }

  // Find inline code (` ... `)
  const inlineCodeRegex = /`[^`]+`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    skipRegions.push({ from: match.index, to: match.index + match[0].length });
  }

  // Find URLs
  const urlRegex = /https?:\/\/[^\s\])"]+/g;
  while ((match = urlRegex.exec(text)) !== null) {
    skipRegions.push({ from: match.index, to: match.index + match[0].length });
  }

  // Find wiki links [[ ... ]]
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  while ((match = wikiLinkRegex.exec(text)) !== null) {
    skipRegions.push({ from: match.index, to: match.index + match[0].length });
  }

  // Find frontmatter (--- ... ---)
  const frontmatterRegex = /^---[\s\S]*?---/;
  const frontmatterMatch = frontmatterRegex.exec(text);
  if (frontmatterMatch) {
    skipRegions.push({ from: 0, to: frontmatterMatch[0].length });
  }

  // Sort skip regions
  skipRegions.sort((a, b) => a.from - b.from);

  // Check if position is in a skip region
  function isInSkipRegion(pos: number): boolean {
    for (const region of skipRegions) {
      if (pos >= region.from && pos < region.to) return true;
      if (region.from > pos) break;
    }
    return false;
  }

  // Extract words using regex
  const wordRegex = /[a-zA-Z']+/g;
  while ((match = wordRegex.exec(text)) !== null) {
    const from = match.index;
    const to = from + match[0].length;

    // Skip if in a skip region
    if (isInSkipRegion(from)) continue;

    // Clean up word (remove leading/trailing apostrophes)
    let word = match[0].replace(/^'+|'+$/g, "");
    if (word.length < 2) continue;

    words.push({ word, from, to });
  }

  return words;
}

// Spell check decoration mark
const spellErrorMark = Decoration.mark({ class: "cm-spell-error" });

// Spell checker view plugin (for decorations)
const spellCheckPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private view: EditorView;
    private pollTimer: number | null = null;
    private lastDictVersion: number = dictionaryVersion;

    constructor(view: EditorView) {
      this.view = view;
      this.decorations = this.computeDecorations(view);

      // If dictionary isn't loaded yet, poll until it is
      if (!dictionary && dictionaryLoading) {
        this.waitForDictionary();
      }
    }

    private waitForDictionary() {
      // Wait for dictionary to load, then trigger a re-render
      dictionaryLoading?.then(() => {
        // Dispatch an empty transaction to trigger update cycle
        // This causes update() to be called which will recompute decorations
        if (this.view) {
          this.view.dispatch({});
        }
      });
    }

    destroy() {
      if (this.pollTimer) {
        clearTimeout(this.pollTimer);
      }
    }

    update(update: ViewUpdate) {
      // Check if dictionary was modified (word added to ignore list)
      const dictChanged = this.lastDictVersion !== dictionaryVersion;
      if (dictChanged) {
        this.lastDictVersion = dictionaryVersion;
      }

      // Recompute on doc change, viewport change, dictionary change, or if we have no decorations but dictionary is now ready
      const needsInitialCompute = this.decorations === Decoration.none && dictionary;
      if (update.docChanged || update.viewportChanged || dictChanged || needsInitialCompute) {
        this.decorations = this.computeDecorations(update.view);
      }
    }

    computeDecorations(view: EditorView): DecorationSet {
      if (!dictionary) {
        return Decoration.none;
      }

      const decorations: Array<{ from: number; to: number }> = [];

      // Only check visible ranges for performance
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        const words = extractWords(text);

        for (const { word, from: wordFrom, to: wordTo } of words) {
          if (shouldIgnoreWord(word)) continue;

          // Check spelling - adjust positions to document coordinates
          if (!dictionary.check(word)) {
            decorations.push({ from: from + wordFrom, to: from + wordTo });
          }
        }
      }

      // Sort by position and create decoration set
      decorations.sort((a, b) => a.from - b.from);
      return Decoration.set(
        decorations.map(d => spellErrorMark.range(d.from, d.to))
      );
    }
  },
  {
    decorations: v => v.decorations
  }
);

// Inject spellcheck CSS directly into document (bypasses CodeMirror theme issues)
function injectSpellCheckCSS() {
  if (document.getElementById('spellcheck-styles')) return;
  const style = document.createElement('style');
  style.id = 'spellcheck-styles';
  // Use dotted border to simulate squiggly line (wavy not supported in WebKit)
  style.textContent = `
    .cm-spell-error {
      border-bottom: 1px dotted #ef4444 !important;
      padding-bottom: 1px !important;
    }
  `;
  document.head.appendChild(style);
}

// Spell check theme (kept as fallback)
const spellCheckTheme = EditorView.theme({
  ".cm-spell-error": {
    borderBottom: "1px dotted #ef4444",
    paddingBottom: "1px",
  },
});

// Main extension export
// Uses only the ViewPlugin for decorations - linter was removed for performance
// (dict.suggest() calls were causing ~25% CPU usage when switching notes)
export function spellCheckExtension(enabled: boolean): Extension {
  if (!enabled) {
    return [];
  }

  // Inject CSS directly into document
  injectSpellCheckCSS();

  return [
    spellCheckPlugin,
    spellCheckTheme,
  ];
}

// Add word to custom dictionary (persisted across sessions)
export function addToCustomDictionary(word: string): void {
  const lowerWord = word.toLowerCase();
  userIgnoredWords.add(lowerWord);
  saveIgnoredWords(Array.from(userIgnoredWords));
  dictionaryVersion++; // Trigger decoration refresh
}
