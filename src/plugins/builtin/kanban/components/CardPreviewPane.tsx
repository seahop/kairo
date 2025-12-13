import { useMemo, useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { useNoteStore } from "@/stores/noteStore";
import { useKanbanStore } from "../store";

// Icon for external links
const ExternalLinkIcon = () => (
  <svg
    className="inline-block w-3 h-3 ml-0.5 opacity-60"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

// Transform wiki-style links [[note]] and [[note|display]] to markdown links
// Also transforms card links [[card:title]] and [[card:title|display]]
function preprocessWikiLinks(content: string): string {
  // First, handle card links: [[card:title]] or [[card:board/title]] or [[card:title|display]]
  let processed = content.replace(
    /\[\[card:([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, cardRef, display) => {
      const displayText = display || cardRef;
      return `[${displayText}](cardlink:${encodeURIComponent(cardRef)})`;
    }
  );

  // Then handle regular wiki links: [[path]] or [[path|display text]]
  processed = processed.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, path, display) => {
      const displayText = display || path;
      return `[${displayText}](wikilink:${encodeURIComponent(path)})`;
    }
  );

  return processed;
}

// Type for card lookup result
interface KanbanCardResult {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
}

interface CardPreviewPaneProps {
  content: string;
  className?: string;
  minHeight?: string;
}

export function CardPreviewPane({
  content,
  className = "",
  minHeight = "200px",
}: CardPreviewPaneProps) {
  const { openNoteByReference, resolveNoteReference } = useNoteStore();
  const { loadBoard } = useKanbanStore();
  const [vaultPath, setVaultPath] = useState<string | null>(null);

  // Fetch vault path for resolving relative image paths
  useEffect(() => {
    invoke<string | null>("get_vault_path").then(setVaultPath).catch(console.error);
  }, []);

  // Resolve relative paths to absolute file URLs
  const resolveImagePath = useCallback(
    (src: string | undefined): string | undefined => {
      if (!src) return src;
      // Already absolute URL or external
      if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("file://") || src.startsWith("asset://")) {
        return src;
      }
      // Relative path - resolve against vault
      if (vaultPath) {
        const fullPath = `${vaultPath}/${src}`;
        return convertFileSrc(fullPath);
      }
      return src;
    },
    [vaultPath]
  );

  // Preprocess content to convert wiki links
  const processedContent = useMemo(() => preprocessWikiLinks(content), [content]);

  // Handle wiki link clicks
  const handleWikiLinkClick = useCallback(
    async (e: React.MouseEvent, reference: string) => {
      e.preventDefault();
      const success = await openNoteByReference(reference);
      if (!success) {
        console.warn(`Note not found: ${reference}`);
      }
    },
    [openNoteByReference]
  );

  // Handle card link clicks
  const handleCardLinkClick = useCallback(
    async (e: React.MouseEvent, reference: string) => {
      e.preventDefault();

      // Parse board/title or just title
      let boardName: string | undefined;
      let cardTitle: string;

      if (reference.includes("/")) {
        const parts = reference.split("/");
        boardName = parts[0];
        cardTitle = parts.slice(1).join("/");
      } else {
        cardTitle = reference;
      }

      try {
        const card = await invoke<KanbanCardResult | null>("kanban_find_card_by_title", {
          title: cardTitle,
          boardName: boardName || null,
        });

        if (card) {
          // Load the board
          await loadBoard(card.boardId);

          // Get fresh state after loading and open the card
          const state = useKanbanStore.getState();
          const fullCard = state.cards.find(c => c.id === card.id);

          if (fullCard) {
            state.openCardDetail(fullCard);
          }
        } else {
          console.warn(`Card not found: ${reference}`);
        }
      } catch (err) {
        console.error(`Error navigating to card: ${err}`);
      }
    },
    [loadBoard]
  );

  if (!content.trim()) {
    return (
      <div
        className={`flex items-center justify-center text-dark-500 text-sm italic ${className}`}
        style={{ minHeight }}
      >
        No content to preview
      </div>
    );
  }

  return (
    <div
      className={`overflow-auto bg-dark-900 rounded-lg border border-dark-700 p-4 ${className}`}
      style={{ minHeight }}
    >
      <div className="card-markdown-preview prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // Custom rendering for code blocks
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !match;

              if (isInline) {
                return (
                  <code
                    className="bg-dark-800 px-1.5 py-0.5 rounded text-sm font-mono"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }

              return (
                <div className="relative group">
                  <div className="absolute top-2 right-2 text-xs text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {match[1]}
                  </div>
                  <pre className="bg-dark-800 rounded-lg p-3 overflow-x-auto">
                    <code className="text-sm font-mono" {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            },
            // Custom rendering for links
            a({ href, children, ...props }) {
              // Check if it's a card link
              if (href?.startsWith("cardlink:")) {
                const reference = decodeURIComponent(href.slice(9));
                return (
                  <a
                    href="#"
                    onClick={(e) => handleCardLinkClick(e, reference)}
                    className="cursor-pointer transition-colors text-orange-400 hover:text-orange-300 underline decoration-dotted"
                    title={`Go to card: ${reference}`}
                    {...props}
                  >
                    <span className="mr-1">🎯</span>
                    {children}
                  </a>
                );
              }

              // Check if it's a wiki link
              if (href?.startsWith("wikilink:")) {
                const reference = decodeURIComponent(href.slice(9));
                const resolved = resolveNoteReference(reference);
                const exists = resolved !== null;

                return (
                  <a
                    href="#"
                    onClick={(e) => handleWikiLinkClick(e, reference)}
                    className={`cursor-pointer transition-colors ${
                      exists
                        ? "text-accent-primary hover:text-accent-secondary underline decoration-dotted"
                        : "text-red-400 hover:text-red-300 line-through opacity-70"
                    }`}
                    title={
                      exists
                        ? `Go to: ${resolved.path}`
                        : `Note not found: ${reference}`
                    }
                    {...props}
                  >
                    {children}
                  </a>
                );
              }

              // External link
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                  {...props}
                >
                  {children}
                  <ExternalLinkIcon />
                </a>
              );
            },
            // Custom checkbox rendering for task lists
            input({ checked, ...props }) {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 accent-accent-primary"
                  {...props}
                />
              );
            },
            // Headings with appropriate sizing for cards
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-dark-100 mb-3 mt-4 first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-dark-100 mb-2 mt-3 first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-medium text-dark-200 mb-2 mt-3 first:mt-0">
                {children}
              </h3>
            ),
            // Paragraphs
            p: ({ children }) => (
              <p className="text-dark-300 mb-3 last:mb-0 leading-relaxed">{children}</p>
            ),
            // Lists
            ul: ({ children }) => (
              <ul className="list-disc list-inside text-dark-300 mb-3 space-y-1">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside text-dark-300 mb-3 space-y-1">
                {children}
              </ol>
            ),
            // Blockquotes
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-accent-primary/50 pl-4 italic text-dark-400 my-3">
                {children}
              </blockquote>
            ),
            // Images with size support and path resolution
            img: ({ src, alt, width, height, ...props }) => {
              // Support for sizing via HTML attributes or query params
              // e.g., <img src="path.jpg" width="300" /> or ![alt](path.jpg?width=300)
              let imgWidth = width;
              let imgHeight = height;
              let imgSrc = src;

              // Parse size from URL query params if present
              if (imgSrc && imgSrc.includes('?')) {
                try {
                  const url = new URL(imgSrc, 'http://localhost');
                  const wParam = url.searchParams.get('width') || url.searchParams.get('w');
                  const hParam = url.searchParams.get('height') || url.searchParams.get('h');
                  if (wParam) imgWidth = wParam;
                  if (hParam) imgHeight = hParam;
                  // Remove query params from src for actual image loading
                  imgSrc = imgSrc.split('?')[0];
                } catch {
                  // If URL parsing fails, just use the original src
                }
              }

              // Resolve relative paths to absolute file URLs
              const resolvedSrc = resolveImagePath(imgSrc);

              return (
                <span className="block my-3">
                  <img
                    src={resolvedSrc}
                    alt={alt || ''}
                    width={imgWidth}
                    height={imgHeight}
                    className="max-w-full h-auto rounded-lg border border-dark-700"
                    style={{
                      maxWidth: imgWidth ? `${imgWidth}px` : '100%',
                      maxHeight: imgHeight ? `${imgHeight}px` : undefined,
                    }}
                    loading="lazy"
                    {...props}
                  />
                  {alt && (
                    <span className="block text-xs text-dark-500 mt-1 italic">{alt}</span>
                  )}
                </span>
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
