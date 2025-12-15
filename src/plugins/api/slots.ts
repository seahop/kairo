import { create } from "zustand";
import { ComponentType } from "react";

export type SlotType =
  | "sidebar"
  | "sidebar-footer"
  | "toolbar"
  | "statusbar"
  | "editor-toolbar"
  | "editor-footer"
  | "preview-footer"
  | "modal";

export interface SlotComponent {
  id: string;
  pluginId: string;
  component: ComponentType<{ data?: unknown }>;
  priority?: number; // Higher = rendered first
}

interface SlotsState {
  slots: Map<SlotType, SlotComponent[]>;
  registerSlot: (slot: SlotType, component: SlotComponent) => void;
  unregisterSlot: (slot: SlotType, componentId: string) => void;
  unregisterPluginSlots: (pluginId: string) => void;
  getSlotComponents: (slot: SlotType) => SlotComponent[];
}

export const useSlots = create<SlotsState>((set, get) => ({
  slots: new Map(),

  registerSlot: (slot: SlotType, component: SlotComponent) => {
    set((state) => {
      const newSlots = new Map(state.slots);
      if (!newSlots.has(slot)) {
        newSlots.set(slot, []);
      }
      const components = [...newSlots.get(slot)!, component];
      // Sort by priority (higher first)
      components.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      newSlots.set(slot, components);
      return { slots: newSlots };
    });
  },

  unregisterSlot: (slot: SlotType, componentId: string) => {
    set((state) => {
      const newSlots = new Map(state.slots);
      const components = newSlots.get(slot);
      if (components) {
        newSlots.set(
          slot,
          components.filter((c) => c.id !== componentId)
        );
      }
      return { slots: newSlots };
    });
  },

  unregisterPluginSlots: (pluginId: string) => {
    set((state) => {
      const newSlots = new Map(state.slots);
      for (const [slot, components] of newSlots) {
        newSlots.set(slot, components.filter((c) => c.pluginId !== pluginId));
      }
      return { slots: newSlots };
    });
  },

  getSlotComponents: (slot: SlotType) => get().slots.get(slot) ?? [],
}));

export function registerSlot(slot: SlotType, component: SlotComponent) {
  useSlots.getState().registerSlot(slot, component);
}
