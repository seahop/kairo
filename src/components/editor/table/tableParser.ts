// Markdown Table Parser
// Parses markdown tables into structured data and back

export type CellAlignment = "left" | "center" | "right" | null;

export interface TableCell {
  content: string;
  alignment: CellAlignment;
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableData {
  headers: TableCell[];
  alignments: CellAlignment[];
  rows: TableRow[];
}

export interface TableRange {
  startLine: number;
  endLine: number;
  data: TableData;
}

// Parse a markdown table from text
export function parseMarkdownTable(text: string): TableData | null {
  const lines = text.split("\n");

  if (lines.length < 2) return null;

  // Parse header row
  const headerLine = lines[0];
  if (!headerLine.includes("|")) return null;

  const headers = parseCells(headerLine);
  if (headers.length === 0) return null;

  // Parse alignment row
  const alignmentLine = lines[1];
  if (!alignmentLine.includes("|")) return null;

  const alignments = parseAlignments(alignmentLine);
  if (alignments.length === 0) return null;

  // Ensure header and alignment counts match
  if (headers.length !== alignments.length) {
    // Adjust to match
    while (headers.length < alignments.length) {
      headers.push({ content: "", alignment: null });
    }
    while (alignments.length < headers.length) {
      alignments.push(null);
    }
  }

  // Apply alignments to headers
  headers.forEach((h, i) => {
    h.alignment = alignments[i];
  });

  // Parse data rows
  const rows: TableRow[] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || !line.includes("|")) continue;

    const cells = parseCells(line);
    // Adjust cell count to match headers
    while (cells.length < headers.length) {
      cells.push({ content: "", alignment: alignments[cells.length] || null });
    }
    cells.length = headers.length; // Truncate if too many

    // Apply alignments
    cells.forEach((c, j) => {
      c.alignment = alignments[j];
    });

    rows.push({ cells });
  }

  return { headers, alignments, rows };
}

// Parse cells from a table row
function parseCells(line: string): TableCell[] {
  // Remove leading/trailing pipe and whitespace
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  return trimmed.split("|").map((cell) => ({
    content: cell.trim(),
    alignment: null,
  }));
}

