// CodeMirror keymap for table navigation
import { KeyBinding, EditorView } from "@codemirror/view";
import { EditorState, Transaction } from "@codemirror/state";
import { findTableAtCursor, getCurrentCellIndex, getCellRange } from "./tableDetection";

// Check if we're in a table
function isInTable(view: EditorView): boolean {
  return findTableAtCursor(view) !== null;
}

// Get the number of cells in a line
function getCellCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return trimmed.split("|").length;
  }
  return trimmed.slice(1, -1).split("|").length;
}

// Move to the next cell (Tab)
function moveToNextCell(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const text = line.text;

  if (!text.includes("|")) return false;

  const cellIndex = getCurrentCellIndex(view);
  const cellCount = getCellCount(text);

  // Try to move to next cell in same row
  if (cellIndex < cellCount - 1) {
    const nextCellRange = getCellRange(text, cellIndex + 1);
    if (nextCellRange) {
      view.dispatch({
        selection: { anchor: line.from + nextCellRange.start },
      });
      return true;
    }
  }

  // Move to first cell of next row
  if (line.number < state.doc.lines) {
    const nextLine = state.doc.line(line.number + 1);
    if (nextLine.text.includes("|")) {
      // Skip separator line
      if (isSeparatorLine(nextLine.text) && line.number + 1 < state.doc.lines) {
        const lineAfter = state.doc.line(line.number + 2);
        if (lineAfter.text.includes("|")) {
          const firstCell = getCellRange(lineAfter.text, 0);
          if (firstCell) {
            view.dispatch({
              selection: { anchor: lineAfter.from + firstCell.start },
            });
            return true;
          }
        }
      } else if (!isSeparatorLine(nextLine.text)) {
        const firstCell = getCellRange(nextLine.text, 0);
        if (firstCell) {
          view.dispatch({
            selection: { anchor: nextLine.from + firstCell.start },
          });
          return true;
        }
      }
    }
  }

  // At end of table - add new row
  const table = findTableAtCursor(view);
  if (table) {
    const lastLine = state.doc.line(table.endLine);
    const cellCount = getCellCount(lastLine.text);
    const newRow = "\n|" + " |".repeat(cellCount);

    view.dispatch({
      changes: { from: lastLine.to, insert: newRow },
      selection: { anchor: lastLine.to + 3 }, // Position after first pipe and space
    });
    return true;
  }

  return false;
}

// Move to the previous cell (Shift+Tab)
function moveToPrevCell(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const text = line.text;

  if (!text.includes("|")) return false;

  const cellIndex = getCurrentCellIndex(view);

  // Move to previous cell in same row
  if (cellIndex > 0) {
    const prevCellRange = getCellRange(text, cellIndex - 1);
    if (prevCellRange) {
      view.dispatch({
        selection: { anchor: line.from + prevCellRange.start },
      });
      return true;
    }
  }

  // Move to last cell of previous row
  if (line.number > 1) {
    const prevLine = state.doc.line(line.number - 1);
    if (prevLine.text.includes("|") && !isSeparatorLine(prevLine.text)) {
      const cellCount = getCellCount(prevLine.text);
      const lastCell = getCellRange(prevLine.text, cellCount - 1);
      if (lastCell) {
        view.dispatch({
          selection: { anchor: prevLine.from + lastCell.start },
        });
        return true;
      }
    }
  }

  return false;
}

// Check if a line is a table separator
function isSeparatorLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.includes("|")) return false;
  const content = trimmed.replace(/[|:\s]/g, "");
  return content.length > 0 && /^-+$/.test(content);
}

// Handle Enter in table (move to next row, same column)
function handleEnterInTable(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  if (!line.text.includes("|")) return false;

  const cellIndex = getCurrentCellIndex(view);

  // Find next data row (skip separator)
  let targetLineNum = line.number + 1;
  while (targetLineNum <= state.doc.lines) {
    const targetLine = state.doc.line(targetLineNum);
    if (!targetLine.text.includes("|")) break;
    if (!isSeparatorLine(targetLine.text)) {
      const cellRange = getCellRange(targetLine.text, cellIndex);
      if (cellRange) {
        view.dispatch({
          selection: { anchor: targetLine.from + cellRange.start },
        });
        return true;
      }
    }
    targetLineNum++;
  }

  // At end of table - add new row
  const table = findTableAtCursor(view);
  if (table) {
    const lastLine = state.doc.line(table.endLine);
    const cellCount = getCellCount(lastLine.text);

    // Create new row with empty cells
    const cells = Array(cellCount).fill(" ").join("|");
    const newRow = `\n|${cells}|`;

    // Calculate position for the same column in new row
    let insertPos = 2; // Start after "|"
    for (let i = 0; i < cellIndex; i++) {
      insertPos += 2; // " |"
    }

    view.dispatch({
      changes: { from: lastLine.to, insert: newRow },
      selection: { anchor: lastLine.to + insertPos },
    });
    return true;
  }

  return false;
}

// Table keymap
export const tableKeymap: KeyBinding[] = [
  {
    key: "Tab",
    run: (view) => {
      if (isInTable(view)) {
        return moveToNextCell(view);
      }
      return false;
    },
  },
  {
    key: "Shift-Tab",
    run: (view) => {
      if (isInTable(view)) {
        return moveToPrevCell(view);
      }
      return false;
    },
  },
  {
    key: "Enter",
    run: (view) => {
      if (isInTable(view)) {
        return handleEnterInTable(view);
      }
      return false;
    },
  },
];

// Auto-format table on blur or when leaving table
export function formatTableOnBlur(_state: EditorState): Transaction | null {
  // This would auto-align columns when leaving the table
  // For now, we'll skip this complexity
  return null;
}
