// Kairo Plugin API
// Plugins can use these exports to extend the application

export { usePluginStore, registerPlugin, type Plugin, type PluginManifest } from "./registry";
export {
  useHooks,
  registerHook,
  registerFilter,
  triggerHook,
  applyFilter,
  type HookType,
  type FilterType,
  type HookCallback,
  type FilterCallback,
} from "./hooks";
export { useSlots, registerSlot, type SlotType, type SlotComponent } from "./slots";
export { useCommands, registerCommand, type Command } from "./commands";
