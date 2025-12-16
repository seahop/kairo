import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { useDiagramStore } from "../../store";
import type { NodeData } from "../../types";

interface SwimlaneNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
  width?: number;
  height?: number;
}

function SwimlaneNodeComponent({ id, data, selected, width: nodeWidth, height: nodeHeight }: SwimlaneNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label || "Swimlane");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNode = useDiagramStore((state) => state.updateNode);

  // Use node dimensions from React Flow (set by NodeResizer) or defaults
  const width = nodeWidth || 800;
  const height = nodeHeight || 150;

  const borderColor = data.borderColor || "#475569";
  const headerColor = data.color || "#334155";
  const orientation = data.swimlaneOrientation || "horizontal";
  const headerSize = 40;

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

  if (orientation === "vertical") {
    // Vertical swimlane (header on left)
    return (
      <>
        <NodeResizer
          minWidth={100}
          minHeight={200}
          isVisible={selected}
          lineClassName="border-slate-400"
          handleClassName="h-2 w-2 bg-white border-2 border-slate-400 rounded"
        />

        {/* Connection handles */}
        <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 !bg-slate-500 opacity-50" />
        <Handle type="target" position={Position.Right} id="right" className="w-2 h-2 !bg-slate-500 opacity-50" />
        <Handle type="target" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-slate-500 opacity-50" />
        <Handle type="source" position={Position.Top} id="top-source" className="w-2 h-2 !bg-slate-500 opacity-50" />
        <Handle type="source" position={Position.Right} id="right-source" className="w-2 h-2 !bg-slate-500 opacity-50" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-2 h-2 !bg-slate-500 opacity-50" />

        <div
          className="relative flex"
          style={{
            width,
            height,
            border: `2px solid ${borderColor}`,
            borderRadius: 4,
            backgroundColor: "transparent",
          }}
        >
          {/* Vertical header on left */}
          <div
            className="flex items-center justify-center"
            style={{
              width: headerSize,
              height: "100%",
              backgroundColor: headerColor,
              borderRight: `2px solid ${borderColor}`,
              borderRadius: "2px 0 0 2px",
              writingMode: "vertical-rl",
              textOrientation: "mixed",
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
                className="w-full bg-transparent text-white text-sm font-semibold outline-none text-center"
                style={{ writingMode: "horizontal-tb", width: height - 8 }}
              />
            ) : (
              <span className="text-white text-sm font-semibold truncate px-2">
                {data.label || "Swimlane"}
              </span>
            )}
          </div>
          {/* Content area */}
          <div className="flex-1" />
        </div>
      </>
    );
  }

  // Horizontal swimlane (header on top)
  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-slate-400"
        handleClassName="h-2 w-2 bg-white border-2 border-slate-400 rounded"
      />

      {/* Connection handles */}
      <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 !bg-slate-500 opacity-50" />
      <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 !bg-slate-500 opacity-50" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-slate-500 opacity-50" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-2 h-2 !bg-slate-500 opacity-50" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-2 h-2 !bg-slate-500 opacity-50" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-2 h-2 !bg-slate-500 opacity-50" />

      <div
        className="relative"
        style={{
          width,
          height,
          border: `2px solid ${borderColor}`,
          borderRadius: 4,
          backgroundColor: "transparent",
        }}
      >
        {/* Horizontal header on top */}
        <div
          className="flex items-center justify-center"
          style={{
            width: "100%",
            height: headerSize,
            backgroundColor: headerColor,
            borderBottom: `2px solid ${borderColor}`,
            borderRadius: "2px 2px 0 0",
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
              className="w-full bg-transparent text-white text-sm font-semibold outline-none text-center px-4"
            />
          ) : (
            <span className="text-white text-sm font-semibold truncate px-4">
              {data.label || "Swimlane"}
            </span>
          )}
        </div>
        {/* Content area */}
        <div className="flex-1" />
      </div>
    </>
  );
}

export const SwimlaneNode = memo(SwimlaneNodeComponent);
