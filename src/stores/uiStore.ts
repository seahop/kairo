import { create } from "zustand";

export type EditorViewMode = 'editor' | 'preview' | 'split';
export type MainViewMode = 'notes' | 'graph' | 'vault-health';

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
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  sidebarWidth: 280,
  isSidebarCollapsed: false,
  isSearchOpen: false,
  activeModal: null,
  modalData: null,
  confirmDialog: null,
  editorSplitRatio: 50,
  showPreview: true,
  editorViewMode: 'split',
  mainViewMode: 'notes',
  sidePaneContent: null,
  sidePaneWidth: 350,

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
}));
