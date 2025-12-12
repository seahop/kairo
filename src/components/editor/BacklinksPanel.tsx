import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNoteStore } from "@/stores/noteStore";

interface Backlink {
  source_id: string;
  source_path: string;
  source_title: string;
  context: string;
}

const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export function BacklinksPanel() {
  const { currentNote, openNote } = useNoteStore();
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (!currentNote) {
      setBacklinks([]);
      return;
    }

    const loadBacklinks = async () => {
      setIsLoading(true);
      try {
        const links = await invoke<Backlink[]>("get_backlinks", {
          notePath: currentNote.path,
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
  }, [currentNote?.path]);

  if (!currentNote) return null;

  return (
    <div className="border-t border-dark-800 bg-dark-900">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-dark-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
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
              {backlinks.map((link) => (
                <button
                  key={link.source_id}
                  className="w-full text-left p-2 rounded-lg hover:bg-dark-800 transition-colors group"
                  onClick={() => openNote(link.source_path)}
                >
                  <div className="text-sm font-medium text-dark-200 group-hover:text-accent-primary">
                    {link.source_title}
                  </div>
                  {link.context && (
                    <div className="text-xs text-dark-500 mt-1 line-clamp-2">
                      ...{link.context}...
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
