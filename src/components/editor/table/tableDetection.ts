// CodeMirror extension for detecting and highlighting tables
import { ViewPlugin, Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// Table line decoration
const tableLineDecoration = Decoration.line({
  class: "cm-table-line",
});

const tableHeaderLineDecoration = Decoration.line({
  class: "cm-table-header-line",
});

const tableSeparatorLineDecoration = Decoration.line({
  class: "cm-table-separator-line",
});

// Check if a line is part of a markdown table
function isTableLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.includes("|") && trimmed.length > 1;
}

// Check if a line is a table separator (e.g., |---|---|)
function isSeparatorLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.includes("|")) return false;
  // Remove pipes and colons, check if only dashes and spaces remain
  const content = trimmed.replace(/[|:\s]/g, "");
  return content.length > 0 && /^-+$/.test(content);
}

// Build decorations for tables
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;

    if (isTableLine(text)) {
      if (isSeparatorLine(text)) {
        builder.add(line.from, line.from, tableSeparatorLineDecoration);
      } else if (i > 1) {
        const prevLine = doc.line(i - 1);
        const nextLine = i < doc.lines ? doc.line(i + 1) : null;

        // Check if this is a header (followed by separator)
        if (nextLine && isSeparatorLine(nextLine.text)) {
          builder.add(line.from, line.from, tableHeaderLineDecoration);
        } else if (isTableLine(prevLine.text)) {
          // Part of table body
          builder.add(line.from, line.from, tableLineDecoration);
        }
      } else {
        // First line might be a table header
        const nextLine = i < doc.lines ? doc.line(i + 1) : null;
        if (nextLine && isSeparatorLine(nextLine.text)) {
          builder.add(line.from, line.from, tableHeaderLineDecoration);
        }
      }
    }
  }

  return builder.finish();
}

// ViewPlugin for table detection
export const tableDetectionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: { docChanged: boolean; view: EditorView }) {
      if (update.docChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// Theme for table styling
export const tableTheme = EditorView.baseTheme({
  ".cm-table-line": {
    backgroundColor: "rgba(var(--color-accent-primary-rgb), 0.03)",
  },
  ".cm-table-header-line": {
    backgroundColor: "rgba(var(--color-accent-primary-rgb), 0.06)",
    fontWeight: "500",
  },
  ".cm-table-separator-line": {
    opacity: "0.6",
  },
});

// Find table boundaries at cursor position
export interface TableBoundary {
  startLine: number; // 1-indexed line number
  endLine: number;
  startPos: number; // Character position
  endPos: number;
}

export function findTableAtCursor(view: EditorView): TableBoundary | null {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Check if current line is a table line
  if (!isTableLine(line.text)) return null;

  // Find start of table
  let startLine = line.number;
  while (startLine > 1) {
    const prevLine = state.doc.line(startLine - 1);
    if (!isTableLine(prevLine.text)) break;
    startLine--;
  }

  // Find end of table
  let endLine = line.number;
  while (endLine < state.doc.lines) {
    const nextLine = state.doc.line(endLine + 1);
    if (!isTableLine(nextLine.text)) break;
    endLine++;
  }

  // Get character positions
  const startPos = state.doc.line(startLine).from;
  const endPos = state.doc.line(endLine).to;

  return { startLine, endLine, startPos, endPos };
}

// Get current cell position (column index) from cursor
export function getCurrentCellIndex(view: EditorView): number {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const text = line.text;

  // Count pipes before cursor position
  const cursorInLine = pos - line.from;
  let pipeCount = 0;

  for (let i = 0; i < cursorInLine && i < text.length; i++) {
    if (text[i] === "|") pipeCount++;
  }

  // Adjust for leading pipe
  if (text.trimStart().startsWith("|") && pipeCount > 0) {
    pipeCount--;
  }

  return Math.max(0, pipeCount);
}

// Find the position of a cell in a table line
export function getCellRange(
  text: string,
  cellIndex: number
): { start: number; end: number } | null {
  let start = 0;
  let end = text.length;
  let currentCell = 0;

  // Skip leading pipe
  if (text.trimStart().startsWith("|")) {
    const leadingSpaces = text.length - text.trimStart().length;
    start = leadingSpaces + 1;
  }

  for (let i = start; i < text.length; i++) {
    if (text[i] === "|") {
      if (currentCell === cellIndex) {
        end = i;
        break;
      }
      currentCell++;
      start = i + 1;
    }
  }

  if (currentCell < cellIndex) return null;

  // Trim whitespace from cell content
  while (start < end && text[start] === " ") start++;
  while (end > start && text[end - 1] === " ") end--;

  return { start, end };
}
