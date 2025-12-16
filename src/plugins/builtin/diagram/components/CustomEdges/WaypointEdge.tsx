import { useCallback, useState } from "react";
import {
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import type { EdgeData } from "../../types";

// Calculate a smooth path through waypoints
function getWaypointPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Array<{ x: number; y: number }>
): string {
  if (!waypoints || waypoints.length === 0) {
    // No waypoints, use straight line
    return `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  }

  // Build path through all waypoints
  const allPoints = [
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ];

  // Create a smooth path using quadratic bezier curves
  let path = `M ${allPoints[0].x},${allPoints[0].y}`;

  if (allPoints.length === 2) {
    // Just source and target
    path += ` L ${allPoints[1].x},${allPoints[1].y}`;
  } else if (allPoints.length === 3) {
    // One waypoint - use quadratic bezier
    path += ` Q ${allPoints[1].x},${allPoints[1].y} ${allPoints[2].x},${allPoints[2].y}`;
  } else {
    // Multiple waypoints - use line segments with rounded corners
    for (let i = 1; i < allPoints.length; i++) {
      path += ` L ${allPoints[i].x},${allPoints[i].y}`;
    }
  }

  return path;
}

// Calculate midpoint of edge for adding waypoints
function getMidpoint(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  waypoints: Array<{ x: number; y: number }>
): { x: number; y: number } {
  if (!waypoints || waypoints.length === 0) {
    return {
      x: (sourceX + targetX) / 2,
      y: (sourceY + targetY) / 2,
    };
  }

  // Find midpoint along the path
  const allPoints = [
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ];

  // Calculate total path length
  let totalLength = 0;
  for (let i = 0; i < allPoints.length - 1; i++) {
    const dx = allPoints[i + 1].x - allPoints[i].x;
    const dy = allPoints[i + 1].y - allPoints[i].y;
    totalLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Find point at half the total length
  let targetLength = totalLength / 2;
  let accLength = 0;

  for (let i = 0; i < allPoints.length - 1; i++) {
    const dx = allPoints[i + 1].x - allPoints[i].x;
    const dy = allPoints[i + 1].y - allPoints[i].y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (accLength + segmentLength >= targetLength) {
      const ratio = (targetLength - accLength) / segmentLength;
      return {
        x: allPoints[i].x + dx * ratio,
        y: allPoints[i].y + dy * ratio,
      };
    }

    accLength += segmentLength;
  }

  return allPoints[allPoints.length - 1];
}

interface WaypointEdgeProps extends EdgeProps {
  data?: EdgeData;
}

export function WaypointEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
  style,
  markerEnd,
  markerStart,
  label,
}: WaypointEdgeProps) {
  const { setEdges } = useReactFlow();
  const [draggingWaypoint, setDraggingWaypoint] = useState<number | null>(null);

  const waypoints = data?.waypoints || [];
  const edgePath = getWaypointPath(sourceX, sourceY, targetX, targetY, waypoints);
  const labelPosition = getMidpoint(sourceX, sourceY, targetX, targetY, waypoints);

  // Handle waypoint drag
  const handleWaypointMouseDown = useCallback(
    (index: number, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      setDraggingWaypoint(index);

      const handleMouseMove = (e: MouseEvent) => {
        // Get the React Flow viewport element
        const flowElement = document.querySelector(".react-flow__viewport");
        if (!flowElement) return;

        // Get the transform from the viewport
        const transform = (flowElement as HTMLElement).style.transform;
        const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/);

        if (!match) return;

        const translateX = parseFloat(match[1]);
        const translateY = parseFloat(match[2]);
        const scale = parseFloat(match[3]);

        // Get the container bounds
        const container = document.querySelector(".react-flow");
        if (!container) return;
        const rect = container.getBoundingClientRect();

        // Calculate the position in flow coordinates
        const x = (e.clientX - rect.left - translateX) / scale;
        const y = (e.clientY - rect.top - translateY) / scale;

        setEdges((edges) =>
          edges.map((edge) => {
            if (edge.id !== id) return edge;
            const currentWaypoints = [...((edge.data as EdgeData)?.waypoints || [])];
            currentWaypoints[index] = { x, y };
            return {
              ...edge,
              data: { ...edge.data, waypoints: currentWaypoints },
            };
          })
        );
      };

      const handleMouseUp = () => {
        setDraggingWaypoint(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [id, setEdges]
  );

  // Double-click on edge to add waypoint
  const handleEdgeDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();

      // Get the flow viewport for coordinate calculation
      const flowElement = document.querySelector(".react-flow__viewport");
      if (!flowElement) return;

      const transform = (flowElement as HTMLElement).style.transform;
      const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/);

      if (!match) return;

      const translateX = parseFloat(match[1]);
      const translateY = parseFloat(match[2]);
      const scale = parseFloat(match[3]);

      const container = document.querySelector(".react-flow");
      if (!container) return;
      const rect = container.getBoundingClientRect();

      // Calculate click position in flow coordinates
      const x = (event.clientX - rect.left - translateX) / scale;
      const y = (event.clientY - rect.top - translateY) / scale;

      // Find the best insertion point
      const allPoints = [
        { x: sourceX, y: sourceY },
        ...waypoints,
        { x: targetX, y: targetY },
      ];

      // Find which segment the click is closest to
      let bestSegment = 0;
      let bestDist = Infinity;

      for (let i = 0; i < allPoints.length - 1; i++) {
        const p1 = allPoints[i];
        const p2 = allPoints[i + 1];

        // Calculate distance from point to line segment
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / (dx * dx + dy * dy)));
        const projX = p1.x + t * dx;
        const projY = p1.y + t * dy;
        const dist = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);

        if (dist < bestDist) {
          bestDist = dist;
          bestSegment = i;
        }
      }

      // Insert new waypoint at the click position
      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.id !== id) return edge;
          const currentWaypoints = [...((edge.data as EdgeData)?.waypoints || [])];
          currentWaypoints.splice(bestSegment, 0, { x, y });
          return {
            ...edge,
            data: { ...edge.data, waypoints: currentWaypoints },
          };
        })
      );
    },
    [id, sourceX, sourceY, targetX, targetY, waypoints, setEdges]
  );

  // Remove waypoint on right-click
  const handleWaypointContextMenu = useCallback(
    (index: number, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setEdges((edges) =>
        edges.map((edge) => {
          if (edge.id !== id) return edge;
          const currentWaypoints = [...((edge.data as EdgeData)?.waypoints || [])];
          currentWaypoints.splice(index, 1);
          return {
            ...edge,
            data: { ...edge.data, waypoints: currentWaypoints },
          };
        })
      );
    },
    [id, setEdges]
  );

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        onDoubleClick={handleEdgeDoubleClick}
      />
      {/* Invisible wider path for easier interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onDoubleClick={handleEdgeDoubleClick}
        style={{ cursor: "crosshair" }}
      />

      {/* Waypoint handles - show when edge is selected */}
      {selected && waypoints.map((wp, index) => (
        <g key={index}>
          {/* Outer ring for visibility */}
          <circle
            cx={wp.x}
            cy={wp.y}
            r={8}
            fill="white"
            stroke={(style?.stroke as string) || "#64748b"}
            strokeWidth={2}
            style={{ cursor: draggingWaypoint === index ? "grabbing" : "grab" }}
            onMouseDown={(e) => handleWaypointMouseDown(index, e)}
            onContextMenu={(e) => handleWaypointContextMenu(index, e)}
          />
          {/* Inner dot */}
          <circle
            cx={wp.x}
            cy={wp.y}
            r={4}
            fill={(style?.stroke as string) || "#64748b"}
            style={{ pointerEvents: "none" }}
          />
        </g>
      ))}

      {/* Edge label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`,
              pointerEvents: "all",
            }}
            className="px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-dark-200"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
