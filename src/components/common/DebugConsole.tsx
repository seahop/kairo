import { useEffect, useRef } from "react";
import { useExtensionStore, ExtensionLog } from "@/stores/extensionStore";
import clsx from "clsx";
import { CloseIcon } from "@/components/common/Icons";

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const TerminalIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

function LogEntry({ log }: { log: ExtensionLog }) {
  const levelColors = {
    info: "text-blue-400",
    warn: "text-amber-400",
    error: "text-red-400",
    debug: "text-dark-500",
  };

  const levelBg = {
    info: "bg-blue-400/10",
    warn: "bg-amber-400/10",
    error: "bg-red-400/10",
    debug: "bg-dark-800",
  };

  const timestamp = new Date(log.timestamp).toLocaleTimeString();

  return (
    <div className={clsx("px-3 py-1.5 border-b border-dark-800 font-mono text-xs", levelBg[log.level])}>
      <div className="flex items-start gap-3">
        <span className="text-dark-500 shrink-0">{timestamp}</span>
        <span className={clsx("uppercase font-semibold w-12 shrink-0", levelColors[log.level])}>
          {log.level}
        </span>
        <span className="text-accent-primary shrink-0">[{log.extensionId}]</span>
        <span className="text-dark-200 break-all">{log.message}</span>
      </div>
      {log.details && (
        <div className="mt-1 ml-32 text-dark-400 break-all whitespace-pre-wrap">
          {log.details}
        </div>
      )}
    </div>
  );
}

export function DebugConsole() {
  const { logs, consoleOpen, setConsoleOpen, clearLogs } = useExtensionStore();
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (consoleOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, consoleOpen]);

  // Keyboard shortcut to toggle console
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+` or Ctrl+Shift+D to toggle
      if ((e.ctrlKey && e.key === "`") || (e.ctrlKey && e.shiftKey && e.key === "D")) {
        e.preventDefault();
        setConsoleOpen(!consoleOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [consoleOpen, setConsoleOpen]);

  if (!consoleOpen) {
    return null;
  }

  const errorCount = logs.filter(l => l.level === "error").length;
  const warnCount = logs.filter(l => l.level === "warn").length;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-64 bg-dark-950 border-t border-dark-700 z-30 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-900 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-dark-200">
            <TerminalIcon />
            <span className="text-sm font-medium">Extension Console</span>
          </div>

          {/* Counters */}
          <div className="flex items-center gap-2 text-xs">
            {errorCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                {errorCount} error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
            {warnCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                {warnCount} warning{warnCount !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-dark-500">{logs.length} total</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
            onClick={clearLogs}
            title="Clear logs"
          >
            <TrashIcon />
          </button>
          <button
            className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
            onClick={() => setConsoleOpen(false)}
            title="Close console"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-dark-500 text-sm">
            No logs yet. Extension activity will appear here.
          </div>
        ) : (
          <div>
            {logs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// Small button to toggle console
export function DebugConsoleToggle() {
  const { consoleOpen, setConsoleOpen, logs } = useExtensionStore();
  const errorCount = logs.filter(l => l.level === "error").length;

  return (
    <button
      className={clsx(
        "p-1.5 rounded transition-colors relative",
        consoleOpen ? "bg-dark-700 text-accent-primary" : "hover:bg-dark-700 text-dark-400"
      )}
      onClick={() => setConsoleOpen(!consoleOpen)}
      title="Toggle extension console (Ctrl+`)"
    >
      <TerminalIcon />
      {errorCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
          {errorCount > 9 ? "9+" : errorCount}
        </span>
      )}
    </button>
  );
}
