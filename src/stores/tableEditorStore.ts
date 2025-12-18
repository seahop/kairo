import { create } from "zustand";
import type { TableData, CellAlignment } from "@/components/editor/table/tableParser";
import {
  createEmptyTable,
  addRow,
  removeRow,
  addColumn,
  removeColumn,
  setCell,
  setAlignment,
} from "@/components/editor/table/tableParser";

interface TableEditorState {
  // Modal state
  isOpen: boolean;
  tableData: TableData | null;

  // Position info for replacing in editor
  startLine: number | null;
  endLine: number | null;

  // Editing state
  selectedCell: { row: number; col: number } | null;
  isEditing: boolean;

  // Callbacks
  onSave: ((markdown: string) => void) | null;

  // Actions
  openEditor: (
    data: TableData | null,
    startLine: number,
    endLine: number,
    onSave: (markdown: string) => void
  ) => void;
  closeEditor: () => void;
  createNewTable: (rows?: number, cols?: number) => void;

  // Table operations
  setTableData: (data: TableData) => void;
  updateCell: (row: number, col: number, content: string) => void;
  addTableRow: (index?: number) => void;
  removeTableRow: (index: number) => void;
  addTableColumn: (index?: number) => void;
  removeTableColumn: (index: number) => void;
  setColumnAlignment: (col: number, alignment: CellAlignment) => void;

  // Selection
  selectCell: (row: number, col: number) => void;
  moveSelection: (direction: "up" | "down" | "left" | "right") => void;
  clearSelection: () => void;
  setEditing: (editing: boolean) => void;
}

export const useTableEditorStore = create<TableEditorState>((set, get) => ({
  isOpen: false,
  tableData: null,
  startLine: null,
  endLine: null,
  selectedCell: null,
  isEditing: false,
  onSave: null,

  openEditor: (data, startLine, endLine, onSave) => {
    set({
      isOpen: true,
      tableData: data || createEmptyTable(),
      startLine,
      endLine,
      onSave,
      selectedCell: { row: 0, col: 0 },
      isEditing: false,
    });
  },

  closeEditor: () => {
    set({
      isOpen: false,
      tableData: null,
      startLine: null,
      endLine: null,
      onSave: null,
      selectedCell: null,
      isEditing: false,
    });
  },

  createNewTable: (rows = 2, cols = 3) => {
    set({
      tableData: createEmptyTable(rows, cols),
      selectedCell: { row: -1, col: 0 }, // Start at first header
    });
  },

  setTableData: (data) => {
    set({ tableData: data });
  },

  updateCell: (row, col, content) => {
    const { tableData } = get();
    if (!tableData) return;
    set({ tableData: setCell(tableData, row, col, content) });
  },

  addTableRow: (index) => {
    const { tableData } = get();
    if (!tableData) return;
    set({ tableData: addRow(tableData, index) });
  },

  removeTableRow: (index) => {
    const { tableData, selectedCell } = get();
    if (!tableData) return;

    const newData = removeRow(tableData, index);
    set({ tableData: newData });

    // Adjust selection if needed
    if (selectedCell && selectedCell.row === index) {
      const newRow = Math.min(index, newData.rows.length - 1);
      set({ selectedCell: { row: newRow, col: selectedCell.col } });
    } else if (selectedCell && selectedCell.row > index) {
      set({ selectedCell: { row: selectedCell.row - 1, col: selectedCell.col } });
    }
  },

  addTableColumn: (index) => {
    const { tableData } = get();
    if (!tableData) return;
    set({ tableData: addColumn(tableData, index) });
  },

  removeTableColumn: (index) => {
    const { tableData, selectedCell } = get();
    if (!tableData) return;

    const newData = removeColumn(tableData, index);
    set({ tableData: newData });

    // Adjust selection if needed
    if (selectedCell && selectedCell.col === index) {
      const newCol = Math.min(index, newData.headers.length - 1);
      set({ selectedCell: { row: selectedCell.row, col: newCol } });
    } else if (selectedCell && selectedCell.col > index) {
      set({ selectedCell: { row: selectedCell.row, col: selectedCell.col - 1 } });
    }
  },

  setColumnAlignment: (col, alignment) => {
    const { tableData } = get();
    if (!tableData) return;
    set({ tableData: setAlignment(tableData, col, alignment) });
  },

  selectCell: (row, col) => {
    set({ selectedCell: { row, col }, isEditing: false });
  },

  moveSelection: (direction) => {
    const { tableData, selectedCell } = get();
    if (!tableData || !selectedCell) return;

    let { row, col } = selectedCell;
    const maxRow = tableData.rows.length - 1;
    const maxCol = tableData.headers.length - 1;

    switch (direction) {
      case "up":
        row = Math.max(-1, row - 1); // -1 is header row
        break;
      case "down":
        row = Math.min(maxRow, row + 1);
        break;
      case "left":
        if (col > 0) {
          col--;
        } else if (row > -1) {
          row--;
          col = maxCol;
        }
        break;
      case "right":
        if (col < maxCol) {
          col++;
        } else if (row < maxRow) {
          row++;
          col = 0;
        }
        break;
    }

    set({ selectedCell: { row, col }, isEditing: false });
  },

  clearSelection: () => {
    set({ selectedCell: null, isEditing: false });
  },

  setEditing: (editing) => {
    set({ isEditing: editing });
  },
}));
