import { create } from "zustand";
import { triggerHook } from "./hooks";

export interface Command {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  pluginId?: string;
  icon?: string;
  category?: string;
  execute: () => void | Promise<void>;
}

interface CommandsState {
  commands: Map<string, Command>;
  registerCommand: (command: Command) => void;
  unregisterCommand: (id: string) => void;
  unregisterPluginCommands: (pluginId: string) => void;
  executeCommand: (id: string) => Promise<void>;
  getCommands: () => Command[];
  searchCommands: (query: string) => Command[];
}

export const useCommands = create<CommandsState>((set, get) => ({
  commands: new Map(),

  registerCommand: (command: Command) => {
    set((state) => {
      const newCommands = new Map(state.commands);
      newCommands.set(command.id, command);
      return { commands: newCommands };
    });
  },

  unregisterCommand: (id: string) => {
    set((state) => {
      const newCommands = new Map(state.commands);
      newCommands.delete(id);
      return { commands: newCommands };
    });
  },

  unregisterPluginCommands: (pluginId: string) => {
    set((state) => {
      const newCommands = new Map(state.commands);
      for (const [id, command] of newCommands) {
        if (command.pluginId === pluginId) {
          newCommands.delete(id);
        }
      }
      return { commands: newCommands };
    });
  },

  executeCommand: async (id: string) => {
    const command = get().commands.get(id);
    if (command) {
      try {
        // Trigger hook before execution
        triggerHook("onCommandExecute", { commandId: id, command });
        await command.execute();
      } catch (err) {
        console.error(`[Command] Error executing ${id}:`, err);
        // Re-throw so callers can handle if needed
        throw err;
      }
    } else {
      console.warn(`[Command] Command not found: ${id}`);
    }
  },

  getCommands: () => Array.from(get().commands.values()),

  searchCommands: (query: string) => {
    const lowerQuery = query.toLowerCase();
    return Array.from(get().commands.values()).filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.category?.toLowerCase().includes(lowerQuery)
    );
  },
}));

export function registerCommand(command: Command) {
  useCommands.getState().registerCommand(command);
}
