import { useEffect, useCallback, useRef } from "react";
import { useTableEditorStore } from "@/stores/tableEditorStore";
import { tableToMarkdown, type CellAlignment } from "./tableParser";
import { CloseIcon } from "@/components/common/Icons";

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

const AlignLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
  </svg>
);

const AlignCenterIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
  </svg>
);

const AlignRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
  </svg>
);

export function TableEditorModal() {
  const {
    isOpen,
    tableData,
    selectedCell,
    isEditing,
    onSave,
    closeEditor,
    updateCell,
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
    setColumnAlignment,
    selectCell,
    moveSelection,
    setEditing,
  } = useTableEditorStore();

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, selectedCell]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !tableData) return;

      // Escape to close or stop editing
      if (e.key === "Escape") {
        if (isEditing) {
          setEditing(false);
        } else {
          closeEditor();
        }
        return;
      }

      // When editing a cell
      if (isEditing) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          setEditing(false);
          moveSelection("down");
        } else if (e.key === "Tab") {
          e.preventDefault();
          setEditing(false);
          moveSelection(e.shiftKey ? "left" : "right");
        }
        return;
      }

      // Navigation when not editing
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveSelection("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          moveSelection("down");
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveSelection("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          moveSelection("right");
          break;
        case "Tab":
          e.preventDefault();
          moveSelection(e.shiftKey ? "left" : "right");
          break;
        case "Enter":
          e.preventDefault();
          if (selectedCell) {
            setEditing(true);
          }
          break;
        case "Delete":
        case "Backspace":
          if (selectedCell) {
            updateCell(selectedCell.row, selectedCell.col, "");
          }
          break;
        default:
          // Start editing if typing
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && selectedCell) {
            setEditing(true);
          }
      }
    },
    [isOpen, isEditing, selectedCell, tableData, closeEditor, moveSelection, setEditing, updateCell]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Handle save
  const handleSave = () => {
    if (tableData && onSave) {
      const markdown = tableToMarkdown(tableData);
      onSave(markdown);
    }
    closeEditor();
  };

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    if (selectedCell?.row === row && selectedCell?.col === col) {
      setEditing(true);
    } else {
      selectCell(row, col);
    }
  };

  // Handle cell input change
  const handleCellChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedCell) {
      updateCell(selectedCell.row, selectedCell.col, e.target.value);
    }
  };

  // Handle cell blur
  const handleCellBlur = () => {
    setEditing(false);
  };

  // Cycle alignment
  const cycleAlignment = (col: number) => {
    if (!tableData) return;
    const current = tableData.alignments[col];
    const next: CellAlignment =
      current === null ? "left" : current === "left" ? "center" : current === "center" ? "right" : null;
    setColumnAlignment(col, next);
  };

  if (!isOpen || !tableData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={closeEditor} />

      {/* Modal */}
      <div className="relative bg-dark-900 border border-dark-700 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800">
          <h2 className="text-lg font-semibold text-dark-100">Table Editor</h2>
          <div className="flex items-center gap-2">
            <button
              className="btn-primary px-4 py-2"
              onClick={handleSave}
            >
              Save Table
            </button>
            <button className="btn-icon" onClick={closeEditor}>
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 p-3 border-b border-dark-800 bg-dark-850">
          <div className="flex items-center gap-1">
            <span className="text-xs text-dark-500 mr-2">Rows:</span>
            <button
              className="btn-ghost p-1.5"
              onClick={() => addTableRow()}
              title="Add row"
            >
              <PlusIcon />
            </button>
            <button
              className="btn-ghost p-1.5"
              onClick={() => selectedCell && selectedCell.row >= 0 && removeTableRow(selectedCell.row)}
              disabled={!selectedCell || selectedCell.row < 0 || tableData.rows.length <= 1}
              title="Remove row"
            >
              <TrashIcon />
            </button>
          </div>

          <div className="w-px h-6 bg-dark-700" />

          <div className="flex items-center gap-1">
            <span className="text-xs text-dark-500 mr-2">Columns:</span>
            <button
              className="btn-ghost p-1.5"
              onClick={() => addTableColumn()}
              title="Add column"
            >
              <PlusIcon />
            </button>
            <button
              className="btn-ghost p-1.5"
              onClick={() => selectedCell && removeTableColumn(selectedCell.col)}
              disabled={!selectedCell || tableData.headers.length <= 1}
              title="Remove column"
            >
              <TrashIcon />
            </button>
          </div>

          <div className="w-px h-6 bg-dark-700" />

          <div className="flex items-center gap-1">
            <span className="text-xs text-dark-500 mr-2">Align:</span>
            <button
              className="btn-ghost p-1.5"
              onClick={() => selectedCell && setColumnAlignment(selectedCell.col, "left")}
              title="Align left"
            >
              <AlignLeftIcon />
            </button>
            <button
              className="btn-ghost p-1.5"
              onClick={() => selectedCell && setColumnAlignment(selectedCell.col, "center")}
              title="Align center"
            >
              <AlignCenterIcon />
            </button>
            <button
              className="btn-ghost p-1.5"
              onClick={() => selectedCell && setColumnAlignment(selectedCell.col, "right")}
              title="Align right"
            >
              <AlignRightIcon />
            </button>
          </div>

          <div className="ml-auto text-xs text-dark-500">
            Tab to navigate • Enter to edit • Esc to close
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {tableData.headers.map((header, col) => {
                  const isSelected = selectedCell?.row === -1 && selectedCell?.col === col;
                  const alignment = tableData.alignments[col];
                  return (
                    <th
                      key={col}
                      className={`
                        border border-dark-700 p-0 relative
                        ${isSelected ? "ring-2 ring-accent-primary ring-inset" : ""}
                      `}
                      onClick={() => handleCellClick(-1, col)}
                    >
                      {isSelected && isEditing ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={header.content}
                          onChange={handleCellChange}
                          onBlur={handleCellBlur}
                          className="w-full px-3 py-2 bg-dark-800 text-dark-100 outline-none font-semibold"
                          style={{ textAlign: alignment || "left" }}
                        />
                      ) : (
                        <div
                          className="px-3 py-2 bg-dark-850 text-dark-200 font-semibold min-h-[38px] cursor-pointer hover:bg-dark-800"
                          style={{ textAlign: alignment || "left" }}
                        >
                          {header.content || <span className="text-dark-600 italic">Header</span>}
                        </div>
                      )}
                      {/* Alignment indicator */}
                      <button
                        className="absolute bottom-0.5 right-0.5 p-0.5 text-dark-500 hover:text-dark-300 opacity-0 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleAlignment(col);
                        }}
                        title="Change alignment"
                      >
                        {alignment === "center" ? (
                          <AlignCenterIcon />
                        ) : alignment === "right" ? (
                          <AlignRightIcon />
                        ) : (
                          <AlignLeftIcon />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.cells.map((cell, colIdx) => {
                    const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                    const alignment = tableData.alignments[colIdx];
                    return (
                      <td
                        key={colIdx}
                        className={`
                          border border-dark-700 p-0
                          ${isSelected ? "ring-2 ring-accent-primary ring-inset" : ""}
                        `}
                        onClick={() => handleCellClick(rowIdx, colIdx)}
                      >
                        {isSelected && isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={cell.content}
                            onChange={handleCellChange}
                            onBlur={handleCellBlur}
                            className="w-full px-3 py-2 bg-dark-800 text-dark-100 outline-none"
                            style={{ textAlign: alignment || "left" }}
                          />
                        ) : (
                          <div
                            className="px-3 py-2 text-dark-300 min-h-[38px] cursor-pointer hover:bg-dark-850"
                            style={{ textAlign: alignment || "left" }}
                          >
                            {cell.content || <span className="text-dark-600">&nbsp;</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-dark-800 text-xs text-dark-500">
          <div>
            {tableData.headers.length} columns × {tableData.rows.length} rows
          </div>
          <div>
            {selectedCell && (
              <>
                Selected: {selectedCell.row === -1 ? "Header" : `Row ${selectedCell.row + 1}`}, Column{" "}
                {selectedCell.col + 1}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
