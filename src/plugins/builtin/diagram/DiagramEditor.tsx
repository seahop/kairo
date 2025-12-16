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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ZoomIn, ZoomOut, Maximize, Lock, Unlock } from "lucide-react";

import { useDiagramStore } from "./store";
import { ShapeNode, IconNode, TextNode, ICON_MAP } from "./components/CustomNodes";
import { exportToPng } from "./utils/export";
import type { DiagramNode, DiagramEdge, NodeData, ReactFlowNodeData } from "./types";

// Custom node types
const nodeTypes: NodeTypes = {
  shape: ShapeNode,
  icon: IconNode,
  text: TextNode,
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
}

function CustomControls({ isLocked, onToggleLock }: CustomControlsProps) {
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
  const isNewBoardRef = useRef(false); // Track if board was just created (ref for sync updates)
  const reactFlowRef = useRef<HTMLDivElement>(null);

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

      // Debounce position updates to backend
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
            {activeTab === "shapes" ? (
              <div className="space-y-2">
                {SHAPE_PALETTE.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => handleAddShape(shape.shapeType)}
                    className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:bg-dark-700 hover:text-white rounded transition-colors"
                  >
                    {shape.name}
                  </button>
                ))}
                <button
                  onClick={handleAddText}
                  className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:bg-dark-700 hover:text-white rounded transition-colors"
                >
                  Text
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
                            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded transition-colors"
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
        <div className="flex-1" ref={reactFlowRef}>
          {currentBoard ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={isLocked ? undefined : handleNodesChange}
              onEdgesChange={isLocked ? undefined : handleEdgesChange}
              onConnect={isLocked ? undefined : handleConnect}
              onSelectionChange={isLocked ? undefined : handleSelectionChange}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              nodesDraggable={!isLocked}
              nodesConnectable={!isLocked}
              elementsSelectable={!isLocked}
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
              <CustomControls isLocked={isLocked} onToggleLock={() => setIsLocked(!isLocked)} />
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
    </div>
  );
}
