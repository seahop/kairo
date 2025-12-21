import { create } from "zustand";

export type EditorViewMode = 'editor' | 'preview' | 'split';
export type MainViewMode = 'notes' | 'graph' | 'vault-health';

// Tab management
export interface TabInfo {
  id: string;
  notePath: string;
  isPinned: boolean;
  customName?: string; // User-defined tab name (overrides derived name)
  // Per-tab navigation history
  history: string[];
  historyIndex: number;
}

interface PersistedTabState {
  tabs: Array<{ id: string; notePath: string; isPinned: boolean; customName?: string }>;
  activeTabId: string | null;
}

const TABS_STORAGE_KEY = 'kairo-open-tabs';

// Generate unique tab ID
function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

// Side pane content types
export type SidePaneContent =
  | { type: 'card'; cardId: string; boardId: string }
  | { type: 'backlinks'; noteId: string }
  | { type: 'outline'; noteId: string }
  | { type: 'note'; notePath: string }
  | null;

interface UIState {
  // Sidebar
  sidebarWidth: number;
  isSidebarCollapsed: boolean;

  // Search
  isSearchOpen: boolean;

  // Modals
  activeModal: string | null;
  modalData: unknown;

  // Confirm dialog
  confirmDialog: ConfirmDialogOptions | null;

  // Editor
  editorSplitRatio: number;
  showPreview: boolean;
  editorViewMode: EditorViewMode;

  // Main view mode (notes vs graph)
  mainViewMode: MainViewMode;

  // Side pane (right panel)
  sidePaneContent: SidePaneContent;
  sidePaneWidth: number;

  // Editor settings
  spellcheckEnabled: boolean;

  // Reading mode settings
  readingFontSize: 'sm' | 'base' | 'lg' | 'xl';
  readingWidth: 'narrow' | 'medium' | 'wide' | 'full';

  // Tabs
  openTabs: TabInfo[];
  activeTabId: string | null;
  tabsInitialized: boolean;

  // Actions
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setSearchOpen: (open: boolean) => void;
  openModal: (modalId: string, data?: unknown) => void;
  closeModal: () => void;
  showConfirmDialog: (options: ConfirmDialogOptions) => void;
  closeConfirmDialog: () => void;
  setEditorSplitRatio: (ratio: number) => void;
  togglePreview: () => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  cycleEditorViewMode: () => void;
  setMainViewMode: (mode: MainViewMode) => void;
  openSidePane: (content: SidePaneContent) => void;
  closeSidePane: () => void;
  setSidePaneWidth: (width: number) => void;
  setSpellcheckEnabled: (enabled: boolean) => void;
  toggleSpellcheck: () => void;
  setReadingFontSize: (size: 'sm' | 'base' | 'lg' | 'xl') => void;
  setReadingWidth: (width: 'narrow' | 'medium' | 'wide' | 'full') => void;

  // Tab actions
  openTab: (notePath: string, options?: { isPinned?: boolean; background?: boolean; forceNew?: boolean }) => string;
  openNoteInCurrentTab: (notePath: string, addToHistory?: boolean) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  setActiveTabByPath: (notePath: string) => void;
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  renameTab: (tabId: string, name: string | undefined) => void;
  getTabByPath: (notePath: string) => TabInfo | undefined;
  getActiveTab: () => TabInfo | undefined;
  initializeTabsFromStorage: (validateNote: (path: string) => boolean) => void;
  // Tab navigation (per-tab history)
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => string | null;
  goForward: () => string | null;
}

