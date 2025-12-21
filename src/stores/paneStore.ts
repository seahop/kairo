import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { triggerHook } from "@/plugins/api/hooks";
import { EditorViewMode } from "@/stores/uiStore";

// Types
export type SplitDirection = 'horizontal' | 'vertical';

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

interface PaneState {
  root: PaneNode | null;
  activePaneId: string | null;

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
  draftCache: new Map<string, string>(),

  initializePane: () => {
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
  },

  setActivePane: (paneId: string) => {
    const pane = findPaneInTree(get().root, paneId);
    if (pane) {
      set({ activePaneId: paneId });
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
    const { activePaneId, openNoteInPane } = get();
    if (activePaneId) {
      await openNoteInPane(activePaneId, notePath);
    }
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
    const { root } = get();
    if (!root) return;

    set({
      root: updatePaneInTree(root, paneId, (p) => ({
        ...p,
        viewMode: mode,
      })),
    });
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
    const { root } = get();
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

    set({ root: updateSplit(root) });
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
}));
