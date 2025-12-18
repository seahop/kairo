import { useState, useEffect } from "react";
import { useDataviewStore } from "@/stores/dataviewStore";
import { useNoteStore } from "@/stores/noteStore";
import type { DataviewResult } from "@/lib/dataview";

interface DataviewRendererProps {
  query: string;
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-4">
    <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent-primary border-t-transparent" />
  </div>
);

const ErrorDisplay = ({ error }: { error: string }) => (
  <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
    <span className="font-medium">Query Error:</span> {error}
  </div>
);

export function DataviewRenderer({ query }: DataviewRendererProps) {
  const { executeQuery } = useDataviewStore();
  const { openNote } = useNoteStore();
  const [result, setResult] = useState<DataviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const runQuery = async () => {
      setIsLoading(true);
      try {
        const res = await executeQuery(query);
        if (mounted) {
          setResult(res);
        }
      } catch (error) {
        if (mounted) {
          setResult({
            type: "LIST",
            rows: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    runQuery();

    return () => {
      mounted = false;
    };
  }, [query, executeQuery]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!result) {
    return null;
  }

  if (result.error) {
    return <ErrorDisplay error={result.error} />;
  }

  if (result.rows.length === 0) {
    return (
      <div className="text-dark-500 text-sm italic py-2">
        No results found
      </div>
    );
  }

  const handleNoteClick = (path: string) => {
    openNote(path);
  };

  // Render based on query type
  if (result.type === "TABLE" && result.columns) {
    return (
      <DataviewTable
        columns={result.columns}
        rows={result.rows}
        onNoteClick={handleNoteClick}
      />
    );
  }

  return (
    <DataviewList rows={result.rows} onNoteClick={handleNoteClick} />
  );
}

interface DataviewTableProps {
  columns: string[];
  rows: DataviewResult["rows"];
  onNoteClick: (path: string) => void;
}

function DataviewTable({ columns, rows, onNoteClick }: DataviewTableProps) {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") {
      // Check if it's a timestamp (seconds since epoch)
      if (value > 1000000000 && value < 2000000000) {
        return new Date(value * 1000).toLocaleDateString();
      }
      return value.toString();
    }
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  const getDisplayName = (col: string): string => {
    const names: Record<string, string> = {
      "file.name": "Name",
      "file.path": "Path",
      "file.ctime": "Created",
      "file.mtime": "Modified",
      "file.folder": "Folder",
    };
    return names[col] || col;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-700">
            <th className="px-3 py-2 text-left text-dark-400 font-medium">
              Note
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-dark-400 font-medium"
              >
                {getDisplayName(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.path}
              className={`border-b border-dark-800 hover:bg-dark-850 ${
                idx % 2 === 0 ? "bg-dark-900" : "bg-dark-850/50"
              }`}
            >
              <td className="px-3 py-2">
                <button
                  className="text-accent-primary hover:underline text-left"
                  onClick={() => onNoteClick(row.path)}
                >
                  {row.title}
                </button>
              </td>
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-dark-300">
                  {formatValue(row.values[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-dark-500 mt-2">
        {rows.length} result{rows.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

interface DataviewListProps {
  rows: DataviewResult["rows"];
  onNoteClick: (path: string) => void;
}

function DataviewList({ rows, onNoteClick }: DataviewListProps) {
  return (
    <div>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.path} className="flex items-center gap-2">
            <span className="text-dark-500">-</span>
            <button
              className="text-accent-primary hover:underline text-left"
              onClick={() => onNoteClick(row.path)}
            >
              {row.title}
            </button>
          </li>
        ))}
      </ul>
      <div className="text-xs text-dark-500 mt-2">
        {rows.length} result{rows.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
