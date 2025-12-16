import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeTypes,
  type ReactFlowInstance,
  BackgroundVariant,
  MarkerType,
  ConnectionMode,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock, Copy, Trash2, ArrowUpToLine, ArrowDownToLine, Layers, Plus, Palette, Square, Circle as CircleIcon, Minus, ChevronRight, Type, Zap, MousePointer2, Move, Link2, Unlink, Undo2, Redo2, AlignLeft, AlignRight, AlignCenterHorizontal, AlignStartVertical, AlignEndVertical, AlignCenterVertical, GripHorizontal, GripVertical, Search, X, Eye, EyeOff, Bold, Italic, AlignCenter, Image, FileText, ExternalLink } from "lucide-react";

import { useDiagramStore } from "./store";
import { useNoteStore } from "@/stores/noteStore";
import { ShapeNode, IconNode, TextNode, GroupNode, ImageNode, SwimlaneNode, ICON_MAP } from "./components/CustomNodes";
import { WaypointEdge } from "./components/CustomEdges";
import { exportToPng } from "./utils/export";
import { TEMPLATE_CATEGORY_NAMES, getTemplatesByCategory } from "./templates";
import { ExtensionTitleBar, DropdownItem } from "@/components/layout/ExtensionTitleBar";
import type { DiagramNode, DiagramEdge, NodeData, ReactFlowNodeData, EdgeData, DiagramTemplate } from "./types";
import type { EdgeTypes } from "@xyflow/react";

// Custom node types
const nodeTypes: NodeTypes = {
  shape: ShapeNode,
  icon: IconNode,
  text: TextNode,
  group: GroupNode,
  image: ImageNode,
  swimlane: SwimlaneNode,
};

// Custom edge types
const edgeTypes: EdgeTypes = {
  waypoint: WaypointEdge,
};

// Shape definitions for palette
const SHAPE_PALETTE = [
  { id: "rectangle", name: "Rectangle", shapeType: "rectangle" as const },
  { id: "circle", name: "Circle", shapeType: "circle" as const },
  { id: "diamond", name: "Diamond", shapeType: "diamond" as const },
  { id: "cylinder", name: "Cylinder", shapeType: "cylinder" as const },
  { id: "hexagon", name: "Hexagon", shapeType: "hexagon" as const },
];

// Icon categories for palette
const ICON_CATEGORIES = [
  { name: "Infrastructure", icons: ["Server", "Database", "Cloud", "HardDrive", "Cpu"] },
  { name: "Network", icons: ["Network", "Router", "Wifi", "Globe"] },
  { name: "Devices", icons: ["Monitor", "Smartphone", "Container"] },
  { name: "Security", icons: ["Shield", "Lock", "Key"] },
  { name: "People", icons: ["User", "Users"] },
  { name: "General", icons: ["Box", "FileText", "Folder", "Settings"] },
];

// Convert backend nodes to React Flow nodes
function toReactFlowNodes(nodes: DiagramNode[]): Node[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.nodeType,
    position: { x: node.positionX, y: node.positionY },
    data: {
      ...node.data,
      nodeType: node.nodeType,
    },
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
  }));
}

// Map arrow types to React Flow marker types
function getMarkerType(arrowType?: string): MarkerType | undefined {
  switch (arrowType) {
    case 'arrow': return MarkerType.Arrow;
    case 'arrowclosed': return MarkerType.ArrowClosed;
    case 'none': return undefined;
    default: return MarkerType.ArrowClosed;
  }
}

// Convert backend edges to React Flow edges
function toReactFlowEdges(edges: DiagramEdge[]): Edge[] {
  return edges.map((edge) => {
    const data = edge.data as EdgeData | undefined;
    const strokeWidth = data?.strokeWidth || 2;
    const strokeStyle = data?.strokeStyle || 'solid';
    const strokeDasharray = strokeStyle === 'dashed' ? '5,5' : strokeStyle === 'dotted' ? '2,2' : undefined;

    const targetMarkerType = getMarkerType(data?.targetArrow);
    const sourceMarkerType = getMarkerType(data?.sourceArrow);

    // Use waypoint edge type if edge has waypoints, otherwise use the specified type
    const hasWaypoints = data?.waypoints && data.waypoints.length > 0;

    return {
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: hasWaypoints ? "waypoint" : edge.edgeType,
      data: edge.data,
      markerEnd: targetMarkerType ? {
        type: targetMarkerType,
        width: 20,
        height: 20,
        color: data?.color,
      } : undefined,
      markerStart: sourceMarkerType ? {
        type: sourceMarkerType,
        width: 20,
        height: 20,
        color: data?.color,
      } : undefined,
      style: {
        stroke: data?.color || '#64748b',
        strokeWidth,
        strokeDasharray,
      },
      animated: data?.animated,
      label: data?.label,
      labelStyle: data?.labelBgColor ? { fill: data.labelBgColor } : undefined,
    };
  });
}

// Color palette for nodes
const COLOR_PALETTE = [
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#64748b", // slate
];

// Custom controls component with proper icons
interface CustomControlsProps {
  isLocked: boolean;
  onToggleLock: () => void;
  isSelectMode: boolean;
  onToggleSelectMode: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasSelection: boolean;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignMiddle: () => void;
  onAlignBottom: () => void;
  onDistributeH: () => void;
  onDistributeV: () => void;
}

