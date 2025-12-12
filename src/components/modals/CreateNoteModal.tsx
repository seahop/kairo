import { useState, useEffect, useRef } from "react";
import { useNoteStore } from "@/stores/noteStore";
import { useUIStore } from "@/stores/uiStore";
import {
  defaultTemplates,
  NoteTemplate,
  processTemplate,
  generateFilename,
  getTemplatesByCategory,
} from "@/lib/templates";
import clsx from "clsx";

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const categories = [
  { id: 'all', label: 'All Templates' },
  { id: 'general', label: 'General' },
  { id: 'daily', label: 'Daily Notes' },
  { id: 'zettelkasten', label: 'Zettelkasten' },
  { id: 'moc', label: 'MOC' },
  { id: 'para', label: 'PARA' },
] as const;

export function CreateNoteModal() {
  const { createNote } = useNoteStore();
  const { activeModal, closeModal } = useUIStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [step, setStep] = useState<'select' | 'customize'>('select');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isOpen = activeModal === 'create-note';

  useEffect(() => {
    if (isOpen) {
      setSelectedCategory('all');
      setSelectedTemplate(null);
      setCustomTitle('');
      setStep('select');
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'customize' && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [step]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (step === 'customize') {
          setStep('select');
        } else {
          closeModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, closeModal]);

  if (!isOpen) return null;

  const filteredTemplates = selectedCategory === 'all'
    ? defaultTemplates
    : getTemplatesByCategory(selectedCategory as NoteTemplate['category']);

  const handleSelectTemplate = (template: NoteTemplate) => {
    setSelectedTemplate(template);
    // If template needs title, go to customize step
    if (template.filenamePattern.includes('{title}')) {
      setStep('customize');
    } else {
      // Create note directly
      handleCreate(template, '');
    }
  };

  const handleCreate = async (template: NoteTemplate, title: string) => {
    const finalTitle = title || 'untitled';
    const filename = generateFilename(template, finalTitle);
    const content = processTemplate(template.content, finalTitle);

    await createNote(filename, content);
    closeModal();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTemplate && customTitle.trim()) {
      handleCreate(selectedTemplate, customTitle.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="relative bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-dark-100">
            {step === 'select' ? 'Create New Note' : `New ${selectedTemplate?.name}`}
          </h2>
          <button
            className="p-1 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded transition-colors"
            onClick={closeModal}
          >
            <CloseIcon />
          </button>
        </div>

        {step === 'select' ? (
          <>
            {/* Category tabs */}
            <div className="flex gap-2 px-6 py-3 border-b border-dark-800 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={clsx(
                    "px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors",
                    selectedCategory === cat.id
                      ? "bg-accent-primary text-dark-950 font-medium"
                      : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
                  )}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Template grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    className="p-4 text-left bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-dark-600 rounded-lg transition-colors group"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="font-medium text-dark-200 group-hover:text-accent-primary">
                      {template.name}
                    </div>
                    <div className="text-sm text-dark-500 mt-1">
                      {template.description}
                    </div>
                    <div className="text-xs text-dark-600 mt-2 font-mono">
                      {template.pathPrefix}/
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Customize step */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Note Title
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:border-accent-primary"
                  placeholder="Enter note title..."
                />
              </div>

              {/* Preview */}
              <div className="mt-6">
                <div className="text-sm font-medium text-dark-400 mb-2">Preview</div>
                <div className="p-4 bg-dark-850 border border-dark-700 rounded-lg">
                  <div className="text-sm text-dark-300 font-mono mb-2">
                    {customTitle ? generateFilename(selectedTemplate!, customTitle) : 'Enter a title...'}
                  </div>
                  <pre className="text-xs text-dark-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {processTemplate(selectedTemplate!.content, customTitle || '{title}')}
                  </pre>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-dark-700 bg-dark-850">
              <button
                type="button"
                className="px-4 py-2 text-sm text-dark-400 hover:text-dark-200"
                onClick={() => setStep('select')}
              >
                ← Back to templates
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-accent-primary text-dark-950 font-medium rounded-lg hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!customTitle.trim()}
              >
                Create Note
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
