import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface TagInfo {
  name: string;
  count: number;
  notes: string[]; // note paths
}

export interface TagNode {
  name: string;
  fullPath: string;
  count: number;
  notes: string[];
  children: Map<string, TagNode>;
}

interface TagState {
  tags: TagInfo[];
  tagTree: TagNode;
  isLoading: boolean;
  error: string | null;
  selectedTag: string | null;
  expandedTags: Set<string>;

  // Actions
  loadTags: () => Promise<void>;
  selectTag: (tag: string | null) => void;
  toggleTagExpanded: (tag: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  getNotesForTag: (tag: string) => string[];
}

function buildTagTree(tags: TagInfo[]): TagNode {
  const root: TagNode = {
    name: "",
    fullPath: "",
    count: 0,
    notes: [],
    children: new Map(),
  };

  for (const tag of tags) {
    const parts = tag.name.split("/");
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          fullPath: currentPath,
          count: 0,
          notes: [],
          children: new Map(),
        });
      }

      current = current.children.get(part)!;

      // Only set count/notes for the leaf tag
      if (i === parts.length - 1) {
        current.count = tag.count;
        current.notes = tag.notes;
      }
    }
  }

  return root;
}

function getAllTagPaths(node: TagNode, paths: string[] = []): string[] {
  if (node.fullPath) {
    paths.push(node.fullPath);
  }
  for (const child of node.children.values()) {
    getAllTagPaths(child, paths);
  }
  return paths;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  tagTree: {
    name: "",
    fullPath: "",
    count: 0,
    notes: [],
    children: new Map(),
  },
  isLoading: false,
  error: null,
  selectedTag: null,
  expandedTags: new Set(),

  loadTags: async () => {
    set({ isLoading: true, error: null });
    try {
      // Fetch tags with their associated note paths
      const rawTags = await invoke<string[]>("get_all_tags");
      const tagNotes = await invoke<Record<string, string[]>>("get_tag_notes");

      const tags: TagInfo[] = rawTags.map(name => ({
        name,
        count: tagNotes[name]?.length || 0,
        notes: tagNotes[name] || [],
      }));

      // Sort by name for consistent display
      tags.sort((a, b) => a.name.localeCompare(b.name));

      const tagTree = buildTagTree(tags);

      // Auto-expand first level
      const expandedTags = new Set<string>();
      for (const child of tagTree.children.values()) {
        expandedTags.add(child.fullPath);
      }

      set({
        tags,
        tagTree,
        expandedTags,
        isLoading: false,
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  selectTag: (tag: string | null) => {
    set({ selectedTag: tag });
  },

  toggleTagExpanded: (tag: string) => {
    const { expandedTags } = get();
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(tag)) {
      newExpanded.delete(tag);
    } else {
      newExpanded.add(tag);
    }
    set({ expandedTags: newExpanded });
  },

  expandAll: () => {
    const { tagTree } = get();
    const allPaths = getAllTagPaths(tagTree);
    set({ expandedTags: new Set(allPaths) });
  },

  collapseAll: () => {
    set({ expandedTags: new Set() });
  },

  getNotesForTag: (tag: string): string[] => {
    const { tags } = get();
    // Get notes for exact tag and all nested tags
    const relevantTags = tags.filter(t =>
      t.name === tag || t.name.startsWith(`${tag}/`)
    );
    const allNotes = new Set<string>();
    for (const t of relevantTags) {
      for (const note of t.notes) {
        allNotes.add(note);
      }
    }
    return Array.from(allNotes);
  },
}));
