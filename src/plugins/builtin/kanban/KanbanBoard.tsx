import { useState, useEffect } from "react";
import { useKanbanStore, KanbanCard, KanbanColumn } from "./store";

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Create Board Modal Component
function CreateBoardModal() {
  const { showCreateModal, closeCreateModal, createBoard, isLoading, error } = useKanbanStore();
  const [boardName, setBoardName] = useState("");
  const [columns, setColumns] = useState("To Do, In Progress, Done");

  if (!showCreateModal) return null;

  const handleCreate = async () => {
    if (boardName.trim()) {
      const columnList = columns.split(",").map(c => c.trim()).filter(c => c);
      await createBoard(boardName.trim(), columnList.length > 0 ? columnList : undefined);
      setBoardName("");
      setColumns("To Do, In Progress, Done");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={closeCreateModal}>
      <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md border border-dark-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-dark-100 mb-4">Create New Board</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Board Name</label>
            <input
              type="text"
              className="input"
              placeholder="My Board"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-dark-400 mb-1">Columns (comma-separated)</label>
            <input
              type="text"
              className="input"
              placeholder="To Do, In Progress, Done"
              value={columns}
              onChange={(e) => setColumns(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button className="btn-secondary flex-1" onClick={closeCreateModal} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="btn-primary flex-1"
            onClick={handleCreate}
            disabled={!boardName.trim() || isLoading}
          >
            {isLoading ? "Creating..." : "Create Board"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CardProps {
  card: KanbanCard;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function Card({ card, onDelete, onDragStart }: CardProps) {
  return (
    <div
      className="group px-3 py-2 bg-dark-800 rounded-lg cursor-move hover:bg-dark-700 transition-colors"
      draggable
      onDragStart={onDragStart}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-dark-100">{card.title}</span>
        <button
          className="opacity-0 group-hover:opacity-100 text-dark-500 hover:text-red-400 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <TrashIcon />
        </button>
      </div>
      {card.notePath && (
        <div className="mt-1 text-xs text-dark-500 truncate">{card.notePath}</div>
      )}
    </div>
  );
}

interface ColumnProps {
  column: KanbanColumn;
  cards: KanbanCard[];
  boardId: string;
  onAddCard: (title: string) => void;
  onDeleteCard: (cardId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function Column({ column, cards, onAddCard, onDeleteCard, onDragOver, onDrop }: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");

  const handleAddCard = () => {
    if (newCardTitle.trim()) {
      onAddCard(newCardTitle.trim());
      setNewCardTitle("");
      setIsAdding(false);
    }
  };

  const sortedCards = [...cards].sort((a, b) => a.position - b.position);

  return (
    <div
      className="flex-shrink-0 w-72 bg-dark-900 rounded-lg p-3"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-dark-200">{column.name}</h3>
        <span className="text-xs text-dark-500 bg-dark-800 px-2 py-0.5 rounded">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2 min-h-[100px]">
        {sortedCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            onDelete={() => onDeleteCard(card.id)}
            onDragStart={(e) => {
              e.dataTransfer.setData("cardId", card.id);
              e.dataTransfer.setData("fromColumnId", column.id);
            }}
          />
        ))}
      </div>

      {/* Add card */}
      {isAdding ? (
        <div className="mt-2">
          <input
            type="text"
            className="input text-sm"
            placeholder="Card title..."
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCard();
              if (e.key === "Escape") setIsAdding(false);
            }}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button className="btn-primary text-sm flex-1" onClick={handleAddCard}>
              Add
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mt-2 w-full flex items-center justify-center gap-1 py-2 text-sm text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
          onClick={() => setIsAdding(true)}
        >
          <PlusIcon />
          Add card
        </button>
      )}
    </div>
  );
}

export function KanbanBoard() {
  const {
    currentBoard,
    cards,
    boards,
    showView,
    toggleView,
    loadBoard,
    loadBoards,
    addCard,
    moveCard,
    deleteCard,
    openCreateModal,
    error,
  } = useKanbanStore();

  const [, setDraggedCard] = useState<string | null>(null);

  // Load boards when view opens
  useEffect(() => {
    if (showView && boards.length === 0) {
      loadBoards();
    }
  }, [showView, boards.length, loadBoards]);

  if (!showView) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (columnId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("cardId");
    if (cardId && currentBoard) {
      const columnCards = cards.filter((c) => c.columnId === columnId);
      moveCard(cardId, columnId, columnCards.length);
    }
    setDraggedCard(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-dark-950 z-30 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-dark-100">Kanban Boards</h1>

            {/* Board selector */}
            {boards.length > 0 && (
              <select
                className="input py-1 w-48"
                value={currentBoard?.id || ""}
                onChange={(e) => e.target.value && loadBoard(e.target.value)}
              >
                <option value="">Select a board...</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            )}

            <button className="btn-ghost text-sm flex items-center" onClick={openCreateModal}>
              <PlusIcon />
              <span className="ml-1">New Board</span>
            </button>
          </div>

          <button className="btn-icon" onClick={toggleView}>
            <CloseIcon />
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Board content */}
        <div className="flex-1 overflow-x-auto p-6">
          {currentBoard ? (
            <div className="flex gap-4 h-full">
              {currentBoard.columns.map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  cards={cards.filter((c) => c.columnId === column.id)}
                  boardId={currentBoard.id}
                  onAddCard={(title) => addCard(currentBoard.id, column.id, title)}
                  onDeleteCard={deleteCard}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(column.id)}
                />
              ))}

              {/* Add column button */}
              <button
                className="flex-shrink-0 w-72 h-fit py-8 border-2 border-dashed border-dark-700 rounded-lg text-dark-500 hover:text-dark-300 hover:border-dark-500 transition-colors flex items-center justify-center"
                onClick={() => {
                  const name = prompt("Column name:");
                  if (name) {
                    useKanbanStore.getState().addColumn(currentBoard.id, name);
                  }
                }}
              >
                <PlusIcon />
                <span className="ml-2">Add Column</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-dark-500">
              <div className="text-center">
                <p className="text-lg mb-2">No board selected</p>
                <p className="text-sm mb-4">
                  {boards.length > 0
                    ? "Select a board from the dropdown above"
                    : "Create your first board to get started"}
                </p>
                <button className="btn-primary" onClick={openCreateModal}>
                  Create Board
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Board Modal */}
      <CreateBoardModal />
    </>
  );
}
