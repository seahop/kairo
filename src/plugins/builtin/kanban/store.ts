import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { CardTemplate, BUILTIN_TEMPLATES, TEMPLATE_STORAGE_KEY } from "./templates";

export type Priority = "low" | "medium" | "high" | "urgent";

export interface CardMetadata {
  assignees: string[];
  labels: string[];
}

export interface KanbanCard {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description?: string;
  noteId?: string;
  notePath?: string;
  position: number;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
  dueDate?: number;
  priority?: Priority;
  metadata?: CardMetadata;
}

export interface KanbanColumn {
  id: string;
  name: string;
  color?: string;
  isDone: boolean;
}

export interface KanbanBoard {
  id: string;
  name: string;
  columns: KanbanColumn[];
  createdAt: number;
  modifiedAt: number;
}

export interface KanbanLabel {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface BoardMember {
  id: string;
  boardId: string;
  name: string;
  addedAt: number;
}

export interface CardUpdateInput {
  title?: string;
  description?: string;
  dueDate?: number | null;
  priority?: Priority | null;
  assignees?: string[];
  labels?: string[];
}

interface CreateCardData {
  columnId: string;
  title: string;
  description: string;
  priority: Priority | "";
  dueDate: string;
  assignees: string[];
}

interface KanbanState {
  boards: KanbanBoard[];
  currentBoard: KanbanBoard | null;
  cards: KanbanCard[];
  labels: KanbanLabel[];
  boardMembers: BoardMember[];
  selectedCard: KanbanCard | null;
  showCardDetail: boolean;
  assigneeSuggestions: string[];
  isLoading: boolean;
  error: string | null;
  showView: boolean;
  showCreateModal: boolean;
  showCreateCardModal: boolean;
  createCardData: CreateCardData | null;
  customTemplates: CardTemplate[];
  selectedTemplateId: string | null;

  // Board actions
  loadBoards: () => Promise<void>;
  loadBoard: (id: string) => Promise<void>;
  createBoard: (name: string, columns?: string[]) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;

  // Column actions
  addColumn: (boardId: string, name: string) => Promise<void>;
  removeColumn: (boardId: string, columnId: string) => Promise<void>;
  updateColumn: (
    boardId: string,
    columnId: string,
    updates: { name?: string; color?: string; isDone?: boolean }
  ) => Promise<void>;

  // Card actions
  addCard: (boardId: string, columnId: string, title: string, noteId?: string) => Promise<void>;
  updateCard: (cardId: string, updates: CardUpdateInput) => Promise<void>;
  moveCard: (cardId: string, toColumnId: string, position: number) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  takeCard: (cardId: string, username: string) => Promise<void>;

  // Card detail panel
  openCardDetail: (card: KanbanCard) => void;
  closeCardDetail: () => void;
  setSelectedCard: (card: KanbanCard | null) => void;

  // Label actions
  loadLabels: (boardId: string) => Promise<void>;
  createLabel: (boardId: string, name: string, color: string) => Promise<void>;
  updateLabel: (labelId: string, name: string, color: string) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<void>;

  // Board member actions
  loadBoardMembers: (boardId: string) => Promise<void>;
  addBoardMember: (boardId: string, name: string) => Promise<void>;
  removeBoardMember: (memberId: string) => Promise<void>;

  // Assignee suggestions (from board members)
  loadAssigneeSuggestions: () => Promise<void>;

  // UI actions
  toggleView: () => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  setCurrentBoard: (board: KanbanBoard | null) => void;
  openCreateCardModal: (columnId: string) => void;
  closeCreateCardModal: () => void;
  createCardWithDetails: (data: CreateCardData) => Promise<void>;

  // Template actions
  loadCustomTemplates: () => Promise<void>;
  saveCustomTemplate: (template: Omit<CardTemplate, "id">) => Promise<void>;
  deleteCustomTemplate: (templateId: string) => Promise<void>;
  selectTemplate: (templateId: string | null) => void;
  getSelectedTemplate: () => CardTemplate | null;
  getAllTemplates: () => CardTemplate[];
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  boards: [],
  currentBoard: null,
  cards: [],
  labels: [],
  boardMembers: [],
  selectedCard: null,
  showCardDetail: false,
  assigneeSuggestions: [],
  isLoading: false,
  error: null,
  showView: false,
  showCreateModal: false,
  showCreateCardModal: false,
  createCardData: null,
  customTemplates: [],
  selectedTemplateId: null,

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
    const { currentBoard } = get();
    if (!currentBoard) return;

