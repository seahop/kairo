import { useCallback, useEffect, useRef, useState } from "react";
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
  BackgroundVariant,
  MarkerType,
  ConnectionMode,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock, Copy, Trash2, ArrowUpToLine, ArrowDownToLine, Layers, Plus, Palette, Square, Circle as CircleIcon, Minus, ChevronRight, Type, Zap, MousePointer2, Move, Link2, Unlink } from "lucide-react";

import { useDiagramStore } from "./store";
import { ShapeNode, IconNode, TextNode, GroupNode, ICON_MAP } from "./components/CustomNodes";
import { exportToPng } from "./utils/export";
import type { DiagramNode, DiagramEdge, NodeData, ReactFlowNodeData } from "./types";

// Custom node types
const nodeTypes: NodeTypes = {
  shape: ShapeNode,
  icon: IconNode,
  text: TextNode,
  group: GroupNode,
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

// Convert backend edges to React Flow edges
function toReactFlowEdges(edges: DiagramEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.edgeType,
    data: edge.data,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
    },
    style: edge.data?.color ? { stroke: edge.data.color } : undefined,
    animated: edge.data?.animated,
    label: edge.data?.label,
  }));
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
}

function CustomControls({ isLocked, onToggleLock, isSelectMode, onToggleSelectMode }: CustomControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
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
  } = useDiagramStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [newBoardName, setNewBoardName] = useState("");
  const [activeTab, setActiveTab] = useState<"shapes" | "icons">("shapes");
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [isLocked, setIsLocked] = useState(true); // Default to locked for viewing
  const [isSelectMode, setIsSelectMode] = useState(false); // Selection mode vs pan mode
  const isNewBoardRef = useRef(false); // Track if board was just created (ref for sync updates)
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map()); // Track drag start for grouped movement

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
    edgeId?: string;
    flowPosition?: { x: number; y: number };
    submenu?: "fill" | "border" | "borderStyle" | "opacity" | "edgeColor" | "edgeType";
  } | null>(null);

  // Sync React Flow state with store
  useEffect(() => {
    setNodes(toReactFlowNodes(storeNodes));
  }, [storeNodes, setNodes]);

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

  // Handle drag start - record positions for grouped movement
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as NodeData;
      const groupId = nodeData?.selectionGroupId;

      if (groupId) {
        // Record starting positions of all nodes in the same group
        dragStartPositions.current.clear();
        nodes.forEach((n) => {
          const nData = n.data as NodeData;
          if (nData?.selectionGroupId === groupId) {
            dragStartPositions.current.set(n.id, { x: n.position.x, y: n.position.y });
          }
        });
      }
    },
    [nodes]
  );

  // Handle drag - move all grouped nodes together
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as NodeData;
      const groupId = nodeData?.selectionGroupId;

      if (groupId && dragStartPositions.current.size > 1) {
        const startPos = dragStartPositions.current.get(node.id);
        if (!startPos) return;

        // Calculate delta from drag start
        const deltaX = node.position.x - startPos.x;
        const deltaY = node.position.y - startPos.y;

        // Update all grouped nodes
        setNodes((nds) =>
          nds.map((n) => {
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
      }
    },
    [setNodes]
  );

  // Handle drag stop - save all grouped node positions to backend
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as NodeData;
      const groupId = nodeData?.selectionGroupId;

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
    },
    [nodes, currentBoard, bulkUpdateNodes]
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

  // Handle node deletion with keyboard (only when unlocked)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isLocked) return; // Don't allow deletion when locked
      if (e.key === "Delete" || e.key === "Backspace") {
        selectedNodeIds.forEach((id) => deleteNode(id));
        selectedEdgeIds.forEach((id) => deleteEdge(id));
      }
    },
    [isLocked, selectedNodeIds, selectedEdgeIds, deleteNode, deleteEdge]
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

  // Check if context node is in a group
  const contextNodeGroupId = contextMenu?.nodeId
    ? storeNodes.find((n) => n.id === contextMenu.nodeId)?.data.selectionGroupId
    : undefined;

  // Delete selected
  const handleDeleteSelected = useCallback(() => {
    selectedNodeIds.forEach((id) => deleteNode(id));
    selectedEdgeIds.forEach((id) => deleteEdge(id));
    closeContextMenu();
  }, [selectedNodeIds, selectedEdgeIds, deleteNode, deleteEdge, closeContextMenu]);

  // Add at position (from context menu)
  const handleAddAtPosition = useCallback(
    async (type: "shape" | "icon" | "text" | "group", shapeType?: string, iconName?: string) => {
      if (!currentBoard || !contextMenu?.flowPosition) return;

      const { x, y } = contextMenu.flowPosition;

      if (type === "shape" && shapeType) {
        await addNode(currentBoard.id, "shape", x, y, 120, 80, {
          label: shapeType,
          shapeType: shapeType as NodeData["shapeType"],
          color: selectedColor,
          borderColor: selectedColor,
        });
      } else if (type === "icon" && iconName) {
        await addNode(currentBoard.id, "icon", x, y, 80, 80, {
          label: iconName,
          icon: iconName,
          color: selectedColor,
          borderColor: selectedColor,
        });
      } else if (type === "text") {
        await addNode(currentBoard.id, "text", x, y, undefined, undefined, {
          label: "Text",
          color: "#e5e7eb",
        });
      } else if (type === "group") {
        await addNode(currentBoard.id, "group", x, y, 300, 200, {
          label: "Group",
          borderColor: selectedColor,
          opacity: 0, // No fill by default
        });
      }
      closeContextMenu();
    },
    [currentBoard, contextMenu, addNode, selectedColor, closeContextMenu]
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

  // Open submenu
  const openSubmenu = useCallback((submenu: "fill" | "border" | "borderStyle" | "opacity" | "edgeColor" | "edgeType") => {
    setContextMenu((prev) => prev ? { ...prev, submenu } : null);
  }, []);

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

  if (!showView) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-dark-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Diagram Editor</h2>
          {currentBoard && (
            <span className="text-dark-400">{currentBoard.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentBoard && (
            <button
              onClick={() => {
                if (reactFlowRef.current) {
                  const filename = `${currentBoard.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
                  exportToPng(reactFlowRef.current, filename);
                }
              }}
              className="px-3 py-1.5 text-sm bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors"
              title="Export as PNG"
            >
              Export PNG
            </button>
          )}
          <button
            onClick={openCreateModal}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            New Diagram
          </button>
          <button
            onClick={() => setShowView(false)}
            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

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
              nodeTypes={nodeTypes}
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
              <CustomControls
                isLocked={isLocked}
                onToggleLock={() => setIsLocked(!isLocked)}
                isSelectMode={isSelectMode}
                onToggleSelectMode={() => setIsSelectMode(!isSelectMode)}
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

      {/* Context Menu */}
      {contextMenu && !isLocked && (
        <div
          className="fixed z-[100] bg-dark-800 border border-dark-600 rounded-lg shadow-xl py-1 min-w-[200px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
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

              {/* Grouping options */}
              <div className="border-t border-dark-600 my-1" />
              <div className="px-3 py-1.5 text-xs text-dark-500 uppercase font-semibold">Grouping</div>
              {selectedNodeIds.length >= 2 && (
                <button
                  onClick={handleGroupSelection}
                  className="w-full px-3 py-2 text-left text-sm text-dark-200 hover:bg-dark-700 flex items-center gap-2"
                >
                  <Link2 size={14} />
                  Group Selection ({selectedNodeIds.length} items)
                </button>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
