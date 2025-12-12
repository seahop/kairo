import { SearchResult } from "@/stores/searchStore";
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

export function SearchResults({
  results,
  selectedIndex,
  onSelect,
  onHover,
  query,
}: SearchResultsProps) {
  // Highlight matching text in snippet
  const highlightSnippet = (snippet: string, searchQuery: string) => {
    if (!searchQuery.trim()) return snippet;

    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    let result = snippet;

    for (const term of terms) {
      const cleanTerm = term.replace(/[*?]/g, "");
      if (!cleanTerm) continue;

      const regex = new RegExp(`(${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    return result;
  };

  if (results.length === 0) {
    return (
      <div className="p-8 text-center text-dark-400">
        No results found
      </div>
    );
  }

  return (
    <div className="py-2">
      {results.map((result, index) => (
        <div
          key={result.id}
          className={clsx(
            "px-4 py-3 cursor-pointer transition-colors",
            index === selectedIndex ? "bg-dark-800" : "hover:bg-dark-800/50"
          )}
          onClick={() => onSelect(result)}
          onMouseEnter={() => onHover(index)}
        >
          <div className="flex items-center gap-2 mb-1">
            <FileIcon />
            <span className="font-medium text-dark-100">{result.title}</span>
            <span className="text-xs text-dark-500">{result.path}</span>
            {result.score > 0 && (
              <span className="text-xs text-dark-600 ml-auto">
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
      ))}
    </div>
  );
}
