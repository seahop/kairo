import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { triggerHook } from "@/plugins/api/hooks";
import { EditorViewMode } from "@/stores/uiStore";

// Types
export type SplitDirection = 'horizontal' | 'vertical';

// Persistence types - minimal data for saving/restoring layout
interface PersistedLeaf {
  type: 'leaf';
  notePath: string | null;
  viewMode: EditorViewMode;
}

interface PersistedSplit {
  type: 'split';
  direction: SplitDirection;
  ratio: number;
  children: [PersistedNode, PersistedNode];
}

type PersistedNode = PersistedLeaf | PersistedSplit;

interface PersistedPaneState {
  root: PersistedNode | null;
  activePaneIndex: number; // Index in leaf order
}

// Per-tab layout persistence
interface PersistedTabLayout {
  root: PersistedNode;
  activePaneIndex: number;
}

interface PersistedTabLayouts {
  currentTabId: string | null;
  layouts: Record<string, PersistedTabLayout>; // tabId -> layout
}

const PANE_STORAGE_KEY = 'kairo-pane-layout';
const TAB_LAYOUTS_STORAGE_KEY = 'kairo-tab-layouts';

// Helper to serialize pane tree for persistence
const serializePaneTree = (node: PaneNode): PersistedNode => {
  if (node.type === 'leaf') {
    return {
      type: 'leaf',
      notePath: node.notePath,
      viewMode: node.viewMode,
    };
  }
  return {
    type: 'split',
    direction: node.direction,
    ratio: node.ratio,
    children: [
      serializePaneTree(node.children[0]),
      serializePaneTree(node.children[1]),
    ],
  };
};

// Helper to collect leaves (forward declaration for serializePaneTree)
const collectLeafPanesFromNode = (node: PaneNode): PaneLeaf[] => {
  if (node.type === 'leaf') return [node];
  return [...collectLeafPanesFromNode(node.children[0]), ...collectLeafPanesFromNode(node.children[1])];
};

// Helper to deserialize pane tree from persistence
const deserializePaneTree = (persisted: PersistedNode): PaneNode => {
  if (persisted.type === 'leaf') {
    return {
      type: 'leaf',
      id: generatePaneId(),
      notePath: persisted.notePath,
      editorContent: '',
      originalContent: '',
      hasUnsavedChanges: false,
      viewMode: persisted.viewMode,
      isLoading: false,
      note: null,
      history: persisted.notePath ? [persisted.notePath] : [],
      historyIndex: persisted.notePath ? 0 : -1,
    };
  }
  return {
    type: 'split',
    id: generatePaneId(),
    direction: persisted.direction,
    ratio: persisted.ratio,
    children: [
      deserializePaneTree(persisted.children[0]),
      deserializePaneTree(persisted.children[1]),
    ],
  };
};

// Helper to load pane layout from localStorage (legacy - single layout)
const loadPaneLayout = (): { root: PaneNode; activePaneId: string } | null => {
  try {
    const stored = localStorage.getItem(PANE_STORAGE_KEY);
    if (!stored) return null;

    const persisted: PersistedPaneState = JSON.parse(stored);
    if (!persisted.root) return null;

    const root = deserializePaneTree(persisted.root);
    const leaves = collectLeafPanesFromNode(root);

    // Get active pane by index
    const activePaneIndex = Math.min(persisted.activePaneIndex, leaves.length - 1);
    const activePaneId = leaves[Math.max(0, activePaneIndex)]?.id;

    if (!activePaneId) return null;

    return { root, activePaneId };
  } catch (e) {
    console.warn('Failed to load pane layout:', e);
    return null;
  }
};

