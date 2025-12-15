import { create } from "zustand";

// Built-in menu categories
export type MenuCategory = "file" | "edit" | "view" | "tools" | "help";

export interface MenuBarItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  pluginId: string;
  execute: () => void | Promise<void>;
  // Optional: only show this item when condition is met
  when?: () => boolean;
  priority?: number; // Higher = appears first within the category
  divider?: boolean; // Show divider above this item
}

// For creating entirely new menu categories
export interface CustomMenuCategory {
  id: string;
  label: string;
  pluginId: string;
  priority?: number; // Higher = appears more to the left
}

interface MenuBarState {
  // Items added to built-in categories
  menuItems: Map<MenuCategory, MenuBarItem[]>;

  // Custom menu categories added by extensions
  customCategories: CustomMenuCategory[];

  // Items in custom categories
  customMenuItems: Map<string, MenuBarItem[]>;

  // Registration for built-in categories
  registerMenuItem: (category: MenuCategory, item: Omit<MenuBarItem, "pluginId">, pluginId?: string) => void;
  unregisterMenuItem: (category: MenuCategory, itemId: string) => void;

  // Custom category management
  registerCategory: (category: Omit<CustomMenuCategory, "pluginId">, pluginId?: string) => void;
  unregisterCategory: (categoryId: string) => void;
  registerCustomMenuItem: (categoryId: string, item: Omit<MenuBarItem, "pluginId">, pluginId?: string) => void;
  unregisterCustomMenuItem: (categoryId: string, itemId: string) => void;

  // Unregister all items from a plugin
  unregisterPluginMenuItems: (pluginId: string) => void;

  // Retrieval
  getMenuItems: (category: MenuCategory) => MenuBarItem[];
  getCustomCategories: () => CustomMenuCategory[];
  getCustomMenuItems: (categoryId: string) => MenuBarItem[];
}

export const useMenuBarStore = create<MenuBarState>((set, get) => ({
  menuItems: new Map(),
  customCategories: [],
  customMenuItems: new Map(),

  registerMenuItem: (category, item, pluginId = "core") => {
    set((state) => {
      const newMenuItems = new Map(state.menuItems);
      if (!newMenuItems.has(category)) {
        newMenuItems.set(category, []);
      }

      const fullItem: MenuBarItem = {
        ...item,
        pluginId,
        id: pluginId === "core" ? item.id : `${pluginId}.${item.id}`,
      };

      const items = [...newMenuItems.get(category)!, fullItem];
      // Sort by priority (higher first)
      items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      newMenuItems.set(category, items);

      return { menuItems: newMenuItems };
    });
  },

  unregisterMenuItem: (category, itemId) => {
    set((state) => {
      const newMenuItems = new Map(state.menuItems);
      const items = newMenuItems.get(category);
      if (items) {
        newMenuItems.set(category, items.filter((item) => item.id !== itemId));
      }
      return { menuItems: newMenuItems };
    });
  },

  registerCategory: (category, pluginId = "core") => {
    set((state) => {
      const fullCategory: CustomMenuCategory = {
        ...category,
        pluginId,
        id: pluginId === "core" ? category.id : `${pluginId}.${category.id}`,
      };

      const categories = [...state.customCategories, fullCategory];
      categories.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      return { customCategories: categories };
    });
  },

  unregisterCategory: (categoryId) => {
    set((state) => ({
      customCategories: state.customCategories.filter((c) => c.id !== categoryId),
      customMenuItems: (() => {
        const newItems = new Map(state.customMenuItems);
        newItems.delete(categoryId);
        return newItems;
      })(),
    }));
  },

  registerCustomMenuItem: (categoryId, item, pluginId = "core") => {
    set((state) => {
      const newCustomMenuItems = new Map(state.customMenuItems);
      if (!newCustomMenuItems.has(categoryId)) {
        newCustomMenuItems.set(categoryId, []);
      }

      const fullItem: MenuBarItem = {
        ...item,
        pluginId,
        id: pluginId === "core" ? item.id : `${pluginId}.${item.id}`,
      };

      const items = [...newCustomMenuItems.get(categoryId)!, fullItem];
      items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      newCustomMenuItems.set(categoryId, items);

      return { customMenuItems: newCustomMenuItems };
    });
  },

  unregisterCustomMenuItem: (categoryId, itemId) => {
    set((state) => {
      const newCustomMenuItems = new Map(state.customMenuItems);
      const items = newCustomMenuItems.get(categoryId);
      if (items) {
        newCustomMenuItems.set(categoryId, items.filter((item) => item.id !== itemId));
      }
      return { customMenuItems: newCustomMenuItems };
    });
  },

  unregisterPluginMenuItems: (pluginId) => {
    set((state) => {
      // Remove from built-in categories
      const newMenuItems = new Map(state.menuItems);
      for (const [category, items] of newMenuItems) {
        newMenuItems.set(category, items.filter((item) => item.pluginId !== pluginId));
      }

      // Remove custom categories
      const newCustomCategories = state.customCategories.filter((c) => c.pluginId !== pluginId);

      // Remove from custom category items
      const newCustomMenuItems = new Map(state.customMenuItems);
      for (const [categoryId, items] of newCustomMenuItems) {
        newCustomMenuItems.set(categoryId, items.filter((item) => item.pluginId !== pluginId));
      }

      return {
        menuItems: newMenuItems,
        customCategories: newCustomCategories,
        customMenuItems: newCustomMenuItems,
      };
    });
  },

  getMenuItems: (category) => {
    const items = get().menuItems.get(category) ?? [];
    // Filter by "when" condition
    return items.filter((item) => {
      if (item.when) {
        try {
          return item.when();
        } catch {
          return false;
        }
      }
      return true;
    });
  },

  getCustomCategories: () => get().customCategories,

  getCustomMenuItems: (categoryId) => {
    const items = get().customMenuItems.get(categoryId) ?? [];
    return items.filter((item) => {
      if (item.when) {
        try {
          return item.when();
        } catch {
          return false;
        }
      }
      return true;
    });
  },
}));

// Convenience functions
export function registerMenuItem(
  category: MenuCategory,
  item: Omit<MenuBarItem, "pluginId">,
  pluginId?: string
) {
  useMenuBarStore.getState().registerMenuItem(category, item, pluginId);
}

export function registerMenuCategory(
  category: Omit<CustomMenuCategory, "pluginId">,
  pluginId?: string
) {
  useMenuBarStore.getState().registerCategory(category, pluginId);
}

export function registerCustomMenuItem(
  categoryId: string,
  item: Omit<MenuBarItem, "pluginId">,
  pluginId?: string
) {
  useMenuBarStore.getState().registerCustomMenuItem(categoryId, item, pluginId);
}
