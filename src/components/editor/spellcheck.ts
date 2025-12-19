import { linter, Diagnostic, lintGutter } from "@codemirror/lint";
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

// Initialize dictionary on module load
loadDictionary();

// Words to ignore (common markdown/code patterns)
const ignorePatterns = [
  /^https?:\/\//,      // URLs
  /^[A-Z][a-z]*[A-Z]/, // CamelCase
  /^[A-Z]+$/,          // ALL CAPS (acronyms)
  /^\d+$/,             // Numbers
  /^[a-z]+\d+/i,       // Alphanumeric identifiers
  /^[@#]/,             // Mentions and tags
];

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

  // Check custom dictionary (case insensitive)
  if (customDictionary.has(word.toLowerCase())) return true;

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

    constructor(view: EditorView) {
      this.decorations = this.computeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.computeDecorations(update.view);
      }
    }

    computeDecorations(view: EditorView): DecorationSet {
      if (!dictionary) {
        return Decoration.none;
      }

      const decorations: Array<{ from: number; to: number }> = [];
      const text = view.state.doc.toString();
      const words = extractWords(text);

      for (const { word, from, to } of words) {
        if (shouldIgnoreWord(word)) continue;

        // Check spelling
        if (!dictionary.check(word)) {
          decorations.push({ from, to });
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

// Spell checker linter (for diagnostics with suggestions)
function createSpellLinter() {
  return linter(
    async (view: EditorView) => {
      const dict = await loadDictionary();
      const diagnostics: Diagnostic[] = [];
      const text = view.state.doc.toString();
      const words = extractWords(text);

      for (const { word, from, to } of words) {
        if (shouldIgnoreWord(word)) continue;

        if (!dict.check(word)) {
          const suggestions = dict.suggest(word).slice(0, 5);

          const diagnostic: Diagnostic = {
            from,
            to,
            severity: "warning",
            message: `"${word}" may be misspelled`,
            actions: suggestions.map(suggestion => ({
              name: suggestion,
              apply(view: EditorView, actionFrom: number, actionTo: number) {
                view.dispatch({
                  changes: { from: actionFrom, to: actionTo, insert: suggestion }
                });
              }
            }))
          };

          diagnostics.push(diagnostic);
        }
      }

      return diagnostics;
    },
    {
      delay: 500, // Debounce spell checking
    }
  );
}

// Spell check theme (red wavy underline)
const spellCheckTheme = EditorView.baseTheme({
  ".cm-spell-error": {
    textDecoration: "underline wavy #ef4444",
    textDecorationSkipInk: "none",
  },
  // Lint panel styling
  ".cm-lint-marker-warning": {
    content: '""',
  },
  ".cm-diagnostic-warning": {
    borderLeft: "3px solid #f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    padding: "3px 6px",
    marginLeft: "0",
  },
  ".cm-diagnosticAction": {
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: "3px",
    padding: "2px 6px",
    marginLeft: "4px",
    cursor: "pointer",
    fontSize: "12px",
  },
  ".cm-diagnosticAction:hover": {
    backgroundColor: "#334155",
  },
});

// Main extension export
export function spellCheckExtension(enabled: boolean): Extension {
  if (!enabled) {
    return [];
  }

  return [
    spellCheckPlugin,
    createSpellLinter(),
    lintGutter(),
    spellCheckTheme,
  ];
}

// Add word to custom dictionary (for this session)
export function addToCustomDictionary(word: string): void {
  customDictionary.add(word.toLowerCase());
}