// Helper to save all tab layouts to localStorage
const saveAllTabLayouts = (
  currentTabId: string | null,
  currentRoot: PaneNode | null,
  currentActivePaneId: string | null,
  tabLayouts: Map<string, TabPaneLayout>
) => {
  try {
    const layouts: Record<string, PersistedTabLayout> = {};

    // Save current tab's layout
    if (currentTabId && currentRoot && currentActivePaneId) {
      const leaves = collectLeafPanesFromNode(currentRoot);
      const activePaneIndex = leaves.findIndex(p => p.id === currentActivePaneId);
      layouts[currentTabId] = {
        root: serializePaneTree(currentRoot),
        activePaneIndex: activePaneIndex >= 0 ? activePaneIndex : 0,
      };
    }

    // Save other tabs' layouts from the map
    tabLayouts.forEach((layout, tabId) => {
      if (tabId !== currentTabId) { // Don't overwrite current tab
        const leaves = collectLeafPanesFromNode(layout.root);
        const activePaneIndex = leaves.findIndex(p => p.id === layout.activePaneId);
        layouts[tabId] = {
          root: serializePaneTree(layout.root),
          activePaneIndex: activePaneIndex >= 0 ? activePaneIndex : 0,
        };
      }
    });

    const persisted: PersistedTabLayouts = {
      currentTabId,
      layouts,
    };

    localStorage.setItem(TAB_LAYOUTS_STORAGE_KEY, JSON.stringify(persisted));
  } catch (e) {
    console.warn('Failed to save tab layouts:', e);
  }
};

// Helper to load all tab layouts from localStorage
const loadAllTabLayouts = (): {
  currentTabId: string | null;
  tabLayouts: Map<string, TabPaneLayout>;
} | null => {
  try {
    const stored = localStorage.getItem(TAB_LAYOUTS_STORAGE_KEY);
    if (!stored) return null;

    const persisted: PersistedTabLayouts = JSON.parse(stored);
    const tabLayouts = new Map<string, TabPaneLayout>();

    for (const [tabId, layout] of Object.entries(persisted.layouts)) {
      const root = deserializePaneTree(layout.root);
      const leaves = collectLeafPanesFromNode(root);
      const activePaneIndex = Math.min(layout.activePaneIndex, leaves.length - 1);
      const activePaneId = leaves[Math.max(0, activePaneIndex)]?.id;

      if (activePaneId) {
        tabLayouts.set(tabId, { root, activePaneId });
      }
    }

    return {
      currentTabId: persisted.currentTabId,
      tabLayouts,
    };
  } catch (e) {
    console.warn('Failed to load tab layouts:', e);
    return null;
  }
};

export interface Note {
  id: string;
  path: string;
  title: string;
  content: string;
  modified_at: number;
  created_at: number;
}

export interface PaneLeaf {
  type: 'leaf';
  id: string;
  notePath: string | null;
  editorContent: string;
  originalContent: string; // Content when note was loaded (for change detection)
  hasUnsavedChanges: boolean;
  viewMode: EditorViewMode;
  isLoading: boolean;
  note: Note | null; // Full note data
  history: string[];
  historyIndex: number;
}

export interface PaneSplit {
  type: 'split';
  id: string;
  direction: SplitDirection;
  children: [PaneNode, PaneNode];
  ratio: number; // 0-100 for first child
}

export type PaneNode = PaneLeaf | PaneSplit;

// Generate unique IDs
let paneIdCounter = 0;
const generatePaneId = () => `pane-${++paneIdCounter}`;

// Create a new leaf pane
const createLeafPane = (notePath: string | null = null): PaneLeaf => ({
  type: 'leaf',
  id: generatePaneId(),
  notePath,
  editorContent: '',
  originalContent: '',
  hasUnsavedChanges: false,
  viewMode: 'preview',
  isLoading: false,
  note: null,
  history: notePath ? [notePath] : [],
  historyIndex: notePath ? 0 : -1,
});

// Per-tab pane layout storage
interface TabPaneLayout {
  root: PaneNode;
  activePaneId: string;
}

interface PaneState {
  root: PaneNode | null;
  activePaneId: string | null;

  // Per-tab pane layouts
  currentTabId: string | null;
  tabLayouts: Map<string, TabPaneLayout>;

