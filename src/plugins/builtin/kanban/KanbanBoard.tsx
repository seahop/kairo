import { useState, useEffect, useRef } from "react";
import { useKanbanStore, KanbanCard, KanbanColumn, Priority } from "./store";
import { CardDetailPanel } from "./CardDetailPanel";
import { DatePicker } from "../../../components/common/DatePicker";
import { Select, SelectOption } from "../../../components/common/Select";
import { TemplateSelector } from "./components/TemplateSelector";
import { TemplateManager } from "./components/TemplateManager";
import { CardTemplate } from "./templates";
import { ExtensionTitleBar, DropdownItem } from "../../../components/layout/ExtensionTitleBar";
import { LinkContextMenu, useContextMenu } from "../../../components/common/LinkContextMenu";

const priorityOptions: SelectOption[] = [
  { value: "", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

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

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const MoreIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
);

const UserPlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);

// Priority colors for border
const priorityColors: Record<Priority, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500",
  low: "border-l-blue-500",
};

// Format date for display
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Create Board Modal Component
function CreateBoardModal() {
  const { showCreateModal, closeCreateModal, createBoard, isLoading, error, currentUsername, boardMembers } = useKanbanStore();
  const [boardName, setBoardName] = useState("");
  const [columns, setColumns] = useState("Created, In Progress, Waiting on Others, Delayed, Closed, Backlog");
  const [isPersonalBoard, setIsPersonalBoard] = useState(false);
  const [ownerName, setOwnerName] = useState("");

  if (!showCreateModal) return null;

  const handleCreate = async () => {
    if (boardName.trim()) {
      const columnList = columns.split(",").map(c => c.trim()).filter(c => c);
      const owner = isPersonalBoard ? (ownerName.trim() || currentUsername || undefined) : undefined;
      await createBoard(boardName.trim(), columnList.length > 0 ? columnList : undefined, owner);
      setBoardName("");
      setColumns("Created, In Progress, Waiting on Others, Delayed, Closed, Backlog");
      setIsPersonalBoard(false);
      setOwnerName("");
    }
  };

  // Suggest owner names from board members
  const suggestedOwners = boardMembers.map(m => m.name);

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
              autoComplete="off"
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
              autoComplete="off"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="personalBoard"
              checked={isPersonalBoard}
              onChange={(e) => setIsPersonalBoard(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-accent-primary focus:ring-accent-primary"
            />
            <label htmlFor="personalBoard" className="text-sm text-dark-300">
              Make this a personal board
            </label>
          </div>

          {isPersonalBoard && (
            <div>
              <label className="block text-sm text-dark-400 mb-1">Board Owner</label>
              <input
                type="text"
                className="input"
                placeholder={currentUsername || "Owner name..."}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                list="owner-suggestions"
                autoComplete="off"
              />
              {suggestedOwners.length > 0 && (
                <datalist id="owner-suggestions">
                  {suggestedOwners.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
              <p className="text-xs text-dark-500 mt-1">
                Cards assigned to this person will appear on this board.
              </p>
            </div>
          )}
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

// Create Card Modal Component
function CreateCardModal() {
  const {
    showCreateCardModal,
    closeCreateCardModal,
    createCardWithDetails,
    createCardData,
    currentBoard,
    assigneeSuggestions,
    isLoading,
    error,
  } = useKanbanStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [dueDate, setDueDate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [newAssignee, setNewAssignee] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (showCreateCardModal) {
      setTitle("");
      setDescription("");
      setPriority("");
      setDueDate("");
      setAssignees([]);
      setNewAssignee("");
      setSelectedTemplate(null);
    }
  }, [showCreateCardModal]);

  // Apply template when selected
  const handleTemplateSelect = (template: CardTemplate | null) => {
    setSelectedTemplate(template);
    if (template) {
      setDescription(template.content);
    } else {
      setDescription("");
    }
  };

  if (!showCreateCardModal || !createCardData) return null;

  const columnName = currentBoard?.columns.find(c => c.id === createCardData.columnId)?.name || "Unknown";

  const handleCreate = async () => {
    if (title.trim()) {
      await createCardWithDetails({
        ...createCardData,
        title: title.trim(),
        description,
        priority,
        dueDate,
        assignees,
      });
    }
  };

  const handleAddAssignee = (name: string) => {
    if (name && !assignees.includes(name)) {
      setAssignees([...assignees, name]);
    }
    setNewAssignee("");
    setShowSuggestions(false);
  };

  const handleRemoveAssignee = (name: string) => {
    setAssignees(assignees.filter(a => a !== name));
  };

  const filteredSuggestions = assigneeSuggestions.filter(
    s => s.toLowerCase().includes(newAssignee.toLowerCase()) && !assignees.includes(s)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={closeCreateCardModal}>
      <div className="bg-dark-900 rounded-lg p-6 w-full max-w-lg border border-dark-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-dark-100 mb-1">Create New Card</h2>
        <p className="text-sm text-dark-500 mb-4">Adding to: {columnName}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Template selector */}
          <div>
            <label className="block text-sm text-dark-400 mb-1">Template</label>
            <TemplateSelector
              onSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplate?.id}
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-dark-400 mb-1">Title *</label>
            <input
              type="text"
              className="input"
              placeholder="Card title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              autoComplete="off"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-dark-400 mb-1">
              Description
              {selectedTemplate && (
                <span className="ml-2 text-xs text-accent-primary">
                  (from template: {selectedTemplate.name})
                </span>
              )}
            </label>
            <textarea
              className="input min-h-[120px] resize-none font-mono text-sm"
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm text-dark-400 mb-1">Priority</label>
              <Select
                value={priority}
                onChange={(value) => setPriority(value as Priority | "")}
                options={priorityOptions}
                placeholder="No priority"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm text-dark-400 mb-1">Due Date</label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Set due date..."
              />
            </div>
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-sm text-dark-400 mb-1">Assignees</label>
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {assignees.map(assignee => (
                  <span
                    key={assignee}
                    className="flex items-center gap-1 px-2 py-1 bg-dark-800 rounded text-sm"
                  >
                    <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary text-xs flex items-center justify-center">
                      {assignee.charAt(0).toUpperCase()}
                    </span>
                    {assignee}
                    <button
                      className="ml-1 p-0.5 text-dark-500 hover:text-red-400 rounded-full hover:bg-dark-700"
                      onClick={() => handleRemoveAssignee(assignee)}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                className="input"
                placeholder="Add assignee..."
                value={newAssignee}
                onChange={(e) => {
                  setNewAssignee(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAssignee) {
                    e.preventDefault();
                    handleAddAssignee(newAssignee);
                  }
                  if (e.key === "Escape") {
                    setShowSuggestions(false);
                  }
                }}
                autoComplete="off"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-dark-800 rounded-lg shadow-lg border border-dark-700 py-1 max-h-32 overflow-y-auto z-10">
                  {filteredSuggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-dark-700 text-dark-200"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAddAssignee(suggestion)}
                    >
                      @{suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button className="btn-secondary flex-1" onClick={closeCreateCardModal} disabled={isLoading}>
            Cancel
          </button>
          <button
            className="btn-primary flex-1"
            onClick={handleCreate}
            disabled={!title.trim() || isLoading}
          >
            {isLoading ? "Creating..." : "Create Card"}
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
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isLinkedCard?: boolean;  // True if this card is from another board
}

const EditIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const GripIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="9" cy="5" r="1.5" />
    <circle cx="15" cy="5" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="19" r="1.5" />
    <circle cx="15" cy="19" r="1.5" />
  </svg>
);

function Card({ card, onDelete, onDragStart, onClick, onContextMenu, isLinkedCard }: CardProps) {
  const { labels } = useKanbanStore();
  const isPastDue = card.dueDate && card.dueDate * 1000 < Date.now();

  // Get label objects for this card
  const cardLabels = card.metadata?.labels
    ?.map((labelId) => labels.find((l) => l.id === labelId))
    .filter(Boolean) || [];

  // Just call onDelete - confirmation is handled by parent component's dialog
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete();
  };

  return (
    <div
      className={`group bg-dark-800 rounded-lg overflow-hidden hover:bg-dark-700 hover:ring-1 hover:ring-accent-primary/30 transition-all border-l-4 ${
        card.priority ? priorityColors[card.priority] : "border-l-transparent"
      } ${isLinkedCard ? "ring-1 ring-accent-secondary/30" : ""} ${card.archived ? "opacity-60" : ""}`}
      onContextMenu={onContextMenu}
    >
      {/* Main card content - clickable area */}
      <div
        className="px-3 py-2 cursor-pointer"
        onClick={onClick}
      >
        {/* Labels row */}
        {cardLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {cardLabels.map((label) => (
              <span
                key={label!.id}
                className="px-1.5 py-0.5 text-xs rounded"
                style={{ backgroundColor: label!.color + "30", color: label!.color }}
              >
                {label!.name}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <div className="flex items-center gap-1.5 text-sm text-dark-100">
          {card.archived && (
            <span className="text-dark-500" title="Archived">
              📦
            </span>
          )}
          {isLinkedCard && (
            <span className="text-accent-secondary" title="Linked from another board">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </span>
          )}
          <span>{card.title}</span>
        </div>

        {/* Note path */}
        {card.notePath && (
          <div className="mt-1 text-xs text-dark-500 truncate">{card.notePath}</div>
        )}

        {/* Footer: due date and assignees */}
        {(card.dueDate || (card.metadata?.assignees?.length ?? 0) > 0) ? (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-700">
            {/* Due date */}
            {card.dueDate && (
              <div
                className={`flex items-center gap-1 text-xs ${
                  isPastDue ? "text-red-400" : "text-dark-500"
                }`}
              >
                <CalendarIcon />
                <span>{formatDate(card.dueDate)}</span>
              </div>
            )}

            {/* Assignees */}
            {(card.metadata?.assignees?.length ?? 0) > 0 && (
              <div className="flex -space-x-1">
                {card.metadata!.assignees.slice(0, 3).map((assignee, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary text-xs flex items-center justify-center border border-dark-800"
                    title={assignee}
                  >
                    {assignee.charAt(0).toUpperCase()}
                  </div>
                ))}
                {card.metadata!.assignees.length > 3 && (
                  <div className="w-5 h-5 rounded-full bg-dark-700 text-dark-400 text-xs flex items-center justify-center">
                    +{card.metadata!.assignees.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Hint for cards without metadata */
          <div className="mt-2 pt-2 border-t border-dark-700 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-dark-500">
            Click to edit
          </div>
        )}
      </div>

      {/* Action bar - visible on hover */}
      <div className="flex items-center justify-between px-2 py-1 bg-dark-850 opacity-0 group-hover:opacity-100 transition-opacity border-t border-dark-700">
        {/* Drag handle */}
        <div
          className="cursor-grab active:cursor-grabbing text-dark-500 hover:text-dark-300 p-1"
          draggable
          onDragStart={onDragStart}
          title="Drag to move"
        >
          <GripIcon />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            className="text-dark-500 hover:text-accent-primary p-1"
            onClick={onClick}
            title="Edit card"
          >
            <EditIcon />
          </button>
          <button
            className="text-dark-500 hover:text-red-400 p-1"
            onClick={handleDeleteClick}
            title="Delete card"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ColumnProps {
  column: KanbanColumn;
  cards: KanbanCard[];
  boardId: string;
  onDeleteCard: (cardId: string, cardTitle: string) => void;
  onOpenCard: (card: KanbanCard) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onCardContextMenu: (e: React.MouseEvent, card: KanbanCard) => void;
}

function Column({ column, cards, boardId, onDeleteCard, onOpenCard, onDragOver, onDrop, onCardContextMenu }: ColumnProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { updateColumn, removeColumn, openCreateCardModal, currentBoard } = useKanbanStore();

  const sortedCards = [...cards].sort((a, b) => a.position - b.position);

  return (
    <div
      className="flex-shrink-0 w-72 bg-dark-900 rounded-lg p-3"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-dark-200">{column.name}</h3>
          {column.isDone && (
            <span className="text-green-500" title="Completion column">
              <CheckIcon />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-dark-500 bg-dark-800 px-2 py-0.5 rounded">
            {cards.length}
          </span>
          <div className="relative">
            <button
              className="p-1 text-dark-500 hover:text-dark-300 rounded"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreIcon />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 bg-dark-800 rounded-lg shadow-lg border border-dark-700 py-1 min-w-[180px] z-10">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-dark-700 text-dark-200"
                  onClick={() => {
                    updateColumn(boardId, column.id, { isDone: !column.isDone });
                    setShowMenu(false);
                  }}
                >
                  {column.isDone ? "Unmark as done column" : "Mark as done column"}
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-dark-700 text-red-400"
                  onClick={() => {
                    if (window.confirm(`Delete column "${column.name}"? All cards will be removed.`)) {
                      removeColumn(boardId, column.id);
                    }
                    setShowMenu(false);
                  }}
                >
                  Delete column
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2 min-h-[100px]">
        {sortedCards.map((card) => {
          // Check if this card is linked (from another board)
          const isLinkedCard = currentBoard ? card.boardId !== currentBoard.id : false;
          return (
            <Card
              key={card.id}
              card={card}
              onDelete={() => onDeleteCard(card.id, card.title)}
              onClick={() => onOpenCard(card)}
              onDragStart={(e) => {
                e.dataTransfer.setData("cardId", card.id);
                e.dataTransfer.setData("fromColumnId", column.id);
              }}
              onContextMenu={(e) => onCardContextMenu(e, card)}
              isLinkedCard={isLinkedCard}
            />
          );
        })}
      </div>

      {/* Add card button */}
      <button
        className="mt-2 w-full flex items-center justify-center gap-1 py-2 text-sm text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
        onClick={() => openCreateCardModal(column.id)}
      >
        <PlusIcon />
        Add card
      </button>
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
    loadLabels,
    loadBoardMembers,
    loadAssigneeSuggestions,
    boardMembers,
    addBoardMember,
    removeBoardMember,
    moveCard,
    deleteCard,
    openCardDetail,
    openCreateModal,
    error,
    currentUsername,
    setUsername,
    loadUsername,
    takeCard,
    giveCard,
    unlinkCardFromBoard,
    returnToPool,
    archiveCard,
    showArchivedCards,
    setShowArchivedCards,
  } = useKanbanStore();

  const [, setDraggedCard] = useState<string | null>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const membersPanelRef = useRef<HTMLDivElement>(null);

  // Check if a card should be visible on the current board
  // Cards with assignees (linked boards) only show on linked boards, not home board
  // Cards without assignees (pool) show on home board only
  const isCardVisibleOnBoard = (card: KanbanCard, boardId: string): boolean => {
    // Filter out archived cards unless showArchivedCards is enabled
    if (card.archived && !showArchivedCards) {
      return false;
    }

    const hasLinkedBoards = card.linkedBoardIds && card.linkedBoardIds.length > 0;

    if (card.boardId === boardId) {
      // This is the home board - only show if card has no linked boards (still in pool)
      return !hasLinkedBoards;
    }

    // This is a linked board - show if board is in linkedBoardIds
    return card.linkedBoardIds?.includes(boardId) ?? false;
  };

  // Helper to get the column ID for a card on the current board
  // For home board cards, use columnId directly
  // For linked cards, use boardColumns mapping or default to first column
  const getCardColumnForBoard = (card: KanbanCard, boardId: string): string => {
    if (card.boardId === boardId) {
      // This is the home board, use the direct columnId
      return card.columnId;
    }
    // This is a linked board, check boardColumns for a specific column
    if (card.boardColumns && card.boardColumns[boardId]) {
      return card.boardColumns[boardId];
    }
    // Default to the first column of the current board
    return currentBoard?.columns[0]?.id || "";
  };

  // Close members panel when clicking outside
  useEffect(() => {
    if (!showMembersPanel) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (membersPanelRef.current && !membersPanelRef.current.contains(e.target as Node)) {
        setShowMembersPanel(false);
      }
    };

    // Use setTimeout to avoid immediate close on the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMembersPanel]);

  // Context menu state
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();

  // Username prompt state
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [pendingUsernameAction, setPendingUsernameAction] = useState<(() => void) | null>(null);
  const [usernameInput, setUsernameInput] = useState("");

  // Delete confirmation dialog state (same pattern as extension removal)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    cardId: string;
    cardTitle: string;
  }>({ isOpen: false, cardId: "", cardTitle: "" });

  // Handler to show delete confirmation dialog
  const handleDeleteCardRequest = (cardId: string, cardTitle: string) => {
    setDeleteConfirm({ isOpen: true, cardId, cardTitle });
  };

  // Handler to actually delete the card (only called from dialog)
  const handleConfirmDelete = () => {
    const { cardId } = deleteConfirm;
    setDeleteConfirm({ isOpen: false, cardId: "", cardTitle: "" });
    deleteCard(cardId);
  };

  // Handler to cancel deletion
  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, cardId: "", cardTitle: "" });
  };

  // Member delete confirmation dialog state
  const [memberDeleteConfirm, setMemberDeleteConfirm] = useState<{
    isOpen: boolean;
    memberId: string;
    memberName: string;
  }>({ isOpen: false, memberId: "", memberName: "" });

  // Handler to show member delete confirmation dialog
  const handleDeleteMemberRequest = (memberId: string, memberName: string) => {
    setMemberDeleteConfirm({ isOpen: true, memberId, memberName });
  };

  // Handler to actually delete the member (only called from dialog)
  const handleConfirmMemberDelete = () => {
    const { memberId } = memberDeleteConfirm;
    setMemberDeleteConfirm({ isOpen: false, memberId: "", memberName: "" });
    removeBoardMember(memberId);
  };

  // Handler to cancel member deletion
  const handleCancelMemberDelete = () => {
    setMemberDeleteConfirm({ isOpen: false, memberId: "", memberName: "" });
  };

  // Helper to require username before action
  const requireUsername = (action: () => void) => {
    if (!currentUsername) {
      setPendingUsernameAction(() => action);
      setShowUsernamePrompt(true);
    } else {
      action();
    }
  };

  // Handle username submission
  const handleUsernameSubmit = () => {
    if (usernameInput.trim()) {
      setUsername(usernameInput.trim());
      setShowUsernamePrompt(false);
      setUsernameInput("");
      // Execute pending action if any
      if (pendingUsernameAction) {
        pendingUsernameAction();
        setPendingUsernameAction(null);
      }
    }
  };

  // Context menu handler for cards
  const handleCardContextMenu = (e: React.MouseEvent, card: KanbanCard) => {
    const isLinkedCard = currentBoard ? card.boardId !== currentBoard.id : false;
    const isAssignedToMe = currentUsername && card.metadata?.assignees?.includes(currentUsername);
    const hasAssignees = (card.metadata?.assignees?.length ?? 0) > 0;

    const menuItems: { label: string; icon?: string; onClick: () => void; divider?: boolean }[] = [];

    // Take - add to my board and assign to me
    if (!isAssignedToMe) {
      menuItems.push({
        label: "Take",
        icon: "✋",
        onClick: () => requireUsername(() => {
          if (currentUsername) {
            takeCard(card.id, currentUsername);
          }
        }),
      });
    }

    // Give to... - assign to another team member
    if (boardMembers.length > 0) {
      boardMembers.forEach((member) => {
        if (member.name !== currentUsername && !card.metadata?.assignees?.includes(member.name)) {
          menuItems.push({
            label: `Give to ${member.name}`,
            icon: "👤",
            onClick: () => giveCard(card.id, member.name),
          });
        }
      });
    }

    // Return to pool - remove all assignees
    if (hasAssignees) {
      menuItems.push({
        label: "Return to pool",
        icon: "📤",
        onClick: () => returnToPool(card.id),
        divider: true,
      });
    }

    // Remove from this board (only for linked cards)
    if (isLinkedCard && currentBoard) {
      menuItems.push({
        label: "Remove from this board",
        icon: "🔗",
        onClick: () => unlinkCardFromBoard(card.id, currentBoard.id),
        divider: !hasAssignees,
      });
    }

    // Edit and Delete options
    menuItems.push({
      label: "Edit",
      icon: "✏️",
      onClick: () => openCardDetail(card),
      divider: !isLinkedCard && !hasAssignees,
    });

    // Archive/Unarchive option
    menuItems.push({
      label: card.archived ? "Unarchive" : "Archive",
      icon: card.archived ? "📤" : "📦",
      onClick: () => archiveCard(card.id, !card.archived),
    });

    menuItems.push({
      label: "Delete",
      icon: "🗑️",
      onClick: () => handleDeleteCardRequest(card.id, card.title),
    });

    showContextMenu(e, menuItems);
  };

  // Load boards and username when view opens
  useEffect(() => {
    if (showView) {
      if (boards.length === 0) {
        loadBoards();
      }
      loadUsername();
    }
  }, [showView, boards.length, loadBoards, loadUsername]);

  // Load labels and members when board changes
  useEffect(() => {
    if (currentBoard) {
      loadLabels(currentBoard.id);
      loadBoardMembers(currentBoard.id);
      loadAssigneeSuggestions();
    }
  }, [currentBoard?.id, loadLabels, loadBoardMembers, loadAssigneeSuggestions]);

  if (!showView) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (columnId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("cardId");
    if (cardId && currentBoard) {
      const columnCards = cards.filter((c) =>
        isCardVisibleOnBoard(c, currentBoard.id) &&
        getCardColumnForBoard(c, currentBoard.id) === columnId
      );
      moveCard(cardId, columnId, columnCards.length);
    }
    setDraggedCard(null);
  };

  // Build Kanban menu items
  const kanbanMenuItems: DropdownItem[] = [
    { label: "New Board", onClick: openCreateModal },
    ...(currentBoard ? [
      { label: "Manage Members", onClick: () => setShowMembersPanel(!showMembersPanel), divider: true },
      { label: "Add Column", onClick: () => {
        const name = prompt("Column name:");
        if (name) {
          useKanbanStore.getState().addColumn(currentBoard.id, name);
        }
      }},
    ] : []),
    { label: "Manage Templates", onClick: () => setShowTemplateManager(true), divider: !currentBoard },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-dark-950 z-30 flex flex-col">
        {/* Title bar with menus and window controls */}
        <ExtensionTitleBar
          title="Kanban Boards"
          onBack={toggleView}
          menus={[{ label: "Board", items: kanbanMenuItems }]}
        />

        {/* Toolbar - board selector and actions */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-dark-800 bg-dark-900">
          {/* Board selector */}
          {boards.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                className="w-64 text-sm"
                value={currentBoard?.id || ""}
                onChange={(value) => value && loadBoard(value)}
                options={boards.map((board) => ({
                  value: board.id,
                  label: board.ownerName
                    ? `👤 ${board.name} (${board.ownerName})`
                    : `📋 ${board.name}`,
                }))}
                placeholder="Select a board..."
              />
              {/* Quick access to my board */}
              {currentUsername && (() => {
                const myBoard = boards.find(b => b.ownerName === currentUsername);
                if (myBoard && currentBoard?.id !== myBoard.id) {
                  return (
                    <button
                      className="btn-ghost text-sm px-2 py-1 flex items-center gap-1"
                      onClick={() => loadBoard(myBoard.id)}
                      title="Go to your personal board"
                    >
                      <span>📥</span>
                      <span>My Board</span>
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Board type indicator */}
          {currentBoard && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              currentBoard.ownerName
                ? "bg-accent-primary/20 text-accent-primary"
                : "bg-dark-700 text-dark-400"
            }`}>
              {currentBoard.ownerName
                ? `${currentBoard.ownerName}'s Personal Board`
                : "Project Board"}
            </span>
          )}

          <div className="flex-1" />

          {/* Current user indicator */}
          <div className="flex items-center gap-2">
            {currentUsername ? (
              <button
                className="flex items-center gap-2 text-sm text-dark-300 hover:text-dark-100 px-2 py-1 rounded hover:bg-dark-800"
                onClick={() => {
                  setUsernameInput(currentUsername);
                  setShowUsernamePrompt(true);
                }}
                title="Click to change your name"
              >
                <span className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary text-xs flex items-center justify-center">
                  {currentUsername.charAt(0).toUpperCase()}
                </span>
                <span>{currentUsername}</span>
              </button>
            ) : (
              <button
                className="text-sm text-dark-400 hover:text-dark-200 px-2 py-1 rounded hover:bg-dark-800"
                onClick={() => setShowUsernamePrompt(true)}
              >
                Set your name
              </button>
            )}
          </div>

          {/* Members button */}
          {currentBoard && (
            <div className="relative" ref={membersPanelRef}>
              <button
                className="btn-ghost text-sm flex items-center gap-1"
                onClick={() => setShowMembersPanel(!showMembersPanel)}
              >
                <UserPlusIcon />
                <span>Members ({boardMembers.length})</span>
              </button>

              {/* Members dropdown panel */}
              {showMembersPanel && (
                <div className="absolute top-full right-0 mt-1 w-72 bg-dark-800 rounded-lg shadow-lg border border-dark-700 p-4 z-20">
                  <h3 className="text-sm font-medium text-dark-200 mb-1">Team Members</h3>
                  <p className="text-xs text-dark-500 mb-3">Shared across all boards</p>

                  {/* Add member input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      className="input flex-1 text-sm"
                      placeholder="Add member name..."
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newMemberName.trim()) {
                          addBoardMember(currentBoard.id, newMemberName.trim());
                          setNewMemberName("");
                        }
                      }}
                      autoComplete="off"
                    />
                    <button
                      className="btn-primary text-sm px-3"
                      onClick={() => {
                        if (newMemberName.trim()) {
                          addBoardMember(currentBoard.id, newMemberName.trim());
                          setNewMemberName("");
                        }
                      }}
                      disabled={!newMemberName.trim()}
                    >
                      Add
                    </button>
                  </div>

                  {/* Member list */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {boardMembers.length === 0 ? (
                      <p className="text-xs text-dark-500 py-2">No members yet. Add team members to assign tasks to them.</p>
                    ) : (
                      boardMembers.map((member) => {
                        const memberBoard = boards.find(b => b.ownerName === member.name);
                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between py-1 px-2 rounded hover:bg-dark-700"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary text-xs flex items-center justify-center">
                                {member.name.charAt(0).toUpperCase()}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-sm text-dark-200">{member.name}</span>
                                {memberBoard ? (
                                  <button
                                    className="text-xs text-accent-primary hover:text-accent-secondary text-left"
                                    onClick={() => loadBoard(memberBoard.id)}
                                    title="Go to board"
                                  >
                                    📋 {memberBoard.name}
                                  </button>
                                ) : (
                                  <span className="text-xs text-dark-500">Board pending...</span>
                                )}
                              </div>
                            </div>
                            <button
                              className="text-dark-500 hover:text-red-400 p-1"
                              onClick={() => handleDeleteMemberRequest(member.id, member.name)}
                              title="Remove member"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show archived toggle */}
          {currentBoard && (
            <label className="flex items-center gap-2 text-sm text-dark-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchivedCards}
                onChange={(e) => setShowArchivedCards(e.target.checked)}
                className="rounded border-dark-600 bg-dark-800 text-accent-primary focus:ring-accent-primary"
              />
              <span>Show archived</span>
            </label>
          )}
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
                  cards={cards.filter((c) =>
                    isCardVisibleOnBoard(c, currentBoard.id) &&
                    getCardColumnForBoard(c, currentBoard.id) === column.id
                  )}
                  boardId={currentBoard.id}
                  onDeleteCard={handleDeleteCardRequest}
                  onOpenCard={openCardDetail}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(column.id)}
                  onCardContextMenu={handleCardContextMenu}
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

      {/* Create Card Modal */}
      <CreateCardModal />

      {/* Card Detail Panel */}
      <CardDetailPanel />

      {/* Delete Card Confirmation Dialog */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-sm border border-dark-700">
            <h2 className="text-lg font-semibold text-dark-100 mb-2">Delete Card</h2>
            <p className="text-dark-400 mb-6">
              Are you sure you want to delete "{deleteConfirm.cardTitle}"? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Dialog */}
      {memberDeleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-sm border border-dark-700">
            <h2 className="text-lg font-semibold text-dark-100 mb-2">Remove Member</h2>
            <p className="text-dark-400 mb-6">
              Are you sure you want to remove "{memberDeleteConfirm.memberName}" from this board? Their cards will remain but they will no longer be a member.
            </p>
            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={handleCancelMemberDelete}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleConfirmMemberDelete}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Context Menu */}
      {contextMenu && (
        <LinkContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={hideContextMenu}
        />
      )}

      {/* Username Prompt Modal */}
      {showUsernamePrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-sm border border-dark-700">
            <h2 className="text-lg font-semibold text-dark-100 mb-2">Set Your Name</h2>
            <p className="text-dark-400 mb-4 text-sm">
              Enter your name to identify yourself when taking cards. This will be used to assign cards to you.
            </p>
            <input
              type="text"
              className="input w-full mb-4"
              placeholder="Your name..."
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUsernameSubmit();
                if (e.key === "Escape") {
                  setShowUsernamePrompt(false);
                  setPendingUsernameAction(null);
                  setUsernameInput("");
                }
              }}
              autoFocus
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setShowUsernamePrompt(false);
                  setPendingUsernameAction(null);
                  setUsernameInput("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleUsernameSubmit}
                disabled={!usernameInput.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Manager Modal */}
      {showTemplateManager && (
        <TemplateManager
          isOpen={showTemplateManager}
          onClose={() => setShowTemplateManager(false)}
        />
      )}
    </>
  );
}
