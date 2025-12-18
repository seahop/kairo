import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { parseDataviewQuery, serializeQuery, type DataviewResult } from "@/lib/dataview";

interface CacheEntry {
  result: DataviewResult;
  timestamp: number;
  queryHash: string;
}

interface DataviewState {
  cache: Map<string, CacheEntry>;
  isExecuting: Map<string, boolean>;
  cacheTimeout: number; // ms

  executeQuery: (queryText: string) => Promise<DataviewResult>;
  invalidateCache: () => void;
  invalidateCacheForPath: (path: string) => void;
}

// Simple hash function for cache keys
function hashQuery(query: string): string {
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export const useDataviewStore = create<DataviewState>((set, get) => ({
  cache: new Map(),
  isExecuting: new Map(),
  cacheTimeout: 30000, // 30 seconds

  executeQuery: async (queryText: string): Promise<DataviewResult> => {
    const queryHash = hashQuery(queryText);
    const { cache, cacheTimeout, isExecuting } = get();

    // Check cache first
    const cached = cache.get(queryHash);
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.result;
    }

    // Check if already executing this query
    if (isExecuting.get(queryHash)) {
      // Wait for the existing execution to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const { cache, isExecuting } = get();
          if (!isExecuting.get(queryHash)) {
            clearInterval(checkInterval);
            const result = cache.get(queryHash);
            resolve(result?.result || { type: "LIST", rows: [], error: "Query execution failed" });
          }
        }, 100);
      });
    }

    // Mark as executing
    set((state) => {
      const newExecuting = new Map(state.isExecuting);
      newExecuting.set(queryHash, true);
      return { isExecuting: newExecuting };
    });

    try {
      // Parse the query
      const parsedQuery = parseDataviewQuery(queryText);
      const serialized = serializeQuery(parsedQuery);

      // Execute via Tauri
      const result = await invoke<DataviewResult>("execute_dataview_query", {
        query: serialized,
      });

      // Cache the result
      set((state) => {
        const newCache = new Map(state.cache);
        newCache.set(queryHash, {
          result,
          timestamp: Date.now(),
          queryHash,
        });
        const newExecuting = new Map(state.isExecuting);
        newExecuting.delete(queryHash);
        return { cache: newCache, isExecuting: newExecuting };
      });

      return result;
    } catch (error) {
      // Clear executing flag
      set((state) => {
        const newExecuting = new Map(state.isExecuting);
        newExecuting.delete(queryHash);
        return { isExecuting: newExecuting };
      });

      const errorResult: DataviewResult = {
        type: "LIST",
        rows: [],
        error: error instanceof Error ? error.message : String(error),
      };

      return errorResult;
    }
  },

  invalidateCache: () => {
    set({ cache: new Map() });
  },

  invalidateCacheForPath: (_path: string) => {
    // For now, just invalidate all cache
    // A smarter implementation could check which queries might be affected
    set({ cache: new Map() });
  },
}));

// Listen for note changes to invalidate cache
// This is called from noteStore when a note is saved
export function invalidateDataviewCache(): void {
  useDataviewStore.getState().invalidateCache();
}
