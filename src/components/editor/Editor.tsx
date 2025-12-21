import { useEffect, useCallback, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { MarkdownPane } from "./MarkdownPane";
import { PreviewPane } from "./PreviewPane";
import { ImageUpload } from "./ImageUpload";
import { NoteHistory } from "./NoteHistory";
import { VersionHistory } from "./VersionHistory";
import { TableEditorModal } from "./table/TableEditorModal";
import { useNoteStore } from "@/stores/noteStore";
import { usePaneStore } from "@/stores/paneStore";
import { useUIStore, EditorViewMode } from "@/stores/uiStore";
import { useTableEditorStore } from "@/stores/tableEditorStore";
import { addToCustomDictionary } from "./spellcheck";

// View mode icons
const EditorOnlyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const PreviewOnlyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const SplitViewIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Navigation icons
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ForwardIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const UndoIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const RedoIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const VersionsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

const TableIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h18M3 14h18M3 6h18M3 18h18M9 6v12M15 6v12"
    />
  </svg>
);

const SpellcheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ReadingModeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

// Pane icons
const SplitRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const SplitDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const ClosePaneIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  currentMode: EditorViewMode;
  onSetMode: (mode: EditorViewMode) => void;
  misspelledWord?: string;
  onIgnoreWord?: (word: string) => void;
  // Pane options
  paneId?: string;
  onSplitRight?: () => void;
  onSplitDown?: () => void;
  onClosePane?: () => void;
  canClosePane?: boolean;
}

function ContextMenu({ x, y, onClose, currentMode, onSetMode, misspelledWord, onIgnoreWord, paneId, onSplitRight, onSplitDown, onClosePane, canClosePane }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  // Adjust position to prevent menu from being cut off at window edges
  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const padding = 8; // Padding from window edge

      let newX = x;
      let newY = y;

      // Check right edge
      if (x + rect.width > window.innerWidth - padding) {
        newX = window.innerWidth - rect.width - padding;
      }

      // Check bottom edge
      if (y + rect.height > window.innerHeight - padding) {
        newY = window.innerHeight - rect.height - padding;
      }

      // Ensure we don't go off the left or top edges
      newX = Math.max(padding, newX);
      newY = Math.max(padding, newY);

      setPosition({ x: newX, y: newY });
    } else {
      // Before ref is available, use raw coordinates
      setPosition({ x, y });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleSelect = (mode: EditorViewMode) => {
    onSetMode(mode);
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed bg-dark-850 border border-dark-700 rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
      style={{ left: position.x, top: position.y }}
    >
      {/* Spell check option - only shown when right-clicking a misspelled word */}
      {misspelledWord && onIgnoreWord && (
        <>
          <div className="px-3 py-1.5 text-xs text-dark-500 uppercase tracking-wide">
            Spelling
          </div>
          <button
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 text-dark-200"
            onClick={() => { onIgnoreWord(misspelledWord); onClose(); }}
          >
            <span className="text-green-400">✓</span>
            <span>Ignore "{misspelledWord}"</span>
          </button>
          <div className="border-t border-dark-700 my-1" />
        </>
      )}
      <div className="px-3 py-1.5 text-xs text-dark-500 uppercase tracking-wide">
        View Mode
      </div>
      <button
        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 ${
          currentMode === "editor" ? "text-accent-primary" : "text-dark-200"
        }`}
        onClick={() => handleSelect("editor")}
      >
        <EditorOnlyIcon />
        <span>Editor Only</span>
        {currentMode === "editor" && <span className="ml-auto text-xs">✓</span>}
      </button>
      <button
        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 ${
          currentMode === "preview" ? "text-accent-primary" : "text-dark-200"
        }`}
        onClick={() => handleSelect("preview")}
      >
        <PreviewOnlyIcon />
        <span>Preview Only</span>
        {currentMode === "preview" && <span className="ml-auto text-xs">✓</span>}
      </button>
      <button
        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 ${
          currentMode === "split" ? "text-accent-primary" : "text-dark-200"
        }`}
        onClick={() => handleSelect("split")}
      >
        <SplitViewIcon />
        <span>Split View</span>
        {currentMode === "split" && <span className="ml-auto text-xs">✓</span>}
      </button>
      <div className="border-t border-dark-700 my-1" />
      <div className="px-3 py-1.5 text-xs text-dark-500 uppercase tracking-wide">
        Edit
      </div>
      <button
        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 text-dark-200"
        onClick={() => { document.execCommand("cut"); onClose(); }}
      >
        <span>✂️</span>
        <span>Cut</span>
        <span className="ml-auto text-xs text-dark-500">Ctrl+X</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 text-dark-200"
        onClick={() => { document.execCommand("copy"); onClose(); }}
      >
        <span>📋</span>
        <span>Copy</span>
        <span className="ml-auto text-xs text-dark-500">Ctrl+C</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 text-dark-200"
        onClick={() => { document.execCommand("paste"); onClose(); }}
      >
        <span>📄</span>
        <span>Paste</span>
        <span className="ml-auto text-xs text-dark-500">Ctrl+V</span>
      </button>
      <button
        className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 text-dark-200"
        onClick={() => { document.execCommand("selectAll"); onClose(); }}
      >
        <span>📝</span>
        <span>Select All</span>
        <span className="ml-auto text-xs text-dark-500">Ctrl+A</span>
      </button>
      {/* Pane section - only show when in pane context */}
      {paneId && (
        <>
          <div className="border-t border-dark-700 my-1" />
          <div className="px-3 py-1.5 text-xs text-dark-500 uppercase tracking-wide">
            Pane
          </div>
          <button
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 text-dark-200"
            onClick={() => { onSplitRight?.(); onClose(); }}
          >
            <SplitRightIcon />
            <span>Split Right</span>
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-dark-800 text-dark-200"
            onClick={() => { onSplitDown?.(); onClose(); }}
          >
            <SplitDownIcon />
            <span>Split Down</span>
          </button>
          <button
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
              canClosePane ? "hover:bg-dark-800 text-dark-200" : "text-dark-600 cursor-not-allowed"
            }`}
            onClick={() => { if (canClosePane) { onClosePane?.(); onClose(); } }}
            disabled={!canClosePane}
          >
            <ClosePaneIcon />
            <span>Close Pane</span>
          </button>
        </>
      )}
    </div>,
    document.body
  );
}

