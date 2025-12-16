import { useDiagramStore } from "./store";

const DiagramIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 7v10M7 12h10"
    />
  </svg>
);

export function DiagramSidebar() {
  const { boards, toggleView } = useDiagramStore();

  return (
    <div className="px-4 py-2">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded-lg transition-colors"
        onClick={toggleView}
      >
        <DiagramIcon />
        <span className="text-sm">Diagrams</span>
        {boards.length > 0 && (
          <span className="ml-auto text-xs text-dark-500">{boards.length}</span>
        )}
      </button>
    </div>
  );
}
