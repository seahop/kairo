// Command Enhancer Extension
// Demonstrates: filterCommands filter, onCommandExecute hook

const commandHistory = [];
const commandUsage = {};
const MAX_HISTORY = 20;

function initialize(kairo) {
  kairo.log.info("Command Enhancer extension loaded");

  // Track command executions
  kairo.registerHook("onCommandExecute", (data) => {
    const cmdId = data.commandId;
    if (!cmdId) return;

    // Track usage count
    commandUsage[cmdId] = (commandUsage[cmdId] || 0) + 1;

    // Add to history
    commandHistory.unshift({
      id: cmdId,
      timestamp: Date.now()
    });

    // Limit history size
    if (commandHistory.length > MAX_HISTORY) {
      commandHistory.pop();
    }

    kairo.log.debug(`Command executed: ${cmdId}`, `Total uses: ${commandUsage[cmdId]}`);
  });

  // Filter commands to sort by usage/recency
  kairo.registerFilter("filterCommands", (commands) => {
    if (!commands || !Array.isArray(commands)) {
      return commands;
    }

    // Create a copy to avoid mutating original
    const enhanced = [...commands];

    // Sort by combined score: usage count + recency bonus
    enhanced.sort((a, b) => {
      const aUsage = commandUsage[a.id] || 0;
      const bUsage = commandUsage[b.id] || 0;

      // Recency bonus: +10 if used in last 5 commands
      const recentIds = commandHistory.slice(0, 5).map(h => h.id);
      const aRecent = recentIds.includes(a.id) ? 10 : 0;
      const bRecent = recentIds.includes(b.id) ? 10 : 0;

      const aScore = aUsage + aRecent;
      const bScore = bUsage + bRecent;

      // Sort by score descending, then alphabetically
      if (bScore !== aScore) {
        return bScore - aScore;
      }
      return (a.name || "").localeCompare(b.name || "");
    });

    return enhanced;
  });

  // Commands
  kairo.registerCommand({
    id: "show-stats",
    name: "Command Usage Stats",
    description: "Show most used commands",
    category: "Commands",
    execute: () => {
      const sorted = Object.entries(commandUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (sorted.length === 0) {
        window.alert("No command usage recorded yet.\n\nExecute some commands and try again.");
        return;
      }

      const summary = sorted
        .map(([id, count], i) => `${i + 1}. ${id}: ${count} uses`)
        .join("\n");

      window.alert(`Most Used Commands:\n\n${summary}`);
    }
  });

  kairo.registerCommand({
    id: "show-history",
    name: "Command History",
    description: "Show recently executed commands",
    category: "Commands",
    execute: () => {
      if (commandHistory.length === 0) {
        window.alert("No command history yet.\n\nExecute some commands and try again.");
        return;
      }

      const summary = commandHistory.slice(0, 10).map((entry, i) => {
        const ago = Math.round((Date.now() - entry.timestamp) / 1000);
        const timeStr = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;
        return `${i + 1}. ${entry.id} (${timeStr})`;
      }).join("\n");

      window.alert(`Recent Commands:\n\n${summary}`);
    }
  });

  kairo.registerCommand({
    id: "clear-stats",
    name: "Clear Command Stats",
    description: "Reset all command usage statistics",
    category: "Commands",
    execute: () => {
      const count = Object.keys(commandUsage).length;
      Object.keys(commandUsage).forEach(key => delete commandUsage[key]);
      commandHistory.length = 0;
      window.alert(`Command statistics cleared (${count} commands)`);
    }
  });

  kairo.registerCommand({
    id: "export-stats",
    name: "Export Command Stats",
    description: "Copy command statistics to clipboard",
    category: "Commands",
    execute: async () => {
      const stats = {
        usage: commandUsage,
        history: commandHistory.slice(0, 20),
        exportedAt: new Date().toISOString()
      };

      await navigator.clipboard.writeText(JSON.stringify(stats, null, 2));
      window.alert(`Command stats exported to clipboard (${Object.keys(commandUsage).length} commands tracked)`);
    }
  });

  // Add to View menu
  kairo.registerMenuItem("view", {
    id: "command-stats",
    label: "Command Statistics",
    priority: 5,
    execute: () => {
      const topCommands = Object.entries(commandUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const summary = topCommands.length > 0
        ? topCommands.map(([id, count]) => `${id}: ${count}`).join("\n")
        : "No commands executed yet";

      window.alert("Top Commands:\n\n" + summary);
    }
  });
}

function cleanup(kairo) {
  kairo.log.info("Command Enhancer unloaded", `Tracked ${Object.keys(commandUsage).length} unique commands`);
}

exports.initialize = initialize;
exports.cleanup = cleanup;
