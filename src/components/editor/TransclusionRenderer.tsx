import { useEffect, useState, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useTransclusionStore } from "@/stores/transclusionStore";
import { useNoteStore } from "@/stores/noteStore";

// Icons
const TransclusionIcon = () => (
  <svg
    className="w-3 h-3"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

const LoadingSpinner = () => (
  <svg
    className="animate-spin h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

interface TransclusionRendererProps {
  reference: string;
  blockId?: string;
  alias?: string;
  depth: number;
  resolutionChain?: string[];
}

const MAX_DEPTH = 5;

export function TransclusionRenderer({
  reference,
  blockId,
  alias,
  depth,
  resolutionChain = [],
}: TransclusionRendererProps) {
  const { fetchTransclusion } = useTransclusionStore();
  const { openNoteByReference, resolveNoteReference } = useNoteStore();

  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [sourcePath, setSourcePath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stabilize resolutionChain to prevent infinite re-renders
  // Use a ref to store the chain and only update when content changes
  const chainRef = useRef(resolutionChain);
  const chainKey = resolutionChain.join("|");

  useEffect(() => {
    chainRef.current = resolutionChain;
  }, [chainKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      setIsLoading(true);
      setError(null);

      const result = await fetchTransclusion(
        reference,
        blockId,
        chainRef.current
      );

      if (cancelled) return;

      if (result) {
        if (result.error) {
          setError(result.error);
          setContent(null);
        } else {
          setContent(result.content);
          setTitle(result.title);
          setSourcePath(result.sourcePath);
        }
      } else {
        setError("Failed to load content");
        setContent(null);
      }

      setIsLoading(false);
    };

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [reference, blockId, fetchTransclusion, chainKey]);

  // Preprocess content for nested transclusions
  const processedContent = useMemo(() => {
    if (!content) return "";

    // We need to process wiki links and transclusions in the content
    let processed = content;

    // 1. Block transclusion: ![[note#^block-id]] or ![[note#^block-id|alias]]
    processed = processed.replace(
      /!\[\[([^\]#|]+)#\^([a-zA-Z0-9_-]+)(?:\|([^\]]+))?\]\]/g,
      (_, noteRef, nestedBlockId, nestedAlias) => {
        const encodedRef = encodeURIComponent(noteRef.trim());
        const encodedBlock = encodeURIComponent(nestedBlockId);
        const encodedAlias = nestedAlias ? encodeURIComponent(nestedAlias.trim()) : "";
        return `<div class="transclusion-embed" data-ref="${encodedRef}" data-block="${encodedBlock}" data-alias="${encodedAlias}"></div>`;
      }
    );

    // 2. Full note transclusion: ![[note]] or ![[note|alias]]
    processed = processed.replace(
      /!\[\[([^\]#|]+)(?:\|([^\]]+))?\]\]/g,
      (_, noteRef, nestedAlias) => {
        const encodedRef = encodeURIComponent(noteRef.trim());
        const encodedAlias = nestedAlias ? encodeURIComponent(nestedAlias.trim()) : "";
        return `<div class="transclusion-embed" data-ref="${encodedRef}" data-alias="${encodedAlias}"></div>`;
      }
    );

    // 3. Block reference link: [[note#^block-id]]
    processed = processed.replace(
      /\[\[([^\]#|]+)#\^([a-zA-Z0-9_-]+)(?:\|([^\]]+))?\]\]/g,
      (_, noteRef, nestedBlockId, display) => {
        const displayText = display || `${noteRef}#^${nestedBlockId}`;
        const encodedRef = encodeURIComponent(noteRef.trim());
        const encodedBlock = encodeURIComponent(nestedBlockId);
        return `[${displayText}](#blockref:${encodedRef}:${encodedBlock})`;
      }
    );

    // 4. Regular wiki links
    processed = processed.replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_, path, display) => {
        const displayText = display || path;
        return `[${displayText}](#wikilink:${encodeURIComponent(path)})`;
      }
    );

    return processed;
  }, [content]);

  const handleHeaderClick = async () => {
    if (sourcePath) {
      await openNoteByReference(sourcePath);
    } else {
      await openNoteByReference(reference);
    }
  };

  // Depth exceeded (depth starts at 1, so depth >= MAX_DEPTH means we've hit the limit)
  if (depth >= MAX_DEPTH) {
    return (
      <div className="transclusion-error">
        <span className="font-medium">Maximum depth exceeded</span>
        <span className="text-dark-500 ml-2">
          (limit: {MAX_DEPTH} levels)
        </span>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="transclusion-loading">
        <LoadingSpinner />
        <span>Loading {blockId ? `block ^${blockId}` : reference}...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    const isCircular = error.includes("Circular reference");
    return (
      <div className={isCircular ? "transclusion-circular" : "transclusion-error"}>
        <span className="font-medium">
          {isCircular ? "Circular reference" : "Error"}
        </span>
        <span className="ml-2">{error}</span>
      </div>
    );
  }

  // No content
  if (!content) {
    return (
      <div className="transclusion-error">
        <span>No content found for "{reference}"</span>
      </div>
    );
  }

  // Build the new resolution chain for nested transclusions
  const newChain = [...resolutionChain, reference];

  return (
    <div className="transclusion-block">
      <div
        className="transclusion-header"
        onClick={handleHeaderClick}
        title={`Click to open: ${sourcePath || reference}`}
      >
        <TransclusionIcon />
        <span className="hover:underline">
          {alias || title || reference}
        </span>
        {blockId && (
          <span className="text-secondary-400/60 text-xs">
            ^{blockId}
          </span>
        )}
      </div>
      <div className="transclusion-content prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // Handle nested transclusions via div with transclusion-embed class
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            div: ({ className, children, ...props }: any) => {
              if (className === "transclusion-embed") {
                const ref = props["data-ref"] as string | undefined;
                const nestedBlockId = props["data-block"] as string | undefined;
                const nestedAlias = props["data-alias"] as string | undefined;

                if (!ref) return null;
                return (
                  <TransclusionRenderer
                    reference={decodeURIComponent(ref)}
                    blockId={nestedBlockId ? decodeURIComponent(nestedBlockId) : undefined}
                    alias={nestedAlias ? decodeURIComponent(nestedAlias) : undefined}
                    depth={depth + 1}
                    resolutionChain={newChain}
                  />
                );
              }
              return <div className={className} {...props}>{children}</div>;
            },
            // Handle wiki links
            a({ href, children, ...props }) {
              if (href?.startsWith("#wikilink:")) {
                const linkRef = decodeURIComponent(href.slice(10));
                const resolved = resolveNoteReference(linkRef);
                const exists = resolved !== null;

                return (
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      await openNoteByReference(linkRef);
                    }}
                    className={`
                      cursor-pointer transition-colors
                      ${
                        exists
                          ? "text-accent-primary hover:text-accent-secondary underline decoration-dotted"
                          : "text-red-400 hover:text-red-300 line-through opacity-70"
                      }
                    `}
                    title={
                      exists
                        ? `Go to: ${resolved.path}`
                        : `Note not found: ${linkRef}`
                    }
                    {...props}
                  >
                    {children}
                  </a>
                );
              }

              // Block reference link
              if (href?.startsWith("#blockref:")) {
                const [noteRef, blockRefId] = href
                  .slice(10)
                  .split(":")
                  .map(decodeURIComponent);

                return (
                  <a
                    href="#"
                    onClick={async (e) => {
                      e.preventDefault();
                      await openNoteByReference(noteRef);
                      // TODO: Scroll to block
                    }}
                    className="text-secondary-400 hover:text-secondary-300 underline decoration-dotted"
                    title={`Go to ${noteRef}#^${blockRefId}`}
                    {...props}
                  >
                    {children}
                    <span className="text-xs text-dark-500 ml-1">
                      ^{blockRefId}
                    </span>
                  </a>
                );
              }

              // External or other links
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                  {...props}
                >
                  {children}
                </a>
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
