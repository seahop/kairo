import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { useDiagramStore } from "../../store";
import type { NodeData } from "../../types";

interface TextNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
  width?: number;
  height?: number;
}

function TextNodeComponent({ id, data, selected, width: nodeWidth, height: nodeHeight }: TextNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label || "Text");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateNode = useDiagramStore((state) => state.updateNode);

  // Use node dimensions from React Flow (set by NodeResizer) or defaults
  const width = nodeWidth || undefined;
  const height = nodeHeight || undefined;

  const color = data.color || "#e5e7eb";
  const fontSize = data.fontSize || 14;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

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

    if (e.key === "Escape") {
      setEditValue(data.label || "");
      setIsEditing(false);
    }
    // Allow Enter for multi-line text (blur to save)
  }, [data.label]);

  return (
    <>
      <NodeResizer
        minWidth={80}
        minHeight={30}
        isVisible={selected}
        lineClassName="border-gray-400"
        handleClassName="h-2 w-2 bg-white border-2 border-gray-400 rounded"
      />

      {/* Connection handles - subtle for text nodes */}
      <Handle type="target" position={Position.Top} id="top" className="w-1.5 h-1.5 !bg-gray-500 opacity-50" />
      <Handle type="target" position={Position.Right} id="right" className="w-1.5 h-1.5 !bg-gray-500 opacity-50" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="w-1.5 h-1.5 !bg-gray-500 opacity-50" />
      <Handle type="target" position={Position.Left} id="left" className="w-1.5 h-1.5 !bg-gray-500 opacity-50" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-1.5 h-1.5 !bg-gray-500 opacity-50" />
      <Handle type="source" position={Position.Right} id="right-source" className="w-1.5 h-1.5 !bg-gray-500 opacity-50" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-1.5 h-1.5 !bg-gray-500 opacity-50" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-1.5 h-1.5 !bg-gray-500 opacity-50" />

      <div
        className="min-w-[80px] min-h-[30px] px-2 py-1"
        style={{ width, height }}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full min-h-[30px] bg-dark-800 border border-dark-600 rounded px-1 resize-none outline-none"
            style={{ color, fontSize }}
          />
        ) : (
          <div
            className="whitespace-pre-wrap w-full h-full"
            style={{ color, fontSize }}
          >
            {data.label || "Double-click to edit"}
          </div>
        )}
      </div>
    </>
  );
}

export const TextNode = memo(TextNodeComponent);
