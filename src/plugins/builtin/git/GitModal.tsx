import { useState } from "react";
import { useGitStore } from "./store";
import clsx from "clsx";

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const MinusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);

export function GitModal() {
  const {
    status,
    showCommitModal,
    commitMessage,
    isLoading,
    error,
    closeCommitModal,
    setCommitMessage,
    commit,
    stageFile,
    unstageFile,
    stageAll,
    pull,
    push,
  } = useGitStore();

  const [activeTab, setActiveTab] = useState<"changes" | "history">("changes");

  if (!showCommitModal) return null;

  const handleCommit = () => {
    if (commitMessage.trim() && status?.staged.length) {
      commit(commitMessage);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeCommitModal}>
      <div
        className="modal-content w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800">
          <h2 className="text-lg font-semibold text-dark-100">Git</h2>
          <div className="flex items-center gap-2">
            {status?.hasRemote && (
              <>
                <button
                  className="btn-ghost text-sm"
                  onClick={pull}
                  disabled={isLoading}
                >
                  Pull {status.behind > 0 && `(${status.behind})`}
                </button>
                <button
                  className="btn-ghost text-sm"
                  onClick={push}
                  disabled={isLoading || status.ahead === 0}
                >
                  Push {status.ahead > 0 && `(${status.ahead})`}
                </button>
              </>
            )}
            <button className="btn-icon" onClick={closeCommitModal}>
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-dark-800">
          <button
            className={clsx(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "changes"
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-dark-400 hover:text-dark-200"
            )}
            onClick={() => setActiveTab("changes")}
          >
            Changes
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "changes" && status && (
            <div className="space-y-4">
              {/* Staged files */}
              {status.staged.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-dark-200">
                      Staged ({status.staged.length})
                    </h3>
                  </div>
                  <div className="space-y-1">
                    {status.staged.map((file) => (
                      <div
                        key={file}
                        className="flex items-center justify-between px-3 py-2 bg-dark-800 rounded"
                      >
                        <span className="text-sm text-accent-success truncate">
                          {file}
                        </span>
                        <button
                          className="btn-icon text-dark-400 hover:text-dark-200"
                          onClick={() => unstageFile(file)}
                          title="Unstage"
                        >
                          <MinusIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modified files */}
              {status.modified.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-dark-200">
                      Modified ({status.modified.length})
                    </h3>
                    <button
                      className="text-xs text-accent-primary hover:text-accent-secondary"
                      onClick={stageAll}
                    >
                      Stage all
                    </button>
                  </div>
                  <div className="space-y-1">
                    {status.modified.map((file) => (
                      <div
                        key={file}
                        className="flex items-center justify-between px-3 py-2 bg-dark-800 rounded"
                      >
                        <span className="text-sm text-accent-warning truncate">
                          {file}
                        </span>
                        <button
                          className="btn-icon text-dark-400 hover:text-dark-200"
                          onClick={() => stageFile(file)}
                          title="Stage"
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Untracked files */}
              {status.untracked.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-dark-200 mb-2">
                    Untracked ({status.untracked.length})
                  </h3>
                  <div className="space-y-1">
                    {status.untracked.map((file) => (
                      <div
                        key={file}
                        className="flex items-center justify-between px-3 py-2 bg-dark-800 rounded"
                      >
                        <span className="text-sm text-dark-400 truncate">
                          {file}
                        </span>
                        <button
                          className="btn-icon text-dark-400 hover:text-dark-200"
                          onClick={() => stageFile(file)}
                          title="Stage"
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No changes */}
              {status.staged.length === 0 &&
                status.modified.length === 0 &&
                status.untracked.length === 0 && (
                  <div className="text-center py-8 text-dark-500">
                    No changes to commit
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Commit form */}
        {status && status.staged.length > 0 && (
          <div className="p-4 border-t border-dark-800">
            <textarea
              className="input mb-3 resize-none"
              rows={3}
              placeholder="Commit message..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleCommit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-dark-500">
                Ctrl+Enter to commit
              </span>
              <button
                className="btn-primary"
                onClick={handleCommit}
                disabled={!commitMessage.trim() || isLoading}
              >
                <CheckIcon />
                <span className="ml-2">Commit</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
