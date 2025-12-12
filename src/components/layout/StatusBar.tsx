import { useNoteStore } from "@/stores/noteStore";
import { useVaultStore } from "@/stores/vaultStore";
import { GitStatusBar } from "@/plugins/builtin/git/GitStatusBar";

const SaveIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const UnsavedIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4" />
  </svg>
);

export function StatusBar() {
  const { vault } = useVaultStore();
  const { currentNote, hasUnsavedChanges, isSaving, saveNote, editorContent } = useNoteStore();

  // Count words and characters
  const wordCount = editorContent.trim() ? editorContent.trim().split(/\s+/).length : 0;
  const charCount = editorContent.length;

  return (
    <div className="h-6 bg-dark-900 border-t border-dark-800 px-4 flex items-center justify-between text-xs text-dark-500">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {vault && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent-success" />
            {vault.name}
          </span>
        )}

        {currentNote && (
          <span className="text-dark-400">{currentNote.path}</span>
        )}

        {/* Git status */}
        <GitStatusBar />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {currentNote && (
          <>
            <span>{wordCount} words</span>
            <span>{charCount} chars</span>

            {/* Save status */}
            {isSaving ? (
              <span className="flex items-center gap-1 text-accent-warning">
                Saving...
              </span>
            ) : hasUnsavedChanges ? (
              <button
                className="flex items-center gap-1 text-accent-warning hover:text-accent-primary"
                onClick={saveNote}
                title="Save (Ctrl+S)"
              >
                <UnsavedIcon />
                Unsaved
              </button>
            ) : (
              <span className="flex items-center gap-1 text-accent-success">
                <SaveIcon />
                Saved
              </span>
            )}
          </>
        )}

        <span>Kairo v0.1.0</span>
      </div>
    </div>
  );
}
