import { useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useNoteStore } from "@/stores/noteStore";

// Icon for external links
const ExternalLinkIcon = () => (
  <svg className="inline-block w-3 h-3 ml-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// Transform wiki-style links [[note]] and [[note|display]] to markdown links
function preprocessWikiLinks(content: string): string {
  // Match [[path]] or [[path|display text]]
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, path, display) => {
      const displayText = display || path;
      // Use a special protocol to identify wiki links
      return `[${displayText}](wikilink:${encodeURIComponent(path)})`;
    }
  );
}

export function PreviewPane() {
  const { editorContent, openNoteByReference, resolveNoteReference } = useNoteStore();

  // Preprocess content to convert wiki links
  const processedContent = useMemo(
    () => preprocessWikiLinks(editorContent),
    [editorContent]
  );

  // Handle wiki link clicks
  const handleWikiLinkClick = useCallback(
    async (e: React.MouseEvent, reference: string) => {
      e.preventDefault();
      const success = await openNoteByReference(reference);
      if (!success) {
        // Could show a toast or offer to create the note
        console.warn(`Note not found: ${reference}`);
      }
    },
    [openNoteByReference]
  );

  return (
    <div className="h-full overflow-auto bg-dark-950 p-6">
      <div className="max-w-3xl mx-auto markdown-preview">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // Custom rendering for code blocks
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !match;

              if (isInline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }

              return (
                <div className="relative group">
                  <div className="absolute top-2 right-2 text-xs text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {match[1]}
                  </div>
                  <pre className={className}>
                    <code {...props}>{children}</code>
                  </pre>
                </div>
              );
            },
            // Custom rendering for links
            a({ href, children, ...props }) {
              // Check if it's a wiki link (our custom protocol)
              if (href?.startsWith("wikilink:")) {
                const reference = decodeURIComponent(href.slice(9));
                const resolved = resolveNoteReference(reference);
                const exists = resolved !== null;

                return (
                  <a
                    href="#"
                    onClick={(e) => handleWikiLinkClick(e, reference)}
                    className={`
                      cursor-pointer transition-colors
                      ${exists
                        ? "text-accent-primary hover:text-accent-secondary underline decoration-dotted"
                        : "text-red-400 hover:text-red-300 line-through opacity-70"
                      }
                    `}
                    title={exists ? `Go to: ${resolved.path}` : `Note not found: ${reference}`}
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
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}
