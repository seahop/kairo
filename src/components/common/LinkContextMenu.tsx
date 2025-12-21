import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

interface MenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  divider?: boolean;
}

interface LinkContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function LinkContextMenu({ x, y, items, onClose }: LinkContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 10;
      }
      if (y + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 10;
      }

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] bg-dark-800 border border-dark-600 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {items.map((item, index) => (
        <div key={index}>
          {item.divider && <div className="border-t border-dark-600 my-1" />}
          <button
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="w-full px-3 py-2 text-left text-sm text-dark-100 hover:bg-dark-700 flex items-center gap-2 transition-colors"
          >
            {item.icon && <span className="w-4 text-center">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

// Hook for managing context menu state
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);

  const showContextMenu = useCallback(
    (e: React.MouseEvent, items: MenuItem[]) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    []
  );

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return { contextMenu, showContextMenu, hideContextMenu };
}
