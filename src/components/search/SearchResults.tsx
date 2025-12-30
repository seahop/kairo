import { useCallback, useRef, useEffect } from "react";
import { FixedSizeList as List, ListChildComponentProps } from "react-window";
import { SearchResult } from "@/stores/searchStore";
import DOMPurify from "dompurify";
import clsx from "clsx";

const FileIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

interface SearchResultsProps {
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
  query: string;
}

// Row height for virtual list
const ROW_HEIGHT = 88;

export function SearchResults({
  results,
  selectedIndex,
  onSelect,
  onHover,
  query,
}: SearchResultsProps) {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Scroll selected item into view when navigating with keyboard
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      listRef.current.scrollToItem(selectedIndex, "smart");
    }
  }, [selectedIndex]);

  // Render individual row
  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    const result = results[index];

    return (
      <div
        style={style}
        className={clsx(
          "px-4 py-3 cursor-pointer transition-colors",
          index === selectedIndex ? "bg-dark-800" : "hover:bg-dark-800/50"
        )}
        onClick={() => onSelect(result)}
        onMouseEnter={() => onHover(index)}
      >
        <div className="flex items-center gap-2 mb-1">
          <FileIcon />
          <span className="font-medium text-dark-100 truncate">{result.title}</span>
          <span className="text-xs text-dark-500 truncate flex-shrink-0 max-w-[150px]">{result.path}</span>
          {result.score > 0 && (
            <span className="text-xs text-dark-600 ml-auto flex-shrink-0">
              Score: {result.score.toFixed(2)}
            </span>
          )}
        </div>
        <div
          className="text-sm text-dark-400 line-clamp-2"
          dangerouslySetInnerHTML={{
            __html: highlightSnippet(result.snippet, query),
          }}
        />
        {result.matches.length > 0 && (
          <div className="flex gap-2 mt-2">
            {result.matches.slice(0, 3).map((match, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-dark-800 rounded text-dark-400"
              >
                {match.field}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }, [results, selectedIndex, onSelect, onHover, highlightSnippet, query]);

  if (results.length === 0) {
    return (
      <div className="p-8 text-center text-dark-400">
        No results found
      </div>
    );
  }

  // Calculate list height - limit to container or max height
  const listHeight = Math.min(results.length * ROW_HEIGHT, 400);

  return (
    <div ref={containerRef} className="py-2">
      <List
        ref={listRef}
        height={listHeight}
        itemCount={results.length}
        itemSize={ROW_HEIGHT}
        width="100%"
        overscanCount={3}
      >
        {Row}
      </List>
    </div>
  );
}
