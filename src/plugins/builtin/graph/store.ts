import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface GraphNode {
  id: string;
  path: string;
  title: string;
  linkCount: number;
  backlinkCount: number;
  // D3 force simulation adds these
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  context?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphState {
  // Data
  graphData: GraphData | null;

  // UI State
  showView: boolean;
  isLoading: boolean;
  error: string | null;
  selectedNode: string | null;
  hoveredNode: string | null;
  focusedNote: string | null;

  // Search state
  searchQuery: string;
  searchResults: string[]; // Node IDs matching search

  // View options
  viewMode: "global" | "local" | "search";
  localDepth: number;
  showOrphans: boolean;

  // Physics settings
  linkDistance: number;
  chargeStrength: number;

  // Actions
  loadGraphData: () => Promise<void>;
  toggleView: () => void;
  setViewMode: (mode: "global" | "local" | "search") => void;
  setSelectedNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setFocusedNote: (noteId: string | null) => void;
  setLocalDepth: (depth: number) => void;
  setShowOrphans: (show: boolean) => void;
  setLinkDistance: (distance: number) => void;
  setChargeStrength: (strength: number) => void;
  setSearchQuery: (query: string) => void;
  performSearch: (query: string) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graphData: null,
  showView: false,
  isLoading: false,
  error: null,
  selectedNode: null,
  hoveredNode: null,
  focusedNote: null,
  searchQuery: "",
  searchResults: [],
  viewMode: "global",
  localDepth: 2,
  showOrphans: true,
  linkDistance: 120,
  chargeStrength: -300,

  loadGraphData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await invoke<GraphData>("get_graph_data");
      set({ graphData: data, isLoading: false });
    } catch (error) {
      console.error("Failed to load graph data:", error);
      set({ error: String(error), isLoading: false });
    }
  },

  toggleView: () => {
    const { showView, graphData } = get();
    if (!showView && !graphData) {
      // Load data when opening for the first time
      get().loadGraphData();
    }
    set({ showView: !showView });
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),
  setHoveredNode: (nodeId) => set({ hoveredNode: nodeId }),
  setFocusedNote: (noteId) => set({ focusedNote: noteId }),
  setLocalDepth: (depth) => set({ localDepth: depth }),
  setShowOrphans: (show) => set({ showOrphans: show }),
  setLinkDistance: (distance) => set({ linkDistance: distance }),
  setChargeStrength: (strength) => set({ chargeStrength: strength }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  performSearch: (query) => {
    const { graphData } = get();
    if (!graphData || !query.trim()) {
      set({ searchResults: [], searchQuery: query, viewMode: query.trim() ? "search" : "global" });
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matchingNodes = graphData.nodes.filter(
      (node) =>
        node.title.toLowerCase().includes(lowerQuery) ||
        node.path.toLowerCase().includes(lowerQuery)
    );

    set({
      searchQuery: query,
      searchResults: matchingNodes.map((n) => n.id),
      viewMode: "search",
    });
  },
}));
