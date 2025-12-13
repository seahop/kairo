import { useEffect, useCallback, useState, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { MarkdownPane } from "./MarkdownPane";
import { PreviewPane } from "./PreviewPane";
import { ImageUpload } from "./ImageUpload";
import { useNoteStore } from "@/stores/noteStore";
import { useUIStore, EditorViewMode } from "@/stores/uiStore";

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
      <div className="px-3 py-1.5 text-xs text-dark-500">
        Right-click to change view
      </div>
    </div>
  );
}

export function Editor() {
  const { saveNote, hasUnsavedChanges } = useNoteStore();
  const { editorViewMode, setEditorViewMode, editorSplitRatio, setEditorSplitRatio } = useUIStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);

  // Keyboard shortcut for save
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges) {
          saveNote();
        }
      }
    },
    [saveNote, hasUnsavedChanges]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
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
        <div className="flex items-center gap-3">
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
    </div>
  );
}