interface EditorProps {
  paneId?: string;
}

export function Editor({ paneId }: EditorProps) {
  // NoteStore (fallback for non-pane context)
  const noteStoreState = useNoteStore();

  // PaneStore (for pane context)
  const paneStoreState = usePaneStore();
  const pane = paneId ? paneStoreState.findPane(paneId) : null;

  // Derive state based on context
  const hasUnsavedChanges = pane ? pane.hasUnsavedChanges : noteStoreState.hasUnsavedChanges;
  const editorContent = pane ? pane.editorContent : noteStoreState.editorContent;
  const currentNote = pane ? pane.note : noteStoreState.currentNote;
  const viewMode = pane ? pane.viewMode : undefined;

  // Save function based on context
  const handleSave = useCallback(() => {
    if (paneId) {
      paneStoreState.savePaneNote(paneId);
    } else {
      noteStoreState.saveNote();
    }
  }, [paneId, paneStoreState, noteStoreState]);

  // Set content function based on context
  const handleSetContent = useCallback((content: string) => {
    if (paneId) {
      paneStoreState.setPaneContent(paneId, content);
    } else {
      noteStoreState.setEditorContent(content);
    }
  }, [paneId, paneStoreState, noteStoreState]);

  // Navigation functions based on context
  const goBack = useCallback(() => {
    if (paneId) {
      paneStoreState.goBackInPane(paneId);
    } else {
      noteStoreState.goBack();
    }
  }, [paneId, paneStoreState, noteStoreState]);

  const goForward = useCallback(() => {
    if (paneId) {
      paneStoreState.goForwardInPane(paneId);
    } else {
      noteStoreState.goForward();
    }
  }, [paneId, paneStoreState, noteStoreState]);

  const canGoBack = paneId
    ? paneStoreState.canGoBackInPane(paneId)
    : noteStoreState.canGoBack();

  const canGoForward = paneId
    ? paneStoreState.canGoForwardInPane(paneId)
    : noteStoreState.canGoForward();

  // Pane actions
  const handleSplitRight = useCallback(() => {
    if (paneId) {
      paneStoreState.splitPane(paneId, 'horizontal');
    }
  }, [paneId, paneStoreState]);

  const handleSplitDown = useCallback(() => {
    if (paneId) {
      paneStoreState.splitPane(paneId, 'vertical');
    }
  }, [paneId, paneStoreState]);

  const handleClosePane = useCallback(() => {
    if (paneId) {
      paneStoreState.closePane(paneId);
    }
  }, [paneId, paneStoreState]);

  const canClosePane = paneId ? paneStoreState.getLeafCount() > 1 : false;

  const { editorViewMode: globalEditorViewMode, setEditorViewMode: setGlobalEditorViewMode, editorSplitRatio, setEditorSplitRatio, spellcheckEnabled, toggleSpellcheck, readingFontSize, setReadingFontSize, readingWidth, setReadingWidth } = useUIStore();

  // Use pane-specific view mode if available, otherwise global
  const editorViewMode = viewMode ?? globalEditorViewMode;
  const setEditorViewMode = useCallback((mode: EditorViewMode) => {
    if (paneId) {
      paneStoreState.setPaneViewMode(paneId, mode);
    } else {
      setGlobalEditorViewMode(mode);
    }
  }, [paneId, paneStoreState, setGlobalEditorViewMode]);

  const { openEditor } = useTableEditorStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; misspelledWord?: string } | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReadingSettings, setShowReadingSettings] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const readingSettingsRef = useRef<HTMLDivElement>(null);

  // Close reading settings dropdown when clicking outside
  useEffect(() => {
    if (!showReadingSettings) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (readingSettingsRef.current && !readingSettingsRef.current.contains(e.target as Node)) {
        setShowReadingSettings(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReadingSettings]);

  // Open table editor with a new table (insert at cursor or end)
  const handleInsertTable = useCallback(() => {
    openEditor(
      null, // null creates a new empty table
      0,
      0,
      (markdown: string) => {
        // Insert the table at the end of the content (or could insert at cursor)
        const newContent = editorContent.trim()
          ? `${editorContent}\n\n${markdown}\n`
          : `${markdown}\n`;
        handleSetContent(newContent);
      }
    );
  }, [editorContent, handleSetContent, openEditor]);

  // Check navigation state
  const canNavigateBack = canGoBack;
  const canNavigateForward = canGoForward;

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Save: Ctrl/Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSave();
        }
      }
      // Navigate back: Alt + Left Arrow
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
      // Navigate forward: Alt + Right Arrow
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      }
      // Version history: Ctrl/Cmd + Shift + H
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "H") {
        e.preventDefault();
        if (currentNote) {
          setShowVersionHistory(prev => !prev);
        }
      }
    },
    [handleSave, hasUnsavedChanges, goBack, goForward, currentNote]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Don't show Editor's context menu if clicking on a link in the preview pane
    // (they have their own context menus)
    // Check for data attributes and external links
    const isPreviewLink = target.closest(
      'a[data-wiki-link], a[data-card-link], a[data-diagram-link], a[data-block-ref], a[href^="http"]'
    );
    if (isPreviewLink) {
      // Let the link's own context menu handler deal with it
      return;
    }

    e.preventDefault();

    // Check if clicking on a misspelled word
    let misspelledWord: string | undefined;
    const spellErrorEl = target.closest('.cm-spell-error') as HTMLElement | null;
    if (spellErrorEl) {
      misspelledWord = spellErrorEl.textContent?.trim();
    }

    setContextMenu({ x: e.clientX, y: e.clientY, misspelledWord });
  };

  // Handle ignoring a word from spell check
  const handleIgnoreWord = useCallback((word: string) => {
    addToCustomDictionary(word);
    // Force a re-render of the editor to update decorations
    // We can do this by dispatching a custom event that MarkdownPane can listen to
    window.dispatchEvent(new CustomEvent("spellcheck:refresh"));
  }, []);

  const renderContent = () => {
    switch (editorViewMode) {
      case "editor":
        return <MarkdownPane paneId={paneId} content={editorContent} onContentChange={handleSetContent} />;
      case "preview":
        return <PreviewPane paneId={paneId} content={editorContent} />;
      case "split":
      default:
        return (
          <PanelGroup
            direction="horizontal"
            onLayout={(sizes) => {
              if (sizes[0]) {
                setEditorSplitRatio(sizes[0]);
              }
            }}
          >
            <Panel defaultSize={editorSplitRatio} minSize={20}>
              <MarkdownPane paneId={paneId} content={editorContent} onContentChange={handleSetContent} />
            </Panel>
            <PanelResizeHandle className="w-1 bg-dark-800 hover:bg-accent-primary transition-colors cursor-col-resize" />
            <Panel minSize={20}>
              <PreviewPane paneId={paneId} content={editorContent} />
            </Panel>
          </PanelGroup>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-dark-800 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent">
          {/* Navigation buttons */}
          <div className="flex items-center gap-0.5 mr-2 flex-shrink-0">
            <button
              className={`btn-icon p-1.5 rounded ${
                canNavigateBack
                  ? "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
                  : "text-dark-600 cursor-not-allowed"
              }`}
              onClick={goBack}
              disabled={!canNavigateBack}
              title="Go back (Alt+Left)"
            >
              <BackIcon />
            </button>
            <button
              className={`btn-icon p-1.5 rounded ${
                canNavigateForward
                  ? "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
                  : "text-dark-600 cursor-not-allowed"
              }`}
              onClick={goForward}
              disabled={!canNavigateForward}
              title="Go forward (Alt+Right)"
            >
              <ForwardIcon />
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-dark-700 mr-2 flex-shrink-0" />

          {/* Undo/Redo buttons */}
          <div className="flex items-center gap-0.5 mr-2 flex-shrink-0">
            <button
              className="btn-icon p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-800"
              onClick={() => window.dispatchEvent(new CustomEvent("editor:undo"))}
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon />
            </button>
            <button
              className="btn-icon p-1.5 rounded text-dark-400 hover:text-dark-200 hover:bg-dark-800"
              onClick={() => window.dispatchEvent(new CustomEvent("editor:redo"))}
              title="Redo (Ctrl+Y)"
            >
              <RedoIcon />
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-dark-700 mr-2 flex-shrink-0" />

          <div className="text-xs text-dark-500 flex-shrink-0 whitespace-nowrap">
            {editorViewMode === "editor" && "Editor"}
            {editorViewMode === "preview" && "Preview"}
            {editorViewMode === "split" && "Split View"}
          </div>

          {/* Upload image button */}
          <button
            className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs flex-shrink-0 whitespace-nowrap ${
              showImageUpload
                ? "bg-accent-primary/20 text-accent-primary"
                : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
            }`}
            onClick={() => setShowImageUpload(!showImageUpload)}
            title="Upload image"
          >
            <ImageIcon />
            <span className="hidden sm:inline">Upload Image</span>
          </button>

          {/* Git History button */}
          {currentNote && (
            <button
              className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs flex-shrink-0 whitespace-nowrap ${
                showHistory
                  ? "bg-accent-primary/20 text-accent-primary"
                  : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
              }`}
              onClick={() => setShowHistory(!showHistory)}
              title="View git history"
            >
              <HistoryIcon />
              <span className="hidden sm:inline">Git</span>
            </button>
          )}

          {/* Version History button */}
          {currentNote && (
            <button
              className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs flex-shrink-0 whitespace-nowrap ${
                showVersionHistory
                  ? "bg-accent-primary/20 text-accent-primary"
                  : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
              }`}
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              title="View snapshots (Ctrl+Shift+H)"
            >
              <VersionsIcon />
              <span className="hidden sm:inline">Versions</span>
            </button>
          )}

          {/* Insert table button */}
          <button
            className="btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs flex-shrink-0 whitespace-nowrap text-dark-400 hover:text-dark-200 hover:bg-dark-800"
            onClick={handleInsertTable}
            title="Insert table (or type /table)"
          >
            <TableIcon />
            <span className="hidden sm:inline">Table</span>
          </button>

          {/* Spellcheck toggle */}
          <button
            className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs flex-shrink-0 whitespace-nowrap ${
              spellcheckEnabled
                ? "bg-green-500/20 text-green-400"
                : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
            }`}
            onClick={toggleSpellcheck}
            title={spellcheckEnabled ? "Disable spellcheck" : "Enable spellcheck"}
          >
            <SpellcheckIcon />
            <span className="hidden sm:inline">Spell</span>
          </button>

          {/* Reading mode settings */}
          <div ref={readingSettingsRef} className="relative flex-shrink-0">
            <button
              className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs whitespace-nowrap ${
                showReadingSettings
                  ? "bg-accent-primary/20 text-accent-primary"
                  : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
              }`}
              onClick={() => setShowReadingSettings(!showReadingSettings)}
              title="Reading mode settings"
            >
              <ReadingModeIcon />
              <span className="hidden sm:inline">Reading</span>
            </button>
            {showReadingSettings && (
              <div className="absolute top-full left-0 mt-1 bg-dark-850 border border-dark-700 rounded-lg shadow-xl py-2 z-50 w-48">
                <div className="px-3 py-1.5 text-xs text-dark-500 uppercase tracking-wide">Font Size</div>
                {(['sm', 'base', 'lg', 'xl'] as const).map((size) => (
                  <button
                    key={size}
                    className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-dark-800 ${
                      readingFontSize === size ? "text-accent-primary" : "text-dark-200"
                    }`}
                    onClick={() => { setReadingFontSize(size); }}
                  >
                    <span className="w-4">{readingFontSize === size ? "✓" : ""}</span>
                    {size === 'sm' ? 'Small' : size === 'base' ? 'Medium' : size === 'lg' ? 'Large' : 'Extra Large'}
                  </button>
                ))}
                <div className="border-t border-dark-700 my-1" />
                <div className="px-3 py-1.5 text-xs text-dark-500 uppercase tracking-wide">Content Width</div>
                {(['narrow', 'medium', 'wide', 'full'] as const).map((width) => (
                  <button
                    key={width}
                    className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-dark-800 ${
                      readingWidth === width ? "text-accent-primary" : "text-dark-200"
                    }`}
                    onClick={() => { setReadingWidth(width); }}
                  >
                    <span className="w-4">{readingWidth === width ? "✓" : ""}</span>
                    {width.charAt(0).toUpperCase() + width.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* View mode buttons */}
        <div className="flex items-center gap-1 bg-dark-850 rounded-lg p-0.5 flex-shrink-0">
          <button
            className={`btn-icon p-1.5 rounded ${
              editorViewMode === "editor"
                ? "bg-dark-700 text-accent-primary"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setEditorViewMode("editor")}
            title="Editor only"
          >
            <EditorOnlyIcon />
          </button>
          <button
            className={`btn-icon p-1.5 rounded ${
              editorViewMode === "split"
                ? "bg-dark-700 text-accent-primary"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setEditorViewMode("split")}
            title="Split view"
          >
            <SplitViewIcon />
          </button>
          <button
            className={`btn-icon p-1.5 rounded ${
              editorViewMode === "preview"
                ? "bg-dark-700 text-accent-primary"
                : "text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setEditorViewMode("preview")}
            title="Preview only"
          >
            <PreviewOnlyIcon />
          </button>
        </div>
      </div>

      {/* Image upload panel */}
      {showImageUpload && (
        <div className="border-b border-dark-800 p-4 bg-dark-900">
          <ImageUpload
            onClose={() => setShowImageUpload(false)}
            className="max-w-2xl"
          />
        </div>
      )}

      {/* Editor area with context menu */}
      <div
        className="flex-1 overflow-hidden"
        onContextMenu={handleContextMenu}
      >
        {renderContent()}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          currentMode={editorViewMode}
          onSetMode={setEditorViewMode}
          misspelledWord={contextMenu.misspelledWord}
          onIgnoreWord={handleIgnoreWord}
          paneId={paneId}
          onSplitRight={handleSplitRight}
          onSplitDown={handleSplitDown}
          onClosePane={handleClosePane}
          canClosePane={canClosePane}
        />
      )}

      {/* Note history panel */}
      {showHistory && currentNote && (
        <NoteHistory onClose={() => setShowHistory(false)} />
      )}

      {/* Version history modal */}
      <VersionHistory
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
      />

      {/* Table editor modal */}
      <TableEditorModal />
    </div>
  );
}
