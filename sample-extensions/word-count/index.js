// Word Count Extension
// Demonstrates: Command registration, logging

function initialize(kairo) {
  kairo.log.info("Word Count extension loaded");

  // Register a command to count words in current selection/document
  kairo.registerCommand({
    id: "count-words",
    name: "Count Words in Document",
    description: "Shows word count statistics",
    category: "Tools",
    shortcut: "Ctrl+Shift+W",
    execute: async () => {
      // Get text from clipboard or prompt user
      // Note: Direct editor access isn't available yet, so this is a demo
      const text = await navigator.clipboard.readText().catch(() => "");

      if (!text) {
        kairo.log.warn("No text found. Copy some text first.");
        return;
      }

      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      const chars = text.length;
      const charsNoSpaces = text.replace(/\s/g, "").length;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0).length;
      const readingTime = Math.ceil(words / 200); // ~200 words per minute

      kairo.log.info("Word Count Results", {
        words,
        characters: chars,
        charactersNoSpaces: charsNoSpaces,
        sentences,
        paragraphs,
        estimatedReadingTime: `${readingTime} min`
      });

      // Also show alert for visibility
      alert(`Word Count:\n\nWords: ${words}\nCharacters: ${chars}\nSentences: ${sentences}\nReading time: ~${readingTime} min`);
    }
  });

  kairo.registerCommand({
    id: "reading-time",
    name: "Estimate Reading Time",
    description: "Calculate reading time for copied text",
    category: "Tools",
    execute: async () => {
      const text = await navigator.clipboard.readText().catch(() => "");
      if (!text) {
        alert("Copy some text first to estimate reading time.");
        return;
      }
      const words = text.trim().split(/\s+/).length;
      const minutes = Math.ceil(words / 200);
      alert(`Estimated reading time: ${minutes} minute${minutes !== 1 ? 's' : ''} (${words} words)`);
    }
  });
}

function cleanup(kairo) {
  kairo.log.info("Word Count extension unloaded");
}

// Export for extension loader
exports.initialize = initialize;
exports.cleanup = cleanup;
