import { create } from "zustand";

// Context menu types that extensions can register items for
export type ContextMenuType =
  | "note-tree"        // Right-click on a note in the sidebar
  | "folder-tree"      // Right-click on a folder in the sidebar
  | "editor"           // Right-click in the editor
  | "preview"          // Right-click in the preview pane
  | "wiki-link"        // Right-click on a wiki link
  | "external-link"    // Right-click on an external link
  | "kanban-card"      // Right-click on a kanban card
  | "tab"              // Right-click on a tab
  | "graph-node";      // Right-click on a graph node

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  pluginId: string;
  // Execute receives context data about what was right-clicked
  execute: (context: ContextMenuContext) => void | Promise<void>;
  // Optional: only show this item when condition is met
  when?: (context: ContextMenuContext) => boolean;
  priority?: number; // Higher = appears first
  divider?: boolean; // Show divider above this item
}

// Context passed to menu item handlers
export interface ContextMenuContext {
  type: ContextMenuType;
  // Note-related contexts
  notePath?: string;
  noteTitle?: string;
  // Folder contexts
  folderPath?: string;
  // Link contexts
  linkTarget?: string;
  linkText?: string;
  // Editor contexts
  selectedText?: string;
  cursorPosition?: { line: number; column: number };
  // Kanban contexts
  cardId?: string;
  boardId?: string;
  columnId?: string;
  // Graph contexts
  nodeId?: string;
  // Raw event for advanced use
  event?: { clientX: number; clientY: number };
}

interface ContextMenuState {
  menus: Map<ContextMenuType, ContextMenuItem[]>;

  // Registration
  registerMenuItem: (menuType: ContextMenuType, item: Omit<ContextMenuItem, "pluginId">, pluginId?: string) => void;
  unregisterMenuItem: (menuType: ContextMenuType, itemId: string) => void;
  unregisterPluginMenuItems: (pluginId: string) => void;

  // Retrieval
  getMenuItems: (menuType: ContextMenuType, context?: ContextMenuContext) => ContextMenuItem[];
  getAllMenuItems: () => Map<ContextMenuType, ContextMenuItem[]>;
}

export const useContextMenuStore = create<ContextMenuState>((set, get) => ({
  menus: new Map(),

  registerMenuItem: (menuType, item, pluginId = "core") => {
    set((state) => {
      const newMenus = new Map(state.menus);
      if (!newMenus.has(menuType)) {
        newMenus.set(menuType, []);
      }

      const fullItem: ContextMenuItem = {
        ...item,
        pluginId,
        id: pluginId === "core" ? item.id : `${pluginId}.${item.id}`,
      };

      const items = [...newMenus.get(menuType)!, fullItem];
      // Sort by priority (higher first)
      items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      newMenus.set(menuType, items);

      return { menus: newMenus };
    });
  },

  unregisterMenuItem: (menuType, itemId) => {
    set((state) => {
      const newMenus = new Map(state.menus);
      const items = newMenus.get(menuType);
      if (items) {
        newMenus.set(menuType, items.filter((item) => item.id !== itemId));
      }
      return { menus: newMenus };
    });
  },

  unregisterPluginMenuItems: (pluginId) => {
    set((state) => {
      const newMenus = new Map(state.menus);
      for (const [menuType, items] of newMenus) {
        newMenus.set(menuType, items.filter((item) => item.pluginId !== pluginId));
      }
      return { menus: newMenus };
    });
  },

  getMenuItems: (menuType, context) => {
    const items = get().menus.get(menuType) ?? [];

    // Filter by "when" condition if context is provided
    if (context) {
      return items.filter((item) => {
        if (item.when) {
          try {
            return item.when(context);
          } catch {
            return false;
          }
        }
        return true;
      });
    }

    return items;
  },

  getAllMenuItems: () => get().menus,
}));

// Convenience function for registering menu items
export function registerContextMenuItem(
  menuType: ContextMenuType,
  item: Omit<ContextMenuItem, "pluginId">,
  pluginId?: string
) {
  useContextMenuStore.getState().registerMenuItem(menuType, item, pluginId);
}

// Convenience function for unregistering menu items
export function unregisterContextMenuItem(menuType: ContextMenuType, itemId: string) {
  useContextMenuStore.getState().unregisterMenuItem(menuType, itemId);
}