  // Draft cache for soft-save (unsaved changes cached when switching notes)
  draftCache: Map<string, string>;

  // Actions
  initializePane: () => void;
  splitPane: (paneId: string, direction: SplitDirection) => void;
  closePane: (paneId: string) => void;
  setActivePane: (paneId: string) => void;
  openNoteInPane: (paneId: string, notePath: string) => Promise<void>;
  openNoteInActivePane: (notePath: string) => Promise<void>;
  openNoteInNewPane: (notePath: string, direction?: SplitDirection) => Promise<void>;
  setPaneContent: (paneId: string, content: string) => void;
  setPaneViewMode: (paneId: string, mode: EditorViewMode) => void;
  savePaneNote: (paneId: string) => Promise<void>;
  setPaneRatio: (splitId: string, ratio: number) => void;

  // Tab-pane management
  switchToTab: (tabId: string) => void;
  createLayoutForTab: (tabId: string) => void;
  removeTabLayout: (tabId: string) => void;
  clearAllLayouts: () => void;

  // Navigation within pane
  goBackInPane: (paneId: string) => Promise<void>;
  goForwardInPane: (paneId: string) => Promise<void>;
  canGoBackInPane: (paneId: string) => boolean;
  canGoForwardInPane: (paneId: string) => boolean;

  // Utilities
  findPane: (paneId: string) => PaneLeaf | null;
  findParentSplit: (paneId: string) => { split: PaneSplit; childIndex: 0 | 1 } | null;
  getActivePane: () => PaneLeaf | null;
  getAllLeafPanes: () => PaneLeaf[];
  getLeafCount: () => number;

  // Draft cache actions
  saveDraft: (path: string, content: string) => void;
  clearDraft: (path: string) => void;
  getDraft: (path: string) => string | undefined;
  hasDraft: (path: string) => boolean;
}

// Helper to find a leaf pane in the tree
const findPaneInTree = (node: PaneNode | null, paneId: string): PaneLeaf | null => {
  if (!node) return null;
  if (node.type === 'leaf') {
    return node.id === paneId ? node : null;
  }
  // It's a split
  return findPaneInTree(node.children[0], paneId) || findPaneInTree(node.children[1], paneId);
};

// Helper to find parent split of a pane
const findParentSplitInTree = (
  node: PaneNode | null,
  paneId: string,
  parent: PaneSplit | null = null,
  childIndex: 0 | 1 = 0
): { split: PaneSplit; childIndex: 0 | 1 } | null => {
  if (!node) return null;

  if (node.type === 'leaf') {
    if (node.id === paneId && parent) {
      return { split: parent, childIndex };
    }
    return null;
  }

  // It's a split - check children
  const leftResult = findParentSplitInTree(node.children[0], paneId, node, 0);
  if (leftResult) return leftResult;

  return findParentSplitInTree(node.children[1], paneId, node, 1);
};

// Helper to collect all leaf panes
const collectLeafPanes = (node: PaneNode | null): PaneLeaf[] => {
  if (!node) return [];
  if (node.type === 'leaf') return [node];
  return [...collectLeafPanes(node.children[0]), ...collectLeafPanes(node.children[1])];
};

// Helper to update a pane in the tree (immutably)
const updatePaneInTree = (
  node: PaneNode | null,
  paneId: string,
  updater: (pane: PaneLeaf) => PaneLeaf
): PaneNode | null => {
  if (!node) return null;

  if (node.type === 'leaf') {
    if (node.id === paneId) {
      return updater(node);
    }
    return node;
  }

  // It's a split
  const newChildren: [PaneNode, PaneNode] = [
    updatePaneInTree(node.children[0], paneId, updater) as PaneNode,
    updatePaneInTree(node.children[1], paneId, updater) as PaneNode,
  ];

  // Only create new object if children changed
  if (newChildren[0] === node.children[0] && newChildren[1] === node.children[1]) {
    return node;
  }

  return { ...node, children: newChildren };
};