// Parse alignment row (e.g., |:---|:---:|---:|)
function parseAlignments(line: string): CellAlignment[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  return trimmed.split("|").map((cell) => {
    const c = cell.trim();
    if (!c.includes("-")) return null;

    const left = c.startsWith(":");
    const right = c.endsWith(":");

    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

// Convert TableData back to markdown
export function tableToMarkdown(data: TableData, minColumnWidth = 3): string {
  // Calculate column widths
  const columnWidths = data.headers.map((h, i) => {
    let maxWidth = Math.max(h.content.length, minColumnWidth);
    for (const row of data.rows) {
      if (row.cells[i]) {
        maxWidth = Math.max(maxWidth, row.cells[i].content.length);
      }
    }
    return maxWidth;
  });

  // Build header row
  const headerCells = data.headers.map((h, i) =>
    padCell(h.content, columnWidths[i], h.alignment)
  );
  const headerLine = "| " + headerCells.join(" | ") + " |";

  // Build alignment row
  const alignmentCells = data.alignments.map((a, i) => {
    const width = columnWidths[i];
    switch (a) {
      case "left":
        return ":" + "-".repeat(width - 1);
      case "center":
        return ":" + "-".repeat(width - 2) + ":";
      case "right":
        return "-".repeat(width - 1) + ":";
      default:
        return "-".repeat(width);
    }
  });
  const alignmentLine = "| " + alignmentCells.join(" | ") + " |";

  // Build data rows
  const dataLines = data.rows.map((row) => {
    const cells = row.cells.map((c, i) =>
      padCell(c.content, columnWidths[i], data.alignments[i])
    );
    return "| " + cells.join(" | ") + " |";
  });

  return [headerLine, alignmentLine, ...dataLines].join("\n");
}

// Pad a cell to the specified width with alignment
function padCell(content: string, width: number, alignment: CellAlignment): string {
  const padding = width - content.length;
  if (padding <= 0) return content;

  switch (alignment) {
    case "center":
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + content + " ".repeat(right);
    case "right":
      return " ".repeat(padding) + content;
    default:
      return content + " ".repeat(padding);
  }
}

// Find table at a specific line in the document
export function findTableAtLine(text: string, line: number): TableRange | null {
  const lines = text.split("\n");

  // Look for table boundaries
  let startLine = line;
  let endLine = line;

  // Search backwards for table start
  while (startLine > 0) {
    const prevLine = lines[startLine - 1].trim();
    if (!prevLine.includes("|")) break;
    startLine--;
  }

  // Check if we're in a table
  if (!lines[startLine]?.includes("|")) return null;

  // Search forwards for table end
  while (endLine < lines.length - 1) {
    const nextLine = lines[endLine + 1].trim();
    if (!nextLine.includes("|")) break;
    endLine++;
  }

  // Extract table text
  const tableText = lines.slice(startLine, endLine + 1).join("\n");
  const data = parseMarkdownTable(tableText);

  if (!data) return null;

  return { startLine, endLine, data };
}

// Create a new empty table
export function createEmptyTable(rows = 2, cols = 3): TableData {
  const headers: TableCell[] = Array(cols)
    .fill(null)
    .map((_, i) => ({
      content: `Header ${i + 1}`,
      alignment: null as CellAlignment,
    }));

  const alignments: CellAlignment[] = Array(cols).fill(null);

  const tableRows: TableRow[] = Array(rows)
    .fill(null)
    .map(() => ({
      cells: Array(cols)
        .fill(null)
        .map(() => ({ content: "", alignment: null as CellAlignment })),
    }));

  return { headers, alignments, rows: tableRows };
}

// Add a row to the table
export function addRow(data: TableData, index?: number): TableData {
  const newRow: TableRow = {
    cells: data.headers.map((_, i) => ({
      content: "",
      alignment: data.alignments[i],
    })),
  };

  const rows = [...data.rows];
  if (index === undefined) {
    rows.push(newRow);
  } else {
    rows.splice(index, 0, newRow);
  }

  return { ...data, rows };
}

// Remove a row from the table
export function removeRow(data: TableData, index: number): TableData {
  if (data.rows.length <= 1) return data;
  const rows = data.rows.filter((_, i) => i !== index);
  return { ...data, rows };
}

// Add a column to the table
export function addColumn(data: TableData, index?: number): TableData {
  const insertIndex = index ?? data.headers.length;

  const headers = [...data.headers];
  headers.splice(insertIndex, 0, {
    content: `New Column`,
    alignment: null,
  });

  const alignments = [...data.alignments];
  alignments.splice(insertIndex, 0, null);

  const rows = data.rows.map((row) => {
    const cells = [...row.cells];
    cells.splice(insertIndex, 0, { content: "", alignment: null });
    return { cells };
  });

  return { headers, alignments, rows };
}

// Remove a column from the table
export function removeColumn(data: TableData, index: number): TableData {
  if (data.headers.length <= 1) return data;

  const headers = data.headers.filter((_, i) => i !== index);
  const alignments = data.alignments.filter((_, i) => i !== index);
  const rows = data.rows.map((row) => ({
    cells: row.cells.filter((_, i) => i !== index),
  }));

  return { headers, alignments, rows };
}

// Set cell content
export function setCell(
  data: TableData,
  rowIndex: number,
  colIndex: number,
  content: string
): TableData {
  if (rowIndex === -1) {
    // Header row
    const headers = [...data.headers];
    headers[colIndex] = { ...headers[colIndex], content };
    return { ...data, headers };
  }

  const rows = data.rows.map((row, i) => {
    if (i !== rowIndex) return row;
    const cells = [...row.cells];
    cells[colIndex] = { ...cells[colIndex], content };
    return { cells };
  });

  return { ...data, rows };
}

// Set column alignment
export function setAlignment(
  data: TableData,
  colIndex: number,
  alignment: CellAlignment
): TableData {
  const alignments = [...data.alignments];
  alignments[colIndex] = alignment;

  // Update headers
  const headers = data.headers.map((h, i) =>
    i === colIndex ? { ...h, alignment } : h
  );

  // Update rows
  const rows = data.rows.map((row) => ({
    cells: row.cells.map((c, i) => (i === colIndex ? { ...c, alignment } : c)),
  }));

  return { headers, alignments, rows };
}
