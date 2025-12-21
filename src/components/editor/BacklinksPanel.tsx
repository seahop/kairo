import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore } from "@/stores/noteStore";

interface Backlink {
  source_id: string;
  source_path: string;
  source_title: string;
  context: string;
  archived: boolean;
}

const LinkIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
));
LinkIcon.displayName = "LinkIcon";

const ChevronIcon = memo(({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
));
ChevronIcon.displayName = "ChevronIcon";

// Memoized backlink item to prevent unnecessary re-renders
interface BacklinkItemProps {
  link: Backlink;
  onOpen: (path: string) => void;
  isArchived?: boolean;
}

const BacklinkItem = memo(({ link, onOpen, isArchived }: BacklinkItemProps) => {
  const handleClick = useCallback(() => {
    onOpen(link.source_path);
  }, [onOpen, link.source_path]);

  return (
    <button
      className="w-full text-left p-2 rounded-lg hover:bg-dark-800 transition-colors group"
      onClick={handleClick}
    >
      <div className={`text-sm font-medium ${isArchived ? "text-dark-300 group-hover:text-dark-200" : "text-dark-200 group-hover:text-accent-primary"}`}>
        {link.source_title}
      </div>
      {link.context && (
        <div className={`text-xs mt-1 line-clamp-2 ${isArchived ? "text-dark-600" : "text-dark-500"}`}>
          ...{link.context}...
        </div>
      )}
    </button>
  );
});
BacklinkItem.displayName = "BacklinkItem";

interface BacklinksPanelProps {
  notePath?: string;
  onOpenNote?: (path: string) => void;
}

export const BacklinksPanel = memo(function BacklinksPanel({ notePath: propNotePath, onOpenNote }: BacklinksPanelProps) {
  const { currentNote, openNote } = useNoteStore();

  // Use prop if provided, otherwise fall back to noteStore
  const effectiveNotePath = propNotePath ?? currentNote?.path;
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Memoize filtered lists to avoid recomputing on every render
  const { activeBacklinks, archivedBacklinks } = useMemo(() => ({
    activeBacklinks: backlinks.filter(l => !l.archived),
    archivedBacklinks: backlinks.filter(l => l.archived),
  }), [backlinks]);

  // Memoize toggle handler
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Handle opening a note - use callback if provided, otherwise use noteStore
  const handleOpenNote = useCallback((path: string) => {
    if (onOpenNote) {
      onOpenNote(path);
    } else {
      openNote(path);
    }
  }, [onOpenNote, openNote]);

  useEffect(() => {
    if (!effectiveNotePath) {
      setBacklinks([]);
      return;
    }

    const loadBacklinks = async () => {
      setIsLoading(true);
      try {
        const links = await invoke<Backlink[]>("get_backlinks", {
          notePath: effectiveNotePath,
        });
        setBacklinks(links);
      } catch (error) {
        console.error("Failed to load backlinks:", error);
        setBacklinks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadBacklinks();
  }, [effectiveNotePath]);

  if (!effectiveNotePath) return null;

  return (
    <div className="border-t border-dark-800 bg-dark-900">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-dark-800 transition-colors"
        onClick={handleToggle}
      >
        <ChevronIcon expanded={isExpanded} />
        <LinkIcon />
        <span className="text-sm font-medium text-dark-200">Backlinks</span>
        <span className="ml-auto text-xs text-dark-500 bg-dark-800 px-2 py-0.5 rounded">
          {backlinks.length}
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="text-sm text-dark-500 py-2">Loading...</div>
          ) : backlinks.length === 0 ? (
            <div className="text-sm text-dark-500 py-2">
              No notes link to this page
            </div>
          ) : (
            <div className="space-y-2">
              {/* Active backlinks */}
              {activeBacklinks.map((link) => (
                <BacklinkItem
                  key={link.source_id}
                  link={link}
                  onOpen={handleOpenNote}
                />
              ))}

              {/* Archived backlinks (shown dimmed) */}
              {archivedBacklinks.length > 0 && (
                <div className="opacity-50 mt-3 pt-3 border-t border-dark-800">
                  <div className="text-xs text-dark-500 mb-2">
                    Archived ({archivedBacklinks.length})
                  </div>
                  {archivedBacklinks.map((link) => (
                    <BacklinkItem
                      key={link.source_id}
                      link={link}
                      onOpen={handleOpenNote}
                      isArchived
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
