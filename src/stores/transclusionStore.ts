import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// Types matching Rust structs
interface TranscludedNote {
  content: string;
  title: string;
  path: string;
  exists: boolean;
}

interface BlockContent {
  content: string;
  line_number: number;
  exists: boolean;
}

export interface BlockInfo {
  block_id: string;
  content: string;
  line_number: number;
}

// Cached content with metadata
interface CachedTransclusion {
  content: string;
  title: string;
  sourcePath: string;
  isBlock: boolean;
  blockId?: string;
  fetchedAt: number;
  error?: string;
}

// Cache TTL in milliseconds (30 seconds)
const CACHE_TTL = 30000;
const MAX_CACHE_SIZE = 50;
const MAX_TRANSCLUSION_DEPTH = 5;

interface TransclusionState {
  // Cache of resolved transclusions
  cache: Map<string, CachedTransclusion>;

  // Track loading states
  loading: Set<string>;

  // Actions
  fetchTransclusion: (
    reference: string,
    blockId?: string,
    resolutionChain?: string[]
  ) => Promise<CachedTransclusion | null>;

  fetchBlocksForNote: (notePath: string) => Promise<BlockInfo[]>;

  invalidateNote: (notePath: string) => void;
  clearCache: () => void;

  // Utility
  isCircularReference: (reference: string, chain: string[]) => boolean;
  getCacheKey: (reference: string, blockId?: string) => string;
}

export const useTransclusionStore = create<TransclusionState>((set, get) => ({
  cache: new Map(),
  loading: new Set(),

  getCacheKey: (reference: string, blockId?: string) => {
    return blockId ? `${reference}#^${blockId}` : reference;
  },

  isCircularReference: (reference: string, chain: string[]) => {
    // Normalize the reference for comparison
    const normalizedRef = reference.toLowerCase();
    return chain.some((item) => item.toLowerCase() === normalizedRef);
  },

  fetchTransclusion: async (
    reference: string,
    blockId?: string,
    resolutionChain: string[] = []
  ): Promise<CachedTransclusion | null> => {
    const { cache, loading, getCacheKey, isCircularReference } = get();
    const cacheKey = getCacheKey(reference, blockId);

    // Check for circular reference
    if (isCircularReference(reference, resolutionChain)) {
      return {
        content: "",
        title: reference,
        sourcePath: reference,
        isBlock: !!blockId,
        blockId,
        fetchedAt: Date.now(),
        error: `Circular reference detected: ${[...resolutionChain, reference].join(" → ")}`,
      };
    }

    // Check depth limit
    if (resolutionChain.length >= MAX_TRANSCLUSION_DEPTH) {
      return {
        content: "",
        title: reference,
        sourcePath: reference,
        isBlock: !!blockId,
        blockId,
        fetchedAt: Date.now(),
        error: `Maximum transclusion depth (${MAX_TRANSCLUSION_DEPTH}) exceeded`,
      };
    }

    // Check cache (with TTL)
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached;
    }

    // Check if already loading
    if (loading.has(cacheKey)) {
      // Wait a bit and check cache again
      await new Promise((resolve) => setTimeout(resolve, 100));
      return get().cache.get(cacheKey) || null;
    }

    // Mark as loading
    set((state) => ({
      loading: new Set(state.loading).add(cacheKey),
    }));

    try {
      let result: CachedTransclusion;

      if (blockId) {
        // Fetch specific block
        const blockContent = await invoke<BlockContent>("get_block_content", {
          notePath: reference,
          blockId,
        });

        if (blockContent.exists) {
          result = {
            content: blockContent.content,
            title: reference,
            sourcePath: reference,
            isBlock: true,
            blockId,
            fetchedAt: Date.now(),
          };
        } else {
          result = {
            content: "",
            title: reference,
            sourcePath: reference,
            isBlock: true,
            blockId,
            fetchedAt: Date.now(),
            error: `Block "^${blockId}" not found in "${reference}"`,
          };
        }
      } else {
        // Fetch full note
        const note = await invoke<TranscludedNote>(
          "get_note_content_for_transclusion",
          { path: reference }
        );

        if (note.exists) {
          result = {
            content: note.content,
            title: note.title,
            sourcePath: note.path,
            isBlock: false,
            fetchedAt: Date.now(),
          };
        } else {
          result = {
            content: "",
            title: reference,
            sourcePath: reference,
            isBlock: false,
            fetchedAt: Date.now(),
            error: `Note "${reference}" not found`,
          };
        }
      }

      // Update cache (with size limit)
      set((state) => {
        const newCache = new Map(state.cache);

        // Evict old entries if cache is too large
        if (newCache.size >= MAX_CACHE_SIZE) {
          // Remove oldest entries
          const entries = Array.from(newCache.entries());
          entries.sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
          const toRemove = entries.slice(0, 10);
          toRemove.forEach(([key]) => newCache.delete(key));
        }

        newCache.set(cacheKey, result);

        const newLoading = new Set(state.loading);
        newLoading.delete(cacheKey);

        return { cache: newCache, loading: newLoading };
      });

      return result;
    } catch (error) {
      const errorResult: CachedTransclusion = {
        content: "",
        title: reference,
        sourcePath: reference,
        isBlock: !!blockId,
        blockId,
        fetchedAt: Date.now(),
        error: `Failed to fetch: ${error}`,
      };

      set((state) => {
        const newLoading = new Set(state.loading);
        newLoading.delete(cacheKey);
        return { loading: newLoading };
      });

      return errorResult;
    }
  },

  fetchBlocksForNote: async (notePath: string): Promise<BlockInfo[]> => {
    try {
      return await invoke<BlockInfo[]>("list_blocks_for_note", {
        notePath,
      });
    } catch (error) {
      console.error("Failed to fetch blocks:", error);
      return [];
    }
  },

  invalidateNote: (notePath: string) => {
    set((state) => {
      const newCache = new Map(state.cache);
      // Remove all entries that reference this note
      const normalizedPath = notePath.toLowerCase();
      for (const [key, value] of newCache.entries()) {
        if (value.sourcePath.toLowerCase().includes(normalizedPath)) {
          newCache.delete(key);
        }
      }
      return { cache: newCache };
    });
  },

  clearCache: () => {
    set({ cache: new Map(), loading: new Set() });
  },
}));
