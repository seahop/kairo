import { useMemo, useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useNoteStore } from "@/stores/noteStore";
import { useUIStore } from "@/stores/uiStore";
import { useKanbanStore } from "@/plugins/builtin/kanban/store";
import { useDiagramStore } from "@/plugins/builtin/diagram/store";
import { LinkContextMenu, useContextMenu } from "@/components/common/LinkContextMenu";
import { DataviewRenderer } from "./DataviewRenderer";
import { TransclusionRenderer } from "./TransclusionRenderer";
import { useTableEditorStore } from "@/stores/tableEditorStore";
import { parseMarkdownTable } from "./table/tableParser";

// Icon for external links
const ExternalLinkIcon = () => (
  <svg className="inline-block w-3 h-3 ml-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// Transform wiki-style links [[note]] and [[note|display]] to markdown links
// Also transforms card/kanban links, diagram links, and transclusions
function preprocessWikiLinks(content: string): string {
  // IMPORTANT: Handle transclusions FIRST (before regular links)
  // This ensures ![[note]] is processed before [[note]]

  // 1. Block transclusion: ![[note#^block-id]] or ![[note#^block-id|alias]]
  let processed = content.replace(
    /!\[\[([^\]#|]+)#\^([a-zA-Z0-9_-]+)(?:\|([^\]]+))?\]\]/g,
    (_, noteRef, blockId, alias) => {
      const encodedRef = encodeURIComponent(noteRef.trim());
      const encodedBlock = encodeURIComponent(blockId);
      const encodedAlias = alias ? encodeURIComponent(alias.trim()) : "";
      return `<div class="transclusion-embed" data-ref="${encodedRef}" data-block="${encodedBlock}" data-alias="${encodedAlias}"></div>`;
    }
  );

  // 2. Full note transclusion: ![[note]] or ![[note|alias]]
  processed = processed.replace(
    /!\[\[([^\]#|]+)(?:\|([^\]]+))?\]\]/g,
    (_, noteRef, alias) => {
      const encodedRef = encodeURIComponent(noteRef.trim());
      const encodedAlias = alias ? encodeURIComponent(alias.trim()) : "";
      return `<div class="transclusion-embed" data-ref="${encodedRef}" data-alias="${encodedAlias}"></div>`;
    }
  );

  // 3. Block reference link (not transclusion): [[note#^block-id]] or [[note#^block-id|display]]
  processed = processed.replace(
    /\[\[([^\]#|]+)#\^([a-zA-Z0-9_-]+)(?:\|([^\]]+))?\]\]/g,
    (_, noteRef, blockId, display) => {
      const displayText = display || `${noteRef}#^${blockId}`;
      const encodedRef = encodeURIComponent(noteRef.trim());
      const encodedBlock = encodeURIComponent(blockId);
      return `[${displayText}](#blockref:${encodedRef}:${encodedBlock})`;
    }
  );

  // Handle card links: [[card:title]] or [[card:board/title]] or [[card:title|display]]
  processed = processed.replace(
    /\[\[card:([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, cardRef, display) => {
      const displayText = display || cardRef;
      // Use hash-based URL to avoid protocol sanitization in react-markdown v9
      return `[${displayText}](#cardlink:${encodeURIComponent(cardRef)})`;
    }
  );

  // Handle kanban links (alias for card links): [[kanban:board/title]] or [[kanban:board/title|display]]
  processed = processed.replace(
    /\[\[kanban:([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, cardRef, display) => {
      const displayText = display || cardRef;
      // Use same cardlink hash - they're equivalent
      return `[${displayText}](#cardlink:${encodeURIComponent(cardRef)})`;
    }
  );

  // Handle diagram links: [[diagram:name]] or [[diagram:name|display]]
  processed = processed.replace(
    /\[\[diagram:([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, diagramRef, display) => {
      const displayText = display || diagramRef;
      return `[${displayText}](#diagramlink:${encodeURIComponent(diagramRef)})`;
    }
  );

  // Handle note links: [[note:title]] or [[note:title|display]]
  // This extracts just the title part and converts to a regular wikilink
  processed = processed.replace(
    /\[\[note:([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, noteRef, display) => {
      const displayText = display || noteRef;
      return `[${displayText}](#wikilink:${encodeURIComponent(noteRef)})`;
    }
  );

  // Then handle regular wiki links: [[path]] or [[path|display text]]
  processed = processed.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, path, display) => {
      const displayText = display || path;
      // Use hash-based URL to avoid protocol sanitization in react-markdown v9
      return `[${displayText}](#wikilink:${encodeURIComponent(path)})`;
    }
  );

  return processed;
}

interface PreviewPaneProps {
  content?: string;
}

// Type for card lookup result
interface KanbanCardResult {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
}

export function PreviewPane({ content }: PreviewPaneProps) {
  const { editorContent, openNoteByReference, resolveNoteReference, setEditorContent } = useNoteStore();
  const { loadBoard } = useKanbanStore();
  const { boards: diagramBoards, loadBoards: loadDiagramBoards, loadBoard: loadDiagramBoard, setShowView: setDiagramShowView } = useDiagramStore();
  const { openSidePane } = useUIStore();
  const { openEditor: openTableEditor } = useTableEditorStore();
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const [vaultPath, setVaultPath] = useState<string | null>(null);

  // Use provided content or fall back to store's editorContent
  const displayContent = content ?? editorContent;

  // Fetch vault path for resolving relative image paths
  useEffect(() => {
    invoke<string | null>("get_vault_path").then(setVaultPath).catch(console.error);
  }, []);

  // Load diagram boards if content contains diagram links
  useEffect(() => {
    if (displayContent.includes("[[diagram:")) {
      loadDiagramBoards();
    }
  }, [displayContent, loadDiagramBoards]);

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
  const processedContent = useMemo(() => {
    return preprocessWikiLinks(displayContent);
  }, [displayContent]);

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

  // Handle card link clicks
  const handleCardLinkClick = useCallback(
    async (e: React.MouseEvent, reference: string) => {
      e.preventDefault();
      e.stopPropagation();

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
        // Find the card
        const card = await invoke<KanbanCardResult | null>("kanban_find_card_by_title", {
          title: cardTitle,
          boardName: boardName || null,
        });

        if (card) {
          // Load the board first
          await loadBoard(card.boardId);

          // Small delay to ensure state is updated
          await new Promise(resolve => setTimeout(resolve, 50));

          // Get fresh state after loading
          const state = useKanbanStore.getState();
          const fullCard = state.cards.find(c => c.id === card.id);

          if (fullCard) {
            // Open the kanban view and show the card detail
            useKanbanStore.setState({ showView: true });
            state.openCardDetail(fullCard);
          }
        }
      } catch (err) {
        console.error(`Error navigating to card:`, err);
      }
    },
    [loadBoard]
  );

  // Handle diagram link clicks
  const handleDiagramLinkClick = useCallback(
    async (e: React.MouseEvent, reference: string) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        // Find diagram by name (case-insensitive)
        const diagram = diagramBoards.find(
          (d) => d.name.toLowerCase() === reference.toLowerCase()
        );

        if (diagram) {
          // Load and open the diagram
          await loadDiagramBoard(diagram.id);
          setDiagramShowView(true);
        } else {
          console.warn(`Diagram not found: ${reference}`);
        }
      } catch (err) {
        console.error(`Error navigating to diagram:`, err);
      }
    },
    [diagramBoards, loadDiagramBoard, setDiagramShowView]
  );

  // Open card in side pane without navigating to kanban view
  const openCardInPane = useCallback(
    async (reference: string) => {
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
          // Open the card in the side pane
          openSidePane({
            type: 'card',
            cardId: card.id,
            boardId: card.boardId,
          });
        }
      } catch (err) {
        console.error(`Error opening card in pane:`, err);
      }
    },
    [openSidePane]
  );

  // Copy link to clipboard
  const copyLink = useCallback((linkType: string, reference: string) => {
    const linkText = linkType === "card" ? `[[card:${reference}]]` : `[[${reference}]]`;
    navigator.clipboard.writeText(linkText);
  }, []);

  // Context menu for card links
  const handleCardContextMenu = useCallback(
    (e: React.MouseEvent, reference: string) => {
      showContextMenu(e, [
        {
          label: "Open in Kanban",
          icon: "📋",
          onClick: () => handleCardLinkClick(e, reference),
        },
        {
          label: "Open in Side Pane",
          icon: "📄",
          onClick: () => openCardInPane(reference),
        },
        {
          label: "Copy Link",
          icon: "📋",
          onClick: () => copyLink("card", reference),
          divider: true,
        },
      ]);
    },
    [showContextMenu, handleCardLinkClick, openCardInPane, copyLink]
  );

  // Open note in side pane
  const openNoteInPane = useCallback(
    (reference: string) => {
      const resolved = resolveNoteReference(reference);
      if (resolved) {
        openSidePane({ type: 'note', notePath: resolved.path });
      }
    },
    [resolveNoteReference, openSidePane]
  );

  // Context menu for wiki links
  const handleWikiContextMenu = useCallback(
    (e: React.MouseEvent, reference: string) => {
      showContextMenu(e, [
        {
          label: "Open Note",
          icon: "📝",
          onClick: () => handleWikiLinkClick(e, reference),
        },
        {
          label: "Open in Side Pane",
          icon: "📄",
          onClick: () => openNoteInPane(reference),
        },
        {
          label: "Copy Link",
          icon: "📋",
          onClick: () => copyLink("wiki", reference),
          divider: true,
        },
      ]);
    },
    [showContextMenu, handleWikiLinkClick, openNoteInPane, copyLink]
  );

  // Context menu for external links
  const handleExternalContextMenu = useCallback(
    (e: React.MouseEvent, url: string) => {
      showContextMenu(e, [
        {
          label: "Open in Browser",
          icon: "🌐",
          onClick: () => window.open(url, "_blank"),
        },
        {
          label: "Copy URL",
          icon: "📋",
          onClick: () => navigator.clipboard.writeText(url),
          divider: true,
        },
      ]);
    },
    [showContextMenu]
  );

  // Handle table click to open visual editor
  const handleTableClick = useCallback(
    (tableMarkdown: string) => {
      // Find this table in the source content
      const lines = displayContent.split("\n");
      let tableStartLine = -1;
      let tableEndLine = -1;
      let inTable = false;
      let foundIndex = 0;

      // Find all tables and match by reconstructed content
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isTableLine = line.trim().includes("|") && line.trim().length > 1;

        if (isTableLine && !inTable) {
          inTable = true;
          tableStartLine = i;
        } else if (!isTableLine && inTable) {
          tableEndLine = i - 1;
          // Check if this is the table we clicked
          const tableContent = lines.slice(tableStartLine, tableEndLine + 1).join("\n");
          if (tableContent.trim() === tableMarkdown.trim()) {
            break;
          }
          inTable = false;
          tableStartLine = -1;
          foundIndex++;
        }
      }

      // Handle table at end of file
      if (inTable && tableEndLine === -1) {
        tableEndLine = lines.length - 1;
      }

      if (tableStartLine === -1) {
        // Fallback: just find first table if exact match failed
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim().includes("|") && line.trim().length > 1) {
            tableStartLine = i;
            while (i < lines.length && lines[i].trim().includes("|")) {
              tableEndLine = i;
              i++;
            }
            break;
          }
        }
      }

      if (tableStartLine === -1) return;

      // Parse the table
      const tableLines = lines.slice(tableStartLine, tableEndLine + 1).join("\n");
      const tableData = parseMarkdownTable(tableLines);

      if (tableData) {
        openTableEditor(
          tableData,
          tableStartLine,
          tableEndLine,
          (newMarkdown: string) => {
            // Replace the table in the source
            const newLines = [...lines];
            newLines.splice(tableStartLine, tableEndLine - tableStartLine + 1, ...newMarkdown.split("\n"));
            setEditorContent(newLines.join("\n"));
          }
        );
      }
    },
    [displayContent, openTableEditor, setEditorContent]
  );

  // Debug mode - set to true to show debug UI
  const debugMode = false;

  return (
    <div className="h-full overflow-auto bg-dark-950 p-6">
      {debugMode && (
        <>
          <div className="fixed top-16 right-4 bg-green-600 text-white px-2 py-1 text-xs rounded z-50">
            PreviewPane v2 - Card links: {displayContent?.includes("[[card:") ? "YES" : "NO"}
          </div>
          <details className="mb-4 p-2 bg-dark-800 rounded text-xs">
            <summary className="cursor-pointer text-yellow-400">Debug: Processed Content</summary>
            <pre className="mt-2 p-2 bg-dark-900 rounded overflow-auto max-h-40 text-green-400">
              {processedContent?.substring(0, 500)}
            </pre>
          </details>
        </>
      )}
      <div className="max-w-3xl mx-auto markdown-preview">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          urlTransform={(url) => {
            // Keep our hash-based custom links unchanged
            if (url.startsWith("#cardlink:") || url.startsWith("#wikilink:") || url.startsWith("#diagramlink:") || url.startsWith("#blockref:")) {
              return url;
            }
            return url;
          }}
          components={{
            // Custom rendering for code blocks
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !match;
              const language = match?.[1];

              if (isInline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }

              // Handle dataview queries
              if (language === "dataview") {
                const queryText = String(children).trim();
                return (
                  <div className="my-4 p-4 bg-dark-850 rounded-lg border border-dark-700">
                    <div className="text-xs text-dark-500 mb-2 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary rounded">
                        dataview
                      </span>
                    </div>
                    <DataviewRenderer query={queryText} />
                  </div>
                );
              }

              return (
                <div className="relative group">
                  <div className="absolute top-2 right-2 text-xs text-dark-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {language}
                  </div>
                  <pre className={className}>
                    <code {...props}>{children}</code>
                  </pre>
                </div>
              );
            },
            // Custom rendering for links
            a({ href, children, ...props }) {
              // Check if it's a card link (hash-based URL)
              if (href?.startsWith("#cardlink:")) {
                const reference = decodeURIComponent(href.slice(10));
                return (
                  <a
                    href="#"
                    data-card-link={reference}
                    onClick={(e) => handleCardLinkClick(e, reference)}
                    onContextMenu={(e) => handleCardContextMenu(e, reference)}
                    className="cursor-pointer transition-colors text-orange-400 hover:text-orange-300 underline decoration-dotted"
                    style={{ backgroundColor: 'rgba(251, 146, 60, 0.1)', padding: '0 4px', borderRadius: '4px' }}
                    title={`Go to card: ${reference} (right-click for options)`}
                    {...props}
                  >
                    <span className="mr-1">🎯</span>
                    {children}
                  </a>
                );
              }

              // Check if it's a diagram link (hash-based URL)
              if (href?.startsWith("#diagramlink:")) {
                const reference = decodeURIComponent(href.slice(13)); // "#diagramlink:" is 13 chars
                const diagram = diagramBoards.find(
                  (d) => d.name.toLowerCase() === reference.toLowerCase()
                );
                const exists = diagram !== undefined;

                return (
                  <a
                    href="#"
                    data-diagram-link={reference}
                    onClick={(e) => handleDiagramLinkClick(e, reference)}
                    className={`
                      cursor-pointer transition-colors
                      ${exists
                        ? "text-purple-400 hover:text-purple-300 underline decoration-dotted"
                        : "text-red-400 hover:text-red-300 line-through opacity-70"
                      }
                    `}
                    style={exists ? { backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '0 4px', borderRadius: '4px' } : undefined}
                    title={exists ? `Open diagram: ${diagram.name}` : `Diagram not found: ${reference}`}
                    {...props}
                  >
                    <span className="mr-1">📊</span>
                    {children}
                  </a>
                );
              }

              // Check if it's a wiki link (hash-based URL)
              if (href?.startsWith("#wikilink:")) {
                const reference = decodeURIComponent(href.slice(10));
                const resolved = resolveNoteReference(reference);
                const exists = resolved !== null;

                return (
                  <a
                    href="#"
                    onClick={(e) => handleWikiLinkClick(e, reference)}
                    onContextMenu={(e) => handleWikiContextMenu(e, reference)}
                    className={`
                      cursor-pointer transition-colors
                      ${exists
                        ? "text-accent-primary hover:text-accent-secondary underline decoration-dotted"
                        : "text-red-400 hover:text-red-300 line-through opacity-70"
                      }
                    `}
                    title={exists ? `Go to: ${resolved.path} (right-click for options)` : `Note not found: ${reference}`}
                    {...props}
                  >
                    {children}
                  </a>
                );
              }

              // Check if it's a block reference link
              if (href?.startsWith("#blockref:")) {
                const parts = href.slice(10).split(":");
                const noteRef = decodeURIComponent(parts[0] || "");
                const blockId = decodeURIComponent(parts[1] || "");
                const resolved = resolveNoteReference(noteRef);
                const exists = resolved !== null;

                return (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleWikiLinkClick(e, noteRef);
                      // TODO: scroll to block after navigation
                    }}
                    className={`
                      cursor-pointer transition-colors
                      ${exists
                        ? "text-secondary-400 hover:text-secondary-300 underline decoration-dotted"
                        : "text-red-400 hover:text-red-300 line-through opacity-70"
                      }
                    `}
                    title={exists ? `Go to: ${resolved.path}#^${blockId}` : `Note not found: ${noteRef}`}
                    {...props}
                  >
                    {children}
                    <span className="text-xs text-dark-500 ml-1">^{blockId}</span>
                  </a>
                );
              }

              // External link
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onContextMenu={(e) => href && handleExternalContextMenu(e, href)}
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
            // Custom div handler for transclusion embeds
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            div: ({ className, children, ...props }: any) => {
              // Check if this is a transclusion embed
              if (className === "transclusion-embed") {
                const ref = props["data-ref"] as string | undefined;
                const blockId = props["data-block"] as string | undefined;
                const alias = props["data-alias"] as string | undefined;

                if (!ref) return null;

                return (
                  <TransclusionRenderer
                    reference={decodeURIComponent(ref)}
                    blockId={blockId ? decodeURIComponent(blockId) : undefined}
                    alias={alias ? decodeURIComponent(alias) : undefined}
                    depth={1}
                  />
                );
              }

              // Default div rendering
              return <div className={className} {...props}>{children}</div>;
            },
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
            // Clickable tables with edit overlay
            table({ children, ...props }) {
              // Capture raw table content from children for reconstruction
              const captureTableContent = (element: React.ReactNode): string => {
                if (!element) return "";
                if (typeof element === "string") return element;
                if (Array.isArray(element)) return element.map(captureTableContent).join("");
                if (typeof element === "object" && "props" in element) {
                  const el = element as React.ReactElement;
                  const tagName = typeof el.type === "string" ? el.type : "";
                  const content = captureTableContent(el.props.children);
                  if (tagName === "th" || tagName === "td") return `| ${content} `;
                  if (tagName === "tr") return `${content}|\n`;
                  if (tagName === "thead") return `${content}|---|\n`;
                  return content;
                }
                return "";
              };

              return (
                <div className="relative group my-4">
                  <table
                    className="w-full border-collapse"
                    {...props}
                  >
                    {children}
                  </table>
                  <button
                    className="absolute top-1 right-1 px-2 py-1 text-xs bg-accent-primary/80 hover:bg-accent-primary text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                    onClick={() => {
                      // Find this table in the raw content and open editor
                      // For now, we'll pass the full content and let handleTableClick find it
                      const lines = displayContent.split("\n");
                      // Find the first table in the content
                      for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.trim().includes("|") && line.trim().length > 1) {
                          let endLine = i;
                          while (endLine < lines.length && lines[endLine].trim().includes("|")) {
                            endLine++;
                          }
                          const tableMarkdown = lines.slice(i, endLine).join("\n");
                          handleTableClick(tableMarkdown);
                          return;
                        }
                      }
                    }}
                    title="Edit table"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                </div>
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <LinkContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
}
