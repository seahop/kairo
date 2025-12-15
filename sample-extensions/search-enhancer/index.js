// Search Enhancer Extension
// Demonstrates: filterSearchResults filter, onSearch hook, onSearchResult hook

let filterEnabled = true;
let excludeArchived = true;
let prioritizeTitles = true;
let searchHistory = [];
const MAX_HISTORY = 50;

function initialize(kairo) {
  kairo.log.info("Search Enhancer extension loaded");

  // Track search queries for history
  kairo.registerHook("onSearch", (data) => {
    if (data.query && data.query.trim()) {
      // Add to history (avoid duplicates)
      searchHistory = searchHistory.filter(q => q !== data.query);
      searchHistory.unshift(data.query);
      if (searchHistory.length > MAX_HISTORY) {
        searchHistory.pop();
      }
      kairo.log.debug("Search query", data.query);
    }
  });

  // Log search results
  kairo.registerHook("onSearchResult", (data) => {
    kairo.log.debug("Search results", `Query: "${data.query}", Found: ${data.results?.length || 0} results`);
  });

  // Filter to enhance/modify search results
  kairo.registerFilter("filterSearchResults", (results) => {
    if (!filterEnabled || !results || !Array.isArray(results)) {
      return results;
    }

    let filtered = [...results];

    // Exclude archived notes if enabled
    if (excludeArchived) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(result => {
        const path = result.path || result.file || "";
        return !path.includes("/archive/") && !path.includes("/Archive/");
      });
      if (beforeCount !== filtered.length) {
        kairo.log.debug("Filtered archived", `Removed ${beforeCount - filtered.length} archived notes`);
      }
    }

    // Boost title matches to the top if enabled
    if (prioritizeTitles) {
      filtered.sort((a, b) => {
        const aTitle = a.title || "";
        const bTitle = b.title || "";
        const query = searchHistory[0] || "";

        const aInTitle = aTitle.toLowerCase().includes(query.toLowerCase());
        const bInTitle = bTitle.toLowerCase().includes(query.toLowerCase());

        if (aInTitle && !bInTitle) return -1;
        if (!aInTitle && bInTitle) return 1;
        return 0;
      });
    }

    return filtered;
  });

  // Commands
  kairo.registerCommand({
    id: "toggle-filter",
    name: "Toggle Search Enhancements",
    description: "Enable or disable search result filtering",
    category: "Search",
    execute: () => {
      filterEnabled = !filterEnabled;
      window.alert(`Search enhancements ${filterEnabled ? "enabled" : "disabled"}`);
    }
  });

  kairo.registerCommand({
    id: "toggle-exclude-archived",
    name: "Toggle Exclude Archived",
    description: "Exclude or include archived notes in search results",
    category: "Search",
    execute: () => {
      excludeArchived = !excludeArchived;
      window.alert(`Exclude archived notes: ${excludeArchived ? "Yes" : "No"}`);
    }
  });

  kairo.registerCommand({
    id: "toggle-prioritize-titles",
    name: "Toggle Prioritize Title Matches",
    description: "Move title matches to the top of search results",
    category: "Search",
    execute: () => {
      prioritizeTitles = !prioritizeTitles;
      window.alert(`Prioritize title matches: ${prioritizeTitles ? "Yes" : "No"}`);
    }
  });

  kairo.registerCommand({
    id: "show-history",
    name: "Show Search History",
    description: "Display recent search queries",
    category: "Search",
    execute: () => {
      if (searchHistory.length === 0) {
        window.alert("Search history is empty.\n\nPerform some searches and try again.");
        return;
      }

      const summary = searchHistory.slice(0, 15)
        .map((query, i) => `${i + 1}. ${query}`)
        .join("\n");

      window.alert(`Recent Searches (${searchHistory.length} total):\n\n${summary}`);
    }
  });

  kairo.registerCommand({
    id: "clear-history",
    name: "Clear Search History",
    description: "Clear all search history",
    category: "Search",
    execute: () => {
      const count = searchHistory.length;
      searchHistory.length = 0;
      window.alert(`Search history cleared (${count} queries removed)`);
    }
  });

  kairo.registerCommand({
    id: "copy-history",
    name: "Copy Search History",
    description: "Copy search history to clipboard",
    category: "Search",
    execute: async () => {
      if (searchHistory.length === 0) {
        window.alert("No search history to copy.");
        return;
      }
      await navigator.clipboard.writeText(searchHistory.join("\n"));
      window.alert(`Search history copied to clipboard (${searchHistory.length} queries)`);
    }
  });

  // Add to Edit menu
  kairo.registerMenuItem("edit", {
    id: "search-options",
    label: "Search Options...",
    priority: 5,
    execute: () => {
      const status =
        "Search Enhancer Options:\n\n" +
        "Enabled: " + (filterEnabled ? "Yes" : "No") + "\n" +
        "Exclude Archived: " + (excludeArchived ? "Yes" : "No") + "\n" +
        "Prioritize Titles: " + (prioritizeTitles ? "Yes" : "No") + "\n\n" +
        "Use Command Palette to toggle options.";

      window.alert(status);
    }
  });
}

function cleanup(kairo) {
  kairo.log.info("Search Enhancer unloaded", `History had ${searchHistory.length} queries`);
}

exports.initialize = initialize;
exports.cleanup = cleanup;
