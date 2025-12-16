import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Build optimization - code splitting for better performance
  build: {
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal loading
        manualChunks: {
          // Core React dependencies
          'vendor-react': ['react', 'react-dom'],
          // CodeMirror (large) - load separately
          'vendor-codemirror': [
            '@codemirror/autocomplete',
            '@codemirror/commands',
            '@codemirror/lang-markdown',
            '@codemirror/language',
            '@codemirror/search',
            '@codemirror/state',
            '@codemirror/view',
            '@lezer/highlight',
            '@lezer/markdown',
          ],
          // CodeMirror language data - lazy load heavy syntax files
          'vendor-codemirror-langs': ['@codemirror/language-data'],
          // Graph visualization (heavy)
          'vendor-graph': ['react-force-graph-2d', 'd3-force'],
          // Diagram editor (React Flow)
          'vendor-diagram': ['@xyflow/react', 'html-to-image'],
          // Icon library
          'vendor-icons': ['lucide-react'],
          // Markdown rendering
          'vendor-markdown': ['react-markdown', 'rehype-highlight', 'rehype-raw', 'remark-gfm'],
          // Tauri API
          'vendor-tauri': [
            '@tauri-apps/api',
            '@tauri-apps/plugin-dialog',
            '@tauri-apps/plugin-fs',
            '@tauri-apps/plugin-shell',
          ],
          // State management
          'vendor-state': ['zustand'],
        },
      },
    },
    // Increase chunk size warning limit slightly since we're splitting intentionally
    chunkSizeWarningLimit: 600,
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0", // Allow connections from Docker
    watch: {
      // Tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
