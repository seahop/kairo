import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, HighlightStyle, bracketMatching } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { completionKeymap } from "@codemirror/autocomplete";
import { useNoteStore } from "@/stores/noteStore";
import { kairoAutocompletion, autocompleteTheme } from "./autocomplete";

// Extract wiki-link at a position in the document
function getWikiLinkAtPos(doc: string, pos: number): string | null {
  // Look backwards for [[
  let start = pos;
  while (start > 0 && doc.slice(start - 2, start) !== "[[") {
    start--;
    if (doc[start] === "\n" || doc[start] === "]") return null;
  }
  if (start <= 0) return null;
  start -= 2;

  // Look forwards for ]]
  let end = pos;
  while (end < doc.length && doc.slice(end, end + 2) !== "]]") {
    end++;
    if (doc[end] === "\n" || doc[end] === "[") return null;
  }
  if (end >= doc.length) return null;
  end += 2;

  // Extract the link content
  const linkText = doc.slice(start + 2, end - 2);

  // Handle display text syntax [[path|display]]
  const pipeIndex = linkText.indexOf("|");
  return pipeIndex >= 0 ? linkText.slice(0, pipeIndex) : linkText;
}

// Custom dark theme
const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#020617",
      color: "#e2e8f0",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "#6366f1",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: "14px",
      lineHeight: "1.6",
      padding: "16px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#6366f1",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(99, 102, 241, 0.2)",
      },
    ".cm-activeLine": {
      backgroundColor: "rgba(30, 41, 59, 0.5)",
    },
    ".cm-gutters": {
      backgroundColor: "#020617",
      color: "#475569",
      border: "none",
      borderRight: "1px solid #1e293b",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(30, 41, 59, 0.5)",
      color: "#94a3b8",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 12px",
      minWidth: "40px",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    // Markdown-specific styling
    ".cm-header-1": { fontSize: "1.5em", fontWeight: "bold", color: "#f8fafc" },
    ".cm-header-2": { fontSize: "1.3em", fontWeight: "bold", color: "#f1f5f9" },
    ".cm-header-3": { fontSize: "1.1em", fontWeight: "bold", color: "#e2e8f0" },
    ".cm-link": { color: "#818cf8", textDecoration: "underline" },
    ".cm-url": { color: "#cbd5e1" },
    ".cm-string": { color: "#cbd5e1" },
    ".cmt-string": { color: "#cbd5e1" },
    ".cmt-url": { color: "#cbd5e1" },
    ".tok-string": { color: "#cbd5e1" },
    ".cm-strong": { fontWeight: "bold", color: "#f8fafc" },
    ".cm-emphasis": { fontStyle: "italic" },
    ".cm-strikethrough": { textDecoration: "line-through" },
    ".cm-code": {
      backgroundColor: "#1e293b",
      padding: "2px 4px",
      borderRadius: "4px",
      fontFamily: "'JetBrains Mono', monospace",
    },
    // Autocomplete styling
    ...autocompleteTheme,
  },
  { dark: true }
);

// Custom highlight style for dark theme with readable colors
const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.link, color: "#818cf8", textDecoration: "underline" },
  { tag: tags.url, color: "#e2e8f0" },
  { tag: tags.string, color: "#e2e8f0" },
  { tag: tags.heading1, color: "#f8fafc", fontWeight: "bold", fontSize: "1.5em" },
  { tag: tags.heading2, color: "#f1f5f9", fontWeight: "bold", fontSize: "1.3em" },
  { tag: tags.heading3, color: "#e2e8f0", fontWeight: "bold", fontSize: "1.1em" },
  { tag: tags.strong, color: "#f8fafc", fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.keyword, color: "#c084fc" },
  { tag: tags.comment, color: "#64748b", fontStyle: "italic" },
  { tag: tags.monospace, color: "#e2e8f0" },
  { tag: tags.labelName, color: "#f472b6" },
  { tag: tags.processingInstruction, color: "#94a3b8" },
]);

export function MarkdownPane() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { currentNote, editorContent, setEditorContent, openNoteByReference } = useNoteStore();

  // Handle Ctrl+Click to follow wiki-links
  const handleLinkClick = useCallback((view: EditorView, event: MouseEvent) => {
    // Check if Ctrl (or Cmd on Mac) is pressed
    if (!event.ctrlKey && !event.metaKey) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const doc = view.state.doc.toString();
    const linkTarget = getWikiLinkAtPos(doc, pos);

    if (linkTarget) {
      event.preventDefault();
      openNoteByReference(linkTarget);
      return true;
    }

    return false;
  }, [openNoteByReference]);

  // Create editor on mount
  useEffect(() => {
    if (!editorRef.current || !currentNote) return;

    // Clean up previous editor
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const state = EditorState.create({
      doc: editorContent,
      extensions: [
        // Line numbers and active line
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),

        // History (undo/redo)
        history(),

        // Bracket matching
        bracketMatching(),

        // Selection highlight
        highlightSelectionMatches(),

        // Markdown support
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),

        // Syntax highlighting with custom dark theme colors
        syntaxHighlighting(darkHighlightStyle),

        // Kairo autocompletion (wiki-links, tags, mentions)
        kairoAutocompletion,

        // Keymaps
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
        ]),

        // Theme
        darkTheme,

        // Update listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setEditorContent(update.state.doc.toString());
          }
        }),

        // Make editor fill container
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),

        // DOM event handlers for links
        EditorView.domEventHandlers({
          click: (event, view) => handleLinkClick(view, event),
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Focus the editor
    view.focus();

    return () => {
      view.destroy();
    };
  }, [currentNote?.id, handleLinkClick]); // Only recreate when note changes

  // Update content when it changes externally
  useEffect(() => {
    if (viewRef.current && currentNote) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== editorContent) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: editorContent,
          },
        });
      }
    }
  }, [currentNote?.content]);

  return (
    <div className="h-full overflow-hidden">
      <div ref={editorRef} className="h-full" />
    </div>
  );
}
