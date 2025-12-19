import { useState, useRef, useEffect } from "react";
import { useKanbanStore } from "../store";
import { CardTemplate } from "../templates";
import { TemplateManager } from "./TemplateManager";

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const TemplateIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

interface TemplateSelectorProps {
  onSelect: (template: CardTemplate | null) => void;
  selectedTemplateId?: string | null;
  className?: string;
}

export function TemplateSelector({
  onSelect,
  selectedTemplateId,
  className = "",
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getAllTemplates, loadCustomTemplates } = useKanbanStore();

  // Load custom templates on mount
  useEffect(() => {
    loadCustomTemplates();
  }, [loadCustomTemplates]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const templates = getAllTemplates();
  const selectedTemplate = selectedTemplateId
    ? templates.find((t) => t.id === selectedTemplateId)
    : null;

  const handleSelect = (template: CardTemplate | null) => {
    onSelect(template);
    setIsOpen(false);
  };

  // Group templates by builtin vs custom
  const builtinTemplates = templates.filter((t) => t.isBuiltin);
  const customTemplates = templates.filter((t) => !t.isBuiltin);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-dark-200 hover:border-dark-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <TemplateIcon />
          {selectedTemplate ? selectedTemplate.name : "Select template..."}
        </span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
          {/* No template option */}
          <button
            className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 transition-colors ${
              !selectedTemplateId ? "bg-dark-700 text-accent-primary" : "text-dark-300"
            }`}
            onClick={() => handleSelect(null)}
          >
            <div className="font-medium">No template</div>
            <div className="text-xs text-dark-500">Start with a blank card</div>
          </button>

          {/* Built-in templates */}
          {builtinTemplates.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-dark-500 bg-dark-850 border-t border-dark-700">
                Built-in Templates
              </div>
              {builtinTemplates.map((template) => (
                <button
                  key={template.id}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 transition-colors border-t border-dark-700/50 ${
                    selectedTemplateId === template.id
                      ? "bg-dark-700 text-accent-primary"
                      : "text-dark-200"
                  }`}
                  onClick={() => handleSelect(template)}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-dark-500 line-clamp-1">
                    {template.description}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Custom templates */}
          {customTemplates.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-dark-500 bg-dark-850 border-t border-dark-700">
                Custom Templates
              </div>
              {customTemplates.map((template) => (
                <button
                  key={template.id}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700 transition-colors border-t border-dark-700/50 ${
                    selectedTemplateId === template.id
                      ? "bg-dark-700 text-accent-primary"
                      : "text-dark-200"
                  }`}
                  onClick={() => handleSelect(template)}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-dark-500 line-clamp-1">
                    {template.description}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Manage Templates button */}
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-dark-700 transition-colors border-t border-dark-700 text-dark-400 flex items-center gap-2"
            onClick={() => {
              setIsOpen(false);
              setShowManager(true);
            }}
          >
            <SettingsIcon />
            <span>Manage Templates...</span>
          </button>
        </div>
      )}

      {/* Template Manager Modal */}
      {showManager && (
        <TemplateManager isOpen={showManager} onClose={() => setShowManager(false)} />
      )}
    </div>
  );
}