    try {
      await invoke("kanban_move_card", {
        boardId: currentBoard.id,
        cardId,
        toColumnId,
        position,
      });

      // Update local state optimistically
      const targetColumn = currentBoard.columns.find((c) => c.id === toColumnId);
      const now = Math.floor(Date.now() / 1000);

      set((state) => ({
        cards: state.cards.map((c) => {
          if (c.id !== cardId) return c;
          return {
            ...c,
            columnId: toColumnId,
            position,
            updatedAt: now,
            closedAt: targetColumn?.isDone ? now : undefined,
          };
        }),
        // Update selectedCard if it's the one being moved
        selectedCard:
          state.selectedCard?.id === cardId
            ? {
                ...state.selectedCard,
                columnId: toColumnId,
                position,
                updatedAt: now,
                closedAt: targetColumn?.isDone ? now : undefined,
              }
            : state.selectedCard,
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
        selectedCard: state.selectedCard?.id === cardId ? null : state.selectedCard,
        showCardDetail: state.selectedCard?.id === cardId ? false : state.showCardDetail,
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Update column properties
  updateColumn: async (
    boardId: string,
    columnId: string,
    updates: { name?: string; color?: string; isDone?: boolean }
  ) => {
    try {
      const board = await invoke<KanbanBoard>("kanban_update_column", {
        boardId,
        columnId,
        ...updates,
      });
      set((state) => ({
        currentBoard: state.currentBoard?.id === boardId ? board : state.currentBoard,
        boards: state.boards.map((b) => (b.id === boardId ? board : b)),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Update card details
  updateCard: async (cardId: string, updates: CardUpdateInput) => {
    try {
      const card = await invoke<KanbanCard>("kanban_update_card", {
        cardId,
        title: updates.title,
        description: updates.description,
        dueDate: updates.dueDate,
        priority: updates.priority,
        assignees: updates.assignees,
        labels: updates.labels,
      });
      set((state) => ({
        cards: state.cards.map((c) => (c.id === cardId ? card : c)),
        selectedCard: state.selectedCard?.id === cardId ? card : state.selectedCard,
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Quick action to take a card (assign yourself)
  takeCard: async (cardId: string, username: string) => {
    const { cards, updateCard } = get();
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const currentAssignees = card.metadata?.assignees || [];
    if (currentAssignees.includes(username)) return; // Already assigned

    await updateCard(cardId, {
      assignees: [...currentAssignees, username],
    });
  },

  // Card detail panel
  openCardDetail: (card: KanbanCard) => {
    set({ selectedCard: card, showCardDetail: true });
  },

  closeCardDetail: () => {
    set({ showCardDetail: false });
  },

  setSelectedCard: (card: KanbanCard | null) => {
    set({ selectedCard: card });
  },

  // Label actions
  loadLabels: async (boardId: string) => {
    try {
      const labels = await invoke<KanbanLabel[]>("kanban_get_labels", { boardId });
      set({ labels });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  createLabel: async (boardId: string, name: string, color: string) => {
    try {
      const label = await invoke<KanbanLabel>("kanban_create_label", {
        boardId,
        name,
        color,
      });
      set((state) => ({ labels: [...state.labels, label] }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  updateLabel: async (labelId: string, name: string, color: string) => {
    try {
      const label = await invoke<KanbanLabel>("kanban_update_label", {
        labelId,
        name,
        color,
      });
      set((state) => ({
        labels: state.labels.map((l) => (l.id === labelId ? label : l)),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteLabel: async (labelId: string) => {
    try {
      await invoke("kanban_delete_label", { labelId });
      set((state) => ({
        labels: state.labels.filter((l) => l.id !== labelId),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Board member actions
  loadBoardMembers: async (boardId: string) => {
    try {
      const members = await invoke<BoardMember[]>("kanban_get_board_members", { boardId });
      set({ boardMembers: members });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addBoardMember: async (boardId: string, name: string) => {
    try {
      const member = await invoke<BoardMember>("kanban_add_board_member", { boardId, name });
      set((state) => ({
        boardMembers: [...state.boardMembers, member],
        // Also update assignee suggestions immediately
        assigneeSuggestions: [...state.assigneeSuggestions, name].sort(),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  removeBoardMember: async (memberId: string) => {
    try {
      await invoke("kanban_remove_board_member", { memberId });
      set((state) => ({
        boardMembers: state.boardMembers.filter((m) => m.id !== memberId),
      }));
      // Reload global suggestions (member may still exist on other boards)
      get().loadAssigneeSuggestions();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Load assignee suggestions (from board members)
  loadAssigneeSuggestions: async () => {
    const { currentBoard } = get();
    try {
      const suggestions = await invoke<string[]>("kanban_get_assignee_suggestions", {
        boardId: currentBoard?.id,
      });
      set({ assigneeSuggestions: suggestions });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // UI actions
  toggleView: () => set((state) => ({ showView: !state.showView })),
  openCreateModal: () => set({ showCreateModal: true }),
  closeCreateModal: () => set({ showCreateModal: false }),
  setCurrentBoard: (board) => set({ currentBoard: board }),

  // Card creation modal
  openCreateCardModal: (columnId: string) =>
    set({
      showCreateCardModal: true,
      createCardData: {
        columnId,
        title: "",
        description: "",
        priority: "",
        dueDate: "",
        assignees: [],
      },
    }),

  closeCreateCardModal: () =>
    set({ showCreateCardModal: false, createCardData: null }),

  createCardWithDetails: async (data) => {
    const { currentBoard } = get();
    if (!currentBoard) return;

    try {
      // First create the card
      const card = await invoke<KanbanCard>("kanban_add_card", {
        boardId: currentBoard.id,
        columnId: data.columnId,
        title: data.title,
      });

      // Then update with details if any were provided
      const hasDetails =
        data.description ||
        data.priority ||
        data.dueDate ||
        data.assignees.length > 0;

      if (hasDetails) {
        const updatedCard = await invoke<KanbanCard>("kanban_update_card", {
          cardId: card.id,
          description: data.description || undefined,
          priority: data.priority || undefined,
          dueDate: data.dueDate
            ? Math.floor(new Date(data.dueDate).getTime() / 1000)
            : undefined,
          assignees: data.assignees.length > 0 ? data.assignees : undefined,
        });
        set((state) => ({
          cards: [...state.cards, updatedCard],
          showCreateCardModal: false,
          createCardData: null,
        }));
      } else {
        set((state) => ({
          cards: [...state.cards, card],
          showCreateCardModal: false,
          createCardData: null,
        }));
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  // Template actions
  loadCustomTemplates: async () => {
    try {
      const stored = await invoke<string | null>("read_plugin_data", {
        pluginId: "kanban",
        key: TEMPLATE_STORAGE_KEY,
      });
      if (stored) {
        const templates = JSON.parse(stored) as CardTemplate[];
        set({ customTemplates: templates });
      }
    } catch (error) {
      console.error("Failed to load custom templates:", error);
    }
  },

  saveCustomTemplate: async (template: Omit<CardTemplate, "id">) => {
    const id = `custom-${Date.now()}`;
    const newTemplate: CardTemplate = { ...template, id };
    const { customTemplates } = get();
    const updated = [...customTemplates, newTemplate];

    try {
      await invoke("write_plugin_data", {
        pluginId: "kanban",
        key: TEMPLATE_STORAGE_KEY,
        data: JSON.stringify(updated),
      });
      set({ customTemplates: updated });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteCustomTemplate: async (templateId: string) => {
    const { customTemplates } = get();
    const updated = customTemplates.filter((t) => t.id !== templateId);

    try {
      await invoke("write_plugin_data", {
        pluginId: "kanban",
        key: TEMPLATE_STORAGE_KEY,
        data: JSON.stringify(updated),
      });
      set({ customTemplates: updated });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  selectTemplate: (templateId: string | null) => {
    set({ selectedTemplateId: templateId });
  },

  getSelectedTemplate: () => {
    const { selectedTemplateId, customTemplates } = get();
    if (!selectedTemplateId) return null;

    // Check built-in templates first
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (builtin) return builtin;

    // Check custom templates
    return customTemplates.find((t) => t.id === selectedTemplateId) || null;
  },

  getAllTemplates: () => {
    const { customTemplates } = get();
    return [...BUILTIN_TEMPLATES, ...customTemplates];
  },
}));
