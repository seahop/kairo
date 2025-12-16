// Diagram plugin types - matching Rust backend structures

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface DiagramBoard {
  id: string;
  name: string;
  description?: string;
  viewport: Viewport;
  createdAt: number;
  modifiedAt: number;
}

export interface NodeData {
  label?: string;
  shapeType?: 'rectangle' | 'circle' | 'diamond' | 'cylinder' | 'hexagon';
  icon?: string;
  color?: string;
  borderColor?: string;
  fontSize?: number;
}

export interface DiagramNode {
  id: string;
  boardId: string;
  nodeType: 'shape' | 'icon' | 'text' | 'group';
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
  arrowType?: 'arrow' | 'none';
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
