import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { useDiagramStore } from "../../store";
import type { NodeData } from "../../types";

const SHAPE_PATHS: Record<string, (w: number, h: number) => string> = {
  rectangle: () => "", // Uses rect element
  circle: () => "", // Uses ellipse element
  diamond: (w, h) => `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
  cylinder: () => "", // Custom SVG
  hexagon: (w, h) => {
    const x1 = w * 0.25;
    const x2 = w * 0.75;
    return `M ${x1} 0 L ${x2} 0 L ${w} ${h / 2} L ${x2} ${h} L ${x1} ${h} L 0 ${h / 2} Z`;
  },
};

interface ShapeNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
  width?: number;
  height?: number;
}

function ShapeNodeComponent({ id, data, selected, width: nodeWidth, height: nodeHeight }: ShapeNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label || "");
  const updateNode = useDiagramStore((state) => state.updateNode);

  // Use node dimensions from React Flow (set by NodeResizer) or defaults
  const width = nodeWidth || 120;
  const height = nodeHeight || 80;

  const shapeType = data.shapeType || "rectangle";
  const fillColor = data.color || "#3b82f6";
  const borderColor = data.borderColor || "#1d4ed8";
  const fontSize = data.fontSize || 12;
  const borderRadius = data.borderRadius ?? 4;
  const fontWeight = data.fontWeight || "normal";
  const fontStyle = data.fontStyle || "normal";
  const textAlign = data.textAlign || "center";

  const handleDoubleClick = useCallback(() => {
    setEditValue(data.label || "");
    setIsEditing(true);
  }, [data.label]);

  const saveLabel = useCallback(() => {
    if (editValue !== data.label) {
      // Pass undefined for position/size, only update data
      updateNode(id, undefined, undefined, undefined, undefined, { ...data, label: editValue });
    }
    setIsEditing(false);
  }, [id, data, editValue, updateNode]);

  const handleBlur = useCallback(() => {
    saveLabel();
  }, [saveLabel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Stop propagation to prevent React Flow from handling these keys
    e.stopPropagation();

    if (e.key === "Enter") {
      saveLabel();
    } else if (e.key === "Escape") {
      setEditValue(data.label || "");
      setIsEditing(false);
    }
  }, [data.label, saveLabel]);

  const renderShape = () => {
    switch (shapeType) {
      case "circle":
        return (
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width / 2 - 2}
            ry={height / 2 - 2}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={2}
          />
        );
      case "diamond":
      case "hexagon":
        return (
          <path
            d={SHAPE_PATHS[shapeType](width, height)}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      case "cylinder":
        const ellipseRy = height * 0.15;
        return (
          <>
            {/* Back ellipse */}
            <ellipse
              cx={width / 2}
              cy={ellipseRy}
              rx={width / 2 - 2}
              ry={ellipseRy}
              fill={fillColor}
              stroke={borderColor}
              strokeWidth={2}
            />
            {/* Body */}
            <rect
              x={2}
              y={ellipseRy}
              width={width - 4}
              height={height - ellipseRy * 2}
              fill={fillColor}
              stroke="none"
            />
            <line
              x1={2}
              y1={ellipseRy}
              x2={2}
              y2={height - ellipseRy}
              stroke={borderColor}
              strokeWidth={2}
            />
            <line
              x1={width - 2}
              y1={ellipseRy}
              x2={width - 2}
              y2={height - ellipseRy}
              stroke={borderColor}
              strokeWidth={2}
            />
            {/* Front ellipse */}
            <ellipse
              cx={width / 2}
              cy={height - ellipseRy}
              rx={width / 2 - 2}
              ry={ellipseRy}
              fill={fillColor}
              stroke={borderColor}
              strokeWidth={2}
            />
          </>
        );
      case "rectangle":
      default:
        return (
          <rect
            x={2}
            y={2}
            width={width - 4}
            height={height - 4}
            rx={borderRadius}
            fill={fillColor}
            stroke={borderColor}
            strokeWidth={2}
          />
        );
    }
  };

  return (
    <>
      <NodeResizer
        minWidth={60}
        minHeight={40}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="h-2 w-2 bg-white border-2 border-blue-400 rounded"
      />

      {/* Connection handles */}
      <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 !bg-blue-500" />
      <Handle type="target" position={Position.Right} id="right" className="w-2 h-2 !bg-blue-500" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-blue-500" />
      <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-2 h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Right} id="right-source" className="w-2 h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-2 h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-2 h-2 !bg-blue-500" />

      <div
        className="relative"
        style={{ width, height }}
        onDoubleClick={handleDoubleClick}
      >
        <svg width={width} height={height} className="absolute inset-0">
          {renderShape()}
        </svg>

        {/* Label */}
        <div
          className={`absolute inset-0 flex items-center pointer-events-none ${textAlign === "left" ? "justify-start" : textAlign === "right" ? "justify-end" : "justify-center"}`}
          style={{ padding: "8px" }}
        >
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={`w-full bg-transparent border-none outline-none text-white pointer-events-auto`}
              style={{ fontSize, fontWeight, fontStyle, textAlign }}
              autoFocus
            />
          ) : (
            <span
              className="text-white truncate"
              style={{ fontSize, fontWeight, fontStyle, textAlign, maxWidth: width - 16 }}
            >
              {data.label}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
