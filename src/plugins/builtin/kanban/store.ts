import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface KanbanCard {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  noteId?: string;
  notePath?: string;
  position: number;
  metadata?: Record<string, unknown>;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color?: string;
}

export interface KanbanBoard {
  id: string;
  name: string;
  columns: KanbanColumn[];
  createdAt: number;
  modifiedAt: number;
}

interface KanbanState {
  boards: KanbanBoard[];
  currentBoard: KanbanBoard | null;
  cards: KanbanCard[];
  isLoading: boolean;
  error: string | null;
  showView: boolean;
  showCreateModal: boolean;

  // Actions
  loadBoards: () => Promise<void>;
  loadBoard: (id: string) => Promise<void>;
  createBoard: (name: string, columns?: string[]) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  addColumn: (boardId: string, name: string) => Promise<void>;
  removeColumn: (boardId: string, columnId: string) => Promise<void>;
  addCard: (boardId: string, columnId: string, title: string, noteId?: string) => Promise<void>;
  moveCard: (cardId: string, toColumnId: string, position: number) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  toggleView: () => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  setCurrentBoard: (board: KanbanBoard | null) => void;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  boards: [],
  currentBoard: null,
  cards: [],
  isLoading: false,
  error: null,
  showView: false,
  showCreateModal: false,

  loadBoards: async () => {
    set({ isLoading: true, error: null });
    try {
      const boards = await invoke<KanbanBoard[]>("kanban_list_boards");
      set({ boards, isLoading: false });

      // Load the first board if available
      if (boards.length > 0 && !get().currentBoard) {
        get().loadBoard(boards[0].id);
      }
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  loadBoard: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const board = await invoke<KanbanBoard>("kanban_get_board", { boardId: id });
      const cards = await invoke<KanbanCard[]>("kanban_get_cards", { boardId: id });
      set({ currentBoard: board, cards, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createBoard: async (name: string, columns?: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const defaultColumns = columns ?? ["To Do", "In Progress", "Done"];
      const board = await invoke<KanbanBoard>("kanban_create_board", {
        name,
        columns: defaultColumns,
      });
      set((state) => ({
        boards: [...state.boards, board],
        currentBoard: board,
        cards: [],
        showCreateModal: false,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  deleteBoard: async (id: string) => {
    try {
      await invoke("kanban_delete_board", { boardId: id });
      set((state) => ({
        boards: state.boards.filter((b) => b.id !== id),
        currentBoard: state.currentBoard?.id === id ? null : state.currentBoard,
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addColumn: async (boardId: string, name: string) => {
    try {
      const board = await invoke<KanbanBoard>("kanban_add_column", {
        boardId,
        name,
      });
      set((state) => ({
        currentBoard: state.currentBoard?.id === boardId ? board : state.currentBoard,
        boards: state.boards.map((b) => (b.id === boardId ? board : b)),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  removeColumn: async (boardId: string, columnId: string) => {
    try {
      const board = await invoke<KanbanBoard>("kanban_remove_column", {
        boardId,
        columnId,
      });
      set((state) => ({
        currentBoard: state.currentBoard?.id === boardId ? board : state.currentBoard,
        boards: state.boards.map((b) => (b.id === boardId ? board : b)),
        cards: state.cards.filter((c) => c.columnId !== columnId),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addCard: async (boardId: string, columnId: string, title: string, noteId?: string) => {
    try {
      const card = await invoke<KanbanCard>("kanban_add_card", {
        boardId,
        columnId,
        title,
        noteId,
      });
      set((state) => ({
        cards: [...state.cards, card],
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  moveCard: async (cardId: string, toColumnId: string, position: number) => {
    try {
      await invoke("kanban_move_card", { cardId, toColumnId, position });
      set((state) => ({
        cards: state.cards.map((c) =>
          c.id === cardId ? { ...c, columnId: toColumnId, position } : c
        ),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteCard: async (cardId: string) => {
    try {
      await invoke("kanban_delete_card", { cardId });
      set((state) => ({
        cards: state.cards.filter((c) => c.id !== cardId),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  toggleView: () => set((state) => ({ showView: !state.showView })),
  openCreateModal: () => set({ showCreateModal: true }),
  closeCreateModal: () => set({ showCreateModal: false }),
  setCurrentBoard: (board) => set({ currentBoard: board }),
}));
