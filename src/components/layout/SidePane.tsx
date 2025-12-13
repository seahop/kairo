import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useKanbanStore, KanbanCard } from "@/plugins/builtin/kanban/store";
import { invoke } from "@tauri-apps/api/core";

// Close icon
const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Card icon
const CardIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

// Card detail content component
function CardDetailContent({ cardId, boardId }: { cardId: string; boardId: string }) {
  const { loadBoard } = useKanbanStore();
  const [card, setCard] = useState<KanbanCard | null>(null);
  const [columnName, setColumnName] = useState<string>("");
  const [boardName, setBoardName] = useState<string>("");

  useEffect(() => {
    const loadCardData = async () => {
      // Load the board if needed
      await loadBoard(boardId);

      // Get fresh state
      const state = useKanbanStore.getState();
      const foundCard = state.cards.find((c: KanbanCard) => c.id === cardId);
      if (foundCard) {
        setCard(foundCard);
        // Columns are on the currentBoard
        const col = state.currentBoard?.columns.find((c: { id: string; name: string }) => c.id === foundCard.columnId);
        setColumnName(col?.name || "Unknown");
      }

      // Get board name from currentBoard
      if (state.currentBoard) {
        setBoardName(state.currentBoard.name);
      } else {
        // Fallback: get from boards list
        try {
          const boards = await invoke<{ id: string; name: string }[]>("kanban_get_boards");
          const board = boards.find((b: { id: string }) => b.id === boardId);
          setBoardName(board?.name || "Unknown Board");
        } catch {
          setBoardName("Unknown Board");
        }
      }
    };

    loadCardData();
  }, [cardId, boardId, loadBoard]);

  if (!card) {
    return (
      <div className="p-4 text-dark-400 text-center">
        Loading card...
      </div>
    );
  }

  // Priority colors
  const priorityColors: Record<string, string> = {
    urgent: "text-red-400 bg-red-400/10",
    high: "text-orange-400 bg-orange-400/10",
    medium: "text-yellow-400 bg-yellow-400/10",
    low: "text-blue-400 bg-blue-400/10",
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-dark-500">
          <span>{boardName}</span>
          <span>/</span>
          <span className="px-2 py-0.5 bg-dark-700 rounded">{columnName}</span>
        </div>
        <h2 className="text-lg font-semibold text-dark-100">{card.title}</h2>
      </div>

      {/* Priority */}
      {card.priority && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Priority:</span>
          <span className={`px-2 py-0.5 text-xs rounded capitalize ${priorityColors[card.priority] || "text-dark-400 bg-dark-700"}`}>
            {card.priority}
          </span>
        </div>
      )}

      {/* Due date */}
      {card.dueDate && (
        <div className="text-sm">
          <span className="text-dark-500">Due: </span>
          <span className="text-dark-200">
            {new Date(card.dueDate).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Linked note */}
      {card.notePath && (
        <div className="text-sm">
          <span className="text-dark-500">Linked Note: </span>
          <span className="text-accent-primary">{card.notePath}</span>
        </div>
      )}

      {/* Description */}
      {card.description && (
        <div className="space-y-1">
          <div className="text-xs text-dark-500 uppercase">Description</div>
          <div className="text-sm text-dark-300 whitespace-pre-wrap bg-dark-800 rounded p-3">
            {card.description}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-dark-600 space-y-1 pt-4 border-t border-dark-700">
        <div>Created: {new Date(card.createdAt).toLocaleString()}</div>
        <div>Updated: {new Date(card.updatedAt).toLocaleString()}</div>
        {card.closedAt && <div>Closed: {new Date(card.closedAt).toLocaleString()}</div>}
      </div>
    </div>
  );
}

export function SidePane() {
  const { sidePaneContent, closeSidePane } = useUIStore();

  if (!sidePaneContent) return null;

  const getTitle = () => {
    switch (sidePaneContent.type) {
      case "card":
        return "Card Details";
      case "backlinks":
        return "Backlinks";
      case "outline":
        return "Outline";
      default:
        return "Details";
    }
  };

  const getIcon = () => {
    switch (sidePaneContent.type) {
      case "card":
        return <CardIcon />;
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (sidePaneContent.type) {
      case "card":
        return (
          <CardDetailContent
            cardId={sidePaneContent.cardId}
            boardId={sidePaneContent.boardId}
          />
        );
      case "backlinks":
        return (
          <div className="p-4 text-dark-400">
            Backlinks for note coming soon...
          </div>
        );
      case "outline":
        return (
          <div className="p-4 text-dark-400">
            Outline coming soon...
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-900 border-l border-dark-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
        <div className="flex items-center gap-2 text-dark-200">
          {getIcon()}
          <span className="text-sm font-medium">{getTitle()}</span>
        </div>
        <button
          onClick={closeSidePane}
          className="p-1 hover:bg-dark-700 rounded transition-colors text-dark-400 hover:text-dark-200"
          title="Close panel"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
