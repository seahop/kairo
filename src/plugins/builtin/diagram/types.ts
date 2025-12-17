// Diagram plugin types - matching Rust backend structures

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface LinkedNote {
  noteId: string;
  notePath: string;
}

export interface DiagramBoard {
  id: string;
  name: string;
  description?: string;
  /** @deprecated Use linkedNotes instead */
  noteId?: string;
  /** @deprecated Use linkedNotes instead */
  notePath?: string;
  linkedNotes: LinkedNote[];
  viewport: Viewport;
  createdAt: number;
  modifiedAt: number;
  archived: boolean;
}

export interface NodeData {
  label?: string;
  shapeType?: 'rectangle' | 'circle' | 'diamond' | 'cylinder' | 'hexagon';
  icon?: string;
  color?: string;
  borderColor?: string;
  fontSize?: number;
  // Group/container specific
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderWidth?: number;
  opacity?: number;
  // Selection grouping - nodes with same groupId move together
  selectionGroupId?: string;
  // Text formatting
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  // Corner radius for rectangles
  borderRadius?: number;
  // Layer assignment
  layerId?: string;
  // Image node specific
  imageUrl?: string;
  imageFit?: 'contain' | 'cover' | 'fill';
  // Swimlane specific
  swimlaneOrientation?: 'horizontal' | 'vertical';
}

export interface DiagramNode {
  id: string;
  boardId: string;
  nodeType: 'shape' | 'icon' | 'text' | 'group' | 'image' | 'swimlane';
  positionX: number;
  positionY: number;
  width?: number;
  height?: number;
  data: NodeData;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface EdgeData {
  label?: string;
  color?: string;
  animated?: boolean;
  // Arrow styles
  sourceArrow?: 'none' | 'arrow' | 'arrowclosed' | 'diamond' | 'circle';
  targetArrow?: 'none' | 'arrow' | 'arrowclosed' | 'diamond' | 'circle';
  // Line styling
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  // Label positioning
  labelPosition?: 'start' | 'center' | 'end';
  labelBgColor?: string;
  // Waypoints for manual edge routing
  waypoints?: Array<{ x: number; y: number }>;
  [key: string]: unknown;
}

export interface DiagramEdge {
  id: string;
  boardId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  edgeType: 'default' | 'straight' | 'step' | 'smoothstep';
  data?: EdgeData;
  createdAt: number;
  updatedAt: number;
}

export interface DiagramBoardFull {
  board: DiagramBoard;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface NodePositionUpdate {
  id: string;
  positionX: number;
  positionY: number;
}

// React Flow compatible types for the editor
export interface ReactFlowNodeData extends NodeData {
  nodeType: 'shape' | 'icon' | 'text' | 'group';
  [key: string]: unknown;
}

// Shape palette item
export interface ShapeDefinition {
  id: string;
  name: string;
  shapeType: NodeData['shapeType'];
  defaultWidth: number;
  defaultHeight: number;
  category: 'basic' | 'flowchart' | 'tech';
}

// Icon palette item
export interface IconDefinition {
  id: string;
  name: string;
  icon: string;
  category: 'infrastructure' | 'network' | 'services' | 'security' | 'people' | 'misc';
}

// Undo/Redo history types
export type HistoryActionType =
  | 'ADD_NODE'
  | 'UPDATE_NODE'
  | 'DELETE_NODE'
  | 'MOVE_NODES'
  | 'ADD_EDGE'
  | 'UPDATE_EDGE'
  | 'DELETE_EDGE';

export interface HistoryAction {
  type: HistoryActionType;
  // Node-related data
  node?: DiagramNode;
  previousNode?: DiagramNode;
  nodes?: DiagramNode[];
  previousNodes?: DiagramNode[];
  // Edge-related data
  edge?: DiagramEdge;
  previousEdge?: DiagramEdge;
  // For bulk operations
  nodeIds?: string[];
  edgeIds?: string[];
  // Related edges (for node deletion)
  relatedEdges?: DiagramEdge[];
}

// Layer for organizing diagram elements
export interface DiagramLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

// Template definitions
export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  category: 'flowchart' | 'network' | 'org-chart' | 'sequence' | 'general';
  thumbnail?: string;
  nodes: Omit<DiagramNode, 'id' | 'boardId' | 'createdAt' | 'updatedAt'>[];
  edges: Omit<DiagramEdge, 'id' | 'boardId' | 'createdAt' | 'updatedAt'>[];
}

// Clipboard data for copy/paste
export interface ClipboardData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  timestamp: number;
}
