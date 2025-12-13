import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { completionKeymap } from "@codemirror/autocomplete";
import { kairoAutocompletion, autocompleteTheme } from "@/components/editor/autocomplete";
import { useNoteStore } from "@/stores/noteStore";

// Extract wiki-link at a position in the document
function getWikiLinkAtPos(doc: string, pos: number): string | null {
  let start = pos;
  while (start > 0 && doc.slice(start - 2, start) !== "[[") {
    start--;
    if (doc[start] === "\n" || doc[start] === "]") return null;
  }
  if (start <= 0) return null;
  start -= 2;

  let end = pos;
  while (end < doc.length && doc.slice(end, end + 2) !== "]]") {
    end++;
    if (doc[end] === "\n" || doc[end] === "[") return null;
  }
  if (end >= doc.length) return null;
  end += 2;

  const linkText = doc.slice(start + 2, end - 2);
  const pipeIndex = linkText.indexOf("|");
  return pipeIndex >= 0 ? linkText.slice(0, pipeIndex) : linkText;
}

// Card editor theme - similar to main editor but optimized for smaller context
const cardEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#0f172a",
      color: "#e2e8f0",
    },
    ".cm-content": {
      caretColor: "#6366f1",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: "13px",
      lineHeight: "1.5",
      padding: "12px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#6366f1",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(99, 102, 241, 0.2)",
      },
    ".cm-scroller": {
      overflow: "auto",
    },
    ".cm-placeholder": {
      color: "#475569",
      fontStyle: "italic",
    },
    // Markdown styling
    ".cm-header-1": { fontSize: "1.4em", fontWeight: "bold", color: "#f8fafc" },
    ".cm-header-2": { fontSize: "1.2em", fontWeight: "bold", color: "#f1f5f9" },
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
    // Autocomplete styling
    ...autocompleteTheme,
  },
  { dark: true }
);

interface CardMarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export function CardMarkdownEditor({
  content,
  onChange,
  onBlur,
  placeholder = "Write markdown content...",
  minHeight = "200px",
  className = "",
}: CardMarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);
  const { openNoteByReference } = useNoteStore();

  // Keep content ref updated
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Handle Ctrl+Click to follow wiki-links
  const handleLinkClick = useCallback(
    (view: EditorView, event: MouseEvent) => {
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
    },
    [openNoteByReference]
  );

  // Create editor on mount
  useEffect(() => {
    if (!editorRef.current) return;

    // Clean up previous editor
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const state = EditorState.create({
      doc: content,
      extensions: [
        // History (undo/redo)
        history(),

        // Bracket matching
        bracketMatching(),

        // Selection highlight
        highlightSelectionMatches(),

        // Placeholder
        placeholderExt(placeholder),

        // Markdown support
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),

        // Syntax highlighting
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

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
        cardEditorTheme,

        // Height configuration
        EditorView.theme({
          "&": { minHeight },
          ".cm-scroller": { overflow: "auto" },
        }),

        // Update listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            contentRef.current = newContent;
            onChange(newContent);
          }
        }),

        // Blur handler
        EditorView.domEventHandlers({
          blur: () => {
            onBlur?.();
            return false;
          },
          click: (event, view) => handleLinkClick(view, event),
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [placeholder, minHeight]); // Only recreate when config changes

  // Update content when it changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== content) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
        });
      }
    }
  }, [content]);

  return (
    <div
      ref={editorRef}
      className={`overflow-hidden rounded-lg border border-dark-700 bg-dark-900 ${className}`}
    />
  );
}