function CustomControls({
  isLocked,
  onToggleLock,
  isSelectMode,
  onToggleSelectMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  onDistributeH,
  onDistributeV,
}: CustomControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  return (
    <>
      {/* Main controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1 z-10">
        <button
          onClick={() => zoomIn()}
          className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => zoomOut()}
          className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={() => fitView({ padding: 0.2 })}
          className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded transition-colors"
          title="Fit View"
        >
          <Maximize size={18} />
        </button>
        <div className="border-t border-dark-600 my-1" />
        <button
          onClick={onToggleSelectMode}
          disabled={isLocked}
          className={`p-2 rounded transition-colors ${isSelectMode ? 'text-blue-400 bg-dark-700' : 'text-dark-300 hover:text-white hover:bg-dark-700'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isSelectMode ? "Select Mode (drag to select)" : "Pan Mode (drag to pan)"}
        >
          {isSelectMode ? <MousePointer2 size={18} /> : <Move size={18} />}
        </button>
        <button
          onClick={onToggleLock}
          className={`p-2 rounded transition-colors ${isLocked ? 'text-blue-400 bg-dark-700' : 'text-dark-300 hover:text-white hover:bg-dark-700'}`}
          title={isLocked ? "Unlock (enable editing)" : "Lock (view only)"}
        >
          {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
        </button>
      </div>

      {/* Undo/Redo and Alignment toolbar (top) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1 z-10">
        <button
          onClick={onUndo}
          disabled={!canUndo || isLocked}
          className={`p-2 rounded transition-colors ${!canUndo || isLocked ? 'text-dark-600 cursor-not-allowed' : 'text-dark-300 hover:text-white hover:bg-dark-700'}`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo || isLocked}
          className={`p-2 rounded transition-colors ${!canRedo || isLocked ? 'text-dark-600 cursor-not-allowed' : 'text-dark-300 hover:text-white hover:bg-dark-700'}`}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={18} />
        </button>
        <div className="w-px h-6 bg-dark-600 mx-1" />
        <div className="relative">
          <button
            onClick={() => setShowAlignMenu(!showAlignMenu)}
            disabled={!hasSelection || isLocked}
            className={`p-2 rounded transition-colors ${!hasSelection || isLocked ? 'text-dark-600 cursor-not-allowed' : 'text-dark-300 hover:text-white hover:bg-dark-700'} ${showAlignMenu ? 'bg-dark-700' : ''}`}
            title="Alignment Tools"
          >
            <AlignCenterHorizontal size={18} />
          </button>
          {showAlignMenu && hasSelection && !isLocked && (
            <div className="absolute top-full left-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg p-2 shadow-xl min-w-[180px]">
              <div className="text-xs text-dark-500 uppercase font-semibold px-2 py-1">Align</div>
              <div className="grid grid-cols-3 gap-1 mb-2">
                <button onClick={() => { onAlignLeft(); setShowAlignMenu(false); }} className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded" title="Align Left">
                  <AlignLeft size={16} />
                </button>
                <button onClick={() => { onAlignCenter(); setShowAlignMenu(false); }} className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded" title="Align Center">
                  <AlignCenterHorizontal size={16} />
                </button>
                <button onClick={() => { onAlignRight(); setShowAlignMenu(false); }} className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded" title="Align Right">
                  <AlignRight size={16} />
                </button>
                <button onClick={() => { onAlignTop(); setShowAlignMenu(false); }} className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded" title="Align Top">
                  <AlignStartVertical size={16} />
                </button>
                <button onClick={() => { onAlignMiddle(); setShowAlignMenu(false); }} className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded" title="Align Middle">
                  <AlignCenterVertical size={16} />
                </button>
                <button onClick={() => { onAlignBottom(); setShowAlignMenu(false); }} className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded" title="Align Bottom">
                  <AlignEndVertical size={16} />
                </button>
              </div>
              <div className="text-xs text-dark-500 uppercase font-semibold px-2 py-1">Distribute</div>
              <div className="grid grid-cols-2 gap-1">
                <button onClick={() => { onDistributeH(); setShowAlignMenu(false); }} className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded flex items-center gap-2" title="Distribute Horizontally">
                  <GripHorizontal size={16} />
                  <span className="text-xs">Horizontal</span>
                </button>
                <button onClick={() => { onDistributeV(); setShowAlignMenu(false); }} className="p-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded flex items-center gap-2" title="Distribute Vertically">
                  <GripVertical size={16} />
                  <span className="text-xs">Vertical</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function DiagramEditor() {
  const {
    showView,
    setShowView,
    boards,
    currentBoard,
    nodes: storeNodes,
    edges: storeEdges,
    loadBoard,
    loadBoards,
    createBoard,
    deleteBoard,
    addNode,
    deleteNode,
    bulkUpdateNodes,
    addEdge: addStoreEdge,
    deleteEdge,
    showCreateModal,
    openCreateModal,
    closeCreateModal,
    showDeleteConfirm,
    boardToDelete,
    confirmDeleteBoard,
    cancelDeleteBoard,
    selectedNodeIds,
    selectedEdgeIds,
    setSelection,
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    // Clipboard
    copySelection,
    pasteClipboard,
    cutSelection,
    // Alignment
    alignNodes,
    distributeNodes,
    nudgeSelection,
    // Layers
    layers,
    activeLayerId,
    addLayer,
    deleteLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    setActiveLayer,
    // Search
    showSearch,
    setShowSearch,
    searchQuery,
    setSearchQuery,
    // Note linking
    addNoteLink,
    removeNoteLink,
    removeAllNoteLinks,
  } = useDiagramStore();

  // Note store for linking diagrams to notes
  const { notes, openNote } = useNoteStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [newBoardName, setNewBoardName] = useState("");
  const [activeTab, setActiveTab] = useState<"shapes" | "icons">("shapes");
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [isLocked, setIsLocked] = useState(true); // Default to locked for viewing
  const [isSelectMode, setIsSelectMode] = useState(false); // Selection mode vs pan mode
  const isNewBoardRef = useRef(false); // Track if board was just created (ref for sync updates)
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map()); // Track drag start for grouped movement
  const ctrlDragDuplicates = useRef<Map<string, string>>(new Map()); // Track duplicated node IDs (original -> duplicate)

  // Smart guides state
  const [smartGuides, setSmartGuides] = useState<{
    horizontal: Array<{ y: number; x1: number; x2: number }>;
    vertical: Array<{ x: number; y1: number; y2: number }>;
  }>({ horizontal: [], vertical: [] });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
    edgeId?: string;
    flowPosition?: { x: number; y: number };
    submenu?: "fill" | "border" | "borderStyle" | "opacity" | "cornerRadius" | "fontSize" | "textAlign" | "edgeColor" | "edgeType" | "strokeWidth" | "strokeStyle" | "sourceArrow" | "targetArrow" | "edgeLabel" | "imageUrl" | "imageFit" | "layer";
  } | null>(null);
  const [edgeLabelValue, setEdgeLabelValue] = useState("");

  // Template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Note linking modal state
  const [showNoteLinkModal, setShowNoteLinkModal] = useState(false);
  const [noteLinkSearch, setNoteLinkSearch] = useState("");

  // Build a set of hidden layer IDs for quick lookup
  const hiddenLayerIds = useMemo(() => {
    const hidden = new Set<string>();
    layers.forEach(l => {
      if (!l.visible) hidden.add(l.id);
    });
    return hidden;
  }, [layers]);

  // Build a set of locked layer IDs for quick lookup
  const lockedLayerIds = useMemo(() => {
    const locked = new Set<string>();
    layers.forEach(l => {
      if (l.locked) locked.add(l.id);
    });
    return locked;
  }, [layers]);

  // Sync React Flow state with store - apply layer visibility
  useEffect(() => {
    const allReactFlowNodes = toReactFlowNodes(storeNodes).map((node) => {
      const storeNode = storeNodes.find((n) => n.id === node.id);
      const nodeLayerId = storeNode?.data?.layerId || 'default';
      const isHidden = hiddenLayerIds.has(nodeLayerId);
      const isLocked = lockedLayerIds.has(nodeLayerId);

      return {
        ...node,
        hidden: isHidden,
        draggable: !isLocked && !isHidden,
        connectable: !isLocked && !isHidden,
        selectable: !isHidden,
        // Add a CSS class for hidden nodes - this is more reliable than inline styles
        className: isHidden ? 'react-flow-node-hidden' : undefined,
      };
    });

    setNodes(allReactFlowNodes);
  }, [storeNodes, hiddenLayerIds, lockedLayerIds, setNodes]);

  useEffect(() => {
    setEdges(toReactFlowEdges(storeEdges));
  }, [storeEdges, setEdges]);

  // Reload boards when view opens (ensures persistence works)
  useEffect(() => {
    if (showView) {
      loadBoards();
    }
  }, [showView, loadBoards]);

  // Load first board when boards are available
  useEffect(() => {
    if (showView && boards.length > 0 && !currentBoard) {
      loadBoard(boards[0].id);
    }
  }, [showView, boards, currentBoard, loadBoard]);

  // Set lock state when board changes - lock existing boards, unlock new ones
  useEffect(() => {
    if (currentBoard) {
      if (isNewBoardRef.current) {
        setIsLocked(false); // New board starts unlocked for editing
        isNewBoardRef.current = false; // Reset the flag
      } else {
        setIsLocked(true); // Existing boards start locked
      }
    }
  }, [currentBoard?.id]); // Only trigger on board ID change

  // Handle node changes (position updates)
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);

      // Debounce position updates to backend (only for non-grouped or single node moves)
      const positionChanges = changes.filter(
        (c): c is { type: "position"; id: string; position: { x: number; y: number }; dragging?: boolean } =>
          c.type === "position" && "position" in c && !!(c as { position?: unknown }).position && !(c as { dragging?: boolean }).dragging
      );

      if (positionChanges.length > 0 && currentBoard) {
        const updates = positionChanges.map((c) => ({
          id: c.id,
          positionX: c.position.x,
          positionY: c.position.y,
        }));
        bulkUpdateNodes(currentBoard.id, updates);
      }
    },
    [onNodesChange, currentBoard, bulkUpdateNodes]
  );

  // Handle drag start - record positions for grouped movement or Ctrl+Drag duplicate
  const handleNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as NodeData;
      const groupId = nodeData?.selectionGroupId;

      // Clear previous duplicate tracking
      ctrlDragDuplicates.current.clear();
      dragStartPositions.current.clear();

      // Ctrl+Drag to duplicate - record which nodes to duplicate
      if (event.ctrlKey && currentBoard) {
        // Get all selected nodes or just the dragged node
        const nodesToDuplicate = selectedNodeIds.length > 0 && selectedNodeIds.includes(node.id)
          ? nodes.filter((n) => selectedNodeIds.includes(n.id))
          : [node];

        // Record start positions and mark for duplication
        nodesToDuplicate.forEach((n) => {
          ctrlDragDuplicates.current.set(n.id, "pending");
          dragStartPositions.current.set(n.id, { x: n.position.x, y: n.position.y });
        });
        return;
      }

      if (groupId) {
        // Record starting positions of all nodes in the same group
        nodes.forEach((n) => {
          const nData = n.data as NodeData;
          if (nData?.selectionGroupId === groupId) {
            dragStartPositions.current.set(n.id, { x: n.position.x, y: n.position.y });
          }
        });
      }
    },
    [nodes, selectedNodeIds, currentBoard]
  );

  // Handle drag - move all grouped nodes together and calculate smart guides with magnetic snapping
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as NodeData;
      const groupId = nodeData?.selectionGroupId;

      // Calculate smart guides with magnetic snapping
      const SNAP_THRESHOLD = 8; // pixels - distance to trigger snap
      const newHGuides: Array<{ y: number; x1: number; x2: number }> = [];
      const newVGuides: Array<{ x: number; y1: number; y2: number }> = [];

      const nodeWidth = node.width || 100;
      const nodeHeight = node.height || 50;
      const draggedNodeLeft = node.position.x;
      const draggedNodeRight = node.position.x + nodeWidth;
      const draggedNodeTop = node.position.y;
      const draggedNodeBottom = node.position.y + nodeHeight;
      const draggedNodeCenterX = (draggedNodeLeft + draggedNodeRight) / 2;
      const draggedNodeCenterY = (draggedNodeTop + draggedNodeBottom) / 2;

      // Track snap adjustments
      let snapX: number | null = null;
      let snapY: number | null = null;

      // Check alignment with other nodes
      nodes.forEach((n) => {
        if (n.id === node.id) return;
        // Skip nodes being dragged together
        if (groupId && (n.data as NodeData)?.selectionGroupId === groupId) return;

        const otherWidth = n.width || 100;
        const otherHeight = n.height || 50;
        const nodeLeft = n.position.x;
        const nodeRight = n.position.x + otherWidth;
        const nodeTop = n.position.y;
        const nodeBottom = n.position.y + otherHeight;
        const nodeCenterX = (nodeLeft + nodeRight) / 2;
        const nodeCenterY = (nodeTop + nodeBottom) / 2;

        // Horizontal snapping (vertical guides)
        // Left-to-left alignment
        if (snapX === null && Math.abs(draggedNodeLeft - nodeLeft) < SNAP_THRESHOLD) {
          snapX = nodeLeft;
          newVGuides.push({
            x: nodeLeft,
            y1: Math.min(draggedNodeTop, nodeTop) - 20,
            y2: Math.max(draggedNodeBottom, nodeBottom) + 20,
          });
        }
        // Right-to-right alignment
        if (snapX === null && Math.abs(draggedNodeRight - nodeRight) < SNAP_THRESHOLD) {
          snapX = nodeRight - nodeWidth;
          newVGuides.push({
            x: nodeRight,
            y1: Math.min(draggedNodeTop, nodeTop) - 20,
            y2: Math.max(draggedNodeBottom, nodeBottom) + 20,
          });
        }
        // Left-to-right alignment
        if (snapX === null && Math.abs(draggedNodeLeft - nodeRight) < SNAP_THRESHOLD) {
          snapX = nodeRight;
          newVGuides.push({
            x: nodeRight,
            y1: Math.min(draggedNodeTop, nodeTop) - 20,
            y2: Math.max(draggedNodeBottom, nodeBottom) + 20,
          });
        }
        // Right-to-left alignment
        if (snapX === null && Math.abs(draggedNodeRight - nodeLeft) < SNAP_THRESHOLD) {
          snapX = nodeLeft - nodeWidth;
          newVGuides.push({
            x: nodeLeft,
            y1: Math.min(draggedNodeTop, nodeTop) - 20,
            y2: Math.max(draggedNodeBottom, nodeBottom) + 20,
          });
        }
        // Center-to-center X alignment
        if (snapX === null && Math.abs(draggedNodeCenterX - nodeCenterX) < SNAP_THRESHOLD) {
          snapX = nodeCenterX - nodeWidth / 2;
          newVGuides.push({
            x: nodeCenterX,
            y1: Math.min(draggedNodeTop, nodeTop) - 20,
            y2: Math.max(draggedNodeBottom, nodeBottom) + 20,
          });
        }

        // Vertical snapping (horizontal guides)
        // Top-to-top alignment
        if (snapY === null && Math.abs(draggedNodeTop - nodeTop) < SNAP_THRESHOLD) {
          snapY = nodeTop;
          newHGuides.push({
            y: nodeTop,
            x1: Math.min(draggedNodeLeft, nodeLeft) - 20,
            x2: Math.max(draggedNodeRight, nodeRight) + 20,
          });
        }
        // Bottom-to-bottom alignment
        if (snapY === null && Math.abs(draggedNodeBottom - nodeBottom) < SNAP_THRESHOLD) {
          snapY = nodeBottom - nodeHeight;
          newHGuides.push({
            y: nodeBottom,
            x1: Math.min(draggedNodeLeft, nodeLeft) - 20,
            x2: Math.max(draggedNodeRight, nodeRight) + 20,
          });
        }
        // Top-to-bottom alignment
        if (snapY === null && Math.abs(draggedNodeTop - nodeBottom) < SNAP_THRESHOLD) {
          snapY = nodeBottom;
          newHGuides.push({
            y: nodeBottom,
            x1: Math.min(draggedNodeLeft, nodeLeft) - 20,
            x2: Math.max(draggedNodeRight, nodeRight) + 20,
          });
        }
        // Bottom-to-top alignment
        if (snapY === null && Math.abs(draggedNodeBottom - nodeTop) < SNAP_THRESHOLD) {
          snapY = nodeTop - nodeHeight;
          newHGuides.push({
            y: nodeTop,
            x1: Math.min(draggedNodeLeft, nodeLeft) - 20,
            x2: Math.max(draggedNodeRight, nodeRight) + 20,
          });
        }
        // Center-to-center Y alignment
        if (snapY === null && Math.abs(draggedNodeCenterY - nodeCenterY) < SNAP_THRESHOLD) {
          snapY = nodeCenterY - nodeHeight / 2;
          newHGuides.push({
            y: nodeCenterY,
            x1: Math.min(draggedNodeLeft, nodeLeft) - 20,
            x2: Math.max(draggedNodeRight, nodeRight) + 20,
          });
        }
      });

      setSmartGuides({ horizontal: newHGuides, vertical: newVGuides });

      // Apply magnetic snapping - update node position if within threshold
      const snappedX = snapX !== null ? snapX : node.position.x;
      const snappedY = snapY !== null ? snapY : node.position.y;
      const needsSnap = snapX !== null || snapY !== null;

      if (groupId && dragStartPositions.current.size > 1) {
        const startPos = dragStartPositions.current.get(node.id);
        if (!startPos) return;

        // Calculate delta from drag start (use snapped position)
        const deltaX = snappedX - startPos.x;
        const deltaY = snappedY - startPos.y;

        // Update all grouped nodes (including the dragged one with snapping)
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id && needsSnap) {
              return { ...n, position: { x: snappedX, y: snappedY } };
            }
            const nData = n.data as NodeData;
            if (nData?.selectionGroupId === groupId && n.id !== node.id) {
              const nStartPos = dragStartPositions.current.get(n.id);
              if (nStartPos) {
                return {
                  ...n,
                  position: {
                    x: nStartPos.x + deltaX,
                    y: nStartPos.y + deltaY,
                  },
                };
              }
            }
            return n;
          })
        );
      } else if (needsSnap) {
        // Single node snap
        setNodes((nds) =>
          nds.map((n) =>
            n.id === node.id ? { ...n, position: { x: snappedX, y: snappedY } } : n
          )
        );
      }
    },
    [setNodes, nodes]
  );

  // Handle drag stop - save all grouped node positions to backend or create Ctrl+drag duplicates
  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as NodeData;
      const groupId = nodeData?.selectionGroupId;

      // Handle Ctrl+drag duplication
      if (ctrlDragDuplicates.current.size > 0 && currentBoard) {
        // Create duplicates at the new positions, move originals back
        for (const [originalId] of ctrlDragDuplicates.current) {
          const originalNode = nodes.find((n) => n.id === originalId);
          const startPos = dragStartPositions.current.get(originalId);

          if (originalNode && startPos) {
            const srcData = originalNode.data as NodeData;

            // Create duplicate at the new (dragged-to) position
            await useDiagramStore.getState().addNode(
              currentBoard.id,
              originalNode.type as 'shape' | 'icon' | 'text' | 'group' | 'image' | 'swimlane',
              originalNode.position.x,
              originalNode.position.y,
              originalNode.width || undefined,
              originalNode.height || undefined,
              { ...srcData, selectionGroupId: undefined } as NodeData
            );

            // Move the original node back to its start position
            await useDiagramStore.getState().updateNode(
              originalId,
              startPos.x,
              startPos.y
            );
          }
        }

        // Reset originals back to start positions in React Flow state
        setNodes((nds) =>
          nds.map((n) => {
            const startPos = dragStartPositions.current.get(n.id);
            if (startPos && ctrlDragDuplicates.current.has(n.id)) {
              return { ...n, position: startPos };
            }
            return n;
          })
        );

        ctrlDragDuplicates.current.clear();
        dragStartPositions.current.clear();
        // Clear smart guides
        setSmartGuides({ horizontal: [], vertical: [] });
        return;
      }

      if (groupId && dragStartPositions.current.size > 1 && currentBoard) {
        // Save all grouped nodes' new positions
        const updates: { id: string; positionX: number; positionY: number }[] = [];
        nodes.forEach((n) => {
          const nData = n.data as NodeData;
          if (nData?.selectionGroupId === groupId) {
            updates.push({
              id: n.id,
              positionX: n.position.x,
              positionY: n.position.y,
            });
          }
        });
        if (updates.length > 0) {
          bulkUpdateNodes(currentBoard.id, updates);
        }
      }
      dragStartPositions.current.clear();
      // Clear smart guides when drag ends
      setSmartGuides({ horizontal: [], vertical: [] });
    },
    [nodes, currentBoard, bulkUpdateNodes, setNodes]
  );

  // Handle edge changes
  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);

      // Handle edge deletions
      const removals = changes.filter((c): c is { type: "remove"; id: string } => c.type === "remove");
      removals.forEach((r) => {
        deleteEdge(r.id);
      });
    },
    [onEdgesChange, deleteEdge]
  );

  // Handle new connections
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!currentBoard || !connection.source || !connection.target) return;

      addStoreEdge(
        currentBoard.id,
        connection.source,
        connection.target,
        connection.sourceHandle || undefined,
        connection.targetHandle || undefined,
        "default",
        { color: selectedColor }
      );
    },
    [currentBoard, addStoreEdge, selectedColor]
  );

  // Handle selection changes
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelection(
        selectedNodes.map((n) => n.id),
        selectedEdges.map((e) => e.id)
      );
    },
    [setSelection]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      // Undo/Redo (always available, even when locked for viewing history)
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (!isLocked) undo();
        return;
      }
      if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (!isLocked) redo();
        return;
      }

      // Search (Ctrl+F)
      if (isMod && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // Copy/Paste/Cut
      if (isMod && e.key === 'c') {
        e.preventDefault();
        copySelection();
        return;
      }
      if (isMod && e.key === 'v') {
        e.preventDefault();
        if (!isLocked) pasteClipboard();
        return;
      }
      if (isMod && e.key === 'x') {
        e.preventDefault();
        if (!isLocked) cutSelection();
        return;
      }

      // Select all (Ctrl+A)
      if (isMod && e.key === 'a') {
        e.preventDefault();
        if (!isLocked) {
          setSelection(
            storeNodes.map((n) => n.id),
            storeEdges.map((e) => e.id)
          );
        }
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isLocked) return;
        e.preventDefault();
        selectedNodeIds.forEach((id) => deleteNode(id));
        selectedEdgeIds.forEach((id) => deleteEdge(id));
        return;
      }

      // Arrow key nudging
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (isLocked || selectedNodeIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        nudgeSelection(dx, dy);
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelection([], []);
        setShowSearch(false);
        return;
      }
    },
    [isLocked, selectedNodeIds, selectedEdgeIds, deleteNode, deleteEdge, undo, redo, copySelection, pasteClipboard, cutSelection, nudgeSelection, setSelection, setShowSearch, storeNodes, storeEdges]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Add shape node
  const handleAddShape = useCallback(
    async (shapeType: NodeData["shapeType"]) => {
      if (!currentBoard) return;

      await addNode(
        currentBoard.id,
        "shape",
        200 + Math.random() * 100,
        200 + Math.random() * 100,
        120,
        80,
        {
          label: shapeType || "Shape",
          shapeType,
          color: selectedColor,
          borderColor: selectedColor,
        }
      );
    },
    [currentBoard, addNode, selectedColor]
  );

  // Add icon node
  const handleAddIcon = useCallback(
    async (iconName: string) => {
      if (!currentBoard) return;

      await addNode(
        currentBoard.id,
        "icon",
        200 + Math.random() * 100,
        200 + Math.random() * 100,
        80,
        80,
        {
          label: iconName,
          icon: iconName,
          color: selectedColor,
          borderColor: selectedColor,
        }
      );
    },
    [currentBoard, addNode, selectedColor]
  );

  // Add text node
  const handleAddText = useCallback(async () => {
    if (!currentBoard) return;

    await addNode(
      currentBoard.id,
      "text",
      200 + Math.random() * 100,
      200 + Math.random() * 100,
      undefined,
      undefined,
      {
        label: "Text",
        color: "#e5e7eb",
      }
    );
  }, [currentBoard, addNode]);

  // Add group/container node
  const handleAddGroup = useCallback(async () => {
    if (!currentBoard) return;

    await addNode(
      currentBoard.id,
      "group",
      150 + Math.random() * 100,
      150 + Math.random() * 100,
      300,
      200,
      {
        label: "Group",
        borderColor: selectedColor,
        opacity: 0, // No fill by default
      }
    );
  }, [currentBoard, addNode, selectedColor]);

  // Context menu: handle right-click on canvas (pane)
  const handleContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      if (isLocked) return;

      // Get flow position from screen coordinates
      const bounds = reactFlowRef.current?.getBoundingClientRect();
      if (!bounds) return;

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowPosition: {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        },
      });
    },
    [isLocked]
  );

  // Context menu: handle right-click on node
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation(); // Prevent pane context menu from also firing
      if (isLocked) return;

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    [isLocked]
  );

  // Context menu: handle right-click on edge
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation(); // Prevent pane context menu from also firing
      if (isLocked) return;

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
      });
    },
    [isLocked]
  );

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Duplicate selected nodes
  const handleDuplicate = useCallback(async () => {
    if (!currentBoard || selectedNodeIds.length === 0) return;

    for (const nodeId of selectedNodeIds) {
      const node = storeNodes.find((n) => n.id === nodeId);
      if (node) {
        await addNode(
          currentBoard.id,
          node.nodeType,
          node.positionX + 30,
          node.positionY + 30,
          node.width,
          node.height,
          { ...node.data }
        );
      }
    }
    closeContextMenu();
  }, [currentBoard, selectedNodeIds, storeNodes, addNode, closeContextMenu]);

  // Bring node to front (increase z-index)
  const handleBringToFront = useCallback(async () => {
    if (!currentBoard || !contextMenu?.nodeId) return;

    const maxZ = Math.max(...storeNodes.map((n) => n.zIndex), 0);
    await useDiagramStore.getState().updateNode(
      contextMenu.nodeId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      maxZ + 1
    );
    closeContextMenu();
  }, [currentBoard, contextMenu, storeNodes, closeContextMenu]);

  // Send node to back (decrease z-index)
  const handleSendToBack = useCallback(async () => {
    if (!currentBoard || !contextMenu?.nodeId) return;

    const minZ = Math.min(...storeNodes.map((n) => n.zIndex), 0);
    await useDiagramStore.getState().updateNode(
      contextMenu.nodeId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      minZ - 1
    );
    closeContextMenu();
  }, [currentBoard, contextMenu, storeNodes, closeContextMenu]);

  // Group selected nodes - assign same selectionGroupId
  const handleGroupSelection = useCallback(async () => {
    if (!currentBoard || selectedNodeIds.length < 2) return;

    // Generate a new group ID
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update all selected nodes with the new group ID
    for (const nodeId of selectedNodeIds) {
      const node = storeNodes.find((n) => n.id === nodeId);
      if (node) {
        const newData = { ...node.data, selectionGroupId: groupId };
        await useDiagramStore.getState().updateNode(
          nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
    }
    closeContextMenu();
  }, [currentBoard, selectedNodeIds, storeNodes, closeContextMenu]);

  // Ungroup node - remove selectionGroupId
  const handleUngroupNode = useCallback(async () => {
    if (!currentBoard || !contextMenu?.nodeId) return;

    const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
    if (node && node.data.selectionGroupId) {
      // Remove the selectionGroupId
      const { selectionGroupId: _, ...restData } = node.data;
      await useDiagramStore.getState().updateNode(
        contextMenu.nodeId,
        undefined,
        undefined,
        undefined,
        undefined,
        restData as NodeData
      );
    }
    closeContextMenu();
  }, [currentBoard, contextMenu, storeNodes, closeContextMenu]);

  // Ungroup all nodes in the same group
  const handleUngroupAll = useCallback(async () => {
    if (!currentBoard || !contextMenu?.nodeId) return;

    const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
    if (node && node.data.selectionGroupId) {
      const groupId = node.data.selectionGroupId;
      // Find all nodes in this group and remove their groupId
      for (const n of storeNodes) {
        if (n.data.selectionGroupId === groupId) {
          const { selectionGroupId: _, ...restData } = n.data;
          await useDiagramStore.getState().updateNode(
            n.id,
            undefined,
            undefined,
            undefined,
            undefined,
            restData as NodeData
          );
        }
      }
    }
    closeContextMenu();
  }, [currentBoard, contextMenu, storeNodes, closeContextMenu]);

  // Wrap selected nodes in a swimlane
  const handleWrapInSwimlane = useCallback(async (orientation: 'horizontal' | 'vertical') => {
    try {
      if (!currentBoard) {
        console.error('handleWrapInSwimlane: No current board');
        return;
      }
      if (selectedNodeIds.length < 1) {
        console.error('handleWrapInSwimlane: No nodes selected');
        return;
      }

      // Get selected nodes
      const selectedNodes = storeNodes.filter((n) => selectedNodeIds.includes(n.id));
      if (selectedNodes.length === 0) {
        console.error('handleWrapInSwimlane: Selected nodes not found in store');
        return;
      }

      // Calculate bounding box of selected nodes
      const padding = 20;
      const headerSize = 40;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of selectedNodes) {
        const nodeWidth = node.width || 100;
        const nodeHeight = node.height || 100;
        minX = Math.min(minX, node.positionX);
        minY = Math.min(minY, node.positionY);
        maxX = Math.max(maxX, node.positionX + nodeWidth);
        maxY = Math.max(maxY, node.positionY + nodeHeight);
      }

      // Calculate swimlane dimensions with padding
      let swimlaneX: number, swimlaneY: number, swimlaneWidth: number, swimlaneHeight: number;

      if (orientation === 'horizontal') {
        // Header on top - add space for header
        swimlaneX = minX - padding;
        swimlaneY = minY - padding - headerSize;
        swimlaneWidth = (maxX - minX) + padding * 2;
        swimlaneHeight = (maxY - minY) + padding * 2 + headerSize;
      } else {
        // Header on left - add space for header
        swimlaneX = minX - padding - headerSize;
        swimlaneY = minY - padding;
        swimlaneWidth = (maxX - minX) + padding * 2 + headerSize;
        swimlaneHeight = (maxY - minY) + padding * 2;
      }

      // Find minimum z-index to place swimlane behind everything
      const minZ = Math.min(...storeNodes.map((n) => n.zIndex || 0), 0);

      // Create the swimlane
      const swimlane = await addNode(
        currentBoard.id,
        'swimlane',
        swimlaneX,
        swimlaneY,
        swimlaneWidth,
        swimlaneHeight,
        {
          label: 'Swimlane',
          color: '#334155',
          borderColor: '#475569',
          swimlaneOrientation: orientation,
        }
      );

      // Set swimlane z-index to be behind other nodes
      await useDiagramStore.getState().updateNode(
        swimlane.id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        minZ - 1
      );

      closeContextMenu();
    } catch (error) {
      console.error('handleWrapInSwimlane error:', error);
    }
  }, [currentBoard, selectedNodeIds, storeNodes, addNode, closeContextMenu]);

  // Check if context node is in a group
  const contextNodeGroupId = contextMenu?.nodeId
    ? storeNodes.find((n) => n.id === contextMenu.nodeId)?.data.selectionGroupId
    : undefined;

  // Check if any selected nodes are in a group (for canvas context menu)
  const selectedNodesGroupIds = selectedNodeIds
    .map((id) => storeNodes.find((n) => n.id === id)?.data.selectionGroupId)
    .filter(Boolean) as string[];
  const hasSelectedGroupedNodes = selectedNodesGroupIds.length > 0;
  const uniqueSelectedGroupIds = [...new Set(selectedNodesGroupIds)];

  // Ungroup all selected nodes (remove from their groups)
  const handleUngroupSelected = useCallback(async () => {
    if (!currentBoard || selectedNodeIds.length === 0) return;

    for (const nodeId of selectedNodeIds) {
      const node = storeNodes.find((n) => n.id === nodeId);
      if (node?.data.selectionGroupId) {
        const { selectionGroupId: _, ...restData } = node.data;
        await useDiagramStore.getState().updateNode(
          nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          restData as NodeData
        );
      }
    }
    closeContextMenu();
  }, [currentBoard, selectedNodeIds, storeNodes, closeContextMenu]);

  // Ungroup all nodes in the same groups as selected nodes
  const handleUngroupAllFromSelection = useCallback(async () => {
    if (!currentBoard || uniqueSelectedGroupIds.length === 0) return;

    for (const n of storeNodes) {
      if (n.data.selectionGroupId && uniqueSelectedGroupIds.includes(n.data.selectionGroupId)) {
        const { selectionGroupId: _, ...restData } = n.data;
        await useDiagramStore.getState().updateNode(
          n.id,
          undefined,
          undefined,
          undefined,
          undefined,
          restData as NodeData
        );
      }
    }
    closeContextMenu();
  }, [currentBoard, storeNodes, uniqueSelectedGroupIds, closeContextMenu]);

  // Apply template to current board
  const handleApplyTemplate = useCallback(
    async (template: DiagramTemplate) => {
      if (!currentBoard) return;

      // Create a mapping from template node indices to new node IDs
      const nodeIdMap = new Map<string, string>();
      const newNodeIds: string[] = [];

      // Create nodes from template
      for (let i = 0; i < template.nodes.length; i++) {
        const templateNode = template.nodes[i];
        const newId = crypto.randomUUID();
        nodeIdMap.set(String(i), newId);
        newNodeIds.push(newId);

        await addNode(
          currentBoard.id,
          templateNode.nodeType as 'shape' | 'icon' | 'text' | 'group' | 'image' | 'swimlane',
          templateNode.positionX,
          templateNode.positionY,
          templateNode.width,
          templateNode.height,
          templateNode.data as NodeData
        );
      }

      // Create edges from template (after short delay to ensure nodes exist)
      setTimeout(async () => {
        for (const templateEdge of template.edges) {
          const sourceId = nodeIdMap.get(templateEdge.sourceNodeId);
          const targetId = nodeIdMap.get(templateEdge.targetNodeId);

          if (sourceId && targetId) {
            await addStoreEdge(
              currentBoard.id,
              sourceId,
              targetId,
              templateEdge.sourceHandle,
              templateEdge.targetHandle,
              templateEdge.edgeType,
              templateEdge.data
            );
          }
        }
      }, 100);

      setShowTemplateModal(false);
    },
    [currentBoard, addNode, addStoreEdge]
  );

  // Delete selected
  const handleDeleteSelected = useCallback(() => {
    selectedNodeIds.forEach((id) => deleteNode(id));
    selectedEdgeIds.forEach((id) => deleteEdge(id));
    closeContextMenu();
  }, [selectedNodeIds, selectedEdgeIds, deleteNode, deleteEdge, closeContextMenu]);

  // Add at position (from context menu)
  const handleAddAtPosition = useCallback(
    async (type: "shape" | "icon" | "text" | "group" | "image" | "swimlane", shapeType?: string, iconName?: string) => {
      if (!currentBoard || !contextMenu?.flowPosition) return;

      const { x, y } = contextMenu.flowPosition;
      // Assign new nodes to active layer (if not default)
      const layerData = activeLayerId && activeLayerId !== 'default' ? { layerId: activeLayerId } : {};

      if (type === "shape" && shapeType) {
        await addNode(currentBoard.id, "shape", x, y, 120, 80, {
          label: shapeType,
          shapeType: shapeType as NodeData["shapeType"],
          color: selectedColor,
          borderColor: selectedColor,
          ...layerData,
        });
      } else if (type === "icon" && iconName) {
        await addNode(currentBoard.id, "icon", x, y, 80, 80, {
          label: iconName,
          icon: iconName,
          color: selectedColor,
          borderColor: selectedColor,
          ...layerData,
        });
      } else if (type === "text") {
        await addNode(currentBoard.id, "text", x, y, undefined, undefined, {
          label: "Text",
          color: "#e5e7eb",
          ...layerData,
        });
      } else if (type === "group") {
        await addNode(currentBoard.id, "group", x, y, 300, 200, {
          label: "Group",
          borderColor: selectedColor,
          opacity: 0, // No fill by default
          ...layerData,
        });
      } else if (type === "image") {
        await addNode(currentBoard.id, "image", x, y, 200, 150, {
          label: "",
          imageUrl: "",
          imageFit: "contain",
          borderColor: selectedColor,
          ...layerData,
        });
      } else if (type === "swimlane") {
        await addNode(currentBoard.id, "swimlane", x, y, 800, 150, {
          label: "Swimlane",
          color: "#334155",
          borderColor: "#475569",
          swimlaneOrientation: shapeType === "vertical" ? "vertical" : "horizontal",
          ...layerData,
        });
      }
      closeContextMenu();
    },
    [currentBoard, contextMenu, addNode, selectedColor, activeLayerId, closeContextMenu]
  );

  // Change node fill/background color
  const handleChangeNodeColor = useCallback(
    async (color: string) => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        const newData = { ...node.data, color };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Change node border color
  const handleChangeNodeBorderColor = useCallback(
    async (borderColor: string) => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        const newData = { ...node.data, borderColor };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Change border style (for groups)
  const handleChangeBorderStyle = useCallback(
    async (borderStyle: "solid" | "dashed" | "dotted") => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        const newData = { ...node.data, borderStyle };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Change opacity (for groups)
  const handleChangeOpacity = useCallback(
    async (opacity: number) => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        // If changing from 0 opacity and no color set, use the border color
        const color = node.data.color || node.data.borderColor || "#3b82f6";
        const newData = { ...node.data, color, opacity };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Change edge color
  const handleChangeEdgeColor = useCallback(
    async (color: string) => {
      if (!contextMenu?.edgeId) return;
      const edge = storeEdges.find((e) => e.id === contextMenu.edgeId);
      if (edge) {
        await useDiagramStore.getState().updateEdge(
          contextMenu.edgeId,
          undefined,
          undefined,
          undefined,
          { ...edge.data, color }
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeEdges, closeContextMenu]
  );

  // Change edge type
  const handleChangeEdgeType = useCallback(
    async (edgeType: "default" | "straight" | "step" | "smoothstep") => {
      if (!contextMenu?.edgeId) return;
      await useDiagramStore.getState().updateEdge(
        contextMenu.edgeId,
        undefined,
        undefined,
        edgeType,
        undefined
      );
      closeContextMenu();
    },
    [contextMenu, closeContextMenu]
  );

  // Toggle edge animation
  const handleToggleEdgeAnimation = useCallback(async () => {
    if (!contextMenu?.edgeId) return;
    const edge = storeEdges.find((e) => e.id === contextMenu.edgeId);
    if (edge) {
      await useDiagramStore.getState().updateEdge(
        contextMenu.edgeId,
        undefined,
        undefined,
        undefined,
        { ...edge.data, animated: !edge.data?.animated }
      );
    }
    closeContextMenu();
  }, [contextMenu, storeEdges, closeContextMenu]);

  // Clear all waypoints from an edge
  const handleClearWaypoints = useCallback(async () => {
    if (!contextMenu?.edgeId) return;
    const edge = storeEdges.find((e) => e.id === contextMenu.edgeId);
    if (edge) {
      await useDiagramStore.getState().updateEdge(
        contextMenu.edgeId,
        undefined,
        undefined,
        undefined,
        { ...edge.data, waypoints: [] }
      );
    }
    closeContextMenu();
  }, [contextMenu, storeEdges, closeContextMenu]);

  // Change edge stroke width
  const handleChangeStrokeWidth = useCallback(
    async (strokeWidth: number) => {
      if (!contextMenu?.edgeId) return;
      const edge = storeEdges.find((e) => e.id === contextMenu.edgeId);
      if (edge) {
        await useDiagramStore.getState().updateEdge(
          contextMenu.edgeId,
          undefined,
          undefined,
          undefined,
          { ...edge.data, strokeWidth }
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeEdges, closeContextMenu]
  );

  // Change edge stroke style
  const handleChangeStrokeStyle = useCallback(
    async (strokeStyle: "solid" | "dashed" | "dotted") => {
      if (!contextMenu?.edgeId) return;
      const edge = storeEdges.find((e) => e.id === contextMenu.edgeId);
      if (edge) {
        await useDiagramStore.getState().updateEdge(
          contextMenu.edgeId,
          undefined,
          undefined,
          undefined,
          { ...edge.data, strokeStyle }
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeEdges, closeContextMenu]
  );

  // Change edge source arrow
  const handleChangeSourceArrow = useCallback(
    async (sourceArrow: "none" | "arrow" | "arrowclosed" | "diamond" | "circle") => {
      if (!contextMenu?.edgeId) return;
      const edge = storeEdges.find((e) => e.id === contextMenu.edgeId);
      if (edge) {
        await useDiagramStore.getState().updateEdge(
          contextMenu.edgeId,
          undefined,
          undefined,
          undefined,
          { ...edge.data, sourceArrow }
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeEdges, closeContextMenu]
  );

  // Change edge target arrow
  const handleChangeTargetArrow = useCallback(
    async (targetArrow: "none" | "arrow" | "arrowclosed" | "diamond" | "circle") => {
      if (!contextMenu?.edgeId) return;
      const edge = storeEdges.find((e) => e.id === contextMenu.edgeId);
      if (edge) {
        await useDiagramStore.getState().updateEdge(
          contextMenu.edgeId,
          undefined,
          undefined,
          undefined,
          { ...edge.data, targetArrow }
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeEdges, closeContextMenu]
  );

  // Change corner radius (for rectangles)
  const handleChangeCornerRadius = useCallback(
    async (borderRadius: number) => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        const newData = { ...node.data, borderRadius };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Change font size
  const handleChangeFontSize = useCallback(
    async (fontSize: number) => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        const newData = { ...node.data, fontSize };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Toggle font weight
  const handleToggleFontWeight = useCallback(
    async () => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        const currentWeight = node.data.fontWeight || "normal";
        const newWeight: "normal" | "bold" = currentWeight === "bold" ? "normal" : "bold";
        const newData = { ...node.data, fontWeight: newWeight };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Toggle font style
  const handleToggleFontStyle = useCallback(
    async () => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        const currentStyle = node.data.fontStyle || "normal";
        const newStyle: "normal" | "italic" = currentStyle === "italic" ? "normal" : "italic";
        const newData = { ...node.data, fontStyle: newStyle };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Change text alignment
  const handleChangeTextAlign = useCallback(
    async (textAlign: "left" | "center" | "right") => {
      if (!contextMenu?.nodeId) return;
      const node = storeNodes.find((n) => n.id === contextMenu.nodeId);
      if (node) {
        const newData = { ...node.data, textAlign };
        await useDiagramStore.getState().updateNode(
          contextMenu.nodeId,
          undefined,
          undefined,
          undefined,
          undefined,
          newData
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeNodes, closeContextMenu]
  );

  // Save edge label
  const handleSaveEdgeLabel = useCallback(
    async () => {
      if (!contextMenu?.edgeId) return;
      const edge = storeEdges.find((e) => e.id === contextMenu.edgeId);
      if (edge) {
        await useDiagramStore.getState().updateEdge(
          contextMenu.edgeId,
          undefined,
          undefined,
          undefined,
          { ...edge.data, label: edgeLabelValue }
        );
      }
      closeContextMenu();
    },
    [contextMenu, storeEdges, edgeLabelValue, closeContextMenu]
  );

  // Open submenu
  const openSubmenu = useCallback((submenu: "fill" | "border" | "borderStyle" | "opacity" | "cornerRadius" | "fontSize" | "textAlign" | "edgeColor" | "edgeType" | "strokeWidth" | "strokeStyle" | "sourceArrow" | "targetArrow" | "edgeLabel" | "imageUrl" | "imageFit" | "layer") => {
    // Initialize edge label value when opening edgeLabel submenu
    if (submenu === "edgeLabel") {
      const edge = storeEdges.find((e) => e.id === contextMenu?.edgeId);
      setEdgeLabelValue(edge?.data?.label || "");
    }
    setContextMenu((prev) => prev ? { ...prev, submenu } : null);
  }, [contextMenu, storeEdges]);

  // Get current node for context menu (to show current values)
  const contextNode = contextMenu?.nodeId ? storeNodes.find((n) => n.id === contextMenu.nodeId) : null;
  const contextEdge = contextMenu?.edgeId ? storeEdges.find((e) => e.id === contextMenu.edgeId) : null;

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [closeContextMenu]);

  // Create new board
  const handleCreateBoard = useCallback(async () => {
    if (!newBoardName.trim()) return;
    const board = await createBoard(newBoardName.trim());
    setNewBoardName("");
    isNewBoardRef.current = true; // Mark as new so it opens unlocked (ref updates sync)
    loadBoard(board.id);
  }, [newBoardName, createBoard, loadBoard]);

  // Delete board
  const handleDeleteBoard = useCallback(async () => {
    if (!boardToDelete) return;
    await deleteBoard(boardToDelete.id);
  }, [boardToDelete, deleteBoard]);

  // Build Diagram menu items
  const diagramMenuItems: DropdownItem[] = [
    { label: "New Diagram", onClick: openCreateModal },
    ...(currentBoard ? [
      { label: "Export as PNG", onClick: () => {
        if (reactFlowRef.current) {
          const filename = `${currentBoard.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
          exportToPng(reactFlowRef.current, filename);
        }
      }, divider: true },
      { label: "Insert Template", onClick: () => setShowTemplateModal(true) },
      {
        label: "Link Note",
        onClick: () => setShowNoteLinkModal(true),
        divider: !(currentBoard.linkedNotes && currentBoard.linkedNotes.length > 0)
      },
      ...(currentBoard.linkedNotes && currentBoard.linkedNotes.length > 0 ? [
        { label: "Unlink All Notes", onClick: () => removeAllNoteLinks(currentBoard.id), divider: true },
      ] : []),
    ] : []),
  ];

  if (!showView) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-dark-900">
      {/* Title bar with menus and window controls */}
      <ExtensionTitleBar
        title={currentBoard ? currentBoard.name : "Diagram Editor"}
        onBack={() => setShowView(false)}
        menus={[{ label: "Diagram", items: diagramMenuItems }]}
      >
        {/* Linked notes indicator in toolbar */}
        {currentBoard?.linkedNotes && currentBoard.linkedNotes.length > 0 && (
          <div className="flex items-center gap-1">
            {currentBoard.linkedNotes.slice(0, 3).map((linkedNote) => (
              <div key={linkedNote.noteId} className="flex items-center gap-1 px-2 py-0.5 bg-dark-700 rounded-lg group">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-dark-300 max-w-24 truncate" title={linkedNote.notePath}>
                  {linkedNote.notePath.split('/').pop()?.replace('.md', '')}
                </span>
                <button
                  onClick={() => {
                    openNote(linkedNote.notePath);
                    setShowView(false);
                  }}
                  className="p-0.5 text-dark-400 hover:text-blue-400 transition-colors"
                  title="Open linked note"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  onClick={() => removeNoteLink(currentBoard.id, linkedNote.noteId)}
                  className="p-0.5 text-dark-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Unlink this note"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {currentBoard.linkedNotes.length > 3 && (
              <span className="text-xs text-dark-400 px-1">
                +{currentBoard.linkedNotes.length - 3} more
              </span>
            )}
          </div>
        )}
      </ExtensionTitleBar>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Board List & Palette */}
        <div className="w-64 border-r border-dark-700 bg-dark-800 flex flex-col">
          {/* Board List */}
          <div className="p-3 border-b border-dark-700">
            <h3 className="text-xs font-semibold text-dark-400 uppercase mb-2">Diagrams</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
                    currentBoard?.id === board.id
                      ? "bg-blue-600/20 text-blue-400"
                      : "text-dark-300 hover:bg-dark-700"
                  }`}
                  onClick={() => loadBoard(board.id)}
                >
                  <span className="text-sm truncate">{board.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteBoard(board);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-dark-500 hover:text-red-400 transition-opacity"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              {boards.length === 0 && (
                <p className="text-xs text-dark-500 text-center py-2">No diagrams yet</p>
              )}
            </div>
          </div>

          {/* Color Palette */}
          <div className="p-3 border-b border-dark-700">
            <h3 className="text-xs font-semibold text-dark-400 uppercase mb-2">Color</h3>
            <div className="flex flex-wrap gap-1">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded ${selectedColor === color ? "ring-2 ring-white ring-offset-1 ring-offset-dark-800" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          {/* Shape/Icon Tabs */}
          <div className="flex border-b border-dark-700">
            <button
              className={`flex-1 px-3 py-2 text-sm ${activeTab === "shapes" ? "bg-dark-700 text-white" : "text-dark-400 hover:text-white"}`}
              onClick={() => setActiveTab("shapes")}
            >
              Shapes
            </button>
            <button
              className={`flex-1 px-3 py-2 text-sm ${activeTab === "icons" ? "bg-dark-700 text-white" : "text-dark-400 hover:text-white"}`}
              onClick={() => setActiveTab("icons")}
            >
              Icons
            </button>
          </div>

          {/* Palette Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLocked && (
              <div className="text-xs text-amber-500 bg-amber-500/10 px-2 py-1.5 rounded mb-3">
                Unlock to add elements
              </div>
            )}
            {activeTab === "shapes" ? (
              <div className="space-y-2">
                {SHAPE_PALETTE.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => handleAddShape(shape.shapeType)}
                    disabled={isLocked}
                    className={`w-full px-3 py-2 text-left text-sm rounded transition-colors ${
                      isLocked
                        ? "text-dark-500 cursor-not-allowed"
                        : "text-dark-300 hover:bg-dark-700 hover:text-white"
                    }`}
                  >
                    {shape.name}
                  </button>
                ))}
                <button
                  onClick={handleAddText}
                  disabled={isLocked}
                  className={`w-full px-3 py-2 text-left text-sm rounded transition-colors ${
                    isLocked
                      ? "text-dark-500 cursor-not-allowed"
                      : "text-dark-300 hover:bg-dark-700 hover:text-white"
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={handleAddGroup}
                  disabled={isLocked}
                  className={`w-full px-3 py-2 text-left text-sm rounded transition-colors ${
                    isLocked
                      ? "text-dark-500 cursor-not-allowed"
                      : "text-dark-300 hover:bg-dark-700 hover:text-white"
                  }`}
                >
                  Group / Border
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {ICON_CATEGORIES.map((category) => (
                  <div key={category.name}>
                    <h4 className="text-xs font-semibold text-dark-500 mb-2">{category.name}</h4>
                    <div className="grid grid-cols-4 gap-1">
                      {category.icons.map((iconName) => {
                        const IconComponent = ICON_MAP[iconName];
                        return IconComponent ? (
                          <button
                            key={iconName}
                            onClick={() => handleAddIcon(iconName)}
                            disabled={isLocked}
                            className={`p-2 rounded transition-colors ${
                              isLocked
                                ? "text-dark-600 cursor-not-allowed"
                                : "text-dark-400 hover:text-white hover:bg-dark-700"
                            }`}
                            title={iconName}
                          >
                            <IconComponent size={20} />
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Canvas */}
        <div
          className="flex-1"
          ref={reactFlowRef}
          onContextMenu={(e) => {
            // Fallback context menu handler for when React Flow's onPaneContextMenu doesn't fire
            // This happens in selection mode or when right-clicking on selection areas
            if (isLocked) return;

            // Check if right-click was on a node or edge (those have their own handlers)
            const target = e.target as HTMLElement;
            const isOnNode = target.closest('.react-flow__node');
            const isOnEdge = target.closest('.react-flow__edge');
            const isOnSelection = target.closest('.react-flow__nodesselection') || target.closest('.react-flow__selection');

            // Always prevent default to stop browser context menu
            e.preventDefault();

            // If on selection area or canvas (not on specific node/edge), show our context menu
            if (isOnSelection || (!isOnNode && !isOnEdge)) {
              const bounds = reactFlowRef.current?.getBoundingClientRect();
              if (!bounds) return;

              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                flowPosition: {
                  x: e.clientX - bounds.left,
                  y: e.clientY - bounds.top,
                },
              });
            }
          }}
        >
          {currentBoard ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={isLocked ? undefined : handleNodesChange}
              onEdgesChange={isLocked ? undefined : handleEdgesChange}
              onConnect={isLocked ? undefined : handleConnect}
              onSelectionChange={isLocked ? undefined : handleSelectionChange}
              onNodeDragStart={isLocked ? undefined : handleNodeDragStart}
              onNodeDrag={isLocked ? undefined : handleNodeDrag}
              onNodeDragStop={isLocked ? undefined : handleNodeDragStop}
              onPaneContextMenu={handleContextMenu}
              onNodeContextMenu={handleNodeContextMenu}
              onEdgeContextMenu={handleEdgeContextMenu}
              onInit={(instance) => { reactFlowInstance.current = instance; }}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              connectionMode={ConnectionMode.Loose}
              nodesDraggable={!isLocked}
              nodesConnectable={!isLocked}
              elementsSelectable={!isLocked}
              selectionOnDrag={!isLocked && isSelectMode}
              panOnDrag={!isLocked && !isSelectMode}
              selectionMode={SelectionMode.Partial}
              fitView
              snapToGrid
              snapGrid={[15, 15]}
              className="bg-dark-900"
              defaultEdgeOptions={{
                type: "default",
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 20,
                  height: 20,
                },
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
              {/* Smart guides overlay */}
              <svg className="react-flow__edges" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1000 }}>
                {smartGuides.horizontal.map((guide, i) => (
                  <line
                    key={`h-${i}`}
                    x1={guide.x1}
                    y1={guide.y}
                    x2={guide.x2}
                    y2={guide.y}
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                ))}
                {smartGuides.vertical.map((guide, i) => (
                  <line
                    key={`v-${i}`}
                    x1={guide.x}
                    y1={guide.y1}
                    x2={guide.x}
                    y2={guide.y2}
                    stroke="#3b82f6"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                ))}
              </svg>
              <CustomControls
                isLocked={isLocked}
                onToggleLock={() => setIsLocked(!isLocked)}
                isSelectMode={isSelectMode}
                onToggleSelectMode={() => setIsSelectMode(!isSelectMode)}
                canUndo={canUndo()}
                canRedo={canRedo()}
                onUndo={undo}
                onRedo={redo}
                hasSelection={selectedNodeIds.length >= 2}
                onAlignLeft={() => alignNodes('left')}
                onAlignCenter={() => alignNodes('center')}
                onAlignRight={() => alignNodes('right')}
                onAlignTop={() => alignNodes('top')}
                onAlignMiddle={() => alignNodes('middle')}
                onAlignBottom={() => alignNodes('bottom')}
                onDistributeH={() => distributeNodes('horizontal')}
                onDistributeV={() => distributeNodes('vertical')}
              />
              <MiniMap
                className="bg-dark-800 border border-dark-700"
                nodeColor={(node) => {
                  const data = node.data as unknown as ReactFlowNodeData;
                  return data?.color || "#3b82f6";
                }}
                maskColor="rgba(0, 0, 0, 0.8)"
              />
            </ReactFlow>
          ) : (
            <div className="flex items-center justify-center h-full text-dark-500">
              <div className="text-center">
                <p className="mb-4">Select a diagram or create a new one</p>
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Create Diagram
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-dark-800 rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Diagram</h3>
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Diagram name"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBoard();
                if (e.key === "Escape") closeCreateModal();
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={closeCreateModal}
                className="px-4 py-2 text-dark-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBoard}
                disabled={!newBoardName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && boardToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-dark-800 rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Diagram?</h3>
            <p className="text-dark-400 mb-4">
              Are you sure you want to delete "{boardToDelete.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelDeleteBoard}
                className="px-4 py-2 text-dark-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBoard}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-dark-800 rounded-lg shadow-xl p-6 w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Choose a Template</h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-dark-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {Array.from(getTemplatesByCategory()).map(([category, templates]) => (
                <div key={category} className="mb-6">
                  <h4 className="text-sm font-semibold text-dark-400 uppercase mb-3">
                    {TEMPLATE_CATEGORY_NAMES[category] || category}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleApplyTemplate(template)}
                        className="p-4 bg-dark-700 hover:bg-dark-600 rounded-lg text-left transition-colors border border-dark-600 hover:border-dark-500"
                      >
                        <div className="font-medium text-white mb-1">{template.name}</div>
                        <div className="text-xs text-dark-400">{template.description}</div>
                        <div className="text-xs text-dark-500 mt-2">
                          {template.nodes.length} nodes, {template.edges.length} connections
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Note Link Modal */}
      {showNoteLinkModal && currentBoard && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-dark-800 rounded-lg shadow-xl p-6 w-[400px] max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Link to Note</h3>
              <button
                onClick={() => {
                  setShowNoteLinkModal(false);
                  setNoteLinkSearch("");
                }}
                className="text-dark-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <input
              type="text"
              value={noteLinkSearch}
              onChange={(e) => setNoteLinkSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <div className="overflow-y-auto flex-1 max-h-[400px]">
              {notes
                .filter((note) => {
                  // Filter out already linked notes
                  const alreadyLinked = currentBoard.linkedNotes?.some(ln => ln.noteId === note.id);
                  if (alreadyLinked) return false;
                  // Apply search filter
                  if (noteLinkSearch) {
                    return note.title.toLowerCase().includes(noteLinkSearch.toLowerCase()) ||
                      note.path.toLowerCase().includes(noteLinkSearch.toLowerCase());
                  }
                  return true;
                })
                .slice(0, 50)
                .map((note) => (
                  <button
                    key={note.id}
                    onClick={async () => {
                      await addNoteLink(currentBoard.id, note.id);
                      setShowNoteLinkModal(false);
                      setNoteLinkSearch("");
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-dark-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-dark-400 flex-shrink-0" />
                    <div className="overflow-hidden">
                      <div className="text-sm text-white truncate">{note.title || note.path.split('/').pop()?.replace('.md', '')}</div>
                      <div className="text-xs text-dark-500 truncate">{note.path}</div>
                    </div>
                  </button>
                ))}
              {notes.filter((note) => {
                const alreadyLinked = currentBoard.linkedNotes?.some(ln => ln.noteId === note.id);
                if (alreadyLinked) return false;
                if (noteLinkSearch) {
                  return note.title.toLowerCase().includes(noteLinkSearch.toLowerCase()) ||
                    note.path.toLowerCase().includes(noteLinkSearch.toLowerCase());
                }
                return true;
              }).length === 0 && (
                <div className="text-center py-8 text-dark-500">
                  {currentBoard.linkedNotes?.length === notes.length
                    ? "All notes are already linked"
                    : "No notes found"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && !isLocked && (
        <div
          className="fixed z-[100] bg-dark-800 border border-dark-600 rounded-lg shadow-xl py-1 min-w-[200px] max-h-[70vh] overflow-y-auto"
          style={{
            // Position horizontally - clamp to stay 20px from edges
            left: Math.max(10, Math.min(contextMenu.x, window.innerWidth - 230)),
            // Position vertically - if would overflow, position above click point
            top: contextMenu.y > window.innerHeight * 0.6
              ? Math.max(10, contextMenu.y - Math.min(500, window.innerHeight * 0.6))
              : Math.min(contextMenu.y, window.innerHeight - 50),
            // Limit max height based on available space
            maxHeight: contextMenu.y > window.innerHeight * 0.6
              ? contextMenu.y - 20
              : window.innerHeight - contextMenu.y - 20,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Node-specific options */}
          {contextMenu.nodeId && !contextMenu.submenu && (
            <>
              {/* Style options */}
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Style</div>
              <button
                onClick={() => openSubmenu("fill")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Palette size={14} />
                  Fill Color
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-4 h-4 rounded border border-dark-500"
                    style={{ backgroundColor: contextNode?.data.color || "#3b82f6" }}
                  />
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <button
                onClick={() => openSubmenu("border")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Square size={14} />
                  Border Color
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-4 h-4 rounded border border-dark-500"
                    style={{ backgroundColor: contextNode?.data.borderColor || "#3b82f6" }}
                  />
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              {contextNode?.nodeType === "group" && (
                <>
                  <button
                    onClick={() => openSubmenu("borderStyle")}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Minus size={14} />
                      Border Style
                    </span>
                    <span className="text-xs text-dark-400 flex items-center gap-1">
                      {contextNode?.data.borderStyle || "dashed"}
                      <ChevronRight size={12} className="text-dark-500" />
                    </span>
                  </button>
                  <button
                    onClick={() => openSubmenu("opacity")}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={14} />
                      Fill Opacity
                    </span>
                    <span className="text-xs text-dark-400 flex items-center gap-1">
                      {Math.round((contextNode?.data.opacity ?? 0) * 100)}%
                      <ChevronRight size={12} className="text-dark-500" />
                    </span>
                  </button>
                </>
              )}
              {/* Corner radius - for shapes with corners */}
              {(contextNode?.nodeType === "shape" ||
                contextNode?.nodeType === "image" ||
                contextNode?.nodeType === "group" ||
                contextNode?.nodeType === "text") && (
                <button
                  onClick={() => openSubmenu("cornerRadius")}
                  className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Square size={14} className="rounded" />
                    Corner Radius
                  </span>
                  <span className="text-xs text-dark-400 flex items-center gap-1">
                    {contextNode?.data.borderRadius || 0}px
                    <ChevronRight size={12} className="text-dark-500" />
                  </span>
                </button>
              )}
              {/* Image node options */}
              {contextNode?.nodeType === "image" && (
                <>
                  <div className="border-t border-dark-600 my-1" />
                  <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Image</div>
                  <button
                    onClick={() => openSubmenu("imageUrl")}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Image size={14} />
                      Image URL
                    </span>
                    <span className="text-xs text-dark-400 truncate max-w-[100px] flex items-center gap-1">
                      {contextNode?.data.imageUrl ? "Set" : "Not set"}
                      <ChevronRight size={12} className="text-dark-500" />
                    </span>
                  </button>
                  <button
                    onClick={() => openSubmenu("imageFit")}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Maximize size={14} />
                      Image Fit
                    </span>
                    <span className="text-xs text-dark-400 flex items-center gap-1">
                      {contextNode?.data.imageFit || "contain"}
                      <ChevronRight size={12} className="text-dark-500" />
                    </span>
                  </button>
                </>
              )}

              {/* Text formatting section */}
              <div className="border-t border-dark-600 my-1" />
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Text</div>
              <button
                onClick={() => openSubmenu("fontSize")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Type size={14} />
                  Font Size
                </span>
                <span className="text-xs text-dark-400 flex items-center gap-1">
                  {contextNode?.data.fontSize || 12}px
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <button
                onClick={handleToggleFontWeight}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Bold size={14} />
                  Bold
                </span>
                <span className={`text-xs ${contextNode?.data.fontWeight === "bold" ? "text-blue-400" : "text-dark-500"}`}>
                  {contextNode?.data.fontWeight === "bold" ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={handleToggleFontStyle}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Italic size={14} />
                  Italic
                </span>
                <span className={`text-xs ${contextNode?.data.fontStyle === "italic" ? "text-blue-400" : "text-dark-500"}`}>
                  {contextNode?.data.fontStyle === "italic" ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={() => openSubmenu("textAlign")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <AlignCenter size={14} />
                  Alignment
                </span>
                <span className="text-xs text-dark-400 flex items-center gap-1">
                  {contextNode?.data.textAlign || "center"}
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>

              <div className="border-t border-dark-600 my-1" />
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Arrange</div>
              <button
                onClick={handleDuplicate}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <Copy size={14} />
                Duplicate
              </button>
              <button
                onClick={handleBringToFront}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <ArrowUpToLine size={14} />
                Bring to Front
              </button>
              <button
                onClick={handleSendToBack}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <ArrowDownToLine size={14} />
                Send to Back
              </button>

              {/* Layer options */}
              {layers.length > 1 && (
                <>
                  <div className="border-t border-dark-600 my-1" />
                  <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Layer</div>
                  <button
                    onClick={() => openSubmenu("layer")}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={14} />
                      Move to Layer
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </>
              )}

              {/* Grouping options */}
              <div className="border-t border-dark-600 my-1" />
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Grouping</div>
              {selectedNodeIds.length >= 2 && (
                <>
                  <button
                    onClick={handleGroupSelection}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <Link2 size={14} />
                    Group Selection ({selectedNodeIds.length} items)
                  </button>
                  <button
                    onClick={() => handleWrapInSwimlane('horizontal')}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <GripHorizontal size={14} />
                    Wrap in Horizontal Swimlane
                  </button>
                  <button
                    onClick={() => handleWrapInSwimlane('vertical')}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <GripVertical size={14} />
                    Wrap in Vertical Swimlane
                  </button>
                </>
              )}
              {contextNodeGroupId && (
                <>
                  <button
                    onClick={handleUngroupNode}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <Unlink size={14} />
                    Remove from Group
                  </button>
                  <button
                    onClick={handleUngroupAll}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <Unlink size={14} />
                    Ungroup All
                  </button>
                </>
              )}
              {!contextNodeGroupId && selectedNodeIds.length < 2 && (
                <div className="px-3 py-2 text-xs text-dark-500 italic">
                  Select 2+ nodes to group
                </div>
              )}

              <div className="border-t border-dark-600 my-1" />
              <button
                onClick={handleDeleteSelected}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}

          {/* Fill color submenu */}
          {contextMenu.nodeId && contextMenu.submenu === "fill" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Fill Color
              </div>
              <div className="px-3 py-2 grid grid-cols-6 gap-1">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleChangeNodeColor(color)}
                    className={`w-6 h-6 rounded border ${contextNode?.data.color === color ? "ring-2 ring-white ring-offset-1 ring-offset-dark-800" : "border-dark-500 hover:border-white"}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="border-t border-dark-600 my-1" />
              <button
                onClick={() => handleChangeNodeColor("transparent")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <span className="w-4 h-4 rounded border border-dark-500 bg-dark-900 relative overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-br from-transparent via-red-500 to-transparent" style={{ transform: "rotate(45deg)", width: "200%", left: "-50%" }} />
                </span>
                No Fill
              </button>
            </>
          )}

          {/* Border color submenu */}
          {contextMenu.nodeId && contextMenu.submenu === "border" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Border Color
              </div>
              <div className="px-3 py-2 grid grid-cols-6 gap-1">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleChangeNodeBorderColor(color)}
                    className={`w-6 h-6 rounded border ${contextNode?.data.borderColor === color ? "ring-2 ring-white ring-offset-1 ring-offset-dark-800" : "border-dark-500 hover:border-white"}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </>
          )}

          {/* Border style submenu */}
          {contextMenu.nodeId && contextMenu.submenu === "borderStyle" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Border Style
              </div>
              <button
                onClick={() => handleChangeBorderStyle("solid")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${contextNode?.data.borderStyle === "solid" ? "text-blue-400" : "text-dark-200"}`}
              >
                <span className="w-8 h-0 border-t-2 border-current" style={{ borderStyle: "solid" }} />
                Solid
              </button>
              <button
                onClick={() => handleChangeBorderStyle("dashed")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${contextNode?.data.borderStyle === "dashed" || !contextNode?.data.borderStyle ? "text-blue-400" : "text-dark-200"}`}
              >
                <span className="w-8 h-0 border-t-2 border-current" style={{ borderStyle: "dashed" }} />
                Dashed
              </button>
              <button
                onClick={() => handleChangeBorderStyle("dotted")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${contextNode?.data.borderStyle === "dotted" ? "text-blue-400" : "text-dark-200"}`}
              >
                <span className="w-8 h-0 border-t-2 border-current" style={{ borderStyle: "dotted" }} />
                Dotted
              </button>
            </>
          )}

          {/* Opacity submenu (for groups) */}
          {contextMenu.nodeId && contextMenu.submenu === "opacity" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Fill Opacity
              </div>
              {[0, 0.1, 0.2, 0.3, 0.5, 0.75, 1].map((opacity) => (
                <button
                  key={opacity}
                  onClick={() => handleChangeOpacity(opacity)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center justify-between ${(contextNode?.data.opacity ?? 0) === opacity ? "text-blue-400" : "text-dark-200"}`}
                >
                  <span>{opacity === 0 ? "No Fill" : `${Math.round(opacity * 100)}%`}</span>
                  <span
                    className="w-6 h-4 rounded border border-dark-500"
                    style={{
                      backgroundColor: opacity === 0
                        ? "transparent"
                        : `rgba(59, 130, 246, ${opacity})`,
                    }}
                  />
                </button>
              ))}
            </>
          )}

          {/* Corner radius submenu (for rectangles) */}
          {contextMenu.nodeId && contextMenu.submenu === "cornerRadius" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Corner Radius
              </div>
              {[0, 4, 8, 12, 16, 24, 32].map((radius) => (
                <button
                  key={radius}
                  onClick={() => handleChangeCornerRadius(radius)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextNode?.data.borderRadius || 0) === radius ? "text-blue-400" : "text-dark-200"}`}
                >
                  <div
                    className="w-5 h-5 border-2 border-current"
                    style={{ borderRadius: `${radius}px` }}
                  />
                  {radius === 0 ? "None" : `${radius}px`}
                </button>
              ))}
            </>
          )}

          {/* Image URL submenu */}
          {contextMenu.nodeId && contextMenu.submenu === "imageUrl" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Image URL
              </div>
              <div className="px-3 py-2">
                <input
                  type="text"
                  placeholder="Enter image URL..."
                  defaultValue={contextNode?.data.imageUrl || ""}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const url = (e.target as HTMLInputElement).value;
                      if (contextMenu.nodeId && contextNode) {
                        await useDiagramStore.getState().updateNode(
                          contextMenu.nodeId,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          { ...contextNode.data, imageUrl: url }
                        );
                      }
                      closeContextMenu();
                    }
                  }}
                  className="w-full px-2 py-1 bg-dark-700 border border-dark-600 rounded text-sm text-white placeholder-dark-500 outline-none focus:border-blue-500"
                  autoFocus
                />
                <p className="text-xs text-dark-500 mt-1">Press Enter to apply</p>
              </div>
            </>
          )}

          {/* Image fit submenu */}
          {contextMenu.nodeId && contextMenu.submenu === "imageFit" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Image Fit
              </div>
              {(["contain", "cover", "fill"] as const).map((fit) => (
                <button
                  key={fit}
                  onClick={async () => {
                    if (contextMenu.nodeId && contextNode) {
                      await useDiagramStore.getState().updateNode(
                        contextMenu.nodeId,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        { ...contextNode.data, imageFit: fit }
                      );
                    }
                    closeContextMenu();
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 ${(contextNode?.data.imageFit || "contain") === fit ? "text-blue-400" : "text-dark-200"}`}
                >
                  <span className="capitalize">{fit}</span>
                  <span className="text-xs text-dark-500 ml-2">
                    {fit === "contain" && "- Fit inside, preserve ratio"}
                    {fit === "cover" && "- Fill and crop, preserve ratio"}
                    {fit === "fill" && "- Stretch to fill"}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Font size submenu */}
          {contextMenu.nodeId && contextMenu.submenu === "fontSize" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Font Size
              </div>
              {[10, 12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
                <button
                  key={size}
                  onClick={() => handleChangeFontSize(size)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 ${(contextNode?.data.fontSize || 12) === size ? "text-blue-400" : "text-dark-200"}`}
                >
                  <span style={{ fontSize: `${Math.min(size, 18)}px` }}>{size}px</span>
                </button>
              ))}
            </>
          )}

          {/* Text alignment submenu */}
          {contextMenu.nodeId && contextMenu.submenu === "textAlign" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Text Alignment
              </div>
              <button
                onClick={() => handleChangeTextAlign("left")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextNode?.data.textAlign || "center") === "left" ? "text-blue-400" : "text-dark-200"}`}
              >
                <AlignLeft size={14} />
                Left
              </button>
              <button
                onClick={() => handleChangeTextAlign("center")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextNode?.data.textAlign || "center") === "center" ? "text-blue-400" : "text-dark-200"}`}
              >
                <AlignCenter size={14} />
                Center
              </button>
              <button
                onClick={() => handleChangeTextAlign("right")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextNode?.data.textAlign || "center") === "right" ? "text-blue-400" : "text-dark-200"}`}
              >
                <AlignRight size={14} />
                Right
              </button>
            </>
          )}

          {/* Layer submenu */}
          {contextMenu.nodeId && contextMenu.submenu === "layer" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Move to Layer
              </div>
              {layers.map((layer) => {
                const currentLayerId = contextNode?.data.layerId || 'default';
                const isCurrentLayer = currentLayerId === layer.id;
                return (
                  <button
                    key={layer.id}
                    onClick={async () => {
                      if (contextMenu.nodeId && contextNode && !isCurrentLayer) {
                        const newLayerId = layer.id === 'default' ? undefined : layer.id;
                        await useDiagramStore.getState().updateNode(
                          contextMenu.nodeId,
                          undefined,
                          undefined,
                          undefined,
                          undefined,
                          { ...contextNode.data, layerId: newLayerId }
                        );
                      }
                      closeContextMenu();
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${isCurrentLayer ? "text-blue-400" : "text-dark-200"}`}
                  >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    {layer.name}
                    {isCurrentLayer && <span className="ml-auto text-xs text-dark-500">(current)</span>}
                  </button>
                );
              })}
            </>
          )}

          {/* Edge-specific options */}
          {contextMenu.edgeId && !contextMenu.submenu && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Style</div>
              <button
                onClick={() => openSubmenu("edgeColor")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Palette size={14} />
                  Line Color
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="w-4 h-4 rounded border border-dark-500"
                    style={{ backgroundColor: contextEdge?.data?.color || "#64748b" }}
                  />
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <button
                onClick={() => openSubmenu("strokeWidth")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Minus size={14} />
                  Line Thickness
                </span>
                <span className="text-xs text-dark-400 flex items-center gap-1">
                  {(contextEdge?.data as EdgeData)?.strokeWidth || 2}px
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <button
                onClick={() => openSubmenu("strokeStyle")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Minus size={14} />
                  Line Style
                </span>
                <span className="text-xs text-dark-400 flex items-center gap-1">
                  {(contextEdge?.data as EdgeData)?.strokeStyle || "solid"}
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <button
                onClick={() => openSubmenu("edgeType")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Type size={14} />
                  Line Type
                </span>
                <span className="text-xs text-dark-400 flex items-center gap-1">
                  {contextEdge?.edgeType || "default"}
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <div className="border-t border-dark-600 my-1" />
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Arrows</div>
              <button
                onClick={() => openSubmenu("sourceArrow")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <ArrowUpToLine size={14} className="rotate-[-90deg]" />
                  Start Arrow
                </span>
                <span className="text-xs text-dark-400 flex items-center gap-1">
                  {(contextEdge?.data as EdgeData)?.sourceArrow || "none"}
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <button
                onClick={() => openSubmenu("targetArrow")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <ArrowDownToLine size={14} className="rotate-[-90deg]" />
                  End Arrow
                </span>
                <span className="text-xs text-dark-400 flex items-center gap-1">
                  {(contextEdge?.data as EdgeData)?.targetArrow || "arrowclosed"}
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <div className="border-t border-dark-600 my-1" />
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Label</div>
              <button
                onClick={() => openSubmenu("edgeLabel")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Type size={14} />
                  Edit Label
                </span>
                <span className="text-xs text-dark-400 flex items-center gap-1">
                  {contextEdge?.data?.label || "(none)"}
                  <ChevronRight size={12} className="text-dark-500" />
                </span>
              </button>
              <div className="border-t border-dark-600 my-1" />
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Waypoints</div>
              <div className="px-3 py-1 text-xs text-dark-400">
                Double-click edge to add waypoints
              </div>
              {(contextEdge?.data as EdgeData)?.waypoints && ((contextEdge?.data as EdgeData)?.waypoints?.length ?? 0) > 0 && (
                <button
                  onClick={handleClearWaypoints}
                  className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <X size={14} />
                    Clear Waypoints
                  </span>
                  <span className="text-xs text-dark-400">
                    {(contextEdge?.data as EdgeData)?.waypoints?.length} points
                  </span>
                </button>
              )}
              <div className="border-t border-dark-600 my-1" />
              <button
                onClick={handleToggleEdgeAnimation}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Zap size={14} />
                  Animated
                </span>
                <span className={`text-xs ${contextEdge?.data?.animated ? "text-blue-400" : "text-dark-500"}`}>
                  {contextEdge?.data?.animated ? "ON" : "OFF"}
                </span>
              </button>
              <div className="border-t border-dark-600 my-1" />
              <button
                onClick={() => {
                  deleteEdge(contextMenu.edgeId!);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete Connection
              </button>
            </>
          )}

          {/* Edge color submenu */}
          {contextMenu.edgeId && contextMenu.submenu === "edgeColor" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Line Color
              </div>
              <div className="px-3 py-2 grid grid-cols-6 gap-1">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleChangeEdgeColor(color)}
                    className={`w-6 h-6 rounded border ${contextEdge?.data?.color === color ? "ring-2 ring-white ring-offset-1 ring-offset-dark-800" : "border-dark-500 hover:border-white"}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </>
          )}

          {/* Edge type submenu */}
          {contextMenu.edgeId && contextMenu.submenu === "edgeType" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Line Type
              </div>
              <button
                onClick={() => handleChangeEdgeType("default")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 ${contextEdge?.edgeType === "default" ? "text-blue-400" : "text-dark-200"}`}
              >
                Bezier (Default)
              </button>
              <button
                onClick={() => handleChangeEdgeType("straight")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 ${contextEdge?.edgeType === "straight" ? "text-blue-400" : "text-dark-200"}`}
              >
                Straight
              </button>
              <button
                onClick={() => handleChangeEdgeType("step")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 ${contextEdge?.edgeType === "step" ? "text-blue-400" : "text-dark-200"}`}
              >
                Step
              </button>
              <button
                onClick={() => handleChangeEdgeType("smoothstep")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 ${contextEdge?.edgeType === "smoothstep" ? "text-blue-400" : "text-dark-200"}`}
              >
                Smooth Step
              </button>
            </>
          )}

          {/* Stroke width submenu */}
          {contextMenu.edgeId && contextMenu.submenu === "strokeWidth" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Line Thickness
              </div>
              {[1, 2, 3, 4, 5, 6, 8].map((width) => (
                <button
                  key={width}
                  onClick={() => handleChangeStrokeWidth(width)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.strokeWidth === width ? "text-blue-400" : "text-dark-200"}`}
                >
                  <div className="w-12 flex items-center">
                    <div
                      className="w-full rounded-full"
                      style={{
                        height: `${width}px`,
                        backgroundColor: contextEdge?.data?.color || "#64748b"
                      }}
                    />
                  </div>
                  {width}px
                </button>
              ))}
            </>
          )}

          {/* Stroke style submenu */}
          {contextMenu.edgeId && contextMenu.submenu === "strokeStyle" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Line Style
              </div>
              <button
                onClick={() => handleChangeStrokeStyle("solid")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.strokeStyle === "solid" || !(contextEdge?.data as EdgeData)?.strokeStyle ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="10" className="mr-2">
                  <line x1="0" y1="5" x2="40" y2="5" stroke="currentColor" strokeWidth="2" />
                </svg>
                Solid
              </button>
              <button
                onClick={() => handleChangeStrokeStyle("dashed")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.strokeStyle === "dashed" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="10" className="mr-2">
                  <line x1="0" y1="5" x2="40" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray="6,4" />
                </svg>
                Dashed
              </button>
              <button
                onClick={() => handleChangeStrokeStyle("dotted")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.strokeStyle === "dotted" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="10" className="mr-2">
                  <line x1="0" y1="5" x2="40" y2="5" stroke="currentColor" strokeWidth="2" strokeDasharray="2,3" />
                </svg>
                Dotted
              </button>
            </>
          )}

          {/* Source arrow submenu */}
          {contextMenu.edgeId && contextMenu.submenu === "sourceArrow" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Start Arrow
              </div>
              <button
                onClick={() => handleChangeSourceArrow("none")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.sourceArrow === "none" || !(contextEdge?.data as EdgeData)?.sourceArrow ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="0" y1="8" x2="40" y2="8" stroke="currentColor" strokeWidth="2" />
                </svg>
                None
              </button>
              <button
                onClick={() => handleChangeSourceArrow("arrow")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.sourceArrow === "arrow" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="12" y1="8" x2="40" y2="8" stroke="currentColor" strokeWidth="2" />
                  <polyline points="12,2 0,8 12,14" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                Arrow (Open)
              </button>
              <button
                onClick={() => handleChangeSourceArrow("arrowclosed")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.sourceArrow === "arrowclosed" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="12" y1="8" x2="40" y2="8" stroke="currentColor" strokeWidth="2" />
                  <polygon points="12,2 0,8 12,14" fill="currentColor" />
                </svg>
                Arrow (Filled)
              </button>
              <button
                onClick={() => handleChangeSourceArrow("diamond")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.sourceArrow === "diamond" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="14" y1="8" x2="40" y2="8" stroke="currentColor" strokeWidth="2" />
                  <polygon points="7,2 0,8 7,14 14,8" fill="currentColor" />
                </svg>
                Diamond
              </button>
              <button
                onClick={() => handleChangeSourceArrow("circle")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.sourceArrow === "circle" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="12" y1="8" x2="40" y2="8" stroke="currentColor" strokeWidth="2" />
                  <circle cx="6" cy="8" r="5" fill="currentColor" />
                </svg>
                Circle
              </button>
            </>
          )}

          {/* Target arrow submenu */}
          {contextMenu.edgeId && contextMenu.submenu === "targetArrow" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                End Arrow
              </div>
              <button
                onClick={() => handleChangeTargetArrow("none")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.targetArrow === "none" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="0" y1="8" x2="40" y2="8" stroke="currentColor" strokeWidth="2" />
                </svg>
                None
              </button>
              <button
                onClick={() => handleChangeTargetArrow("arrow")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.targetArrow === "arrow" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="0" y1="8" x2="28" y2="8" stroke="currentColor" strokeWidth="2" />
                  <polyline points="28,2 40,8 28,14" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                Arrow (Open)
              </button>
              <button
                onClick={() => handleChangeTargetArrow("arrowclosed")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.targetArrow === "arrowclosed" || !(contextEdge?.data as EdgeData)?.targetArrow ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="0" y1="8" x2="28" y2="8" stroke="currentColor" strokeWidth="2" />
                  <polygon points="28,2 40,8 28,14" fill="currentColor" />
                </svg>
                Arrow (Filled)
              </button>
              <button
                onClick={() => handleChangeTargetArrow("diamond")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.targetArrow === "diamond" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="0" y1="8" x2="26" y2="8" stroke="currentColor" strokeWidth="2" />
                  <polygon points="33,2 40,8 33,14 26,8" fill="currentColor" />
                </svg>
                Diamond
              </button>
              <button
                onClick={() => handleChangeTargetArrow("circle")}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 flex items-center gap-2 ${(contextEdge?.data as EdgeData)?.targetArrow === "circle" ? "text-blue-400" : "text-dark-200"}`}
              >
                <svg width="40" height="16" className="mr-2">
                  <line x1="0" y1="8" x2="28" y2="8" stroke="currentColor" strokeWidth="2" />
                  <circle cx="34" cy="8" r="5" fill="currentColor" />
                </svg>
                Circle
              </button>
            </>
          )}

          {/* Edge label submenu */}
          {contextMenu.edgeId && contextMenu.submenu === "edgeLabel" && (
            <>
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold flex items-center gap-2">
                <button
                  onClick={() => setContextMenu((prev) => prev ? { ...prev, submenu: undefined } : null)}
                  className="hover:text-white"
                >
                  ←
                </button>
                Edge Label
              </div>
              <div className="px-3 py-2">
                <input
                  type="text"
                  value={edgeLabelValue}
                  onChange={(e) => setEdgeLabelValue(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      handleSaveEdgeLabel();
                    } else if (e.key === "Escape") {
                      closeContextMenu();
                    }
                  }}
                  placeholder="Enter label..."
                  className="w-full px-2 py-1 bg-dark-700 border border-dark-500 rounded text-sm text-white placeholder-dark-400 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleSaveEdgeLabel}
                    className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEdgeLabelValue("");
                      handleSaveEdgeLabel();
                    }}
                    className="px-2 py-1 bg-dark-600 hover:bg-dark-500 rounded text-xs text-dark-200"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Canvas options (add new elements) */}
          {!contextMenu.nodeId && !contextMenu.edgeId && contextMenu.flowPosition && (
            <>
              {/* Selection grouping options - show when multiple nodes selected */}
              {selectedNodeIds.length >= 2 && (
                <>
                  <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Selection</div>
                  <button
                    onClick={handleGroupSelection}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <Link2 size={14} />
                    Group Selection ({selectedNodeIds.length} items)
                  </button>
                  <button
                    onClick={() => handleWrapInSwimlane('horizontal')}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <GripHorizontal size={14} />
                    Wrap in Horizontal Swimlane
                  </button>
                  <button
                    onClick={() => handleWrapInSwimlane('vertical')}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <GripVertical size={14} />
                    Wrap in Vertical Swimlane
                  </button>
                  {hasSelectedGroupedNodes && (
                    <>
                      <div className="border-t border-dark-600 my-1" />
                      <button
                        onClick={handleUngroupSelected}
                        className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                      >
                        <Unlink size={14} />
                        Remove Selected from Groups
                      </button>
                      <button
                        onClick={handleUngroupAllFromSelection}
                        className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                      >
                        <Unlink size={14} />
                        Ungroup All ({uniqueSelectedGroupIds.length} group{uniqueSelectedGroupIds.length !== 1 ? 's' : ''})
                      </button>
                    </>
                  )}
                  <div className="border-t border-dark-600 my-1" />
                  <button
                    onClick={handleDeleteSelected}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Delete Selection
                  </button>
                  <div className="border-t border-dark-600 my-1" />
                </>
              )}
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Add Element</div>
              <button
                onClick={() => handleAddAtPosition("shape", "rectangle")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <Square size={14} />
                Rectangle
              </button>
              <button
                onClick={() => handleAddAtPosition("shape", "circle")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <CircleIcon size={14} />
                Circle
              </button>
              <button
                onClick={() => handleAddAtPosition("shape", "diamond")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <Plus size={14} />
                Diamond
              </button>
              <button
                onClick={() => handleAddAtPosition("text")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <Type size={14} />
                Text
              </button>
              <div className="border-t border-dark-600 my-1" />
              <button
                onClick={() => handleAddAtPosition("group")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <Layers size={14} />
                Group / Border
              </button>
              <button
                onClick={() => handleAddAtPosition("image")}
                className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
              >
                <Image size={14} />
                Image
              </button>
              {/* Only show Add Swimlane when no selection (otherwise Wrap in Swimlane is shown above) */}
              {selectedNodeIds.length === 0 && (
                <>
                  <div className="border-t border-dark-600 my-1" />
                  <div className="px-3 py-1 text-xs text-dark-500 uppercase">Swimlanes</div>
                  <button
                    onClick={() => handleAddAtPosition("swimlane", "horizontal")}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <GripHorizontal size={14} />
                    Horizontal Swimlane
                  </button>
                  <button
                    onClick={() => handleAddAtPosition("swimlane", "vertical")}
                    className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <GripVertical size={14} />
                    Vertical Swimlane
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-60 flex items-start justify-center pt-20 bg-black/30">
          <div className="bg-dark-800 rounded-lg shadow-xl w-[500px] max-h-[400px] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-700">
              <Search size={18} className="text-dark-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes and edges..."
                className="flex-1 bg-transparent text-white placeholder-dark-500 outline-none"
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="p-1 text-dark-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2">
              {searchQuery.trim() && (
                <>
                  {storeNodes
                    .filter((n) =>
                      n.data.label?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((node) => (
                      <button
                        key={node.id}
                        onClick={() => {
                          setSelection([node.id], []);
                          // Navigate to the node
                          if (reactFlowInstance.current) {
                            const nodeWidth = node.width || 100;
                            const nodeHeight = node.height || 100;
                            reactFlowInstance.current.setCenter(
                              node.positionX + nodeWidth / 2,
                              node.positionY + nodeHeight / 2,
                              { zoom: 1, duration: 500 }
                            );
                          }
                          setShowSearch(false);
                          setSearchQuery('');
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 rounded flex items-center gap-2"
                      >
                        <Square size={14} className="text-dark-400" />
                        <span>{node.data.label || `${node.nodeType} node`}</span>
                        <span className="text-xs text-dark-500 ml-auto">{node.nodeType}</span>
                      </button>
                    ))}
                  {storeEdges
                    .filter((e) =>
                      e.data?.label?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((edge) => {
                      // Find source and target nodes to calculate edge center
                      const sourceNode = storeNodes.find((n) => n.id === edge.sourceNodeId);
                      const targetNode = storeNodes.find((n) => n.id === edge.targetNodeId);
                      return (
                        <button
                          key={edge.id}
                          onClick={() => {
                            setSelection([], [edge.id]);
                            // Navigate to the edge center (midpoint between source and target)
                            if (reactFlowInstance.current && sourceNode && targetNode) {
                              const centerX = (sourceNode.positionX + targetNode.positionX) / 2;
                              const centerY = (sourceNode.positionY + targetNode.positionY) / 2;
                              reactFlowInstance.current.setCenter(centerX, centerY, { zoom: 1, duration: 500 });
                            }
                            setShowSearch(false);
                            setSearchQuery('');
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 rounded flex items-center gap-2"
                        >
                          <Minus size={14} className="text-dark-400" />
                          <span>{edge.data?.label || 'Connection'}</span>
                          <span className="text-xs text-dark-500 ml-auto">edge</span>
                        </button>
                      );
                    })}
                  {storeNodes.filter((n) =>
                    n.data.label?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 &&
                    storeEdges.filter((e) =>
                      e.data?.label?.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length === 0 && (
                      <p className="text-dark-500 text-sm text-center py-4">No results found</p>
                    )}
                </>
              )}
              {!searchQuery.trim() && (
                <p className="text-dark-500 text-sm text-center py-4">Type to search...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Layers Panel (collapsible, bottom right) */}
      {currentBoard && !isLocked && (
        <div className="fixed bottom-4 right-4 z-40 bg-dark-800 border border-dark-700 rounded-lg shadow-xl w-56">
          <div className="px-3 py-2 border-b border-dark-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-dark-400 uppercase">Layers</span>
            <button
              onClick={() => addLayer(`Layer ${layers.length + 1}`)}
              className="p-1 text-dark-400 hover:text-white rounded hover:bg-dark-700"
              title="Add new layer"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="p-1 max-h-48 overflow-y-auto">
            {layers.map((layer) => {
              const nodeCount = storeNodes.filter((n) =>
                (n.data.layerId === layer.id) || (!n.data.layerId && layer.id === 'default')
              ).length;
              return (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded cursor-pointer ${
                    activeLayerId === layer.id
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                      : 'text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerVisibility(layer.id);
                    }}
                    className={`p-1 rounded ${layer.visible ? 'text-blue-400' : 'text-dark-600'}`}
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerLock(layer.id);
                    }}
                    className={`p-1 rounded ${layer.locked ? 'text-amber-400' : 'text-dark-600'}`}
                    title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  <span className="flex-1 truncate">{layer.name}</span>
                  <span className="text-xs text-dark-500">{nodeCount}</span>
                  {layer.id !== 'default' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLayer(layer.id);
                      }}
                      className="p-1 text-dark-600 hover:text-red-400 rounded"
                      title="Delete layer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {/* Assign selected nodes to layer */}
          {selectedNodeIds.length > 0 && (
            <div className="px-2 py-2 border-t border-dark-700">
              <div className="text-xs text-dark-500 mb-1">
                Move {selectedNodeIds.length} selected to:
              </div>
              <div className="flex flex-wrap gap-1">
                {layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={async () => {
                      for (const nodeId of selectedNodeIds) {
                        const node = storeNodes.find((n) => n.id === nodeId);
                        if (node) {
                          await useDiagramStore.getState().updateNode(
                            nodeId,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            { ...node.data, layerId: layer.id }
                          );
                        }
                      }
                    }}
                    className="px-2 py-1 text-xs bg-dark-700 hover:bg-dark-600 text-dark-300 rounded"
                  >
                    {layer.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
