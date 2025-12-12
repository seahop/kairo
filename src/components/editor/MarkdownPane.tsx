import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { useNoteStore } from "@/stores/noteStore";

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
    ".cm-link": { color: "#6366f1", textDecoration: "underline" },
    ".cm-url": { color: "#64748b" },
    ".cm-strong": { fontWeight: "bold", color: "#f8fafc" },
    ".cm-emphasis": { fontStyle: "italic" },
    ".cm-strikethrough": { textDecoration: "line-through" },
    ".cm-code": {
      backgroundColor: "#1e293b",
      padding: "2px 4px",
      borderRadius: "4px",
      fontFamily: "'JetBrains Mono', monospace",
    },
  },
  { dark: true }
);

export function MarkdownPane() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { currentNote, editorContent, setEditorContent } = useNoteStore();

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

        // Syntax highlighting
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

        // Autocompletion
        autocompletion(),

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
  }, [currentNote?.id]); // Only recreate when note changes

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

  return <div ref={editorRef} className="h-full overflow-hidden" />;
}
