import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchStore, SearchResult } from "@/stores/searchStore";
import { useNoteStore } from "@/stores/noteStore";
import DOMPurify from "dompurify";
import clsx from "clsx";
import { CloseIcon } from "@/components/common/Icons";

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

interface SearchModalProps {
  onClose: () => void;
}

export function SearchModal({ onClose }: SearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [includeArchived, setIncludeArchived] = useState(false);
  const { query, setQuery, results, isSearching, search, clearResults, setFilters } = useSearchStore();
  const { openNote } = useNoteStore();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      clearResults();
    };
  }, [clearResults]);

  // Update filters when includeArchived changes
  useEffect(() => {
    setFilters({ include_archived: includeArchived });
  }, [includeArchived, setFilters]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      clearResults();
      return;
    }

    const timer = setTimeout(() => {
      search(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, search, clearResults, includeArchived]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            openNote(results[selectedIndex].path);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, openNote, onClose]
  );

  const handleResultClick = (result: SearchResult) => {
    openNote(result.path);
    onClose();
  };

  // Highlight matching text in snippet - memoized and sanitized against XSS
  const highlightSnippet = useCallback((snippet: string, searchQuery: string) => {
    if (!searchQuery.trim()) {
      // Sanitize even plain text to prevent XSS
      return DOMPurify.sanitize(snippet, { ALLOWED_TAGS: [] });
    }

    // First, sanitize the snippet to remove any potentially dangerous HTML
    const sanitizedSnippet = DOMPurify.sanitize(snippet, { ALLOWED_TAGS: [] });

    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    let result = sanitizedSnippet;

    for (const term of terms) {
      const cleanTerm = term.replace(/[*?]/g, "");
      if (!cleanTerm) continue;

      const regex = new RegExp(`(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    // Final sanitization allowing only the mark tag we just added
    return DOMPurify.sanitize(result, { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: ['class'] });
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-dark-800">
          <div className="text-dark-400">
            <SearchIcon />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-lg text-dark-100 placeholder-dark-500 focus:outline-none"
            placeholder="Search notes... (try: tag:redteam, type:ip, code:mimikatz)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-dark-600 bg-dark-800 text-accent-primary focus:ring-accent-primary/50 focus:ring-offset-0"
            />
            <span className="text-xs text-dark-400">Include archived</span>
          </label>
          {query && (
            <button
              className="text-dark-400 hover:text-dark-200"
              onClick={() => setQuery("")}
            >
              <CloseIcon />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="p-8 text-center text-dark-400">Searching...</div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <div
                  key={result.id}
                  className={clsx(
                    "px-4 py-3 cursor-pointer transition-colors",
                    index === selectedIndex
                      ? "bg-dark-800"
                      : "hover:bg-dark-800/50"
                  )}
                  onClick={() => handleResultClick(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileIcon />
                    <span className={clsx("font-medium", result.archived ? "text-dark-300" : "text-dark-100")}>
                      {result.title}
                    </span>
                    {result.archived && (
                      <span className="text-xs bg-dark-700 text-dark-400 px-1.5 py-0.5 rounded">archived</span>
                    )}
                    <span className="text-xs text-dark-500">{result.path}</span>
                  </div>
                  <div
                    className="text-sm text-dark-400 line-clamp-2"
                    dangerouslySetInnerHTML={{
                      __html: highlightSnippet(result.snippet, query),
                    }}
                  />
                </div>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="p-8 text-center text-dark-400">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-8">
              <div className="text-dark-400 text-sm mb-4">Search tips:</div>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <code className="text-accent-primary">mimikatz</code>
                  <span className="text-dark-500">Basic search</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-accent-primary">"exact phrase"</code>
                  <span className="text-dark-500">Exact match</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-accent-primary">mimi*</code>
                  <span className="text-dark-500">Wildcard</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-accent-primary">type:ip 192.168.*</code>
                  <span className="text-dark-500">Search IPs</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-accent-primary">type:cve CVE-2024-*</code>
                  <span className="text-dark-500">Search CVEs</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-accent-primary">tag:redteam</code>
                  <span className="text-dark-500">Filter by tag</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-accent-primary">code:invoke-mimikatz</code>
                  <span className="text-dark-500">Search in code blocks</span>
                </div>
                <div className="flex gap-2">
                  <code className="text-accent-primary">@john meeting</code>
                  <span className="text-dark-500">Mentions</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-dark-800 flex items-center justify-between text-xs text-dark-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-dark-800 rounded ml-1">↓</kbd>
              <span className="ml-2">Navigate</span>
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">Enter</kbd>
              <span className="ml-2">Open</span>
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-dark-800 rounded">Esc</kbd>
              <span className="ml-2">Close</span>
            </span>
          </div>
          {results.length > 0 && (
            <span>{results.length} results</span>
          )}
        </div>
      </div>
    </div>
  );
}
