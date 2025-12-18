import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CloseIcon, MinimizeIcon, MaximizeIcon } from "@/components/common/Icons";

const appWindow = getCurrentWindow();

// Track double-click timing for title bar
let lastClickTime = 0;

// Handle window dragging and double-click to maximize
const handleTitleBarMouseDown = (e: React.MouseEvent) => {
  if (e.button !== 0) return;

  const now = Date.now();
  const timeSinceLastClick = now - lastClickTime;
  lastClickTime = now;

  if (timeSinceLastClick < 300) {
    e.preventDefault();
    appWindow.toggleMaximize();
    lastClickTime = 0;
  } else {
    e.preventDefault();
    appWindow.startDragging();
  }
};

// Icons
const ChevronDownIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const FileTextIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export interface DropdownItem {
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
        onMouseDown={(e) => e.stopPropagation()}
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

export interface ExtensionMenuCategory {
  label: string;
  items: DropdownItem[];
}

interface ExtensionTitleBarProps {
  title: string;
  onBack: () => void;
  menus?: ExtensionMenuCategory[];
  children?: React.ReactNode;
}

export function ExtensionTitleBar({ title, onBack, menus = [], children }: ExtensionTitleBarProps) {
  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div className="h-10 bg-dark-900 border-b border-dark-800 flex items-center select-none">
      {/* App icon and name - draggable */}
      <div
        className="flex items-center gap-2 px-3 cursor-default"
        onMouseDown={handleTitleBarMouseDown}
      >
        <img
          src="/icon-32.png"
          alt="Kairo"
          className="w-5 h-5 rounded pointer-events-none"
        />
        <span className="text-sm font-medium text-dark-200">Kairo</span>
      </div>

      {/* Navigation and menus */}
      <div className="flex items-center gap-1 px-2">
        {/* Back to Notes button */}
        <button
          className="px-3 py-1 text-sm text-dark-300 hover:text-dark-100 hover:bg-dark-800 rounded transition-colors flex items-center gap-1.5"
          onClick={onBack}
          onMouseDown={(e) => e.stopPropagation()}
          title="Go back to Notes"
        >
          <FileTextIcon />
          Notes
        </button>

        {/* Extension-specific menus */}
        {menus.map((menu, index) => (
          <DropdownMenu
            key={index}
            label={menu.label}
            items={menu.items}
          />
        ))}
      </div>

      {/* Extension title and custom toolbar items - draggable area */}
      <div
        className="flex-1 flex items-center gap-4 px-4 h-full cursor-default"
        onMouseDown={handleTitleBarMouseDown}
      >
        <span className="text-sm text-dark-400">{title}</span>
        {/* Custom toolbar items */}
        {children && (
          <div
            className="flex items-center gap-2"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children}
          </div>
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
