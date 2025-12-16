import { memo } from "react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import type { NodeData } from "../../types";

interface ImageNodeProps {
  id: string;
  data: NodeData;
  selected?: boolean;
  width?: number;
  height?: number;
}

function ImageNodeComponent({ data, selected, width: nodeWidth, height: nodeHeight }: ImageNodeProps) {
  // Use node dimensions from React Flow (set by NodeResizer) or defaults
  const width = nodeWidth || 200;
  const height = nodeHeight || 150;

  const imageUrl = data.imageUrl || "";
  const imageFit = data.imageFit || "contain";
  const borderColor = data.borderColor || "#3b82f6";
  const borderRadius = data.borderRadius || 8;

  return (
    <>
      <NodeResizer
        minWidth={80}
        minHeight={60}
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
        className="relative overflow-hidden"
        style={{
          width,
          height,
          borderRadius,
          border: `2px solid ${borderColor}`,
          backgroundColor: "#1f2937",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={data.label || "Image"}
            className="w-full h-full"
            style={{
              objectFit: imageFit,
            }}
            draggable={false}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-dark-400 text-sm">
            <span>No image</span>
          </div>
        )}
        {/* Label overlay at bottom */}
        {data.label && (
          <div
            className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-white text-xs truncate text-center"
          >
            {data.label}
          </div>
        )}
      </div>
    </>
  );
}

export const ImageNode = memo(ImageNodeComponent);
