import { useMemo } from "react";

interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface NoteDiffProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
}

// Simple line-based diff algorithm
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Use Longest Common Subsequence approach for better diffs
  const lcs = computeLCS(oldLines, newLines);
  const diff: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const match of lcs) {
    // Add removed lines (in old but not matched)
    while (oldIdx < match.oldIdx) {
      diff.push({
        type: "removed",
        content: oldLines[oldIdx],
        oldLineNum: oldLineNum++,
      });
      oldIdx++;
    }

    // Add added lines (in new but not matched)
    while (newIdx < match.newIdx) {
      diff.push({
        type: "added",
        content: newLines[newIdx],
        newLineNum: newLineNum++,
      });
      newIdx++;
    }

    // Add unchanged line
    diff.push({
      type: "unchanged",
      content: oldLines[oldIdx],
      oldLineNum: oldLineNum++,
      newLineNum: newLineNum++,
    });
    oldIdx++;
    newIdx++;
  }

  // Add remaining removed lines
  while (oldIdx < oldLines.length) {
    diff.push({
      type: "removed",
      content: oldLines[oldIdx],
      oldLineNum: oldLineNum++,
    });
    oldIdx++;
  }

  // Add remaining added lines
  while (newIdx < newLines.length) {
    diff.push({
      type: "added",
      content: newLines[newIdx],
      newLineNum: newLineNum++,
    });
    newIdx++;
  }

  return diff;
}

// LCS computation for diff
interface LCSMatch {
  oldIdx: number;
  newIdx: number;
}

function computeLCS(oldLines: string[], newLines: string[]): LCSMatch[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS length table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the LCS
  const matches: LCSMatch[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift({ oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}

export function NoteDiff({ oldContent, newContent, oldLabel, newLabel }: NoteDiffProps) {
  const diffLines = useMemo(
    () => computeDiff(oldContent, newContent),
    [oldContent, newContent]
  );

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const line of diffLines) {
      if (line.type === "added") added++;
      else if (line.type === "removed") removed++;
    }
    return { added, removed };
  }, [diffLines]);

  // Check if there are no changes
  const hasChanges = stats.added > 0 || stats.removed > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Stats header */}
      <div className="px-4 py-2 bg-dark-850 border-b border-dark-800 flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          {oldLabel && (
            <span className="text-dark-500">
              {oldLabel} <span className="text-dark-600">vs</span> {newLabel || "Current"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto text-xs">
          {stats.added > 0 && (
            <span className="text-accent-success">+{stats.added}</span>
          )}
          {stats.removed > 0 && (
            <span className="text-red-400">-{stats.removed}</span>
          )}
          {!hasChanges && (
            <span className="text-dark-500">No changes</span>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto font-mono text-sm">
        {!hasChanges ? (
          <div className="flex items-center justify-center h-full text-dark-500">
            <p>This version is identical to the current content</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {diffLines.map((line, index) => (
                <tr
                  key={index}
                  className={
                    line.type === "added"
                      ? "bg-accent-success/10"
                      : line.type === "removed"
                      ? "bg-red-900/20"
                      : ""
                  }
                >
                  {/* Line numbers */}
                  <td className="px-2 py-0.5 text-right text-dark-600 select-none w-12 border-r border-dark-800">
                    {line.oldLineNum || ""}
                  </td>
                  <td className="px-2 py-0.5 text-right text-dark-600 select-none w-12 border-r border-dark-800">
                    {line.newLineNum || ""}
                  </td>

                  {/* Change indicator */}
                  <td
                    className={`px-2 py-0.5 text-center select-none w-6 ${
                      line.type === "added"
                        ? "text-accent-success"
                        : line.type === "removed"
                        ? "text-red-400"
                        : "text-dark-600"
                    }`}
                  >
                    {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                  </td>

                  {/* Content */}
                  <td
                    className={`px-3 py-0.5 whitespace-pre-wrap break-all ${
                      line.type === "added"
                        ? "text-accent-success"
                        : line.type === "removed"
                        ? "text-red-400"
                        : "text-dark-300"
                    }`}
                  >
                    {line.content || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
