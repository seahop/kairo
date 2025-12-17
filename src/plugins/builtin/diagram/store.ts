import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  DiagramBoard,
  DiagramNode,
  DiagramEdge,
  DiagramBoardFull,
  NodeData,
  EdgeData,
  Viewport,
  NodePositionUpdate,
  HistoryAction,
  DiagramLayer,
  ClipboardData,
} from "./types";

const MAX_HISTORY_SIZE = 50;

interface DiagramState {
  // Data
  boards: DiagramBoard[];
  currentBoard: DiagramBoard | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];

  // History for undo/redo
  history: HistoryAction[];
  historyIndex: number;

  // Layers
  layers: DiagramLayer[];
  activeLayerId: string | null;

  // Clipboard
  clipboard: ClipboardData | null;

  // UI State
  showView: boolean;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  isLoading: boolean;
  error: string | null;

  // Modal states
  showCreateModal: boolean;
  showDeleteConfirm: boolean;
  boardToDelete: DiagramBoard | null;
  showTemplates: boolean;
  showSearch: boolean;
  searchQuery: string;

  // Archive state
  showArchivedBoards: boolean;

  // Actions - Boards
  loadBoards: () => Promise<void>;
  loadBoard: (boardId: string) => Promise<void>;
  createBoard: (name: string, description?: string) => Promise<DiagramBoard>;
  updateBoard: (boardId: string, name?: string, description?: string, viewport?: Viewport) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  archiveBoard: (boardId: string, archived: boolean) => Promise<void>;
  setShowArchivedBoards: (show: boolean) => void;
  /** @deprecated Use addNoteLink instead */
  linkNote: (boardId: string, noteId: string | null) => Promise<void>;
  addNoteLink: (boardId: string, noteId: string) => Promise<void>;
  removeNoteLink: (boardId: string, noteId: string) => Promise<void>;
  removeAllNoteLinks: (boardId: string) => Promise<void>;

  // Actions - Nodes
  addNode: (
    boardId: string,
    nodeType: DiagramNode["nodeType"],
    positionX: number,
    positionY: number,
    width?: number,
    height?: number,
    data?: NodeData
  ) => Promise<DiagramNode>;
  updateNode: (
    nodeId: string,
    positionX?: number,
    positionY?: number,
    width?: number,
    height?: number,
    data?: NodeData,
    zIndex?: number
  ) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  bulkUpdateNodes: (boardId: string, updates: NodePositionUpdate[]) => Promise<void>;

  // Actions - Edges
  addEdge: (
    boardId: string,
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
    edgeType?: DiagramEdge["edgeType"],
    data?: EdgeData
  ) => Promise<DiagramEdge>;
  updateEdge: (
    edgeId: string,
    sourceHandle?: string,
    targetHandle?: string,
    edgeType?: DiagramEdge["edgeType"],
    data?: EdgeData
  ) => Promise<void>;
  deleteEdge: (edgeId: string) => Promise<void>;

  // Undo/Redo Actions
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushHistory: (action: HistoryAction) => void;
  clearHistory: () => void;

  // Clipboard Actions
  copySelection: () => void;
  pasteClipboard: (offsetX?: number, offsetY?: number) => Promise<void>;
  cutSelection: () => Promise<void>;

  // Layer Actions
  addLayer: (name: string) => void;
  updateLayer: (layerId: string, updates: Partial<DiagramLayer>) => void;
  deleteLayer: (layerId: string) => void;
  setActiveLayer: (layerId: string | null) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;

  // Alignment Actions
  alignNodes: (alignment: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle') => Promise<void>;
  distributeNodes: (direction: 'horizontal' | 'vertical') => Promise<void>;

  // Nudge Actions
  nudgeSelection: (dx: number, dy: number) => Promise<void>;

  // UI Actions
  toggleView: () => void;
  setShowView: (show: boolean) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  clearSelection: () => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  confirmDeleteBoard: (board: DiagramBoard) => void;
  cancelDeleteBoard: () => void;
  clearError: () => void;
  setShowTemplates: (show: boolean) => void;
  setShowSearch: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  // Initial state
  boards: [],
  currentBoard: null,
  nodes: [],
  edges: [],
  history: [],
  historyIndex: -1,
  layers: [{ id: 'default', name: 'Default', visible: true, locked: false, order: 0 }],
  activeLayerId: 'default',
  clipboard: null,
  showView: false,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  isLoading: false,
  error: null,
  showCreateModal: false,
  showDeleteConfirm: false,
  boardToDelete: null,
  showTemplates: false,
  showSearch: false,
  searchQuery: '',
  showArchivedBoards: false,

  // Board actions
  loadBoards: async () => {
    set({ isLoading: true, error: null });
    try {
      const boards = await invoke<DiagramBoard[]>("diagram_list_boards");
      set({ boards, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  loadBoard: async (boardId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await invoke<DiagramBoardFull>("diagram_get_board", { boardId });
      set({
        currentBoard: data.board,
        nodes: data.nodes,
        edges: data.edges,
        isLoading: false,
        selectedNodeIds: [],
        selectedEdgeIds: [],
      });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createBoard: async (name: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const board = await invoke<DiagramBoard>("diagram_create_board", { name, description });
      set((state) => ({
        boards: [board, ...state.boards],
        isLoading: false,
        showCreateModal: false,
      }));
      return board;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  updateBoard: async (boardId: string, name?: string, description?: string, viewport?: Viewport) => {
    try {
      const board = await invoke<DiagramBoard>("diagram_update_board", {
        boardId,
        name,
        description,
        viewport,
      });
      set((state) => ({
        boards: state.boards.map((b) => (b.id === boardId ? board : b)),
        currentBoard: state.currentBoard?.id === boardId ? board : state.currentBoard,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteBoard: async (boardId: string) => {
    try {
      await invoke("diagram_delete_board", { boardId });
      set((state) => ({
        boards: state.boards.filter((b) => b.id !== boardId),
        currentBoard: state.currentBoard?.id === boardId ? null : state.currentBoard,
        nodes: state.currentBoard?.id === boardId ? [] : state.nodes,
        edges: state.currentBoard?.id === boardId ? [] : state.edges,
        showDeleteConfirm: false,
        boardToDelete: null,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  archiveBoard: async (boardId: string, archived: boolean) => {
    try {
      await invoke("diagram_archive_board", { boardId, archived });
      set((state) => ({
        boards: state.boards.map((b) =>
          b.id === boardId ? { ...b, archived } : b
        ),
        // Close board if archiving and not showing archived
        currentBoard: state.currentBoard?.id === boardId && archived && !state.showArchivedBoards
          ? null
          : state.currentBoard,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setShowArchivedBoards: (show: boolean) => set({ showArchivedBoards: show }),

  linkNote: async (boardId: string, noteId: string | null) => {
    try {
      const board = await invoke<DiagramBoard>("diagram_link_note", { boardId, noteId });
      set((state) => ({
        boards: state.boards.map((b) => (b.id === boardId ? board : b)),
        currentBoard: state.currentBoard?.id === boardId ? board : state.currentBoard,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  addNoteLink: async (boardId: string, noteId: string) => {
    try {
      const board = await invoke<DiagramBoard>("diagram_add_note_link", { boardId, noteId });
      set((state) => ({
        boards: state.boards.map((b) => (b.id === boardId ? board : b)),
        currentBoard: state.currentBoard?.id === boardId ? board : state.currentBoard,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  removeNoteLink: async (boardId: string, noteId: string) => {
    try {
      const board = await invoke<DiagramBoard>("diagram_remove_note_link", { boardId, noteId });
      set((state) => ({
        boards: state.boards.map((b) => (b.id === boardId ? board : b)),
        currentBoard: state.currentBoard?.id === boardId ? board : state.currentBoard,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  removeAllNoteLinks: async (boardId: string) => {
    try {
      const board = await invoke<DiagramBoard>("diagram_remove_all_note_links", { boardId });
      set((state) => ({
        boards: state.boards.map((b) => (b.id === boardId ? board : b)),
        currentBoard: state.currentBoard?.id === boardId ? board : state.currentBoard,
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  // Node actions
  addNode: async (boardId, nodeType, positionX, positionY, width, height, data = {}) => {
    try {
      const node = await invoke<DiagramNode>("diagram_add_node", {
        boardId,
        nodeType,
        positionX,
        positionY,
        width,
        height,
        data,
      });
      set((state) => ({
        nodes: [...state.nodes, node],
      }));
      return node;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  updateNode: async (nodeId, positionX, positionY, width, height, data, zIndex) => {
    try {
      const node = await invoke<DiagramNode>("diagram_update_node", {
        nodeId,
        positionX,
        positionY,
        width,
        height,
        data,
        zIndex,
      });
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === nodeId ? node : n)),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteNode: async (nodeId: string) => {
    try {
      await invoke("diagram_delete_node", { nodeId });
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
        selectedNodeIds: state.selectedNodeIds.filter((id) => id !== nodeId),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  bulkUpdateNodes: async (boardId: string, updates: NodePositionUpdate[]) => {
    try {
      await invoke("diagram_bulk_update_nodes", { boardId, updates });
      set((state) => ({
        nodes: state.nodes.map((node) => {
          const update = updates.find((u) => u.id === node.id);
          if (update) {
            return { ...node, positionX: update.positionX, positionY: update.positionY };
          }
          return node;
        }),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  // Edge actions
  addEdge: async (boardId, sourceNodeId, targetNodeId, sourceHandle, targetHandle, edgeType, data) => {
    try {
      const edge = await invoke<DiagramEdge>("diagram_add_edge", {
        boardId,
        sourceNodeId,
        targetNodeId,
        sourceHandle,
        targetHandle,
        edgeType,
        data,
      });
      set((state) => ({
        edges: [...state.edges, edge],
      }));
      return edge;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  updateEdge: async (edgeId, sourceHandle, targetHandle, edgeType, data) => {
    try {
      const edge = await invoke<DiagramEdge>("diagram_update_edge", {
        edgeId,
        sourceHandle,
        targetHandle,
        edgeType,
        data,
      });
      set((state) => ({
        edges: state.edges.map((e) => (e.id === edgeId ? edge : e)),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteEdge: async (edgeId: string) => {
    try {
      await invoke("diagram_delete_edge", { edgeId });
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== edgeId),
        selectedEdgeIds: state.selectedEdgeIds.filter((id) => id !== edgeId),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  // UI actions
  toggleView: () => set((state) => ({ showView: !state.showView })),
  setShowView: (show: boolean) => set({ showView: show }),

  setSelection: (nodeIds: string[], edgeIds: string[]) =>
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }),

  clearSelection: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),

  openCreateModal: () => set({ showCreateModal: true }),
  closeCreateModal: () => set({ showCreateModal: false }),

  confirmDeleteBoard: (board: DiagramBoard) =>
    set({ showDeleteConfirm: true, boardToDelete: board }),

  cancelDeleteBoard: () => set({ showDeleteConfirm: false, boardToDelete: null }),

  clearError: () => set({ error: null }),

  setShowTemplates: (show: boolean) => set({ showTemplates: show }),
  setShowSearch: (show: boolean) => set({ showSearch: show }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  // Undo/Redo Actions
  pushHistory: (action: HistoryAction) => {
    set((state) => {
      // Truncate any future history if we're not at the end
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(action);
      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
        return { history: newHistory, historyIndex: newHistory.length - 1 };
      }
      return { history: newHistory, historyIndex: newHistory.length - 1 };
    });
  },

  clearHistory: () => set({ history: [], historyIndex: -1 }),

  canUndo: () => {
    const state = get();
    return state.historyIndex >= 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },

  undo: async () => {
    const state = get();
    if (state.historyIndex < 0) return;

    const action = state.history[state.historyIndex];

    try {
      switch (action.type) {
        case 'ADD_NODE':
          if (action.node) {
            await invoke("diagram_delete_node", { nodeId: action.node.id });
            set((s) => ({
              nodes: s.nodes.filter((n) => n.id !== action.node!.id),
              historyIndex: s.historyIndex - 1,
            }));
          }
          break;
        case 'DELETE_NODE':
          if (action.node) {
            const restoredNode = await invoke<DiagramNode>("diagram_add_node", {
              boardId: action.node.boardId,
              nodeType: action.node.nodeType,
              positionX: action.node.positionX,
              positionY: action.node.positionY,
              width: action.node.width,
              height: action.node.height,
              data: action.node.data,
            });
            // Also restore related edges
            const restoredEdges: DiagramEdge[] = [];
            if (action.relatedEdges) {
              for (const edge of action.relatedEdges) {
                const newEdge = await invoke<DiagramEdge>("diagram_add_edge", {
                  boardId: edge.boardId,
                  sourceNodeId: edge.sourceNodeId === action.node.id ? restoredNode.id : edge.sourceNodeId,
                  targetNodeId: edge.targetNodeId === action.node.id ? restoredNode.id : edge.targetNodeId,
                  sourceHandle: edge.sourceHandle,
                  targetHandle: edge.targetHandle,
                  edgeType: edge.edgeType,
                  data: edge.data,
                });
                restoredEdges.push(newEdge);
              }
            }
            set((s) => ({
              nodes: [...s.nodes, restoredNode],
              edges: [...s.edges, ...restoredEdges],
              historyIndex: s.historyIndex - 1,
            }));
          }
          break;
        case 'UPDATE_NODE':
          if (action.previousNode) {
            const node = await invoke<DiagramNode>("diagram_update_node", {
              nodeId: action.previousNode.id,
              positionX: action.previousNode.positionX,
              positionY: action.previousNode.positionY,
              width: action.previousNode.width,
              height: action.previousNode.height,
              data: action.previousNode.data,
              zIndex: action.previousNode.zIndex,
            });
            set((s) => ({
              nodes: s.nodes.map((n) => (n.id === node.id ? node : n)),
              historyIndex: s.historyIndex - 1,
            }));
          }
          break;
        case 'MOVE_NODES':
          if (action.previousNodes && state.currentBoard) {
            const updates = action.previousNodes.map((n) => ({
              id: n.id,
              positionX: n.positionX,
              positionY: n.positionY,
            }));
            await invoke("diagram_bulk_update_nodes", { boardId: state.currentBoard.id, updates });
            set((s) => ({
              nodes: s.nodes.map((node) => {
                const prev = action.previousNodes?.find((p) => p.id === node.id);
                return prev ? { ...node, positionX: prev.positionX, positionY: prev.positionY } : node;
              }),
              historyIndex: s.historyIndex - 1,
            }));
          }
          break;
        case 'ADD_EDGE':
          if (action.edge) {
            await invoke("diagram_delete_edge", { edgeId: action.edge.id });
            set((s) => ({
              edges: s.edges.filter((e) => e.id !== action.edge!.id),
              historyIndex: s.historyIndex - 1,
            }));
          }
          break;
        case 'DELETE_EDGE':
          if (action.edge) {
            const restoredEdge = await invoke<DiagramEdge>("diagram_add_edge", {
              boardId: action.edge.boardId,
              sourceNodeId: action.edge.sourceNodeId,
              targetNodeId: action.edge.targetNodeId,
              sourceHandle: action.edge.sourceHandle,
              targetHandle: action.edge.targetHandle,
              edgeType: action.edge.edgeType,
              data: action.edge.data,
            });
            set((s) => ({
              edges: [...s.edges, restoredEdge],
              historyIndex: s.historyIndex - 1,
            }));
          }
          break;
        case 'UPDATE_EDGE':
          if (action.previousEdge) {
            const edge = await invoke<DiagramEdge>("diagram_update_edge", {
              edgeId: action.previousEdge.id,
              sourceHandle: action.previousEdge.sourceHandle,
              targetHandle: action.previousEdge.targetHandle,
              edgeType: action.previousEdge.edgeType,
              data: action.previousEdge.data,
            });
            set((s) => ({
              edges: s.edges.map((e) => (e.id === edge.id ? edge : e)),
              historyIndex: s.historyIndex - 1,
            }));
          }
          break;
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  redo: async () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;

    const action = state.history[state.historyIndex + 1];

    try {
      switch (action.type) {
        case 'ADD_NODE':
          if (action.node) {
            const node = await invoke<DiagramNode>("diagram_add_node", {
              boardId: action.node.boardId,
              nodeType: action.node.nodeType,
              positionX: action.node.positionX,
              positionY: action.node.positionY,
              width: action.node.width,
              height: action.node.height,
              data: action.node.data,
            });
            set((s) => ({
              nodes: [...s.nodes, node],
              historyIndex: s.historyIndex + 1,
            }));
          }
          break;
        case 'DELETE_NODE':
          if (action.node) {
            await invoke("diagram_delete_node", { nodeId: action.node.id });
            set((s) => ({
              nodes: s.nodes.filter((n) => n.id !== action.node!.id),
              edges: s.edges.filter((e) => e.sourceNodeId !== action.node!.id && e.targetNodeId !== action.node!.id),
              historyIndex: s.historyIndex + 1,
            }));
          }
          break;
        case 'UPDATE_NODE':
          if (action.node) {
            const node = await invoke<DiagramNode>("diagram_update_node", {
              nodeId: action.node.id,
              positionX: action.node.positionX,
              positionY: action.node.positionY,
              width: action.node.width,
              height: action.node.height,
              data: action.node.data,
              zIndex: action.node.zIndex,
            });
            set((s) => ({
              nodes: s.nodes.map((n) => (n.id === node.id ? node : n)),
              historyIndex: s.historyIndex + 1,
            }));
          }
          break;
        case 'MOVE_NODES':
          if (action.nodes && state.currentBoard) {
            const updates = action.nodes.map((n) => ({
              id: n.id,
              positionX: n.positionX,
              positionY: n.positionY,
            }));
            await invoke("diagram_bulk_update_nodes", { boardId: state.currentBoard.id, updates });
            set((s) => ({
              nodes: s.nodes.map((node) => {
                const updated = action.nodes?.find((u) => u.id === node.id);
                return updated ? { ...node, positionX: updated.positionX, positionY: updated.positionY } : node;
              }),
              historyIndex: s.historyIndex + 1,
            }));
          }
          break;
        case 'ADD_EDGE':
          if (action.edge) {
            const edge = await invoke<DiagramEdge>("diagram_add_edge", {
              boardId: action.edge.boardId,
              sourceNodeId: action.edge.sourceNodeId,
              targetNodeId: action.edge.targetNodeId,
              sourceHandle: action.edge.sourceHandle,
              targetHandle: action.edge.targetHandle,
              edgeType: action.edge.edgeType,
              data: action.edge.data,
            });
            set((s) => ({
              edges: [...s.edges, edge],
              historyIndex: s.historyIndex + 1,
            }));
          }
          break;
        case 'DELETE_EDGE':
          if (action.edge) {
            await invoke("diagram_delete_edge", { edgeId: action.edge.id });
            set((s) => ({
              edges: s.edges.filter((e) => e.id !== action.edge!.id),
              historyIndex: s.historyIndex + 1,
            }));
          }
          break;
        case 'UPDATE_EDGE':
          if (action.edge) {
            const edge = await invoke<DiagramEdge>("diagram_update_edge", {
              edgeId: action.edge.id,
              sourceHandle: action.edge.sourceHandle,
              targetHandle: action.edge.targetHandle,
              edgeType: action.edge.edgeType,
              data: action.edge.data,
            });
            set((s) => ({
              edges: s.edges.map((e) => (e.id === edge.id ? edge : e)),
              historyIndex: s.historyIndex + 1,
            }));
          }
          break;
      }
    } catch (e) {
      set({ error: String(e) });
    }
  },

  // Clipboard Actions
  copySelection: () => {
    const state = get();
    const selectedNodes = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    const selectedEdges = state.edges.filter((e) => state.selectedEdgeIds.includes(e.id));

    // Also include edges that connect selected nodes
    const connectedEdges = state.edges.filter(
      (e) =>
        state.selectedNodeIds.includes(e.sourceNodeId) &&
        state.selectedNodeIds.includes(e.targetNodeId) &&
        !state.selectedEdgeIds.includes(e.id)
    );

    set({
      clipboard: {
        nodes: selectedNodes,
        edges: [...selectedEdges, ...connectedEdges],
        timestamp: Date.now(),
      },
    });
  },

  pasteClipboard: async (offsetX = 50, offsetY = 50) => {
    const state = get();
    if (!state.clipboard || !state.currentBoard) return;

    const idMap = new Map<string, string>();
    const newNodes: DiagramNode[] = [];

    // Create new nodes with offset positions
    for (const node of state.clipboard.nodes) {
      const newNode = await invoke<DiagramNode>("diagram_add_node", {
        boardId: state.currentBoard.id,
        nodeType: node.nodeType,
        positionX: node.positionX + offsetX,
        positionY: node.positionY + offsetY,
        width: node.width,
        height: node.height,
        data: node.data,
      });
      idMap.set(node.id, newNode.id);
      newNodes.push(newNode);
    }

    // Create new edges with updated node references
    const newEdges: DiagramEdge[] = [];
    for (const edge of state.clipboard.edges) {
      const newSourceId = idMap.get(edge.sourceNodeId);
      const newTargetId = idMap.get(edge.targetNodeId);
      if (newSourceId && newTargetId) {
        const newEdge = await invoke<DiagramEdge>("diagram_add_edge", {
          boardId: state.currentBoard.id,
          sourceNodeId: newSourceId,
          targetNodeId: newTargetId,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          edgeType: edge.edgeType,
          data: edge.data,
        });
        newEdges.push(newEdge);
      }
    }

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      selectedNodeIds: newNodes.map((n) => n.id),
      selectedEdgeIds: newEdges.map((e) => e.id),
    }));
  },

  cutSelection: async () => {
    const state = get();
    // Copy first
    state.copySelection();

    // Store nodes and related edges for history before deleting
    const nodesToDelete = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    const edgesToDelete = state.edges.filter(
      (e) =>
        state.selectedEdgeIds.includes(e.id) ||
        state.selectedNodeIds.includes(e.sourceNodeId) ||
        state.selectedNodeIds.includes(e.targetNodeId)
    );

    // Push history for each deleted node (with related edges)
    for (const node of nodesToDelete) {
      const relatedEdges = edgesToDelete.filter(
        (e) => e.sourceNodeId === node.id || e.targetNodeId === node.id
      );
      get().pushHistory({
        type: 'DELETE_NODE',
        node,
        relatedEdges,
      });
    }

    // Push history for standalone deleted edges (not connected to deleted nodes)
    for (const edge of state.edges.filter((e) => state.selectedEdgeIds.includes(e.id))) {
      if (!state.selectedNodeIds.includes(edge.sourceNodeId) && !state.selectedNodeIds.includes(edge.targetNodeId)) {
        get().pushHistory({
          type: 'DELETE_EDGE',
          edge,
        });
      }
    }

    // Then delete from backend
    for (const nodeId of state.selectedNodeIds) {
      await invoke("diagram_delete_node", { nodeId });
    }
    for (const edgeId of state.selectedEdgeIds) {
      await invoke("diagram_delete_edge", { edgeId });
    }
    set((s) => ({
      nodes: s.nodes.filter((n) => !s.selectedNodeIds.includes(n.id)),
      edges: s.edges.filter(
        (e) =>
          !s.selectedEdgeIds.includes(e.id) &&
          !s.selectedNodeIds.includes(e.sourceNodeId) &&
          !s.selectedNodeIds.includes(e.targetNodeId)
      ),
      selectedNodeIds: [],
      selectedEdgeIds: [],
    }));
  },

  // Layer Actions
  addLayer: (name: string) => {
    const id = `layer-${Date.now()}`;
    set((state) => ({
      layers: [
        ...state.layers,
        { id, name, visible: true, locked: false, order: state.layers.length },
      ],
    }));
  },

  updateLayer: (layerId: string, updates: Partial<DiagramLayer>) => {
    set((state) => ({
      layers: state.layers.map((l) => (l.id === layerId ? { ...l, ...updates } : l)),
    }));
  },

  deleteLayer: (layerId: string) => {
    if (layerId === 'default') return; // Can't delete default layer
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== layerId),
      activeLayerId: state.activeLayerId === layerId ? 'default' : state.activeLayerId,
    }));
  },

  setActiveLayer: (layerId: string | null) => set({ activeLayerId: layerId }),

  toggleLayerVisibility: (layerId: string) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
    }));
  },

  toggleLayerLock: (layerId: string) => {
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === layerId ? { ...l, locked: !l.locked } : l
      ),
    }));
  },

  // Alignment Actions
  alignNodes: async (alignment) => {
    const state = get();
    if (state.selectedNodeIds.length < 2 || !state.currentBoard) return;

    const selectedNodes = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    const previousNodes = selectedNodes.map((n) => ({ ...n }));

    let updates: NodePositionUpdate[] = [];

    switch (alignment) {
      case 'left': {
        const minX = Math.min(...selectedNodes.map((n) => n.positionX));
        updates = selectedNodes.map((n) => ({ id: n.id, positionX: minX, positionY: n.positionY }));
        break;
      }
      case 'right': {
        const maxX = Math.max(...selectedNodes.map((n) => n.positionX + (n.width || 100)));
        updates = selectedNodes.map((n) => ({
          id: n.id,
          positionX: maxX - (n.width || 100),
          positionY: n.positionY,
        }));
        break;
      }
      case 'center': {
        const minX = Math.min(...selectedNodes.map((n) => n.positionX));
        const maxX = Math.max(...selectedNodes.map((n) => n.positionX + (n.width || 100)));
        const centerX = (minX + maxX) / 2;
        updates = selectedNodes.map((n) => ({
          id: n.id,
          positionX: centerX - (n.width || 100) / 2,
          positionY: n.positionY,
        }));
        break;
      }
      case 'top': {
        const minY = Math.min(...selectedNodes.map((n) => n.positionY));
        updates = selectedNodes.map((n) => ({ id: n.id, positionX: n.positionX, positionY: minY }));
        break;
      }
      case 'bottom': {
        const maxY = Math.max(...selectedNodes.map((n) => n.positionY + (n.height || 100)));
        updates = selectedNodes.map((n) => ({
          id: n.id,
          positionX: n.positionX,
          positionY: maxY - (n.height || 100),
        }));
        break;
      }
      case 'middle': {
        const minY = Math.min(...selectedNodes.map((n) => n.positionY));
        const maxY = Math.max(...selectedNodes.map((n) => n.positionY + (n.height || 100)));
        const centerY = (minY + maxY) / 2;
        updates = selectedNodes.map((n) => ({
          id: n.id,
          positionX: n.positionX,
          positionY: centerY - (n.height || 100) / 2,
        }));
        break;
      }
    }

    if (updates.length > 0) {
      await invoke("diagram_bulk_update_nodes", { boardId: state.currentBoard.id, updates });

      // Push to history
      const newNodes = selectedNodes.map((n) => {
        const update = updates.find((u) => u.id === n.id);
        return update ? { ...n, positionX: update.positionX, positionY: update.positionY } : n;
      });

      get().pushHistory({
        type: 'MOVE_NODES',
        nodes: newNodes,
        previousNodes,
      });

      set((s) => ({
        nodes: s.nodes.map((node) => {
          const update = updates.find((u) => u.id === node.id);
          return update ? { ...node, positionX: update.positionX, positionY: update.positionY } : node;
        }),
      }));
    }
  },

  distributeNodes: async (direction) => {
    const state = get();
    if (state.selectedNodeIds.length < 3 || !state.currentBoard) return;

    const selectedNodes = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    const previousNodes = selectedNodes.map((n) => ({ ...n }));

    let updates: NodePositionUpdate[] = [];

    if (direction === 'horizontal') {
      // Sort by x position
      const sorted = [...selectedNodes].sort((a, b) => a.positionX - b.positionX);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalWidth = (last.positionX + (last.width || 100)) - first.positionX;
      const nodesWidth = sorted.reduce((sum, n) => sum + (n.width || 100), 0);
      const gap = (totalWidth - nodesWidth) / (sorted.length - 1);

      let currentX = first.positionX;
      updates = sorted.map((n) => {
        const update = { id: n.id, positionX: currentX, positionY: n.positionY };
        currentX += (n.width || 100) + gap;
        return update;
      });
    } else {
      // Sort by y position
      const sorted = [...selectedNodes].sort((a, b) => a.positionY - b.positionY);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalHeight = (last.positionY + (last.height || 100)) - first.positionY;
      const nodesHeight = sorted.reduce((sum, n) => sum + (n.height || 100), 0);
      const gap = (totalHeight - nodesHeight) / (sorted.length - 1);

      let currentY = first.positionY;
      updates = sorted.map((n) => {
        const update = { id: n.id, positionX: n.positionX, positionY: currentY };
        currentY += (n.height || 100) + gap;
        return update;
      });
    }

    if (updates.length > 0) {
      await invoke("diagram_bulk_update_nodes", { boardId: state.currentBoard.id, updates });

      const newNodes = selectedNodes.map((n) => {
        const update = updates.find((u) => u.id === n.id);
        return update ? { ...n, positionX: update.positionX, positionY: update.positionY } : n;
      });

      get().pushHistory({
        type: 'MOVE_NODES',
        nodes: newNodes,
        previousNodes,
      });

      set((s) => ({
        nodes: s.nodes.map((node) => {
          const update = updates.find((u) => u.id === node.id);
          return update ? { ...node, positionX: update.positionX, positionY: update.positionY } : node;
        }),
      }));
    }
  },

  // Nudge Actions
  nudgeSelection: async (dx: number, dy: number) => {
    const state = get();
    if (state.selectedNodeIds.length === 0 || !state.currentBoard) return;

    const selectedNodes = state.nodes.filter((n) => state.selectedNodeIds.includes(n.id));
    const previousNodes = selectedNodes.map((n) => ({ ...n }));

    const updates = selectedNodes.map((n) => ({
      id: n.id,
      positionX: n.positionX + dx,
      positionY: n.positionY + dy,
    }));

    await invoke("diagram_bulk_update_nodes", { boardId: state.currentBoard.id, updates });

    const newNodes = selectedNodes.map((n) => ({
      ...n,
      positionX: n.positionX + dx,
      positionY: n.positionY + dy,
    }));

    // Push to history for undo/redo
    get().pushHistory({
      type: 'MOVE_NODES',
      nodes: newNodes,
      previousNodes,
    });

    set((s) => ({
      nodes: s.nodes.map((node) => {
        const update = updates.find((u) => u.id === node.id);
        return update ? { ...node, positionX: update.positionX, positionY: update.positionY } : node;
      }),
    }));
  },
}));
