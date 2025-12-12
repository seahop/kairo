import { useKanbanStore } from "./store";

const KanbanIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

export function KanbanSidebar() {
  const { boards, toggleView } = useKanbanStore();

  return (
    <div className="px-4 py-2">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded-lg transition-colors"
        onClick={toggleView}
      >
        <KanbanIcon />
        <span className="text-sm">Kanban Boards</span>
        {boards.length > 0 && (
          <span className="ml-auto text-xs text-dark-500">{boards.length}</span>
        )}
      </button>
    </div>
  );
}