// Helper to save tabs to localStorage
function saveTabsToStorage(tabs: TabInfo[], activeTabId: string | null) {
  try {
    const state: PersistedTabState = {
      tabs: tabs.map(t => ({ id: t.id, notePath: t.notePath, isPinned: t.isPinned, customName: t.customName })),
      activeTabId,
    };
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save tabs to localStorage:', e);
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  sidebarWidth: 280,
  isSidebarCollapsed: false,
  isSearchOpen: false,
  activeModal: null,
  modalData: null,
  confirmDialog: null,
  editorSplitRatio: 50,
  showPreview: true,
  editorViewMode: 'preview',
  mainViewMode: 'notes',
  sidePaneContent: null,
  sidePaneWidth: 350,
  spellcheckEnabled: true,
  readingFontSize: 'base',
  readingWidth: 'medium',

  // Tabs initial state
  openTabs: [],
  activeTabId: null,
  tabsInitialized: false,

  // Actions
  setSidebarWidth: (width: number) => set({ sidebarWidth: width }),

  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSearchOpen: (open: boolean) => set({ isSearchOpen: open }),

  openModal: (modalId: string, data?: unknown) =>
    set({ activeModal: modalId, modalData: data }),

  closeModal: () => set({ activeModal: null, modalData: null }),

  showConfirmDialog: (options: ConfirmDialogOptions) =>
    set({ confirmDialog: options }),

  closeConfirmDialog: () => set({ confirmDialog: null }),

  setEditorSplitRatio: (ratio: number) => set({ editorSplitRatio: ratio }),

  togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),

  setEditorViewMode: (mode: EditorViewMode) => set({ editorViewMode: mode }),

  cycleEditorViewMode: () =>
    set((state) => {
      const modes: EditorViewMode[] = ['split', 'editor', 'preview'];
      const currentIndex = modes.indexOf(state.editorViewMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { editorViewMode: modes[nextIndex] };
    }),

  setMainViewMode: (mode: MainViewMode) => set({ mainViewMode: mode }),

  openSidePane: (content: SidePaneContent) => set({ sidePaneContent: content }),

  closeSidePane: () => set({ sidePaneContent: null }),

  setSidePaneWidth: (width: number) => set({ sidePaneWidth: width }),

  setSpellcheckEnabled: (enabled: boolean) => set({ spellcheckEnabled: enabled }),

  toggleSpellcheck: () =>
    set((state) => ({ spellcheckEnabled: !state.spellcheckEnabled })),

  setReadingFontSize: (size) => set({ readingFontSize: size }),

  setReadingWidth: (width) => set({ readingWidth: width }),

  // Tab actions
  openTab: (notePath: string, options?: { isPinned?: boolean; background?: boolean; forceNew?: boolean }) => {
    const { openTabs, activeTabId } = get();

    // Check if tab already exists for this note (unless forceNew is true)
    if (!options?.forceNew) {
      const existingTab = openTabs.find(t => t.notePath === notePath);
      if (existingTab) {
        // Just activate the existing tab (unless background mode)
        if (!options?.background) {
          set({ activeTabId: existingTab.id });
          saveTabsToStorage(openTabs, existingTab.id);
        }
        return existingTab.id;
      }
    }

    // Create new tab with initial history
    const newTab: TabInfo = {
      id: generateTabId(),
      notePath,
      isPinned: options?.isPinned ?? false,
      history: [notePath],
      historyIndex: 0,
    };

    // Insert after pinned tabs if not pinned, or at end of pinned tabs if pinned
    const pinnedCount = openTabs.filter(t => t.isPinned).length;
    const insertIndex = newTab.isPinned ? pinnedCount : openTabs.length;

    const newTabs = [
      ...openTabs.slice(0, insertIndex),
      newTab,
      ...openTabs.slice(insertIndex),
    ];

    const newActiveId = options?.background ? activeTabId : newTab.id;
    set({ openTabs: newTabs, activeTabId: newActiveId });
    saveTabsToStorage(newTabs, newActiveId);

    return newTab.id;
  },

  openNoteInCurrentTab: (notePath: string, addToHistory: boolean = true) => {
    const { openTabs, activeTabId } = get();

    // If the active tab already shows this note, nothing to do
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (activeTab?.notePath === notePath) {
      return; // Already showing this note in the active tab
    }

    // If no tabs exist, create the first tab
    if (openTabs.length === 0) {
      const newTab: TabInfo = {
        id: generateTabId(),
        notePath,
        isPinned: false,
        history: [notePath],
        historyIndex: 0,
      };
      set({ openTabs: [newTab], activeTabId: newTab.id });
      saveTabsToStorage([newTab], newTab.id);
      return;
    }

    // Update the active tab's notePath
    if (activeTabId) {
      const activeTabIndex = openTabs.findIndex(t => t.id === activeTabId);
      if (activeTabIndex !== -1) {
        const activeTab = openTabs[activeTabIndex];
        // Don't update pinned tabs - create a new tab instead
        if (activeTab.isPinned) {
          // Insert a new tab after pinned tabs
          const newTab: TabInfo = {
            id: generateTabId(),
            notePath,
            isPinned: false,
            history: [notePath],
            historyIndex: 0,
          };
          const pinnedCount = openTabs.filter(t => t.isPinned).length;
          const newTabs = [
            ...openTabs.slice(0, pinnedCount),
            newTab,
            ...openTabs.slice(pinnedCount),
          ];
          set({ openTabs: newTabs, activeTabId: newTab.id });
          saveTabsToStorage(newTabs, newTab.id);
          return;
        }

        // Update the active tab's notePath and history
        let newHistory = activeTab.history || [];
        let newHistoryIndex = activeTab.historyIndex ?? -1;

        if (addToHistory && notePath !== activeTab.notePath) {
          // Trim forward history when navigating to a new note
          newHistory = newHistory.slice(0, newHistoryIndex + 1);
          newHistory.push(notePath);
          newHistoryIndex = newHistory.length - 1;

          // Limit history size
          if (newHistory.length > 50) {
            newHistory = newHistory.slice(-50);
            newHistoryIndex = newHistory.length - 1;
          }
        }

        const updatedTab: TabInfo = {
          ...activeTab,
          notePath,
          history: newHistory,
          historyIndex: newHistoryIndex,
        };
        const newTabs = [
          ...openTabs.slice(0, activeTabIndex),
          updatedTab,
          ...openTabs.slice(activeTabIndex + 1),
        ];
        set({ openTabs: newTabs });
        saveTabsToStorage(newTabs, activeTabId);
        return;
      }
    }

    // Fallback: create a new tab if no active tab
    const newTab: TabInfo = {
      id: generateTabId(),
      notePath,
      isPinned: false,
      history: [notePath],
      historyIndex: 0,
    };
    const pinnedCount = openTabs.filter(t => t.isPinned).length;
    const newTabs = [
      ...openTabs.slice(0, pinnedCount),
      newTab,
      ...openTabs.slice(pinnedCount),
    ];
    set({ openTabs: newTabs, activeTabId: newTab.id });
    saveTabsToStorage(newTabs, newTab.id);
  },

  closeTab: (tabId: string) => {
    const { openTabs, activeTabId } = get();
    const tabIndex = openTabs.findIndex(t => t.id === tabId);

    if (tabIndex === -1) return;

    const newTabs = openTabs.filter(t => t.id !== tabId);

    // If we're closing the active tab, activate an adjacent tab
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      if (newTabs.length === 0) {
        newActiveId = null;
      } else if (tabIndex >= newTabs.length) {
        // Was last tab, activate new last
        newActiveId = newTabs[newTabs.length - 1].id;
      } else {
        // Activate tab at same position (which is now the next tab)
        newActiveId = newTabs[tabIndex].id;
      }
    }

    set({ openTabs: newTabs, activeTabId: newActiveId });
    saveTabsToStorage(newTabs, newActiveId);
  },

  closeOtherTabs: (tabId: string) => {
    const { openTabs } = get();
    const tabToKeep = openTabs.find(t => t.id === tabId);
    if (!tabToKeep) return;

    // Keep the specified tab and all pinned tabs
    const newTabs = openTabs.filter(t => t.id === tabId || t.isPinned);

    set({ openTabs: newTabs, activeTabId: tabId });
    saveTabsToStorage(newTabs, tabId);
  },

  closeAllTabs: () => {
    const { openTabs } = get();
    // Keep only pinned tabs
    const pinnedTabs = openTabs.filter(t => t.isPinned);
    const newActiveId = pinnedTabs.length > 0 ? pinnedTabs[0].id : null;

    set({ openTabs: pinnedTabs, activeTabId: newActiveId });
    saveTabsToStorage(pinnedTabs, newActiveId);
  },

  setActiveTab: (tabId: string) => {
    const { openTabs } = get();
    const tab = openTabs.find(t => t.id === tabId);
    if (tab) {
      set({ activeTabId: tabId });
      saveTabsToStorage(openTabs, tabId);
    }
  },

  setActiveTabByPath: (notePath: string) => {
    const { openTabs } = get();
    const tab = openTabs.find(t => t.notePath === notePath);
    if (tab) {
      set({ activeTabId: tab.id });
      saveTabsToStorage(openTabs, tab.id);
    }
  },

  pinTab: (tabId: string) => {
    const { openTabs, activeTabId } = get();
    const tabIndex = openTabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1 || openTabs[tabIndex].isPinned) return;

    // Pin the tab and move it to the end of pinned tabs
    const tab = { ...openTabs[tabIndex], isPinned: true };
    const otherTabs = openTabs.filter(t => t.id !== tabId);
    const pinnedCount = otherTabs.filter(t => t.isPinned).length;

    const newTabs = [
      ...otherTabs.slice(0, pinnedCount),
      tab,
      ...otherTabs.slice(pinnedCount),
    ];

    set({ openTabs: newTabs });
    saveTabsToStorage(newTabs, activeTabId);
  },

  unpinTab: (tabId: string) => {
    const { openTabs, activeTabId } = get();
    const tabIndex = openTabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1 || !openTabs[tabIndex].isPinned) return;

    // Unpin the tab and move it after all pinned tabs
    const tab = { ...openTabs[tabIndex], isPinned: false };
    const otherTabs = openTabs.filter(t => t.id !== tabId);
    const pinnedCount = otherTabs.filter(t => t.isPinned).length;

    const newTabs = [
      ...otherTabs.slice(0, pinnedCount),
      tab,
      ...otherTabs.slice(pinnedCount),
    ];

    set({ openTabs: newTabs });
    saveTabsToStorage(newTabs, activeTabId);
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    const { openTabs, activeTabId } = get();
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= openTabs.length) return;
    if (toIndex < 0 || toIndex >= openTabs.length) return;

    const tab = openTabs[fromIndex];

    // Don't allow moving unpinned tabs before pinned tabs
    const pinnedCount = openTabs.filter(t => t.isPinned).length;
    if (!tab.isPinned && toIndex < pinnedCount) return;
    if (tab.isPinned && toIndex >= pinnedCount) return;

    const newTabs = [...openTabs];
    newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, tab);

    set({ openTabs: newTabs });
    saveTabsToStorage(newTabs, activeTabId);
  },

  renameTab: (tabId: string, name: string | undefined) => {
    const { openTabs, activeTabId } = get();
    const tabIndex = openTabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const updatedTab: TabInfo = {
      ...openTabs[tabIndex],
      customName: name?.trim() || undefined, // Remove empty strings
    };
    const newTabs = [
      ...openTabs.slice(0, tabIndex),
      updatedTab,
      ...openTabs.slice(tabIndex + 1),
    ];

    set({ openTabs: newTabs });
    saveTabsToStorage(newTabs, activeTabId);
  },

  getTabByPath: (notePath: string) => {
    return get().openTabs.find(t => t.notePath === notePath);
  },

  getActiveTab: () => {
    const { openTabs, activeTabId } = get();
    return openTabs.find(t => t.id === activeTabId);
  },

  // Tab navigation (per-tab history)
  canGoBack: () => {
    const { openTabs, activeTabId } = get();
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (!activeTab) return false;
    return (activeTab.historyIndex ?? 0) > 0;
  },

  canGoForward: () => {
    const { openTabs, activeTabId } = get();
    const activeTab = openTabs.find(t => t.id === activeTabId);
    if (!activeTab) return false;
    const history = activeTab.history || [];
    return (activeTab.historyIndex ?? 0) < history.length - 1;
  },

  goBack: () => {
    const { openTabs, activeTabId } = get();
    const activeTabIndex = openTabs.findIndex(t => t.id === activeTabId);
    if (activeTabIndex === -1) return null;

    const activeTab = openTabs[activeTabIndex];
    const history = activeTab.history || [];
    const currentIndex = activeTab.historyIndex ?? 0;

    if (currentIndex <= 0) return null;

    const newIndex = currentIndex - 1;
    const previousPath = history[newIndex];

    // Update tab with new history index and notePath
    const updatedTab: TabInfo = {
      ...activeTab,
      notePath: previousPath,
      historyIndex: newIndex,
    };
    const newTabs = [
      ...openTabs.slice(0, activeTabIndex),
      updatedTab,
      ...openTabs.slice(activeTabIndex + 1),
    ];
    set({ openTabs: newTabs });
    saveTabsToStorage(newTabs, activeTabId);

    return previousPath;
  },

  goForward: () => {
    const { openTabs, activeTabId } = get();
    const activeTabIndex = openTabs.findIndex(t => t.id === activeTabId);
    if (activeTabIndex === -1) return null;

    const activeTab = openTabs[activeTabIndex];
    const history = activeTab.history || [];
    const currentIndex = activeTab.historyIndex ?? 0;

    if (currentIndex >= history.length - 1) return null;

    const newIndex = currentIndex + 1;
    const nextPath = history[newIndex];

    // Update tab with new history index and notePath
    const updatedTab: TabInfo = {
      ...activeTab,
      notePath: nextPath,
      historyIndex: newIndex,
    };
    const newTabs = [
      ...openTabs.slice(0, activeTabIndex),
      updatedTab,
      ...openTabs.slice(activeTabIndex + 1),
    ];
    set({ openTabs: newTabs });
    saveTabsToStorage(newTabs, activeTabId);

    return nextPath;
  },

  initializeTabsFromStorage: (validateNote: (path: string) => boolean) => {
    const { tabsInitialized } = get();
    if (tabsInitialized) return;

    try {
      const stored = localStorage.getItem(TABS_STORAGE_KEY);
      if (!stored) {
        set({ tabsInitialized: true });
        return;
      }

      const persisted = JSON.parse(stored) as PersistedTabState;

      // Handle legacy format (activeTabPath instead of activeTabId)
      const legacyActiveTabPath = (persisted as unknown as { activeTabPath?: string }).activeTabPath;

      // Validate and restore tabs
      const restoredTabs: TabInfo[] = [];
      for (const tab of persisted.tabs) {
        if (validateNote(tab.notePath)) {
          restoredTabs.push({
            // Use saved tab ID if available, otherwise generate new one (legacy support)
            id: tab.id || generateTabId(),
            notePath: tab.notePath,
            isPinned: tab.isPinned,
            customName: tab.customName,
            history: tab.notePath ? [tab.notePath] : [],
            historyIndex: tab.notePath ? 0 : -1,
          });
        } else {
          console.warn(`Tab for deleted note skipped: ${tab.notePath}`);
        }
      }

      // Find active tab - prefer saved activeTabId, fallback to legacy activeTabPath
      let activeTabId: string | null = null;
      if (persisted.activeTabId) {
        // Check if the saved activeTabId exists in restored tabs
        const activeTab = restoredTabs.find(t => t.id === persisted.activeTabId);
        activeTabId = activeTab?.id ?? (restoredTabs.length > 0 ? restoredTabs[0].id : null);
      } else if (legacyActiveTabPath) {
        // Legacy support: find by path
        const activeTab = restoredTabs.find(t => t.notePath === legacyActiveTabPath);
        activeTabId = activeTab?.id ?? (restoredTabs.length > 0 ? restoredTabs[0].id : null);
      } else if (restoredTabs.length > 0) {
        activeTabId = restoredTabs[0].id;
      }

      set({ openTabs: restoredTabs, activeTabId, tabsInitialized: true });
    } catch (e) {
      console.warn('Failed to restore tabs from localStorage:', e);
      set({ tabsInitialized: true });
    }
  },
}));
