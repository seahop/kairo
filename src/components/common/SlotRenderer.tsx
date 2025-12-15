import { useSlots, SlotType } from "@/plugins/api/slots";

interface SlotRendererProps {
  slot: SlotType;
  className?: string;
  data?: unknown;
}

/**
 * SlotRenderer - Renders components registered by extensions for a specific slot
 *
 * Extensions can register components to appear in various UI locations:
 * - sidebar: Left sidebar area
 * - sidebar-footer: Bottom of sidebar
 * - toolbar: Main toolbar area
 * - statusbar: Bottom status bar
 * - editor-toolbar: Editor-specific toolbar
 * - editor-footer: Below the editor
 * - preview-footer: Below the preview pane
 * - modal: Modal dialogs
 */
export function SlotRenderer({ slot, className = "", data }: SlotRendererProps) {
  const components = useSlots((state) => state.getSlotComponents(slot));

  if (components.length === 0) {
    return null;
  }

  return (
    <div className={`slot-container slot-${slot} ${className}`}>
      {components.map((slotComponent) => {
        const Component = slotComponent.component;
        return (
          <div
            key={slotComponent.id}
            className="slot-item"
            data-plugin-id={slotComponent.pluginId}
            data-slot-id={slotComponent.id}
          >
            <Component data={data} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hook to check if a slot has any registered components
 */
export function useHasSlotContent(slot: SlotType): boolean {
  const components = useSlots((state) => state.getSlotComponents(slot));
  return components.length > 0;
}
