import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useVaultStore } from "@/stores/vaultStore";

const appWindow = getCurrentWindow();

// Icons
const MinimizeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);

const MaximizeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h16v16h-4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h12v12H4z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

interface DropdownItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  divider?: boolean;
}

interface DropdownMenuProps {
  label: string;
  items: DropdownItem[];
}

function DropdownMenu({ label, items }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="px-3 py-1 text-sm text-dark-300 hover:text-dark-100 hover:bg-dark-800 rounded transition-colors flex items-center gap-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {label}
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-48 bg-dark-850 border border-dark-700 rounded-lg shadow-xl z-50 py-1">
          {items.map((item, index) => (
            <div key={index}>
              {item.divider && <div className="border-t border-dark-700 my-1" />}
              <button
                className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 hover:text-dark-50 flex justify-between items-center transition-colors"
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="text-dark-500 text-xs ml-4">{item.shortcut}</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TitleBar() {
  const { vault, closeVault } = useVaultStore();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  const fileMenuItems: DropdownItem[] = [
    { label: "New Note", shortcut: "Ctrl+N", onClick: () => window.dispatchEvent(new CustomEvent("kairo:new-note")) },
    { label: "New Folder", onClick: () => window.dispatchEvent(new CustomEvent("kairo:new-folder")) },
    { label: "Open Vault...", onClick: () => window.dispatchEvent(new CustomEvent("kairo:open-vault")), divider: true },
    { label: "Close Vault", onClick: closeVault, divider: true },
    { label: "Exit", shortcut: "Alt+F4", onClick: handleClose },
  ];

  const editMenuItems: DropdownItem[] = [
    { label: "Undo", shortcut: "Ctrl+Z", onClick: () => document.execCommand("undo") },
    { label: "Redo", shortcut: "Ctrl+Y", onClick: () => document.execCommand("redo") },
    { label: "Cut", shortcut: "Ctrl+X", onClick: () => document.execCommand("cut"), divider: true },
    { label: "Copy", shortcut: "Ctrl+C", onClick: () => document.execCommand("copy") },
    { label: "Paste", shortcut: "Ctrl+V", onClick: () => document.execCommand("paste") },
    { label: "Find...", shortcut: "Ctrl+F", onClick: () => window.dispatchEvent(new CustomEvent("kairo:search")), divider: true },
  ];

  const viewMenuItems: DropdownItem[] = [
    { label: "Command Palette", shortcut: "Ctrl+K", onClick: () => window.dispatchEvent(new CustomEvent("kairo:command-palette")) },
    { label: "Search", shortcut: "Ctrl+Shift+F", onClick: () => window.dispatchEvent(new CustomEvent("kairo:search")), divider: true },
    { label: "Toggle Sidebar", shortcut: "Ctrl+B", onClick: () => window.dispatchEvent(new CustomEvent("kairo:toggle-sidebar")) },
    { label: "Toggle Preview", shortcut: "Ctrl+Shift+V", onClick: () => window.dispatchEvent(new CustomEvent("kairo:toggle-preview")) },
  ];

  const toolsMenuItems: DropdownItem[] = [
    { label: "Git: Pull", shortcut: "Ctrl+Shift+P", onClick: () => window.dispatchEvent(new CustomEvent("kairo:git-pull")) },
    { label: "Git: Commit", shortcut: "Ctrl+Shift+C", onClick: () => window.dispatchEvent(new CustomEvent("kairo:git-commit")) },
    { label: "Git: Push", shortcut: "Ctrl+Shift+U", onClick: () => window.dispatchEvent(new CustomEvent("kairo:git-push")) },
    { label: "Kanban Boards", onClick: () => window.dispatchEvent(new CustomEvent("kairo:kanban")), divider: true },
    { label: "Templates", onClick: () => window.dispatchEvent(new CustomEvent("kairo:templates")) },
    { label: "Snippets", onClick: () => window.dispatchEvent(new CustomEvent("kairo:snippets")) },
    { label: "Extensions", onClick: () => window.dispatchEvent(new CustomEvent("kairo:extensions")), divider: true },
  ];

  const helpMenuItems: DropdownItem[] = [
    { label: "Keyboard Shortcuts", shortcut: "Ctrl+/", onClick: () => window.dispatchEvent(new CustomEvent("kairo:shortcuts")) },
    { label: "Documentation", onClick: () => window.open("https://github.com/kairo-app/kairo", "_blank") },
    { label: "About Kairo", onClick: () => window.dispatchEvent(new CustomEvent("kairo:about")), divider: true },
  ];

  return (
    <div
      className="h-10 bg-dark-900 border-b border-dark-800 flex items-center select-none"
      data-tauri-drag-region
    >
      {/* App icon and name */}
      <div className="flex items-center gap-2 px-3" data-tauri-drag-region>
        <div className="w-5 h-5 bg-accent-primary rounded flex items-center justify-center text-xs font-bold text-white">
          K
        </div>
        <span className="text-sm font-medium text-dark-200" data-tauri-drag-region>Kairo</span>
      </div>

      {/* Menu items */}
      <div className="flex items-center gap-1 px-2">
        <DropdownMenu label="File" items={fileMenuItems} />
        <DropdownMenu label="Edit" items={editMenuItems} />
        <DropdownMenu label="View" items={viewMenuItems} />
        <DropdownMenu label="Tools" items={toolsMenuItems} />
        <DropdownMenu label="Help" items={helpMenuItems} />
      </div>

      {/* Draggable area - title */}
      <div className="flex-1 text-center" data-tauri-drag-region>
        {vault && (
          <span className="text-xs text-dark-500" data-tauri-drag-region>
            {vault.name}
          </span>
        )}
      </div>

      {/* Window controls */}
      <div className="flex items-center">
        <button
          className="w-12 h-10 flex items-center justify-center text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
          onClick={handleMinimize}
          title="Minimize"
        >
          <MinimizeIcon />
        </button>
        <button
          className="w-12 h-10 flex items-center justify-center text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors"
          onClick={handleMaximize}
          title="Maximize"
        >
          <MaximizeIcon />
        </button>
        <button
          className="w-12 h-10 flex items-center justify-center text-dark-400 hover:text-dark-100 hover:bg-red-600 transition-colors"
          onClick={handleClose}
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
