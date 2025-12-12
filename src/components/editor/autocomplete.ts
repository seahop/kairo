import { CompletionContext, CompletionResult, Completion, autocompletion } from "@codemirror/autocomplete";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore, NoteMetadata } from "@/stores/noteStore";

// Cache for autocomplete data
let noteCache: NoteMetadata[] = [];
let tagCache: string[] = [];
let mentionCache: string[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 5000; // 5 seconds

async function refreshCache() {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL) return;

  try {
    // Get notes from store
    noteCache = useNoteStore.getState().notes;

    // Fetch tags and mentions from backend
    const [tags, mentions] = await Promise.all([
      invoke<string[]>("get_all_tags").catch(() => []),
      invoke<string[]>("get_all_mentions").catch(() => []),
    ]);

    tagCache = tags;
    mentionCache = mentions;
    lastCacheUpdate = now;
  } catch (err) {
    console.error("Failed to refresh autocomplete cache:", err);
  }
}

// Wiki link completion: triggered by [[
function wikiLinkCompletion(context: CompletionContext): CompletionResult | null {
  // Look for [[ before the cursor
  const before = context.matchBefore(/\[\[[^\]]*$/);
  if (!before) return null;

  // Extract the query (text after [[)
  const query = before.text.slice(2).toLowerCase();

  // Filter and sort notes
  const matches = noteCache
    .filter(note => {
      const title = note.title.toLowerCase();
      const path = note.path.toLowerCase();
      return title.includes(query) || path.includes(query);
    })
    .sort((a, b) => {
      // Prioritize title matches over path matches
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aStartsWith = aTitle.startsWith(query);
      const bStartsWith = bTitle.startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 20); // Limit to 20 results

  const options: Completion[] = matches.map(note => ({
    label: note.title,
    detail: note.path,
    type: "text",
    apply: (view, _completion, _from, to) => {
      // Replace from [[ to cursor with [[title]]
      const insertText = `[[${note.title}]]`;
      view.dispatch({
        changes: { from: before.from, to, insert: insertText },
        selection: { anchor: before.from + insertText.length },
      });
    },
  }));

  return {
    from: before.from,
    options,
    validFor: /^[^\]]*$/,
  };
}

// Tag completion: triggered by #
function tagCompletion(context: CompletionContext): CompletionResult | null {
  // Look for # followed by word characters (but not at start of line for headers)
  const before = context.matchBefore(/#\w*$/);
  if (!before) return null;

  // Check if this is a markdown header (# at start of line)
  const line = context.state.doc.lineAt(before.from);
  const lineStart = line.from;
  const textBeforeHash = context.state.sliceDoc(lineStart, before.from);

  // If # is at start of line or preceded only by whitespace and #, it's a header
  if (/^#*\s*$/.test(textBeforeHash)) return null;

  const query = before.text.slice(1).toLowerCase();

  const matches = tagCache
    .filter(tag => tag.toLowerCase().includes(query))
    .sort((a, b) => {
      const aStartsWith = a.toLowerCase().startsWith(query);
      const bStartsWith = b.toLowerCase().startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 15);

  const options: Completion[] = matches.map(tag => ({
    label: `#${tag}`,
    type: "keyword",
    apply: `#${tag}`,
  }));

  // Allow creating new tags
  if (query && !tagCache.some(t => t.toLowerCase() === query)) {
    options.push({
      label: `#${query}`,
      detail: "(new tag)",
      type: "keyword",
      boost: -1, // Lower priority
    });
  }

  return {
    from: before.from,
    options,
    validFor: /^#\w*$/,
  };
}

// Mention completion: triggered by @
function mentionCompletion(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/@\w*$/);
  if (!before) return null;

  const query = before.text.slice(1).toLowerCase();

  const matches = mentionCache
    .filter(mention => mention.toLowerCase().includes(query))
    .sort((a, b) => {
      const aStartsWith = a.toLowerCase().startsWith(query);
      const bStartsWith = b.toLowerCase().startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 15);

  const options: Completion[] = matches.map(mention => ({
    label: `@${mention}`,
    type: "variable",
    apply: `@${mention}`,
  }));

  // Allow creating new mentions
  if (query && !mentionCache.some(m => m.toLowerCase() === query)) {
    options.push({
      label: `@${query}`,
      detail: "(new mention)",
      type: "variable",
      boost: -1,
    });
  }

  return {
    from: before.from,
    options,
    validFor: /^@\w*$/,
  };
}

// Combined completion source
async function kairoCompletions(context: CompletionContext): Promise<CompletionResult | null> {
  // Refresh cache before completing
  await refreshCache();

  // Try each completion source
  const wikiResult = wikiLinkCompletion(context);
  if (wikiResult) return wikiResult;

  const tagResult = tagCompletion(context);
  if (tagResult) return tagResult;

  const mentionResult = mentionCompletion(context);
  if (mentionResult) return mentionResult;

  return null;
}

// Export the configured autocompletion extension
export const kairoAutocompletion = autocompletion({
  override: [kairoCompletions],
  activateOnTyping: true,
  maxRenderedOptions: 20,
  icons: true,
  optionClass: (completion) => {
    if (completion.type === "text") return "cm-completion-note";
    if (completion.type === "keyword") return "cm-completion-tag";
    if (completion.type === "variable") return "cm-completion-mention";
    return "";
  },
});

// Styling for autocomplete dropdown
export const autocompleteTheme = {
  ".cm-tooltip-autocomplete": {
    backgroundColor: "#0f172a !important",
    border: "1px solid #334155 !important",
    borderRadius: "8px !important",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5) !important",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": {
    maxHeight: "300px !important",
    fontFamily: "'Inter', system-ui, sans-serif !important",
    fontSize: "13px !important",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "8px 12px !important",
    borderBottom: "1px solid #1e293b",
  },
  ".cm-tooltip-autocomplete > ul > li:last-child": {
    borderBottom: "none",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "#1e293b !important",
    color: "#f1f5f9 !important",
  },
  ".cm-completionLabel": {
    color: "#e2e8f0",
  },
  ".cm-completionDetail": {
    color: "#64748b !important",
    marginLeft: "12px !important",
    fontStyle: "normal !important",
    fontSize: "11px !important",
  },
  ".cm-completionIcon": {
    width: "16px !important",
    marginRight: "8px !important",
  },
  ".cm-completion-note .cm-completionIcon::after": {
    content: "'📄'",
  },
  ".cm-completion-tag .cm-completionIcon::after": {
    content: "'#'",
    color: "#6366f1",
    fontWeight: "bold",
  },
  ".cm-completion-mention .cm-completionIcon::after": {
    content: "'@'",
    color: "#22c55e",
    fontWeight: "bold",
  },
};

// Force a cache refresh (useful when notes are added/modified)
export function invalidateAutocompleteCache() {
  lastCacheUpdate = 0;
}