// Helper to replace a node in the tree
const replaceNodeInTree = (
  root: PaneNode | null,
  targetId: string,
  replacement: PaneNode
): PaneNode | null => {
  if (!root) return null;

  if (root.id === targetId) {
    return replacement;
  }

  if (root.type === 'leaf') {
    return root;
  }

  // It's a split
  const newChildren: [PaneNode, PaneNode] = [
    replaceNodeInTree(root.children[0], targetId, replacement) as PaneNode,
    replaceNodeInTree(root.children[1], targetId, replacement) as PaneNode,
  ];

  if (newChildren[0] === root.children[0] && newChildren[1] === root.children[1]) {
    return root;
  }

  return { ...root, children: newChildren };
};

export const usePaneStore = create<PaneState>((set, get) => ({
  root: null,
  activePaneId: null,
  currentTabId: null,
  tabLayouts: new Map<string, TabPaneLayout>(),
  draftCache: new Map<string, string>(),

  initializePane: () => {
    // Try to restore per-tab layouts first
    const tabLayoutsData = loadAllTabLayouts();
    if (tabLayoutsData && tabLayoutsData.tabLayouts.size > 0) {
      // We have per-tab layouts - set them up
      // Set an initial empty pane as placeholder - switchToTab will load the real content
      const initialPane = createLeafPane(null);
      set({
        tabLayouts: tabLayoutsData.tabLayouts,
        root: initialPane,
        activePaneId: initialPane.id,
        currentTabId: null, // Important: leave null so switchToTab is called from App.tsx
      });
      return;
    }

    // Try legacy single-pane layout
    const restored = loadPaneLayout();
    if (restored) {
      set({
        root: restored.root,
        activePaneId: restored.activePaneId,
      });

      // Load note content for all panes that have a notePath
      const leaves = collectLeafPanes(restored.root);
      leaves.forEach(async (pane) => {
        if (pane.notePath) {
          try {
            const note = await invoke<Note>("read_note", { path: pane.notePath });
            const { root, draftCache } = get();
            if (!root) return;

            // Check for draft
            const draft = draftCache.get(pane.notePath);
            const contentToUse = draft !== undefined ? draft : note.content;
            const hasDraftChanges = draft !== undefined && draft !== note.content;

            set({
              root: updatePaneInTree(root, pane.id, (p) => ({
                ...p,
                note,
                editorContent: contentToUse,
                originalContent: note.content,
                hasUnsavedChanges: hasDraftChanges,
              })),
            });
          } catch (error) {
            console.warn(`Failed to load note for pane: ${pane.notePath}`, error);
          }
        }
      });
      return;
    }

    // No saved layout, create default
    const initialPane = createLeafPane(null);
    set({
      root: initialPane,
      activePaneId: initialPane.id,
    });
  },

  splitPane: (paneId: string, direction: SplitDirection) => {
    const { root } = get();
    if (!root) return;

    const targetPane = findPaneInTree(root, paneId);
    if (!targetPane) return;

    // Create a new empty pane
    const newPane = createLeafPane(null);

    // Create a split containing the original pane and the new pane
    const newSplit: PaneSplit = {
      type: 'split',
      id: generatePaneId(),
      direction,
      children: [targetPane, newPane],
      ratio: 50,
    };

    // Replace the target pane with the new split
    const newRoot = replaceNodeInTree(root, paneId, newSplit);

    set({
      root: newRoot,
      activePaneId: newPane.id, // Focus the new pane
    });

    // Save all tab layouts
    const { currentTabId, tabLayouts } = get();
    saveAllTabLayouts(currentTabId, newRoot, newPane.id, tabLayouts);
  },

  closePane: (paneId: string) => {
    const { root, activePaneId, draftCache } = get();
    if (!root) return;

    // Can't close if it's the only pane
    const leafCount = collectLeafPanes(root).length;
    if (leafCount <= 1) return;

    // Find the pane to check for unsaved changes
    const paneToClose = findPaneInTree(root, paneId);
    if (paneToClose?.hasUnsavedChanges && paneToClose.notePath) {
      // Save to draft cache before closing
      draftCache.set(paneToClose.notePath, paneToClose.editorContent);
      set({ draftCache: new Map(draftCache) });
    }

    // Find parent split
    const parentInfo = findParentSplitInTree(root, paneId, null, 0);
    if (!parentInfo) return;

    const { split, childIndex } = parentInfo;

    // Get the sibling that will replace the split
    const siblingIndex = childIndex === 0 ? 1 : 0;
    const sibling = split.children[siblingIndex];

    // Replace the split with the sibling
    const newRoot = replaceNodeInTree(root, split.id, sibling);

    // Update active pane if the closed pane was active
    let newActivePaneId = activePaneId;
    if (activePaneId === paneId) {
      // Find first leaf in sibling
      const siblingLeaves = collectLeafPanes(sibling);
      newActivePaneId = siblingLeaves[0]?.id || null;
    }

    set({
      root: newRoot,
      activePaneId: newActivePaneId,
    });

    // Save all tab layouts
    const { currentTabId, tabLayouts } = get();
    saveAllTabLayouts(currentTabId, newRoot, newActivePaneId, tabLayouts);
  },

  setActivePane: (paneId: string) => {
    const { root, currentTabId, tabLayouts } = get();
    const pane = findPaneInTree(root, paneId);
    if (pane) {
      set({ activePaneId: paneId });
      // Save all tab layouts (active pane changed)
      saveAllTabLayouts(currentTabId, root, paneId, tabLayouts);
    }
  },

  openNoteInPane: async (paneId: string, notePath: string) => {
    const { root, draftCache } = get();
    if (!root) return;

    const pane = findPaneInTree(root, paneId);
    if (!pane) return;

    // Save current content to draft cache before switching (soft-save)
    if (pane.hasUnsavedChanges && pane.notePath && pane.notePath !== notePath) {
      draftCache.set(pane.notePath, pane.editorContent);
      set({ draftCache: new Map(draftCache) });
    }

    // Set loading state
    set({
      root: updatePaneInTree(root, paneId, (p) => ({
        ...p,
        isLoading: true,
      })),
    });

    try {
      const note = await invoke<Note>("read_note", { path: notePath });

      // Check if there's a draft for this note
      const draft = draftCache.get(notePath);
      const contentToUse = draft !== undefined ? draft : note.content;
      const hasDraftChanges = draft !== undefined && draft !== note.content;

      // Update pane with note data
      set({
        root: updatePaneInTree(get().root, paneId, (p) => {
          // Update history
          let newHistory = [...p.history];
          let newHistoryIndex = p.historyIndex;

          // Add to history if not navigating
          if (newHistory[newHistoryIndex] !== notePath) {
            // Truncate forward history
            newHistory = newHistory.slice(0, newHistoryIndex + 1);
            newHistory.push(notePath);
            newHistoryIndex = newHistory.length - 1;

            // Keep max 50 entries
            if (newHistory.length > 50) {
              newHistory = newHistory.slice(-50);
              newHistoryIndex = newHistory.length - 1;
            }
          }

          return {
            ...p,
            notePath,
            note,
            editorContent: contentToUse,
            originalContent: note.content,
            hasUnsavedChanges: hasDraftChanges,
            isLoading: false,
            history: newHistory,
            historyIndex: newHistoryIndex,
          };
        }),
      });

      // Trigger hook for extensions
      triggerHook("onNoteOpen", { note, path: notePath });

      // Save all tab layouts (note changed in pane)
      const { root: updatedRoot, activePaneId, currentTabId, tabLayouts } = get();
      saveAllTabLayouts(currentTabId, updatedRoot, activePaneId, tabLayouts);
    } catch (error) {
      console.error("Failed to open note:", error);
      set({
        root: updatePaneInTree(get().root, paneId, (p) => ({
          ...p,
          isLoading: false,
        })),
      });
    }
  },

  openNoteInActivePane: async (notePath: string) => {
    const { activePaneId, openNoteInPane, root } = get();

    // If we have an active pane, use it
    if (activePaneId && root) {
      await openNoteInPane(activePaneId, notePath);
      return;
    }

    // No active pane - need to create a new tab first
    // Import useUIStore dynamically to avoid circular dependency issues
    const { useUIStore } = await import('./uiStore');
    const uiStore = useUIStore.getState();

    // Create a new tab for this note
    const newTabId = uiStore.openTab(notePath);

    // Create a layout for the new tab with a pane containing this note
    const newPane = createLeafPane(null);
    set({
      root: newPane,
      activePaneId: newPane.id,
      currentTabId: newTabId,
      tabLayouts: new Map(get().tabLayouts),
    });

    // Now open the note in this pane
    await openNoteInPane(newPane.id, notePath);
  },

  openNoteInNewPane: async (notePath: string, direction: SplitDirection = 'horizontal') => {
    const { activePaneId, splitPane, openNoteInPane, getAllLeafPanes } = get();
    if (!activePaneId) return;

    // Split the active pane
    splitPane(activePaneId, direction);

    // Get the new pane (it's now the active one after split)
    const leaves = getAllLeafPanes();
    const newPane = leaves.find(p => p.notePath === null);

    if (newPane) {
      await openNoteInPane(newPane.id, notePath);
    }
  },

  setPaneContent: (paneId: string, content: string) => {
    const { root } = get();
    if (!root) return;

    // Get the pane to find its notePath
    const pane = findPaneInTree(root, paneId);
    if (!pane) return;

    const notePath = pane.notePath;

    // Update the source pane
    let newRoot = updatePaneInTree(root, paneId, (p) => ({
      ...p,
      editorContent: content,
      hasUnsavedChanges: content !== p.originalContent,
    }));

    // Sync content to all other panes with the same file
    if (notePath && newRoot) {
      const allPanes = collectLeafPanes(newRoot);
      for (const otherPane of allPanes) {
        if (otherPane.id !== paneId && otherPane.notePath === notePath) {
          newRoot = updatePaneInTree(newRoot, otherPane.id, (p) => ({
            ...p,
            editorContent: content,
            hasUnsavedChanges: content !== p.originalContent,
          }));
        }
      }
    }

    set({ root: newRoot });
  },

  setPaneViewMode: (paneId: string, mode: EditorViewMode) => {
    const { root, activePaneId } = get();
    if (!root) return;

    const newRoot = updatePaneInTree(root, paneId, (p) => ({
      ...p,
      viewMode: mode,
    }));

    set({ root: newRoot });

    // Save all tab layouts (view mode changed)
    const { currentTabId, tabLayouts } = get();
    saveAllTabLayouts(currentTabId, newRoot, activePaneId, tabLayouts);
  },

  savePaneNote: async (paneId: string) => {
    const { root, draftCache } = get();
    if (!root) return;

    const pane = findPaneInTree(root, paneId);
    if (!pane || !pane.notePath) return;

    const notePath = pane.notePath;
    const savedContent = pane.editorContent;

    try {
      await invoke("write_note", {
        path: notePath,
        content: savedContent,
        createIfMissing: false,
      });

      // Clear draft for this note since we've saved it
      draftCache.delete(notePath);

      // Update all panes showing this file to mark them as saved
      let newRoot = get().root;
      if (newRoot) {
        const allPanes = collectLeafPanes(newRoot);
        for (const p of allPanes) {
          if (p.notePath === notePath) {
            newRoot = updatePaneInTree(newRoot, p.id, (paneToUpdate) => ({
              ...paneToUpdate,
              originalContent: savedContent,
              hasUnsavedChanges: false,
            }));
          }
        }
      }

      set({
        root: newRoot,
        draftCache: new Map(draftCache),
      });

      // Trigger hook for extensions
      if (pane.note) {
        triggerHook("onNoteSave", { note: { ...pane.note, content: savedContent }, path: notePath });
      }
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  },

  setPaneRatio: (splitId: string, ratio: number) => {
    const { root, activePaneId } = get();
    if (!root) return;

    const updateSplit = (node: PaneNode): PaneNode => {
      if (node.type === 'leaf') return node;

      if (node.id === splitId) {
        return { ...node, ratio };
      }

      return {
        ...node,
        children: [updateSplit(node.children[0]), updateSplit(node.children[1])] as [PaneNode, PaneNode],
      };
    };

    const newRoot = updateSplit(root);
    set({ root: newRoot });

    // Save all tab layouts (ratio changed)
    const { currentTabId, tabLayouts } = get();
    saveAllTabLayouts(currentTabId, newRoot, activePaneId, tabLayouts);
  },

  // Navigation
  goBackInPane: async (paneId: string) => {
    const { root, openNoteInPane } = get();
    if (!root) return;

    const pane = findPaneInTree(root, paneId);
    if (!pane || pane.historyIndex <= 0) return;

    const newIndex = pane.historyIndex - 1;
    const previousPath = pane.history[newIndex];

    // Update history index first
    set({
      root: updatePaneInTree(root, paneId, (p) => ({
        ...p,
        historyIndex: newIndex,
      })),
    });

    // Open the note (it will update history, but index is already at correct position)
    if (previousPath) {
      await openNoteInPane(paneId, previousPath);
    }
  },

  goForwardInPane: async (paneId: string) => {
    const { root, openNoteInPane } = get();
    if (!root) return;

    const pane = findPaneInTree(root, paneId);
    if (!pane || pane.historyIndex >= pane.history.length - 1) return;

    const newIndex = pane.historyIndex + 1;
    const nextPath = pane.history[newIndex];

    // Update history index first
    set({
      root: updatePaneInTree(root, paneId, (p) => ({
        ...p,
        historyIndex: newIndex,
      })),
    });

    // Open the note
    if (nextPath) {
      await openNoteInPane(paneId, nextPath);
    }
  },

  canGoBackInPane: (paneId: string) => {
    const pane = findPaneInTree(get().root, paneId);
    return pane ? pane.historyIndex > 0 : false;
  },

  canGoForwardInPane: (paneId: string) => {
    const pane = findPaneInTree(get().root, paneId);
    return pane ? pane.historyIndex < pane.history.length - 1 : false;
  },

  // Utilities
  findPane: (paneId: string) => {
    return findPaneInTree(get().root, paneId);
  },

  findParentSplit: (paneId: string) => {
    return findParentSplitInTree(get().root, paneId, null, 0);
  },

  getActivePane: () => {
    const { root, activePaneId } = get();
    if (!activePaneId) return null;
    return findPaneInTree(root, activePaneId);
  },

  getAllLeafPanes: () => {
    return collectLeafPanes(get().root);
  },

  getLeafCount: () => {
    return collectLeafPanes(get().root).length;
  },

  // Draft cache actions
  saveDraft: (path: string, content: string) => {
    const { draftCache } = get();
    draftCache.set(path, content);
    set({ draftCache: new Map(draftCache) });
  },

  clearDraft: (path: string) => {
    const { draftCache } = get();
    draftCache.delete(path);
    set({ draftCache: new Map(draftCache) });
  },

  getDraft: (path: string) => {
    return get().draftCache.get(path);
  },

  hasDraft: (path: string) => {
    return get().draftCache.has(path);
  },

  // Tab-pane management
  switchToTab: (tabId: string) => {
    const { root, activePaneId, currentTabId, tabLayouts } = get();

    // If switching to the same tab, do nothing
    if (currentTabId === tabId) return;

    // Check if we have a saved layout for the new tab FIRST
    // This is important for initial load where currentTabId is null but we have saved layouts
    const savedLayout = tabLayouts.get(tabId);

    // Special case: If this is the first tab (no currentTabId), no saved layout,
    // and we have an existing layout, just associate the current layout with this tab
    if (!currentTabId && !savedLayout && root && activePaneId) {
      set({
        currentTabId: tabId,
        tabLayouts: new Map(tabLayouts),
      });
      return;
    }

    // Save current layout for the current tab (if we have one)
    if (currentTabId && root && activePaneId) {
      tabLayouts.set(currentTabId, { root, activePaneId });
    }

    if (savedLayout) {
      // Restore the saved layout
      set({
        root: savedLayout.root,
        activePaneId: savedLayout.activePaneId,
        currentTabId: tabId,
        tabLayouts: new Map(tabLayouts),
      });

      // Reload content for all panes
      const leaves = collectLeafPanes(savedLayout.root);
      leaves.forEach(async (pane) => {
        if (pane.notePath) {
          try {
            const note = await invoke<Note>("read_note", { path: pane.notePath });
            const { root: currentRoot, draftCache } = get();
            if (!currentRoot) return;

            const draft = draftCache.get(pane.notePath);
            const contentToUse = draft !== undefined ? draft : note.content;
            const hasDraftChanges = draft !== undefined && draft !== note.content;

            set({
              root: updatePaneInTree(currentRoot, pane.id, (p) => ({
                ...p,
                note,
                editorContent: contentToUse,
                originalContent: note.content,
                hasUnsavedChanges: hasDraftChanges,
              })),
            });
          } catch (error) {
            console.warn(`Failed to load note for pane: ${pane.notePath}`, error);
          }
        }
      });
    } else {
      // No saved layout - create a fresh empty pane for this tab
      const newPane = createLeafPane(null);
      set({
        root: newPane,
        activePaneId: newPane.id,
        currentTabId: tabId,
        tabLayouts: new Map(tabLayouts),
      });
    }

    // Save all tab layouts
    const { root: newRoot, activePaneId: newActiveId, currentTabId: newCurrentTabId, tabLayouts: newTabLayouts } = get();
    saveAllTabLayouts(newCurrentTabId, newRoot, newActiveId, newTabLayouts);
  },

  createLayoutForTab: (tabId: string) => {
    const { tabLayouts, currentTabId, root, activePaneId } = get();

    // If this is the first tab and we don't have a current tab, set it
    if (!currentTabId) {
      // Create a fresh pane for this tab
      const newPane = createLeafPane(null);
      set({
        root: newPane,
        activePaneId: newPane.id,
        currentTabId: tabId,
      });
      return;
    }

    // Save current layout before creating new
    if (currentTabId && root && activePaneId) {
      tabLayouts.set(currentTabId, { root, activePaneId });
    }

    // Create a fresh empty pane for the new tab
    const newPane = createLeafPane(null);
    set({
      root: newPane,
      activePaneId: newPane.id,
      currentTabId: tabId,
      tabLayouts: new Map(tabLayouts),
    });

    // Save all tab layouts
    saveAllTabLayouts(tabId, newPane, newPane.id, tabLayouts);
  },

  removeTabLayout: (tabId: string) => {
    const { tabLayouts, root, activePaneId, currentTabId } = get();
    if (tabLayouts.has(tabId)) {
      tabLayouts.delete(tabId);
      set({ tabLayouts: new Map(tabLayouts) });
      // Save updated layouts
      saveAllTabLayouts(currentTabId, root, activePaneId, tabLayouts);
    }
  },

  clearAllLayouts: () => {
    // Reset to empty state - no tabs, no panes
    set({
      root: null,
      activePaneId: null,
      currentTabId: null,
      tabLayouts: new Map(),
    });
    // Clear persisted layouts
    try {
      localStorage.removeItem(TAB_LAYOUTS_STORAGE_KEY);
      localStorage.removeItem(PANE_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear layout storage:', e);
    }
  },
}));
