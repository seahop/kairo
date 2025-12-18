import { useState, useEffect, useRef } from "react";
import { useTemplateStore, Template, templateNeedsTitle, TemplateCategory } from "./index";
import { CloseIcon } from "@/components/common/Icons";
import { Select } from "@/components/common/Select";
import clsx from "clsx";

const FileIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const categories: { id: TemplateCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'daily', label: 'Daily' },
  { id: 'zettelkasten', label: 'Zettelkasten' },
  { id: 'moc', label: 'MOC' },
  { id: 'para', label: 'PARA' },
  { id: 'security', label: 'Security' },
  { id: 'custom', label: 'Custom' },
];

// Template Editor Component
function TemplateEditor() {
  const { editingTemplate, closeEditor, saveTemplate } = useTemplateStore();
  const [name, setName] = useState(editingTemplate?.name || "");
  const [description, setDescription] = useState(editingTemplate?.description || "");
  const [category, setCategory] = useState(editingTemplate?.category || "custom");
  const [pathPrefix, setPathPrefix] = useState(editingTemplate?.pathPrefix || "notes");
  const [filenamePattern, setFilenamePattern] = useState(editingTemplate?.filenamePattern || "{title}");
  const [content, setContent] = useState(editingTemplate?.content || "");

  if (!editingTemplate) return null;

  const handleSave = () => {
    if (!name.trim()) return;

    // If editing a built-in template, create a custom copy with new ID
    const newId = editingTemplate.isBuiltin
      ? `custom-${editingTemplate.id}-${Date.now()}`
      : editingTemplate.id;

    saveTemplate({
      id: newId,
      name: name.trim(),
      description: description.trim() || undefined,
      category: category || "custom",
      pathPrefix: pathPrefix.trim() || "notes",
      filenamePattern: filenamePattern.trim() || "{title}",
      content,
      isBuiltin: false,
    });
  };

  const isNew = editingTemplate.id.startsWith("custom-") && !editingTemplate.name;
  const isEditingBuiltin = editingTemplate.isBuiltin;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <button className="btn-icon" onClick={closeEditor}>
            <BackIcon />
          </button>
          <h2 className="text-lg font-semibold text-dark-100">
            {isNew ? "Create Template" : isEditingBuiltin ? `Customize: ${editingTemplate.name}` : `Edit: ${editingTemplate.name}`}
          </h2>
        </div>
      </div>

      {isEditingBuiltin && (
        <div className="px-4 py-2 bg-accent-primary/10 text-accent-primary text-sm">
          Editing a built-in template will create a custom copy that you can modify.
        </div>
      )}

      {/* Editor Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Row 1: Name and Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Template Name *</label>
            <input
              type="text"
              className="input"
              placeholder="My Template"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Category</label>
            <Select
              value={category}
              onChange={(value) => setCategory(value)}
              options={[
                { value: "custom", label: "Custom" },
                { value: "general", label: "General" },
                { value: "daily", label: "Daily" },
                { value: "zettelkasten", label: "Zettelkasten" },
                { value: "moc", label: "MOC" },
                { value: "para", label: "PARA" },
                { value: "security", label: "Security" },
                { value: "work", label: "Work" },
              ]}
              placeholder="Select category..."
            />
          </div>
        </div>

        {/* Row 2: Description */}
        <div>
          <label className="block text-sm text-dark-400 mb-1">Description</label>
          <input
            type="text"
            className="input"
            placeholder="Brief description of what this template is for"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Row 3: Path and Filename Pattern */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Save Location</label>
            <input
              type="text"
              className="input font-mono text-sm"
              placeholder="notes"
              value={pathPrefix}
              onChange={(e) => setPathPrefix(e.target.value)}
            />
            <div className="text-xs text-dark-500 mt-1">Folder path within your vault</div>
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Filename Pattern</label>
            <input
              type="text"
              className="input font-mono text-sm"
              placeholder="{title}"
              value={filenamePattern}
              onChange={(e) => setFilenamePattern(e.target.value)}
            />
            <div className="text-xs text-dark-500 mt-1">Use {"{title}"}, {"{date}"}, {"{zettel}"}</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <label className="block text-sm text-dark-400 mb-1">
            Template Content
          </label>
          <textarea
            className="input font-mono text-sm h-64 resize-none"
            placeholder="# {title}\n\nYour template content here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center p-4 border-t border-dark-800">
        <div className="text-xs text-dark-500">
          Variables: {"{title}"}, {"{date}"}, {"{time}"}, {"{datetime}"}, {"{weekday}"}, {"{month}"}, {"{year}"}, {"{zettel}"}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={closeEditor}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {isNew ? "Create Template" : isEditingBuiltin ? "Save as Custom" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Title Input for templates that need a title
function TitleInputStep({ template, onBack, onSubmit }: {
  template: Template;
  onBack: () => void;
  onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit(title.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <button type="button" className="btn-icon" onClick={onBack}>
            <BackIcon />
          </button>
          <h2 className="text-lg font-semibold text-dark-100">
            New {template.name}
          </h2>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-dark-300 mb-2">
            Note Title
          </label>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:border-accent-primary"
            placeholder="Enter note title..."
          />
        </div>

        {template.description && (
          <div className="text-sm text-dark-500 mb-4">
            {template.description}
          </div>
        )}

        <div className="mt-4 p-3 bg-dark-850 rounded-lg">
          <div className="text-xs text-dark-500 mb-1">Will be saved to:</div>
          <div className="text-sm text-dark-300 font-mono">
            {template.pathPrefix || 'notes'}/{title ? (template.filenamePattern || '{title}').replace('{title}', title.toLowerCase().replace(/\s+/g, '-')) : '...'}.md
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 p-4 border-t border-dark-800">
        <button type="button" className="btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={!title.trim()}
        >
          Create Note
        </button>
      </div>
    </form>
  );
}

// Template List Component
function TemplateList() {
  const { templates, closeModal, createFromTemplate, openEditor, deleteTemplate } = useTemplateStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [titleInputTemplate, setTitleInputTemplate] = useState<Template | null>(null);

  // Filter templates by category
  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  // Group templates by category for display
  const grouped = filteredTemplates.reduce((acc, template) => {
    const category = template.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  // Sort categories
  const categoryOrder = ['custom', 'general', 'daily', 'zettelkasten', 'moc', 'para', 'security', 'work', 'other'];
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const handleTemplateClick = (template: Template) => {
    if (templateNeedsTitle(template)) {
      setTitleInputTemplate(template);
    } else {
      createFromTemplate(template);
    }
  };

  const handleTitleSubmit = (title: string) => {
    if (titleInputTemplate) {
      createFromTemplate(titleInputTemplate, title);
      setTitleInputTemplate(null);
    }
  };

  const handleDuplicate = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    openEditor({
      ...template,
      id: `custom-${Date.now()}`,
      name: `${template.name} (Copy)`,
      isBuiltin: false,
    });
  };

  // Show title input step
  if (titleInputTemplate) {
    return (
      <TitleInputStep
        template={titleInputTemplate}
        onBack={() => setTitleInputTemplate(null)}
        onSubmit={handleTitleSubmit}
      />
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800">
        <h2 className="text-lg font-semibold text-dark-100">Templates</h2>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-sm flex items-center gap-1"
            onClick={() => openEditor()}
          >
            <PlusIcon />
            New Template
          </button>
          <button className="btn-icon" onClick={closeModal}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 py-3 border-b border-dark-800 flex-wrap">
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

      {/* Templates list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-dark-500">
            <p>No templates in this category</p>
            <button
              className="btn-primary mt-4"
              onClick={() => openEditor()}
            >
              Create a Template
            </button>
          </div>
        ) : selectedCategory === 'all' ? (
          // Grouped view for "All"
          sortedCategories.map((category) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium text-dark-400 mb-2 capitalize">{category}</h3>
              <div className="space-y-2">
                {grouped[category].map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onClick={() => handleTemplateClick(template)}
                    onEdit={() => openEditor(template)}
                    onDuplicate={(e) => handleDuplicate(template, e)}
                    onDelete={() => {
                      if (confirm(`Delete "${template.name}"?`)) {
                        deleteTemplate(template.id);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          // Flat list for specific category
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => handleTemplateClick(template)}
                onEdit={() => openEditor(template)}
                onDuplicate={(e) => handleDuplicate(template, e)}
                onDelete={() => {
                  if (confirm(`Delete "${template.name}"?`)) {
                    deleteTemplate(template.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-dark-800 text-xs text-dark-500">
        Click a template to create a new note • Edit built-in templates to customize them
      </div>
    </>
  );
}

// Individual template card
function TemplateCard({ template, onClick, onEdit, onDuplicate, onDelete }: {
  template: Template;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 p-3 bg-dark-800 hover:bg-dark-700 rounded-lg transition-colors">
      <button
        className="flex-1 flex items-center gap-3 text-left"
        onClick={onClick}
      >
        <div className="text-accent-primary">
          <FileIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-dark-100 flex items-center gap-2">
            {template.name}
            {template.isBuiltin && (
              <span className="text-xs text-dark-500 bg-dark-700 px-1.5 py-0.5 rounded">
                Built-in
              </span>
            )}
          </div>
          <div className="text-sm text-dark-500 truncate">
            {template.description || template.content.split("\n").slice(0, 2).join(" ").slice(0, 60) + "..."}
          </div>
          {template.pathPrefix && (
            <div className="text-xs text-dark-600 font-mono mt-1">
              {template.pathPrefix}/
            </div>
          )}
        </div>
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {template.isBuiltin ? (
          <>
            <button
              className="btn-icon text-dark-400 hover:text-dark-200"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Customize template"
            >
              <EditIcon />
            </button>
            <button
              className="btn-icon text-dark-400 hover:text-dark-200"
              onClick={onDuplicate}
              title="Duplicate template"
            >
              <CopyIcon />
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-icon text-dark-400 hover:text-dark-200"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit template"
            >
              <EditIcon />
            </button>
            <button
              className="btn-icon text-dark-400 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete template"
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function TemplateModal() {
  const { showModal, isEditorMode } = useTemplateStore();

  if (!showModal) return null;

  return (
    <div className="modal-overlay" onClick={() => useTemplateStore.getState().closeModal()}>
      <div
        className="modal-content w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {isEditorMode ? <TemplateEditor /> : <TemplateList />}
      </div>
    </div>
  );
}
