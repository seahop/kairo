import { useState, useEffect, useCallback, useRef } from "react";
import { useKanbanStore, Priority } from "./store";
import { DatePicker } from "../../../components/common/DatePicker";
import { CardMarkdownEditor } from "./components/CardMarkdownEditor";
import { CardPreviewPane } from "./components/CardPreviewPane";
import { ImageUpload } from "../../../components/editor/ImageUpload";

type ViewMode = "edit" | "preview" | "split";

// Min/max widths for the resizable panel
const MIN_WIDTH = 400;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 520;

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const UserPlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);

// View mode icons
const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const PreviewIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const SplitIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// View mode toggle component
function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex border border-dark-700 rounded-lg overflow-hidden">
      <button
        className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
          mode === "edit"
            ? "bg-accent-primary/20 text-accent-primary"
            : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
        }`}
        onClick={() => onChange("edit")}
        title="Edit mode"
      >
        <EditIcon />
        Edit
      </button>
      <button
        className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors border-l border-dark-700 ${
          mode === "split"
            ? "bg-accent-primary/20 text-accent-primary"
            : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
        }`}
        onClick={() => onChange("split")}
        title="Split view"
      >
        <SplitIcon />
        Split
      </button>
      <button
        className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors border-l border-dark-700 ${
          mode === "preview"
            ? "bg-accent-primary/20 text-accent-primary"
            : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
        }`}
        onClick={() => onChange("preview")}
        title="Preview mode"
      >
        <PreviewIcon />
        Preview
      </button>
    </div>
  );
}

const priorityOptions: { value: Priority | ""; label: string; color: string }[] = [
  { value: "", label: "No priority", color: "" },
  { value: "low", label: "Low", color: "text-blue-400" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "high", label: "High", color: "text-orange-400" },
  { value: "urgent", label: "Urgent", color: "text-red-400" },
];

const labelColors = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#6b7280", // gray
];

function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateForInput(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  return date.toISOString().split("T")[0];
}

export function CardDetailPanel() {
  const {
    selectedCard,
    showCardDetail,
    closeCardDetail,
    updateCard,
    deleteCard,
    currentBoard,
    labels,
    assigneeSuggestions,
    createLabel,
    moveCard,
  } = useKanbanStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [dueDate, setDueDate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [cardLabels, setCardLabels] = useState<string[]>([]);
  const [newAssignee, setNewAssignee] = useState("");
  const [showAssigneeSuggestions, setShowAssigneeSuggestions] = useState(false);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(labelColors[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth };
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      // Dragging left increases width, dragging right decreases
      const delta = resizeRef.current.startX - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeRef.current.startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Sync local state when selectedCard changes
  useEffect(() => {
    if (selectedCard) {
      setTitle(selectedCard.title);
      setDescription(selectedCard.description || "");
      setPriority(selectedCard.priority || "");
      setDueDate(formatDateForInput(selectedCard.dueDate));
      setAssignees(selectedCard.metadata?.assignees || []);
      setCardLabels(selectedCard.metadata?.labels || []);
    }
  }, [selectedCard]);

  if (!showCardDetail || !selectedCard) return null;

  const handleSave = () => {
    updateCard(selectedCard.id, {
      title: title !== selectedCard.title ? title : undefined,
      description: description !== (selectedCard.description || "") ? description : undefined,
      priority: priority !== (selectedCard.priority || "") ? (priority || null) : undefined,
      dueDate: dueDate
        ? Math.floor(new Date(dueDate).getTime() / 1000)
        : selectedCard.dueDate
        ? null
        : undefined,
      assignees,
      labels: cardLabels,
    });
  };

  // Show delete confirmation dialog (don't delete yet)
  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  // Actually delete the card (only called from confirmation dialog)
  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    deleteCard(selectedCard.id);
  };

  // Cancel deletion
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleAddAssignee = (name: string) => {
    if (name && !assignees.includes(name)) {
      const newAssignees = [...assignees, name];
      setAssignees(newAssignees);
      updateCard(selectedCard.id, { assignees: newAssignees });
    }
    setNewAssignee("");
    setShowAssigneeSuggestions(false);
  };

  const handleRemoveAssignee = (name: string) => {
    const newAssignees = assignees.filter((a) => a !== name);
    setAssignees(newAssignees);
    updateCard(selectedCard.id, { assignees: newAssignees });
  };

  const handleToggleLabel = (labelId: string) => {
    const newLabels = cardLabels.includes(labelId)
      ? cardLabels.filter((l) => l !== labelId)
      : [...cardLabels, labelId];
    setCardLabels(newLabels);
    updateCard(selectedCard.id, { labels: newLabels });
  };

  const handleCreateLabel = async () => {
    if (newLabelName && currentBoard) {
      await createLabel(currentBoard.id, newLabelName, newLabelColor);
      setNewLabelName("");
      setShowNewLabel(false);
    }
  };

  const handleColumnChange = (columnId: string) => {
    if (columnId !== selectedCard.columnId) {
      moveCard(selectedCard.id, columnId, 0);
    }
  };

  const filteredSuggestions = assigneeSuggestions.filter(
    (s) => s.toLowerCase().includes(newAssignee.toLowerCase()) && !assignees.includes(s)
  );

  return (
    <div
      className="fixed inset-y-0 right-0 bg-dark-900 border-l border-dark-700 shadow-xl z-40 flex"
      style={{ width: panelWidth }}
    >
      {/* Resize handle */}
      <div
        className={`w-1 cursor-col-resize hover:bg-accent-primary/50 transition-colors flex-shrink-0 ${
          isResizing ? "bg-accent-primary" : "bg-transparent hover:bg-dark-600"
        }`}
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      />

      {/* Main panel content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
          <input
            className="text-lg font-semibold bg-transparent border-none outline-none text-dark-100 flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Card title..."
          />
          <div className="flex items-center gap-2">
            <button
              className="p-2 text-dark-500 hover:text-red-400 rounded"
              onClick={handleDelete}
              title="Delete card"
            >
              <TrashIcon />
            </button>
            <button
              className="p-2 text-dark-500 hover:text-dark-200 rounded"
              onClick={closeCardDetail}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Status (Column) */}
        <div>
          <label className="text-sm font-medium text-dark-400 mb-2 block">Status</label>
          <select
            className="input"
            value={selectedCard.columnId}
            onChange={(e) => handleColumnChange(e.target.value)}
          >
            {currentBoard?.columns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name} {col.isDone ? "(Done)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="text-sm font-medium text-dark-400 mb-2 block">Priority</label>
          <select
            className="input"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value as Priority | "");
              updateCard(selectedCard.id, { priority: (e.target.value as Priority) || null });
            }}
          >
            {priorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className={opt.color}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Due Date */}
        <div>
          <label className="text-sm font-medium text-dark-400 mb-2 block">Due Date</label>
          <DatePicker
            value={dueDate}
            onChange={(date) => {
              setDueDate(date);
              updateCard(selectedCard.id, {
                dueDate: date ? Math.floor(new Date(date).getTime() / 1000) : null,
              });
            }}
            placeholder="Set due date..."
          />
        </div>

        {/* Assignees */}
        <div>
          <label className="text-sm font-medium text-dark-400 mb-2 block">Assignees</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {assignees.map((assignee) => (
              <span
                key={assignee}
                className="flex items-center gap-1 px-2 py-1 bg-dark-800 rounded text-sm"
              >
                <span className="w-5 h-5 rounded-full bg-accent-primary/20 text-accent-primary text-xs flex items-center justify-center">
                  {assignee.charAt(0).toUpperCase()}
                </span>
                {assignee}
                <button
                  className="ml-1 text-dark-500 hover:text-red-400"
                  onClick={() => handleRemoveAssignee(assignee)}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Add assignee..."
                value={newAssignee}
                onChange={(e) => {
                  setNewAssignee(e.target.value);
                  setShowAssigneeSuggestions(true);
                }}
                onFocus={() => setShowAssigneeSuggestions(true)}
                onBlur={() => {
                  // Delay to allow click on suggestion
                  setTimeout(() => setShowAssigneeSuggestions(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAssignee) {
                    handleAddAssignee(newAssignee);
                  }
                  if (e.key === "Escape") {
                    setShowAssigneeSuggestions(false);
                  }
                }}
              />
              <button
                className="btn-secondary px-3"
                onClick={() => handleAddAssignee(newAssignee)}
                disabled={!newAssignee}
              >
                <UserPlusIcon />
              </button>
            </div>
            {showAssigneeSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-dark-800 rounded-lg shadow-lg border border-dark-700 py-1 max-h-32 overflow-y-auto z-10">
                {filteredSuggestions.map((suggestion) => (
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

        {/* Labels */}
        <div>
          <label className="text-sm font-medium text-dark-400 mb-2 block">Labels</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {labels.map((label) => (
              <button
                key={label.id}
                className={`px-2 py-1 text-sm rounded border ${
                  cardLabels.includes(label.id)
                    ? "border-transparent"
                    : "border-transparent opacity-50"
                }`}
                style={{
                  backgroundColor: label.color + "30",
                  color: label.color,
                }}
                onClick={() => handleToggleLabel(label.id)}
              >
                {label.name}
              </button>
            ))}
          </div>
          {showNewLabel ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="input flex-1 text-sm"
                placeholder="Label name..."
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                autoFocus
              />
              <div className="flex gap-1">
                {labelColors.map((color) => (
                  <button
                    key={color}
                    className={`w-5 h-5 rounded ${
                      newLabelColor === color ? "ring-2 ring-white ring-offset-1 ring-offset-dark-900" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewLabelColor(color)}
                  />
                ))}
              </div>
              <button className="btn-primary text-sm" onClick={handleCreateLabel}>
                Add
              </button>
              <button className="btn-secondary text-sm" onClick={() => setShowNewLabel(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="text-sm text-dark-500 hover:text-dark-300"
              onClick={() => setShowNewLabel(true)}
            >
              + Create label
            </button>
          )}
        </div>

        {/* Description */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-dark-400">Description</label>
              <button
                className={`p-1 rounded text-xs flex items-center gap-1 ${
                  showImageUpload
                    ? "bg-accent-primary/20 text-accent-primary"
                    : "text-dark-500 hover:text-dark-300 hover:bg-dark-800"
                }`}
                onClick={() => setShowImageUpload(!showImageUpload)}
                title="Upload image"
              >
                <ImageIcon />
              </button>
            </div>
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {/* Image upload panel */}
          {showImageUpload && (
            <div className="mb-3">
              <ImageUpload
                onClose={() => setShowImageUpload(false)}
              />
            </div>
          )}

          {/* Editor/Preview based on view mode */}
          {viewMode === "edit" && (
            <CardMarkdownEditor
              content={description}
              onChange={(newContent) => setDescription(newContent)}
              onBlur={handleSave}
              placeholder="Add a description... (supports markdown, [[wiki-links]], #tags)"
              minHeight="200px"
            />
          )}

          {viewMode === "preview" && (
            <CardPreviewPane
              content={description}
              minHeight="200px"
            />
          )}

          {viewMode === "split" && (
            <div className="flex gap-2 flex-1 min-h-0">
              <div className="flex-1 min-w-0">
                <CardMarkdownEditor
                  content={description}
                  onChange={(newContent) => setDescription(newContent)}
                  onBlur={handleSave}
                  placeholder="Add a description..."
                  minHeight="200px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <CardPreviewPane
                  content={description}
                  minHeight="200px"
                />
              </div>
            </div>
          )}
        </div>

        {/* Linked Note */}
        {selectedCard.notePath && (
          <div className="p-3 bg-dark-850 rounded-lg">
            <div className="text-xs text-dark-500 mb-1">Linked Note</div>
            <span className="text-sm text-accent-primary">{selectedCard.notePath}</span>
          </div>
        )}
        </div>

        {/* Footer - timestamps */}
        <div className="px-6 py-3 border-t border-dark-800 text-xs text-dark-500 space-y-1">
          <div>Created: {formatDateTime(selectedCard.createdAt)}</div>
          <div>Updated: {formatDateTime(selectedCard.updatedAt)}</div>
          {selectedCard.closedAt && <div>Closed: {formatDateTime(selectedCard.closedAt)}</div>}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-sm border border-dark-700">
            <h2 className="text-lg font-semibold text-dark-100 mb-2">Delete Card</h2>
            <p className="text-dark-400 mb-6">
              Are you sure you want to delete "{selectedCard.title}"? This action cannot be undone.
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
    </div>
  );
}
