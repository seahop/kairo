// Preview Enhancer Extension
// Demonstrates: filterPreviewHtml filter, filterNoteContent filter, onPreviewRender hook

let enhancementsEnabled = true;

// Custom styles for enhanced preview
const PREVIEW_STYLES = `
  /* Enhanced code blocks */
  .preview-enhanced pre {
    position: relative;
    border-radius: 8px;
    background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3d 100%);
  }

  .preview-enhanced pre::before {
    content: attr(data-language);
    position: absolute;
    top: 0;
    right: 0;
    padding: 2px 8px;
    font-size: 10px;
    color: #888;
    background: rgba(0,0,0,0.3);
    border-radius: 0 8px 0 8px;
  }

  /* Enhanced blockquotes */
  .preview-enhanced blockquote {
    border-left: 4px solid #6366f1;
    background: rgba(99, 102, 241, 0.1);
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    margin: 16px 0;
  }

  /* Enhanced tables */
  .preview-enhanced table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    border-radius: 8px;
    overflow: hidden;
  }

  .preview-enhanced th {
    background: rgba(99, 102, 241, 0.2);
    font-weight: 600;
  }

  .preview-enhanced td, .preview-enhanced th {
    border: 1px solid #333;
    padding: 8px 12px;
  }

  .preview-enhanced tr:nth-child(even) {
    background: rgba(255,255,255,0.02);
  }

  /* Enhanced task lists */
  .preview-enhanced li.task-done {
    text-decoration: line-through;
    opacity: 0.6;
  }

  /* Reading time indicator */
  .reading-time {
    display: inline-block;
    padding: 4px 12px;
    background: rgba(99, 102, 241, 0.15);
    border-radius: 16px;
    font-size: 12px;
    color: #a5b4fc;
    margin-bottom: 16px;
  }

  /* Word count */
  .word-count {
    color: #666;
    font-size: 11px;
    margin-left: 8px;
  }
`;

function initialize(kairo) {
  kairo.log.info("Preview Enhancer extension loaded");

  // Add custom styles
  kairo.addStyles(PREVIEW_STYLES);

  // Filter to enhance preview HTML
  kairo.registerFilter("filterPreviewHtml", (html) => {
    if (!enhancementsEnabled) return html;

    let enhanced = html;

    // Add preview-enhanced class to container
    enhanced = `<div class="preview-enhanced">${enhanced}</div>`;

    // Calculate reading time (average 200 words per minute)
    const textContent = enhanced.replace(/<[^>]*>/g, " ");
    const wordCount = textContent.trim().split(/\s+/).filter(w => w).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    // Add reading time at the top
    const readingTimeHtml = `
      <div class="reading-time">
        📖 ${readingTime} min read
        <span class="word-count">(${wordCount} words)</span>
      </div>
    `;

    enhanced = enhanced.replace(
      '<div class="preview-enhanced">',
      '<div class="preview-enhanced">' + readingTimeHtml
    );

    // Enhance code blocks with language labels
    enhanced = enhanced.replace(
      /<pre><code class="language-(\w+)">/g,
      '<pre data-language="$1"><code class="language-$1">'
    );

    // Mark completed tasks
    enhanced = enhanced.replace(
      /<li><input type="checkbox" checked[^>]*>/g,
      '<li class="task-done"><input type="checkbox" checked>'
    );

    kairo.log.debug("Preview enhanced", `${wordCount} words, ${readingTime} min read`);

    return enhanced;
  });

  // Hook to log when preview renders
  kairo.registerHook("onPreviewRender", (data) => {
    kairo.log.debug("Preview rendered", `HTML length: ${data.html?.length || 0}`);
  });

  // Command to toggle enhancements
  kairo.registerCommand({
    id: "toggle",
    name: "Toggle Preview Enhancements",
    description: "Enable or disable preview styling enhancements",
    category: "Preview",
    execute: () => {
      enhancementsEnabled = !enhancementsEnabled;
      kairo.log.info(`Preview enhancements ${enhancementsEnabled ? "enabled" : "disabled"}`);

      // Trigger a re-render by cycling the view
      window.alert(`Preview enhancements ${enhancementsEnabled ? "enabled" : "disabled"}\n\nSwitch to a different note and back to see the change.`);
    }
  });

  // Add to context menu
  kairo.registerContextMenuItem("preview", {
    id: "toggle-enhancements",
    label: "Toggle Enhancements",
    icon: "✨",
    execute: () => {
      enhancementsEnabled = !enhancementsEnabled;
      kairo.log.info(`Enhancements ${enhancementsEnabled ? "on" : "off"}`);
    }
  });
}

function cleanup(kairo) {
  kairo.removeStyles();
  kairo.log.info("Preview Enhancer extension unloaded");
}

exports.initialize = initialize;
exports.cleanup = cleanup;
