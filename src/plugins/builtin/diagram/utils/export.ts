import { toPng } from "html-to-image";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export interface ExportOptions {
  backgroundColor?: string;
  quality?: number;
  pixelRatio?: number;
}

/**
 * Convert a data URL to a Uint8Array
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Filter function to exclude UI elements from export
 */
function exportFilter(node: HTMLElement): boolean {
  const className = node.className?.toString() || "";
  // Exclude controls, minimap, and panel from export
  if (className.includes("react-flow__controls") ||
      className.includes("react-flow__minimap") ||
      className.includes("react-flow__panel")) {
    return false;
  }
  return true;
}

/**
 * Export a React Flow diagram to PNG
 */
export async function exportToPng(
  element: HTMLElement,
  filename: string = "diagram.png",
  options: ExportOptions = {}
): Promise<void> {
  const { backgroundColor = "#111827", quality = 0.95, pixelRatio = 2 } = options;

  try {
    // Find the React Flow container
    const reactFlowElement = element.querySelector(".react-flow") as HTMLElement;
    if (!reactFlowElement) {
      throw new Error("Could not find React Flow element");
    }

    const dataUrl = await toPng(reactFlowElement, {
      backgroundColor,
      quality,
      pixelRatio,
      filter: exportFilter,
    });

    // Show save dialog
    const filePath = await save({
      defaultPath: filename,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });

    if (filePath) {
      // Convert data URL to binary and write to file
      const bytes = dataUrlToUint8Array(dataUrl);
      await writeFile(filePath, bytes);
    }
  } catch (error) {
    console.error("Failed to export PNG:", error);
    throw error;
  }
}
