import { useState } from "react";
import { useTemplateStore, Template } from "./index";
import { CloseIcon } from "@/components/common/Icons";

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

// Template Editor Component
function TemplateEditor() {
  const { editingTemplate, closeEditor, saveTemplate } = useTemplateStore();
  const [name, setName] = useState(editingTemplate?.name || "");
  const [category, setCategory] = useState(editingTemplate?.category || "Custom");
  const [content, setContent] = useState(editingTemplate?.content || "");

  if (!editingTemplate) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    saveTemplate({
      ...editingTemplate,
      name: name.trim(),
      category: category.trim() || "Custom",
      content,
    });
  };

  const isNew = editingTemplate.id.startsWith("custom-") && !editingTemplate.name;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <button className="btn-icon" onClick={closeEditor}>
            <BackIcon />
          </button>
          <h2 className="text-lg font-semibold text-dark-100">
            {isNew ? "Create Template" : `Edit: ${editingTemplate.name}`}
          </h2>
        </div>
      </div>

      {/* Editor Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Template Name</label>
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
            <input
              type="text"
              className="input"
              placeholder="Custom"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-sm text-dark-400 mb-1">
            Template Content
            <span className="ml-2 text-dark-500">(Use {"{{date}}"}, {"{{time}}"}, {"{{datetime}}"} for variables)</span>
          </label>
          <textarea
            className="input font-mono text-sm h-80 resize-none"
            placeholder="# Template Title\n\nYour template content here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center p-4 border-t border-dark-800">
        <div className="text-xs text-dark-500">
          Variables: {"{{date}}"}, {"{{time}}"}, {"{{datetime}}"}, {"{{year}}"}, {"{{month}}"}, {"{{day}}"}
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
            {isNew ? "Create Template" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Template List Component
function TemplateList() {
  const { templates, closeModal, createFromTemplate, openEditor, deleteTemplate } = useTemplateStore();

  // Group templates by category
  const grouped = templates.reduce((acc, template) => {
    const category = template.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  // Sort categories with Custom first if it exists
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    if (a === "Custom") return -1;
    if (b === "Custom") return 1;
    return a.localeCompare(b);
  });

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

      {/* Templates list */}
      <div className="flex-1 overflow-y-auto p-4">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-dark-500">
            <p>No templates yet</p>
            <button
              className="btn-primary mt-4"
              onClick={() => openEditor()}
            >
              Create Your First Template
            </button>
          </div>
        ) : (
          sortedCategories.map((category) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-medium text-dark-400 mb-2">{category}</h3>
              <div className="space-y-2">
                {grouped[category].map((template) => (
                  <div
                    key={template.id}
                    className="group flex items-center gap-3 p-3 bg-dark-800 hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <button
                      className="flex-1 flex items-center gap-3 text-left"
                      onClick={() => createFromTemplate(template)}
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
                          {template.content.split("\n").slice(0, 2).join(" ").slice(0, 60)}...
                        </div>
                      </div>
                    </button>

                    {/* Edit/Delete buttons for custom templates */}
                    {!template.isBuiltin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="btn-icon text-dark-400 hover:text-dark-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditor(template);
                          }}
                          title="Edit template"
                        >
                          <EditIcon />
                        </button>
                        <button
                          className="btn-icon text-dark-400 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${template.name}"?`)) {
                              deleteTemplate(template.id);
                            }
                          }}
                          title="Delete template"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-dark-800 text-xs text-dark-500">
        Click a template to create a new note from it
      </div>
    </>
  );
}

export function TemplateModal() {
  const { showModal, isEditorMode } = useTemplateStore();

  if (!showModal) return null;

  return (
    <div className="modal-overlay" onClick={() => useTemplateStore.getState().closeModal()}>
      <div
        className="modal-content w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {isEditorMode ? <TemplateEditor /> : <TemplateList />}
      </div>
    </div>
  );
}
