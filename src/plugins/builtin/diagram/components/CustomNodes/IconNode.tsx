import { memo, useState, useCallback } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import { useDiagramStore } from "../../store";
import {
  Server,
  Database,
  Cloud,
  Globe,
  Shield,
  Lock,
  User,
  Users,
  Cpu,
  HardDrive,
  Network,
  Router,
  Wifi,
  Monitor,
  Smartphone,
  Container,
  Box,
  FileText,
  Folder,
  Settings,
  Key,
  type LucideIcon,
} from "lucide-react";
import type { NodeData } from "../../types";

// Map icon names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Server,
  Database,
  Cloud,
  Globe,
  Shield,
  Lock,
  User,
  Users,
  Cpu,
  HardDrive,
  Network,
  Router,
  Wifi,
  Monitor,
  Smartphone,
  Container,
  Box,
  FileText,
  Folder,
  Settings,
  Key,
};

interface IconNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
  width?: number;
  height?: number;
}

function IconNodeComponent({ id, data, selected, width: nodeWidth, height: nodeHeight }: IconNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label || "");
  const updateNode = useDiagramStore((state) => state.updateNode);

  // Use node dimensions from React Flow (set by NodeResizer) or defaults
  const width = nodeWidth || 80;
  const height = nodeHeight || 80;

  // Scale icon based on container size (40% of smaller dimension)
  const iconSize = Math.min(width, height) * 0.4;

  const iconName = data.icon || "Box";
  const IconComponent = ICON_MAP[iconName] || Box;
  const fillColor = data.color || "#6366f1";
  const borderColor = data.borderColor || "#4f46e5";
  const fontSize = data.fontSize || 11;

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

  return (
    <>
      <NodeResizer
        minWidth={60}
        minHeight={60}
        isVisible={selected}
        lineClassName="border-indigo-400"
        handleClassName="h-2 w-2 bg-white border-2 border-indigo-400 rounded"
      />

      {/* Connection handles */}
      <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 !bg-indigo-500" />
      <Handle type="target" position={Position.Right} id="right" className="w-2 h-2 !bg-indigo-500" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-indigo-500" />
      <Handle type="target" position={Position.Left} id="left" className="w-2 h-2 !bg-indigo-500" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-2 h-2 !bg-indigo-500" />
      <Handle type="source" position={Position.Right} id="right-source" className="w-2 h-2 !bg-indigo-500" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-2 h-2 !bg-indigo-500" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-2 h-2 !bg-indigo-500" />

      <div
        className="relative flex flex-col items-center justify-center rounded-lg"
        style={{
          width,
          height,
          backgroundColor: fillColor,
          border: `2px solid ${borderColor}`,
        }}
        onDoubleClick={handleDoubleClick}
      >
        <IconComponent className="text-white" size={iconSize} strokeWidth={1.5} />

        {/* Label */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[120px]">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full text-center bg-dark-800 border border-dark-600 rounded px-1 text-white outline-none"
              style={{ fontSize }}
              autoFocus
            />
          ) : (
            <span
              className="block text-center text-dark-200 truncate"
              style={{ fontSize }}
            >
              {data.label}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export const IconNode = memo(IconNodeComponent);

// Export the icon map for use in palettes
export { ICON_MAP };
