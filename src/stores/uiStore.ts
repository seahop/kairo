import { create } from "zustand";

export type EditorViewMode = 'editor' | 'preview' | 'split';

interface UIState {
  // Sidebar
  sidebarWidth: number;
  isSidebarCollapsed: boolean;

  // Search
  isSearchOpen: boolean;

  // Modals
  activeModal: string | null;
  modalData: unknown;

  // Editor
  editorSplitRatio: number;
  showPreview: boolean;
  editorViewMode: EditorViewMode;

  // Actions
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setSearchOpen: (open: boolean) => void;
  openModal: (modalId: string, data?: unknown) => void;
  closeModal: () => void;
  setEditorSplitRatio: (ratio: number) => void;
  togglePreview: () => void;
  setEditorViewMode: (mode: EditorViewMode) => void;
  cycleEditorViewMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  sidebarWidth: 280,
  isSidebarCollapsed: false,
  isSearchOpen: false,
  activeModal: null,
  modalData: null,
  editorSplitRatio: 50,
  showPreview: true,
  editorViewMode: 'split',

  // Actions
  setSidebarWidth: (width: number) => set({ sidebarWidth: width }),

  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSearchOpen: (open: boolean) => set({ isSearchOpen: open }),

  openModal: (modalId: string, data?: unknown) =>
    set({ activeModal: modalId, modalData: data }),

  closeModal: () => set({ activeModal: null, modalData: null }),

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
}));
