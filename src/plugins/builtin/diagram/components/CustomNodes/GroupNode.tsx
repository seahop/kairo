import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { useDiagramStore } from "../../store";
import type { NodeData } from "../../types";

// Helper to convert hex color to rgba with opacity
function hexToRgba(hex: string, opacity: number): string {
  // Handle already rgba colors
  if (hex.startsWith("rgba") || hex.startsWith("rgb")) {
    return hex;
  }
  // Remove # if present
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

interface GroupNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
  width?: number;
  height?: number;
}

function GroupNodeComponent({ id, data, selected, width: nodeWidth, height: nodeHeight }: GroupNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label || "Group");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNode = useDiagramStore((state) => state.updateNode);

  // Use node dimensions from React Flow (set by NodeResizer) or defaults
  const width = nodeWidth || 300;
  const height = nodeHeight || 200;

  // Style properties
  const borderColor = data.borderColor || "#3b82f6";
  const fontSize = data.fontSize || 12;
  const borderStyle = data.borderStyle || "dashed";
  const borderWidth = data.borderWidth || 2;
  const opacity = data.opacity ?? 0; // Default to no fill (0 opacity)
  const borderRadius = data.borderRadius ?? 8;

  // Calculate background color with opacity
  // If color is "transparent" or opacity is 0, no fill
  const hasNoFill = !data.color || data.color === "transparent" || opacity === 0;
  const bgColor = hasNoFill ? "transparent" : hexToRgba(data.color || borderColor, opacity);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    setEditValue(data.label || "");
    setIsEditing(true);
  }, [data.label]);

  const saveLabel = useCallback(() => {
    if (editValue !== data.label) {
      updateNode(id, undefined, undefined, undefined, undefined, { ...data, label: editValue });
    }
    setIsEditing(false);
  }, [id, data, editValue, updateNode]);

  const handleBlur = useCallback(() => {
    saveLabel();
  }, [saveLabel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === "Enter") {
      saveLabel();
    } else if (e.key === "Escape") {
      setEditValue(data.label || "");
      setIsEditing(false);
    }
  }, [data.label, saveLabel]);

  return (
    <>
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="h-3 w-3 bg-white border-2 border-blue-400 rounded"
      />

      {/* Connection handles on all sides */}
      <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 !bg-blue-500" />
      <Handle type="target" position={Position.Right} id="right" className="w-2 h-2 !bg-blue-500" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-blue-500" />
      <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-2 h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Right} id="right-source" className="w-2 h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-2 h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-2 h-2 !bg-blue-500" />

      <div
        style={{
          width,
          height,
          backgroundColor: bgColor,
          borderColor: borderColor,
          borderStyle: borderStyle,
          borderWidth: `${borderWidth}px`,
          borderRadius: `${borderRadius}px`,
          boxSizing: "border-box",
        }}
      >
        {/* Header with label */}
        <div
          className="absolute -top-6 left-2 px-2 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: borderColor,
            color: "#ffffff",
            fontSize,
          }}
          onDoubleClick={handleDoubleClick}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none text-white min-w-[60px]"
              style={{ fontSize }}
            />
          ) : (
            data.label || "Group"
          )}
        </div>
      </div>
    </>
  );
}

export const GroupNode = memo(GroupNodeComponent);
