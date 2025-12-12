import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { forceCollide } from "d3-force";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useGraphStore, GraphNode, GraphData } from "./store";
import { useNoteStore } from "@/stores/noteStore";
import { PreviewPane } from "@/components/editor/PreviewPane";

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const GraphIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" strokeWidth={2} />
    <circle cx="5" cy="5" r="2" strokeWidth={2} />
    <circle cx="19" cy="5" r="2" strokeWidth={2} />
    <circle cx="5" cy="19" r="2" strokeWidth={2} />
    <circle cx="19" cy="19" r="2" strokeWidth={2} />
    <path strokeLinecap="round" strokeWidth={2} d="M9.5 10L6.5 6.5M14.5 10L17.5 6.5M9.5 14L6.5 17.5M14.5 14L17.5 17.5" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

interface GraphViewPanelProps {
  width?: number;
  height?: number;
}

interface ContextMenu {
  x: number;
  y: number;
  node: GraphNode;
}

export function GraphViewPanel({ width, height }: GraphViewPanelProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const {
    graphData,
    loadGraphData,
    isLoading,
    selectedNode,
    hoveredNode,
    setHoveredNode,
    viewMode,
    setViewMode,
    showOrphans,
    setShowOrphans,
    linkDistance,
    setLinkDistance,
    chargeStrength,
    setChargeStrength,
    focusedNote,
    setFocusedNote,
    localDepth,
    setLocalDepth,
    searchQuery,
    searchResults,
    performSearch,
  } = useGraphStore();

  const {
    currentNote,
    openNote,
    secondaryNote,
    secondaryEditorContent,
    openNoteInSecondary,
    closeSecondaryNote,
    isSecondaryLoading,
  } = useNoteStore();

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Load graph data on mount
  useEffect(() => {
    if (!graphData) {
      loadGraphData();
    }
  }, [graphData, loadGraphData]);

  // Filter graph data based on view mode and settings
  const filteredData = useMemo((): GraphData | null => {
    if (!graphData) return null;

    let nodes = [...graphData.nodes];
    let links = [...graphData.links];

    // Filter orphans if needed
    if (!showOrphans) {
      const connectedIds = new Set<string>();
      links.forEach((l) => {
        connectedIds.add(l.source as string);
        connectedIds.add(l.target as string);
      });
      nodes = nodes.filter((n) => connectedIds.has(n.id));
    }

    // For search view, show nodes matching search and their connections
    if (viewMode === "search" && searchResults.length > 0) {
      const connectedIds = new Set<string>(searchResults);

      // Add nodes connected to search results (within depth)
      for (let depth = 0; depth < localDepth; depth++) {
        const currentLevel = new Set(connectedIds);
        links.forEach((l) => {
          const source = l.source as string;
          const target = l.target as string;
          if (currentLevel.has(source) && !connectedIds.has(target)) {
            connectedIds.add(target);
          }
          if (currentLevel.has(target) && !connectedIds.has(source)) {
            connectedIds.add(source);
          }
        });
      }

      nodes = nodes.filter((n) => connectedIds.has(n.id));
      links = links.filter(
        (l) =>
          connectedIds.has(l.source as string) &&
          connectedIds.has(l.target as string)
      );
    }

    // For local view, filter to only show nodes connected to the focused note
    if (viewMode === "local" && focusedNote) {
      const focusedId = focusedNote;
      const connectedIds = new Set<string>([focusedId]);

      let currentLevel = new Set<string>([focusedId]);
      for (let depth = 0; depth < localDepth; depth++) {
        const nextLevel = new Set<string>();
        links.forEach((l) => {
          const source = l.source as string;
          const target = l.target as string;
          if (currentLevel.has(source) && !connectedIds.has(target)) {
            nextLevel.add(target);
            connectedIds.add(target);
          }
          if (currentLevel.has(target) && !connectedIds.has(source)) {
            nextLevel.add(source);
            connectedIds.add(source);
          }
        });
        currentLevel = nextLevel;
      }

      nodes = nodes.filter((n) => connectedIds.has(n.id));
      links = links.filter(
        (l) =>
          connectedIds.has(l.source as string) &&
          connectedIds.has(l.target as string)
      );
    }

    return { nodes, links };
  }, [graphData, showOrphans, viewMode, focusedNote, localDepth, searchResults]);

  // Update focused note when current note changes
  useEffect(() => {
    if (currentNote) {
      setFocusedNote(currentNote.id);
    }
  }, [currentNote, setFocusedNote]);

  // Configure d3 forces when physics settings change
  useEffect(() => {
    if (fgRef.current) {
      // Configure link force distance
      const linkForce = fgRef.current.d3Force('link');
      if (linkForce) {
        linkForce.distance(linkDistance);
      }

      // Configure charge (repulsion) force
      const chargeForce = fgRef.current.d3Force('charge');
      if (chargeForce) {
        chargeForce.strength(chargeStrength);
      }

      // Add collision force to prevent nodes from overlapping
      fgRef.current.d3Force('collision', forceCollide().radius((node: any) => {
        const graphNode = node as GraphNode;
        const connections = (graphNode.linkCount || 0) + (graphNode.backlinkCount || 0);
        // Collision radius based on node size + padding
        return Math.max(8, Math.min(20, 8 + connections * 0.8));
      }));

      // Reheat simulation to apply changes
      fgRef.current.d3ReheatSimulation();
    }
  }, [linkDistance, chargeStrength]);

  // Node coloring based on state
  const getNodeColor = useCallback(
    (node: GraphNode) => {
      // Search result highlighting (highest priority)
      if (viewMode === "search" && searchResults.includes(node.id)) {
        return "#f59e0b"; // amber - search result
      }
      if (node.id === focusedNote) return "#6366f1"; // accent-primary - current note
      if (node.id === selectedNode) return "#8b5cf6"; // purple - selected
      if (node.id === hoveredNode) return "#3b82f6"; // blue - hovered

      // Color by connection density
      const connections = node.linkCount + node.backlinkCount;
      if (connections > 10) return "#22c55e"; // green - hub (many connections)
      if (connections > 5) return "#06b6d4"; // cyan - connected (medium connections)
      if (connections > 2) return "#94a3b8"; // slate - normal (some connections)
      return "#64748b"; // slate-500 - sparse (few connections)
    },
    [focusedNote, selectedNode, hoveredNode, viewMode, searchResults]
  );

  // Node size based on connections
  const getNodeSize = useCallback(
    (node: GraphNode) => {
      // Make search results bigger
      if (viewMode === "search" && searchResults.includes(node.id)) {
        return 10;
      }
      const connections = node.linkCount + node.backlinkCount;
      return Math.max(4, Math.min(12, 4 + connections * 0.5));
    },
    [viewMode, searchResults]
  );

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      // Single click opens in preview pane
      openNoteInSecondary(node.path);
      setShowPreview(true);
    },
    [openNoteInSecondary]
  );

  const handleNodeRightClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        node: node,
      });
    },
    []
  );

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Context menu actions
  const handleContextMenuAction = useCallback((action: string, node: GraphNode) => {
    setContextMenu(null);
    switch (action) {
      case 'open':
        openNote(node.path);
        break;
      case 'preview':
        openNoteInSecondary(node.path);
        setShowPreview(true);
        break;
      case 'focus':
        setFocusedNote(node.id);
        setViewMode('local');
        break;
      case 'copyPath':
        navigator.clipboard.writeText(node.path);
        break;
      case 'copyTitle':
        navigator.clipboard.writeText(node.title);
        break;
      case 'copyLink':
        navigator.clipboard.writeText(`[[${node.title}]]`);
        break;
    }
  }, [openNote, openNoteInSecondary, setFocusedNote, setViewMode]);

  // Fix node position after dragging so it stays in place
  const handleNodeDragEnd = useCallback((node: any) => {
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      performSearch(e.target.value);
    },
    [performSearch]
  );

  const effectiveWidth = width || dimensions.width;
  const effectiveHeight = height || dimensions.height;

  return (
    <div className="flex-1 flex flex-col bg-dark-950 overflow-hidden" ref={containerRef}>
      {/* Header with search */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-800 bg-dark-900">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-dark-100">
            <GraphIcon />
            <h2 className="font-semibold">Graph View</h2>
          </div>

          {/* View mode toggle */}
          <div className="flex bg-dark-800 rounded-lg p-0.5">
            <button
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === "global"
                  ? "bg-accent-primary text-white"
                  : "text-dark-400 hover:text-dark-200"
              }`}
              onClick={() => setViewMode("global")}
            >
              Global
            </button>
            <button
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === "local"
                  ? "bg-accent-primary text-white"
                  : "text-dark-400 hover:text-dark-200"
              }`}
              onClick={() => setViewMode("local")}
            >
              Local
            </button>
            <button
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === "search"
                  ? "bg-accent-primary text-white"
                  : "text-dark-400 hover:text-dark-200"
              }`}
              onClick={() => setViewMode("search")}
            >
              Search
            </button>
          </div>

          {/* Stats */}
          {filteredData && (
            <span className="text-xs text-dark-500">
              {filteredData.nodes.length} notes, {filteredData.links.length} links
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-48 pl-8 pr-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-primary"
            />
          </div>

          <button
            className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
            onClick={() => loadGraphData()}
            title="Refresh graph"
          >
            <RefreshIcon />
          </button>
          <button
            className={`p-1.5 rounded transition-colors ${
              showSettings
                ? "bg-dark-800 text-accent-primary"
                : "hover:bg-dark-800 text-dark-400 hover:text-dark-200"
            }`}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* Main content area with optional preview pane */}
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={showPreview ? 60 : 100} minSize={30}>
          <div className="h-full relative overflow-hidden">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-dark-400">Loading graph...</div>
              </div>
            ) : filteredData && filteredData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={fgRef}
                graphData={filteredData}
                nodeLabel={(node: any) => node.title}
                nodeColor={getNodeColor}
                nodeVal={getNodeSize}
                linkColor={() => "#334155"}
                linkWidth={1}
                linkDirectionalParticles={0}
                onNodeClick={handleNodeClick}
                onNodeRightClick={handleNodeRightClick}
                onNodeHover={(node: any) => setHoveredNode(node?.id ?? null)}
                onNodeDragEnd={handleNodeDragEnd}
                cooldownTicks={100}
                onEngineStop={() => fgRef.current?.zoomToFit(400)}
                onNodeDrag={(node: any) => {
                  // Keep node at cursor position during drag
                  node.fx = node.x;
                  node.fy = node.y;
                }}
                enableNodeDrag={true}
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
                backgroundColor="#020617"
                width={showPreview ? (effectiveWidth * 0.6) : effectiveWidth}
                height={effectiveHeight - 57}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-dark-400">
                  <GraphIcon />
                  <p className="mt-2">
                    {viewMode === "search" && searchQuery
                      ? "No nodes match your search"
                      : "No graph data available"}
                  </p>
                  <button
                    className="mt-4 btn-secondary"
                    onClick={() => loadGraphData()}
                  >
                    Load Graph
                  </button>
                </div>
              </div>
            )}

        {/* Settings panel */}
        {showSettings && (
          <div className="absolute top-2 right-2 bg-dark-900 border border-dark-800 rounded-lg p-4 w-64 shadow-xl">
            <h3 className="text-sm font-medium text-dark-200 mb-3">Display</h3>

            <label className="flex items-center gap-2 text-sm text-dark-400 mb-3">
              <input
                type="checkbox"
                checked={showOrphans}
                onChange={(e) => setShowOrphans(e.target.checked)}
                className="accent-accent-primary"
              />
              Show orphan notes
            </label>

            {(viewMode === "local" || viewMode === "search") && (
              <div className="mb-4">
                <label className="text-sm text-dark-400 block mb-1">
                  Depth: {localDepth}
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={localDepth}
                  onChange={(e) => setLocalDepth(Number(e.target.value))}
                  className="w-full accent-accent-primary"
                />
              </div>
            )}

            <h3 className="text-sm font-medium text-dark-200 mb-3 mt-4">
              Physics
            </h3>

            <div className="mb-3">
              <label className="text-sm text-dark-400 block mb-1">
                Link distance: {linkDistance}
              </label>
              <input
                type="range"
                min={30}
                max={200}
                value={linkDistance}
                onChange={(e) => setLinkDistance(Number(e.target.value))}
                className="w-full accent-accent-primary"
              />
            </div>

            <div>
              <label className="text-sm text-dark-400 block mb-1">
                Repulsion: {Math.abs(chargeStrength)}
              </label>
              <input
                type="range"
                min={50}
                max={500}
                value={Math.abs(chargeStrength)}
                onChange={(e) => setChargeStrength(-Number(e.target.value))}
                className="w-full accent-accent-primary"
              />
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-2 left-2 bg-dark-900/90 border border-dark-800 rounded-lg p-2 shadow-xl">
          <div className="flex gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-accent-primary" />
              <span className="text-dark-400">Current</span>
            </div>
            {viewMode === "search" && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-dark-400">Match</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-dark-400">Hub (10+)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <span className="text-dark-400">Connected (5+)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="text-dark-400">Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span className="text-dark-400">Sparse</span>
            </div>
          </div>
        </div>

        {/* Hovered node info */}
        {hoveredNode && filteredData && (
          <div className="absolute top-2 left-2 bg-dark-900 border border-dark-800 rounded-lg p-3 shadow-xl">
            {(() => {
              const node = filteredData.nodes.find((n) => n.id === hoveredNode);
              if (!node) return null;
              return (
                <div>
                  <div className="font-medium text-dark-100">{node.title}</div>
                  <div className="text-xs text-dark-500 mt-1">{node.path}</div>
                  <div className="text-xs text-dark-400 mt-2">
                    {node.linkCount} outgoing, {node.backlinkCount} incoming
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Context menu */}
        {contextMenu && (
          <div
            className="fixed bg-dark-900 border border-dark-700 rounded-lg py-1 shadow-xl z-50 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-xs text-dark-500 border-b border-dark-800 truncate max-w-[200px]">
              {contextMenu.node.title}
            </div>
            <button
              className="w-full px-3 py-1.5 text-sm text-dark-200 hover:bg-dark-800 text-left flex items-center gap-2"
              onClick={() => handleContextMenuAction('preview', contextMenu.node)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Preview
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-dark-200 hover:bg-dark-800 text-left flex items-center gap-2"
              onClick={() => handleContextMenuAction('open', contextMenu.node)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Note (Leave Graph)
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-dark-200 hover:bg-dark-800 text-left flex items-center gap-2"
              onClick={() => handleContextMenuAction('focus', contextMenu.node)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Focus in Local View
            </button>
            <div className="border-t border-dark-800 my-1" />
            <button
              className="w-full px-3 py-1.5 text-sm text-dark-200 hover:bg-dark-800 text-left flex items-center gap-2"
              onClick={() => handleContextMenuAction('copyLink', contextMenu.node)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Copy Wiki Link
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-dark-200 hover:bg-dark-800 text-left flex items-center gap-2"
              onClick={() => handleContextMenuAction('copyTitle', contextMenu.node)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Title
            </button>
            <button
              className="w-full px-3 py-1.5 text-sm text-dark-200 hover:bg-dark-800 text-left flex items-center gap-2"
              onClick={() => handleContextMenuAction('copyPath', contextMenu.node)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Copy Path
            </button>
          </div>
        )}

        {/* Search results list */}
        {viewMode === "search" && searchResults.length > 0 && filteredData && (
          <div className="absolute bottom-2 right-2 bg-dark-900 border border-dark-800 rounded-lg p-2 shadow-xl max-h-48 overflow-y-auto w-56">
            <div className="text-xs text-dark-500 mb-2">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </div>
            <div className="space-y-1">
              {filteredData.nodes
                .filter((n) => searchResults.includes(n.id))
                .map((node) => (
                  <button
                    key={node.id}
                    className="w-full text-left px-2 py-1 rounded hover:bg-dark-800 text-sm text-dark-300 truncate"
                    onClick={() => {
                      openNoteInSecondary(node.path);
                      setShowPreview(true);
                    }}
                  >
                    {node.title}
                  </button>
                ))}
            </div>
          </div>
        )}
          </div>
        </Panel>

        {/* Preview pane */}
        {showPreview && (
          <>
            <PanelResizeHandle className="w-1 bg-dark-800 hover:bg-accent-primary transition-colors cursor-col-resize" />
            <Panel defaultSize={40} minSize={20}>
              <div className="h-full flex flex-col bg-dark-900 border-l border-dark-800">
                {/* Preview header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-dark-800">
                  <div className="flex-1 min-w-0">
                    {secondaryNote ? (
                      <>
                        <h3 className="font-medium text-dark-100 truncate">{secondaryNote.title}</h3>
                        <p className="text-xs text-dark-500 truncate">{secondaryNote.path}</p>
                      </>
                    ) : isSecondaryLoading ? (
                      <span className="text-dark-400">Loading...</span>
                    ) : (
                      <span className="text-dark-500">Select a node to preview</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {secondaryNote && (
                      <button
                        className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
                        onClick={() => openNote(secondaryNote.path)}
                        title="Open in editor"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors"
                      onClick={() => {
                        setShowPreview(false);
                        closeSecondaryNote();
                      }}
                      title="Close preview"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Preview content */}
                <div className="flex-1 overflow-auto">
                  {secondaryNote ? (
                    <PreviewPane content={secondaryEditorContent} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-dark-500">
                      {isSecondaryLoading ? 'Loading...' : 'Click a node to preview'}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  );
}

// Legacy modal version - keeping for backwards compatibility
export function GraphView() {
  const { showView, toggleView } = useGraphStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showView) {
        toggleView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showView, toggleView]);

  if (!showView) return null;

  return (
    <div className="fixed inset-0 bg-dark-950 z-40 flex flex-col">
      <div className="absolute top-4 right-4 z-50">
        <button
          className="p-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300"
          onClick={toggleView}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <GraphViewPanel />
    </div>
  );
}
