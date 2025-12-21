import { usePaneStore } from "@/stores/paneStore";

interface PaneEmptyStateProps {
  paneId: string;
}

export function PaneEmptyState({ paneId }: PaneEmptyStateProps) {
  const setActivePane = usePaneStore((s) => s.setActivePane);
  const activePaneId = usePaneStore((s) => s.activePaneId);
  const isActive = activePaneId === paneId;

  const handleClick = () => {
    setActivePane(paneId);
  };

  return (
    <div
      className="h-full flex items-center justify-center cursor-pointer"
      onClick={handleClick}
    >
      <div className="text-center">
        <div className="text-5xl mb-4 opacity-50">📄</div>
        <h2 className="text-lg font-medium text-dark-300 mb-2">No note selected</h2>
        <p className="text-sm text-dark-500 mb-4">
          Select a note from the sidebar
        </p>
        <div className="text-xs text-dark-600">
          <kbd className="px-2 py-1 bg-dark-800 rounded">Ctrl+K</kbd> to search
        </div>
        {isActive && (
          <div className="mt-4 text-xs text-accent-primary">
            This pane is active
          </div>
        )}
      </div>
    </div>
  );
}
