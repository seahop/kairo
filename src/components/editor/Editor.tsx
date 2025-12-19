import { useEffect, useCallback, useState, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { MarkdownPane } from "./MarkdownPane";
import { PreviewPane } from "./PreviewPane";
import { ImageUpload } from "./ImageUpload";
import { NoteHistory } from "./NoteHistory";
import { VersionHistory } from "./VersionHistory";
import { TableEditorModal } from "./table/TableEditorModal";
import { useNoteStore } from "@/stores/noteStore";
import { useUIStore, EditorViewMode } from "@/stores/uiStore";
import { useTableEditorStore } from "@/stores/tableEditorStore";

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

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  currentMode: EditorViewMode;
  onSetMode: (mode: EditorViewMode) => void;
}

function ContextMenu({ x, y, onClose, currentMode, onSetMode }: ContextMenuProps) {
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

      if (newX !== x || newY !== y) {
        setPosition({ x: newX, y: newY });
      }
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

  return (
    <div
      ref={menuRef}
      className="fixed bg-dark-850 border border-dark-700 rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
      style={{ left: position.x, top: position.y }}
    >
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
    </div>
  );
}

export function Editor() {
  const { saveNote, hasUnsavedChanges, goBack, goForward, canGoBack, canGoForward, currentNote, editorContent, setEditorContent } = useNoteStore();
  const { editorViewMode, setEditorViewMode, editorSplitRatio, setEditorSplitRatio, spellcheckEnabled, toggleSpellcheck, readingFontSize, setReadingFontSize, readingWidth, setReadingWidth } = useUIStore();
  const { openEditor } = useTableEditorStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReadingSettings, setShowReadingSettings] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

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
        setEditorContent(newContent);
      }
    );
  }, [editorContent, setEditorContent, openEditor]);

  // Check navigation state
  const canNavigateBack = canGoBack();
  const canNavigateForward = canGoForward();

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Save: Ctrl/Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges) {
          saveNote();
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
    [saveNote, hasUnsavedChanges, goBack, goForward, currentNote]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Offset y to align menu with cursor (accounts for Tauri window chrome + menu padding)
    setContextMenu({ x: e.clientX, y: e.clientY - 16 });
  };

  const renderContent = () => {
    switch (editorViewMode) {
      case "editor":
        return <MarkdownPane />;
      case "preview":
        return <PreviewPane />;
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
              <MarkdownPane />
            </Panel>
            <PanelResizeHandle className="w-1 bg-dark-800 hover:bg-accent-primary transition-colors cursor-col-resize" />
            <Panel minSize={20}>
              <PreviewPane />
            </Panel>
          </PanelGroup>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-dark-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Navigation buttons */}
          <div className="flex items-center gap-0.5 mr-2">
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
          <div className="w-px h-4 bg-dark-700 mr-2" />

          {/* Undo/Redo buttons */}
          <div className="flex items-center gap-0.5 mr-2">
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
          <div className="w-px h-4 bg-dark-700 mr-2" />

          <div className="text-xs text-dark-500">
            {editorViewMode === "editor" && "Editor"}
            {editorViewMode === "preview" && "Preview"}
            {editorViewMode === "split" && "Split View"}
          </div>

          {/* Upload image button */}
          <button
            className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs ${
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
              className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs ${
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
              className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs ${
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
            className="btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs text-dark-400 hover:text-dark-200 hover:bg-dark-800"
            onClick={handleInsertTable}
            title="Insert table (or type /table)"
          >
            <TableIcon />
            <span className="hidden sm:inline">Table</span>
          </button>

          {/* Spellcheck toggle */}
          <button
            className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs ${
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
          <div className="relative">
            <button
              className={`btn-icon p-1.5 rounded flex items-center gap-1.5 text-xs ${
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
        <div className="flex items-center gap-1 bg-dark-850 rounded-lg p-0.5">
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
