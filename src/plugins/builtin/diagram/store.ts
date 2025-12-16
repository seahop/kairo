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
} from "./types";

interface DiagramState {
  // Data
  boards: DiagramBoard[];
  currentBoard: DiagramBoard | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];

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

  // Actions - Boards
  loadBoards: () => Promise<void>;
  loadBoard: (boardId: string) => Promise<void>;
  createBoard: (name: string, description?: string) => Promise<DiagramBoard>;
  updateBoard: (boardId: string, name?: string, description?: string, viewport?: Viewport) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;

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
}

export const useDiagramStore = create<DiagramState>((set, _get) => ({
  // Initial state
  boards: [],
  currentBoard: null,
  nodes: [],
  edges: [],
  showView: false,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  isLoading: false,
  error: null,
  showCreateModal: false,
  showDeleteConfirm: false,
  boardToDelete: null,

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
}));
