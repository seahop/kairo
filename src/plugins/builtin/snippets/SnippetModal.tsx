import { useSnippetStore, Snippet } from "./index";
import { CloseIcon } from "@/components/common/Icons";

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export function SnippetModal() {
  const {
    showModal,
    searchQuery,
    selectedCategory,
    closeModal,
    setSearchQuery,
    setSelectedCategory,
    copySnippet,
    getFilteredSnippets,
    getCategories,
  } = useSnippetStore();

  if (!showModal) return null;

  const filteredSnippets = getFilteredSnippets();
  const categories = getCategories();

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal-content w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800">
          <h2 className="text-lg font-semibold text-dark-100">Command Snippets</h2>
          <button className="btn-icon" onClick={closeModal}>
            <CloseIcon />
          </button>
        </div>

        {/* Search and filters */}
        <div className="p-4 border-b border-dark-800">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <SearchIcon />
              <input
                type="text"
                className="input pl-10"
                placeholder="Search snippets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500">
                <SearchIcon />
              </div>
            </div>
            <select
              className="input w-48"
              value={selectedCategory || ""}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Snippets list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {filteredSnippets.map((snippet) => (
              <SnippetCard
                key={snippet.id}
                snippet={snippet}
                onCopy={() => copySnippet(snippet)}
              />
            ))}
            {filteredSnippets.length === 0 && (
              <div className="text-center py-8 text-dark-500">
                No snippets found
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800 flex items-center justify-between text-xs text-dark-500">
          <span>{filteredSnippets.length} snippets</span>
          <span>Click to copy to clipboard</span>
        </div>
      </div>
    </div>
  );
}

interface SnippetCardProps {
  snippet: Snippet;
  onCopy: () => void;
}

function SnippetCard({ snippet, onCopy }: SnippetCardProps) {
  return (
    <div
      className="p-4 bg-dark-800 rounded-lg hover:bg-dark-700 cursor-pointer transition-colors group"
      onClick={onCopy}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-medium text-dark-100">{snippet.name}</h3>
          {snippet.description && (
            <p className="text-sm text-dark-400">{snippet.description}</p>
          )}
        </div>
        <button className="btn-icon opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyIcon />
        </button>
      </div>

      <pre className="mt-2 p-3 bg-dark-900 rounded text-sm text-dark-200 font-mono overflow-x-auto">
        <code>{snippet.command}</code>
      </pre>

      <div className="mt-2 flex items-center gap-2">
        {snippet.category && (
          <span className="tag">{snippet.category}</span>
        )}
        {snippet.language && (
          <span className="tag">{snippet.language}</span>
        )}
        {snippet.tags?.map((tag) => (
          <span key={tag} className="tag text-accent-primary bg-accent-primary/10">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
