import { useEffect, useState } from "react";
import { useTagStore, TagNode } from "@/stores/tagStore";
import { useNoteStore } from "@/stores/noteStore";
import clsx from "clsx";

const TagIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
    />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={clsx("w-3 h-3 transition-transform", expanded && "rotate-90")}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const ExpandAllIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

const CollapseAllIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V5m0 4h4M9 9L4 4m11 5V5m0 4h-4m4 0l5-5M9 15v4m0-4h4m-4 0l-5 5m11-5l5 5m-5-5v4m0-4h-4" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

interface TagNodeItemProps {
  node: TagNode;
  level: number;
}

function TagNodeItem({ node, level }: TagNodeItemProps) {
  const { selectedTag, selectTag, expandedTags, toggleTagExpanded, getNotesForTag } =
    useTagStore();
  const { openNote, notes } = useNoteStore();
  const [showNotes, setShowNotes] = useState(false);

  const hasChildren = node.children.size > 0;
  const isExpanded = expandedTags.has(node.fullPath);
  const isSelected = selectedTag === node.fullPath;
  const noteCount = getNotesForTag(node.fullPath).length;

  const handleClick = () => {
    if (hasChildren) {
      toggleTagExpanded(node.fullPath);
    }
    selectTag(node.fullPath);
    setShowNotes(true);
  };

  const handleNoteClick = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openNote(path);
  };

  // Get note metadata for display
  const tagNotes = getNotesForTag(node.fullPath).map((path) => {
    const note = notes.find((n) => n.path === path);
    return note ? { path, title: note.title } : { path, title: path.split("/").pop()?.replace(".md", "") || path };
  });

  return (
    <div>
      <div
        className={clsx(
          "flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-md group",
          "hover:bg-dark-800/70 transition-colors",
          isSelected && "bg-dark-800 text-accent-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-dark-700 rounded"
            onClick={(e) => {
              e.stopPropagation();
              toggleTagExpanded(node.fullPath);
            }}
          >
            <ChevronIcon expanded={isExpanded} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="text-accent-secondary">#</span>
        <span className="text-sm truncate flex-1">{node.name}</span>
        {noteCount > 0 && (
          <span className="text-xs text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity">
            {noteCount}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {Array.from(node.children.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((child) => (
              <TagNodeItem key={child.fullPath} node={child} level={level + 1} />
            ))}
        </div>
      )}

      {/* Notes under selected tag */}
      {isSelected && showNotes && tagNotes.length > 0 && (
        <div
          className="mt-1 mb-2 border-l border-accent-primary/30"
          style={{ marginLeft: `${level * 12 + 24}px` }}
        >
          {tagNotes.map(({ path, title }) => (
            <div
              key={path}
              className="flex items-center gap-2 px-3 py-1 text-sm text-dark-400 hover:text-dark-200 hover:bg-dark-800/50 cursor-pointer rounded-r-md"
              onClick={(e) => handleNoteClick(path, e)}
            >
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TagPane() {
  const {
    tagTree,
    isLoading,
    tags,
    loadTags,
    expandAll,
    collapseAll,
    selectTag,
  } = useTagStore();

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleRefresh = () => {
    loadTags();
    selectTag(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dark-800">
        <div className="flex items-center gap-2">
          <TagIcon />
          <span className="text-sm font-medium text-dark-200">Tags</span>
          <span className="text-xs text-dark-500">{tags.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
            title="Expand all"
            onClick={expandAll}
          >
            <ExpandAllIcon />
          </button>
          <button
            className="p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
            title="Collapse all"
            onClick={collapseAll}
          >
            <CollapseAllIcon />
          </button>
          <button
            className="p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
            title="Refresh tags"
            onClick={handleRefresh}
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent-primary border-t-transparent" />
          </div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-dark-500 text-sm">
            <TagIcon />
            <p className="mt-2">No tags found</p>
            <p className="text-xs text-dark-600 mt-1">Add #tags to your notes</p>
          </div>
        ) : (
          <div>
            {Array.from(tagTree.children.values())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((node) => (
                <TagNodeItem key={node.fullPath} node={node} level={0} />
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-dark-800 text-xs text-dark-500">
        Click a tag to see notes
      </div>
    </div>
  );
}
