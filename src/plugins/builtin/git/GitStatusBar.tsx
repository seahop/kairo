import { useEffect } from "react";
import { useGitStore } from "./store";
import clsx from "clsx";

const GitBranchIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const SyncIcon = ({ className }: { className?: string }) => (
  <svg className={clsx("w-3 h-3", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export function GitStatusBar() {
  const { status, isLoading, checkStatus, pull, push } = useGitStore();

  // Refresh status periodically
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [checkStatus]);

  if (!status?.isRepo) {
    return null;
  }

  const hasChanges =
    status.staged.length > 0 ||
    status.modified.length > 0 ||
    status.untracked.length > 0;

  return (
    <div className="flex items-center gap-3 text-xs">
      {/* Branch */}
      <div className="flex items-center gap-1 text-dark-400">
        <GitBranchIcon />
        <span>{status.branch}</span>
      </div>

      {/* Sync status */}
      {status.hasRemote && (
        <div className="flex items-center gap-1">
          {status.behind > 0 && (
            <button
              className="flex items-center gap-1 text-accent-info hover:text-accent-primary"
              onClick={pull}
              disabled={isLoading}
              title={`Pull ${status.behind} commits`}
            >
              <span>↓{status.behind}</span>
            </button>
          )}
          {status.ahead > 0 && (
            <button
              className="flex items-center gap-1 text-accent-warning hover:text-accent-primary"
              onClick={push}
              disabled={isLoading}
              title={`Push ${status.ahead} commits`}
            >
              <span>↑{status.ahead}</span>
            </button>
          )}
          {status.ahead === 0 && status.behind === 0 && (
            <span className="text-accent-success">✓</span>
          )}
        </div>
      )}

      {/* Changes indicator */}
      {hasChanges && (
        <div className="flex items-center gap-1 text-accent-warning">
          <span>{status.staged.length + status.modified.length + status.untracked.length}</span>
          <span>changes</span>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <SyncIcon className="animate-spin text-dark-400" />
      )}
    </div>
  );
}
