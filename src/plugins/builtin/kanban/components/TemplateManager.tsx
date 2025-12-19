import { useState, useEffect } from "react";
import { useKanbanStore } from "../store";
import { CardTemplate, BUILTIN_TEMPLATES } from "../templates";

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const ResetIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

type EditorMode = "list" | "create" | "edit";

export function TemplateManager({ isOpen, onClose }: TemplateManagerProps) {
  const {
    customTemplates,
    loadCustomTemplates,
    saveCustomTemplate,
    updateCustomTemplate,
    deleteCustomTemplate,
  } = useKanbanStore();

  const [mode, setMode] = useState<EditorMode>("list");
  const [editingTemplate, setEditingTemplate] = useState<CardTemplate | null>(null);
  const [editingBuiltinId, setEditingBuiltinId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);

  // Get IDs of built-in templates that have been customized
  const customizedBuiltinIds = new Set(
    customTemplates
      .filter(t => BUILTIN_TEMPLATES.some(b => b.id === t.id))
      .map(t => t.id)
  );

  // Load templates on mount
  useEffect(() => {
    if (isOpen) {
      loadCustomTemplates();
    }
  }, [isOpen, loadCustomTemplates]);

  // Reset form when mode changes
  useEffect(() => {
    if (mode === "list") {
      setName("");
      setDescription("");
      setContent("");
      setEditingTemplate(null);
      setEditingBuiltinId(null);
    }
  }, [mode]);

  if (!isOpen) return null;

  const handleCreate = () => {
    setMode("create");
    setName("");
    setDescription("");
    setContent("");
  };

  const handleEdit = (template: CardTemplate) => {
    setEditingTemplate(template);
    setEditingBuiltinId(null);
    setName(template.name);
    setDescription(template.description);
    setContent(template.content);
    setMode("edit");
  };

  const handleEditBuiltin = (template: CardTemplate) => {
    // Check if there's already a custom override
    const customOverride = customTemplates.find(t => t.id === template.id);
    const templateToEdit = customOverride || template;

    setEditingTemplate(null);
    setEditingBuiltinId(template.id);
    setName(templateToEdit.name);
    setDescription(templateToEdit.description);
    setContent(templateToEdit.content);
    setMode("edit");
  };

  const handleDuplicate = (template: CardTemplate) => {
    setName(`${template.name} (Copy)`);
    setDescription(template.description);
    setContent(template.content);
    setMode("create");
  };

  const handleResetBuiltin = async (templateId: string) => {
    await deleteCustomTemplate(templateId);
    setResetConfirm(null);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    if (mode === "create") {
      await saveCustomTemplate({
        name: name.trim(),
        description: description.trim(),
        content,
      });
    } else if (mode === "edit") {
      if (editingBuiltinId) {
        // Editing a built-in template - create/update a custom override with the same ID
        const existingOverride = customTemplates.find(t => t.id === editingBuiltinId);
        if (existingOverride) {
          await updateCustomTemplate(editingBuiltinId, {
            name: name.trim(),
            description: description.trim(),
            content,
          });
        } else {
          // Create a new custom template that overrides the built-in
          await saveCustomTemplate({
            id: editingBuiltinId,
            name: name.trim(),
            description: description.trim(),
            content,
          });
        }
      } else if (editingTemplate) {
        await updateCustomTemplate(editingTemplate.id, {
          name: name.trim(),
          description: description.trim(),
          content,
        });
      }
    }

    setMode("list");
  };

  const handleDelete = async (templateId: string) => {
    await deleteCustomTemplate(templateId);
    setDeleteConfirm(null);
  };

  const handleClose = () => {
    setMode("list");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-900 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-dark-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-dark-100">
            {mode === "list" && "Manage Templates"}
            {mode === "create" && "Create Template"}
            {mode === "edit" && "Edit Template"}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-dark-400 hover:text-dark-200 rounded"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {mode === "list" ? (
            <div className="p-4 space-y-4">
              {/* Create button */}
              <button
                onClick={handleCreate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary rounded-lg transition-colors"
              >
                <PlusIcon />
                Create New Template
              </button>

              {/* Custom templates (excluding built-in overrides which are shown below) */}
              {(() => {
                const pureCustomTemplates = customTemplates.filter(t => !BUILTIN_TEMPLATES.some(b => b.id === t.id));
                return pureCustomTemplates.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-dark-400 uppercase mb-2">
                      Your Templates
                    </h3>
                    <div className="space-y-2">
                      {pureCustomTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-start justify-between p-3 bg-dark-800 rounded-lg border border-dark-700"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-dark-100">{template.name}</h4>
                          <p className="text-sm text-dark-400 line-clamp-1">
                            {template.description || "No description"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-1.5 text-dark-400 hover:text-blue-400 rounded transition-colors"
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDuplicate(template)}
                            className="p-1.5 text-dark-400 hover:text-green-400 rounded transition-colors"
                            title="Duplicate"
                          >
                            <CopyIcon />
                          </button>
                          {deleteConfirm === template.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 text-xs text-dark-400 hover:text-dark-200"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(template.id)}
                              className="p-1.5 text-dark-400 hover:text-red-400 rounded transition-colors"
                              title="Delete"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              })()}

              {/* Built-in templates */}
              <div>
                <h3 className="text-xs font-semibold text-dark-400 uppercase mb-2">
                  Built-in Templates
                </h3>
                <div className="space-y-2">
                  {BUILTIN_TEMPLATES.filter(t => t.id !== "blank").map((template) => {
                    const isCustomized = customizedBuiltinIds.has(template.id);
                    const customVersion = isCustomized
                      ? customTemplates.find(t => t.id === template.id)
                      : null;

                    return (
                      <div
                        key={template.id}
                        className={`flex items-start justify-between p-3 rounded-lg border ${
                          isCustomized
                            ? "bg-dark-800 border-accent-primary/30"
                            : "bg-dark-850 border-dark-700/50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={`font-medium ${isCustomized ? "text-dark-100" : "text-dark-200"}`}>
                              {customVersion?.name || template.name}
                            </h4>
                            {isCustomized && (
                              <span className="px-1.5 py-0.5 text-xs bg-accent-primary/20 text-accent-primary rounded">
                                Customized
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-dark-500 line-clamp-1">
                            {customVersion?.description || template.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => handleEditBuiltin(template)}
                            className="p-1.5 text-dark-400 hover:text-blue-400 rounded transition-colors"
                            title={isCustomized ? "Edit customization" : "Customize"}
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDuplicate(customVersion || template)}
                            className="p-1.5 text-dark-400 hover:text-green-400 rounded transition-colors"
                            title="Duplicate as new template"
                          >
                            <CopyIcon />
                          </button>
                          {isCustomized && (
                            resetConfirm === template.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleResetBuiltin(template.id)}
                                  className="px-2 py-1 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded"
                                >
                                  Reset
                                </button>
                                <button
                                  onClick={() => setResetConfirm(null)}
                                  className="px-2 py-1 text-xs text-dark-400 hover:text-dark-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setResetConfirm(template.id)}
                                className="p-1.5 text-dark-400 hover:text-orange-400 rounded transition-colors"
                                title="Reset to default"
                              >
                                <ResetIcon />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Create/Edit form */
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-dark-400 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-primary"
                  placeholder="e.g., Sprint Task, Weekly Review..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-dark-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-primary"
                  placeholder="Brief description of when to use this template..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm text-dark-400 mb-1">
                  Template Content (Markdown)
                </label>
                <textarea
                  className="w-full h-64 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-accent-primary font-mono text-sm resize-none"
                  placeholder="## Section&#10;&#10;Add your template content here...&#10;&#10;- [ ] Task item&#10;- [ ] Another task"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <p className="text-xs text-dark-500 mt-1">
                  Use Markdown formatting. Supports headers, lists, checkboxes, code blocks, etc.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-dark-700">
          {mode === "list" ? (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={() => setMode("list")}
                className="px-4 py-2 text-dark-400 hover:text-dark-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {mode === "create" ? "Create Template" : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
