import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { triggerHook, applyFilter } from "@/plugins/api/hooks";

export interface SearchResult {
  id: string;
  path: string;
  title: string;
  snippet: string;
  score: number;
  matches: SearchMatch[];
  archived: boolean;
}

export interface SearchMatch {
  field: string;
  text: string;
  context: string;
}

export interface EntityResult {
  entity_type: string;
  value: string;
  note_path: string;
  note_title: string;
  context: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters | null;
  created_at: number;
}

export interface SearchFilters {
  tags?: string[];
  folders?: string[];
  entity_types?: string[];
  date_from?: number;
  date_to?: number;
  code_only?: boolean;
  include_archived?: boolean;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  entityResults: EntityResult[];
  savedSearches: SavedSearch[];
  isSearching: boolean;
  error: string | null;
  filters: SearchFilters;

  // Actions
  setQuery: (query: string) => void;
  search: (query?: string) => Promise<void>;
  searchEntities: (entityType?: string, pattern?: string) => Promise<void>;
  saveSearch: (name: string) => Promise<void>;
  loadSavedSearches: () => Promise<void>;
  setFilters: (filters: Partial<SearchFilters>) => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  results: [],
  entityResults: [],
  savedSearches: [],
  isSearching: false,
  error: null,
  filters: {},

  setQuery: (query: string) => set({ query }),

  search: async (queryOverride?: string) => {
    const query = queryOverride ?? get().query;
    if (!query.trim()) {
      set({ results: [] });
      return;
    }

    // Trigger hook for extensions
    triggerHook("onSearch", { query });

    set({ isSearching: true, error: null });
    try {
      const { filters } = get();
      let results = await invoke<SearchResult[]>("search_notes", {
        query,
        filters: Object.keys(filters).length > 0 ? filters : null,
        limit: 50,
      });

      // Apply filter hook to allow extensions to modify results
      results = await applyFilter("filterSearchResults", results, query, filters);

      set({ results, isSearching: false });

      // Trigger hook with results
      triggerHook("onSearchResult", { query, results, filters });
    } catch (error) {
      set({ error: String(error), isSearching: false, results: [] });
    }
  },

  searchEntities: async (entityType?: string, pattern?: string) => {
    set({ isSearching: true, error: null });
    try {
      const results = await invoke<EntityResult[]>("search_entities", {
        entityType,
        pattern,
        limit: 100,
      });
      set({ entityResults: results, isSearching: false });
    } catch (error) {
      set({ error: String(error), isSearching: false, entityResults: [] });
    }
  },

  saveSearch: async (name: string) => {
    const { query, filters } = get();
    try {
      await invoke("save_search", {
        name,
        query,
        filters: Object.keys(filters).length > 0 ? filters : null,
      });
      get().loadSavedSearches();
    } catch (error) {
      set({ error: String(error) });
    }
  },

  loadSavedSearches: async () => {
    try {
      const savedSearches = await invoke<SavedSearch[]>("get_saved_searches");
      set({ savedSearches });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  setFilters: (newFilters: Partial<SearchFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  clearResults: () => {
    set({ results: [], entityResults: [], query: "" });
  },
}));
