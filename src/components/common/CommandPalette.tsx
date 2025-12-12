import { useState, useEffect, useRef, useCallback } from "react";
import { useCommands, Command } from "@/plugins/api/commands";
import clsx from "clsx";

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { searchCommands, executeCommand, getCommands } = useCommands();

  const commands = query.trim() ? searchCommands(query) : getCommands();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, commands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (commands[selectedIndex]) {
            executeCommand(commands[selectedIndex].id);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [commands, selectedIndex, executeCommand, onClose]
  );

  const handleCommandClick = (command: Command) => {
    executeCommand(command.id);
    onClose();
  };

  if (!isOpen) return null;

  // Group commands by category
  const grouped = commands.reduce((acc, cmd) => {
    const category = cmd.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  let globalIndex = -1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-xl max-h-[60vh] flex flex-col mt-[10vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-dark-800">
          <div className="text-dark-400">
            <SearchIcon />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-lg text-dark-100 placeholder-dark-500 focus:outline-none"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Commands list */}
        <div className="flex-1 overflow-y-auto py-2">
          {Object.entries(grouped).map(([category, categoryCommands]) => (
            <div key={category}>
              <div className="px-4 py-1 text-xs text-dark-500 font-medium">
                {category}
              </div>
              {categoryCommands.map((cmd) => {
                globalIndex++;
                const index = globalIndex;
                return (
                  <div
                    key={cmd.id}
                    className={clsx(
                      "px-4 py-2 cursor-pointer flex items-center justify-between",
                      index === selectedIndex
                        ? "bg-dark-800"
                        : "hover:bg-dark-800/50"
                    )}
                    onClick={() => handleCommandClick(cmd)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div>
                      <div className="text-dark-100">{cmd.name}</div>
                      {cmd.description && (
                        <div className="text-sm text-dark-500">
                          {cmd.description}
                        </div>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs bg-dark-700 text-dark-400 rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {commands.length === 0 && (
            <div className="px-4 py-8 text-center text-dark-500">
              No commands found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-dark-800 flex items-center gap-4 text-xs text-dark-500">
          <span>
            <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-dark-800 rounded ml-1">↓</kbd>
            <span className="ml-2">Navigate</span>
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">Enter</kbd>
            <span className="ml-2">Run</span>
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">Esc</kbd>
            <span className="ml-2">Close</span>
          </span>
        </div>
      </div>
    </div>
  );
}
