import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { usePaneStore, PaneNode } from "@/stores/paneStore";
import { PaneLeaf } from "./PaneLeaf";

interface PaneContainerProps {
  node: PaneNode;
}

export function PaneContainer({ node }: PaneContainerProps) {
  const setPaneRatio = usePaneStore((s) => s.setPaneRatio);

  // Leaf node - render the pane content
  if (node.type === 'leaf') {
    return <PaneLeaf pane={node} />;
  }

  // Split node - render a resizable panel group
  const handleLayout = (sizes: number[]) => {
    if (sizes[0] !== undefined) {
      setPaneRatio(node.id, sizes[0]);
    }
  };

  return (
    <PanelGroup
      direction={node.direction}
      onLayout={handleLayout}
      className="h-full"
    >
      <Panel defaultSize={node.ratio} minSize={15}>
        <div className={`h-full ${node.direction === 'horizontal' ? 'border-r border-dark-800' : 'border-b border-dark-800'}`}>
          <PaneContainer node={node.children[0]} />
        </div>
      </Panel>
      <PanelResizeHandle
        className={`
          ${node.direction === 'horizontal' ? 'w-1' : 'h-1'}
          bg-dark-800 hover:bg-accent-primary transition-colors
          ${node.direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize'}
        `}
      />
      <Panel minSize={15}>
        <PaneContainer node={node.children[1]} />
      </Panel>
    </PanelGroup>
  );
}
