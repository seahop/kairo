import { useEffect, useState } from "react";
import { useNoteStore, TrashItem } from "@/stores/noteStore";
import { useUIStore } from "@/stores/uiStore";

// Icons
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const RestoreIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EmptyTrashIcon = () => (
  <svg className="w-12 h-12 text-dark-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function TrashModal({ isOpen, onClose }: TrashModalProps) {
  const {
    trashItems,
    isTrashLoading,
    loadTrash,
    restoreFromTrash,
    permanentlyDelete,
    emptyTrash,
  } = useNoteStore();
  const { showConfirmDialog } = useUIStore();
  const [selectedItem, setSelectedItem] = useState<TrashItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTrash();
    }
  }, [isOpen, loadTrash]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRestore = async (item: TrashItem) => {
    await restoreFromTrash(item.trash_path);
    setSelectedItem(null);
  };

  const handlePermanentDelete = (item: TrashItem) => {
    showConfirmDialog({
      title: "Permanently Delete",
      message: `Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`,
      confirmText: "Delete Forever",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        await permanentlyDelete(item.trash_path);
        setSelectedItem(null);
      },
    });
  };

  const handleEmptyTrash = () => {
    showConfirmDialog({
      title: "Empty Trash",
      message: `Are you sure you want to permanently delete all ${trashItems.length} items in trash? This cannot be undone.`,
      confirmText: "Empty Trash",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        await emptyTrash();
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <TrashIcon />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-100">Trash</h2>
              <p className="text-xs text-dark-500">
                {trashItems.length} {trashItems.length === 1 ? "item" : "items"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trashItems.length > 0 && (
              <button
                className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                onClick={handleEmptyTrash}
              >
                Empty Trash
              </button>
            )}
            <button
              className="p-1 text-dark-400 hover:text-dark-200 transition-colors"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isTrashLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-primary border-t-transparent" />
            </div>
          ) : trashItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-dark-500">
              <EmptyTrashIcon />
              <p className="mt-4 text-sm">Trash is empty</p>
              <p className="text-xs text-dark-600 mt-1">Deleted notes will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-800">
              {trashItems.map((item) => (
                <div
                  key={item.trash_path}
                  className={`
                    px-6 py-3 hover:bg-dark-800/50 transition-colors cursor-pointer
                    ${selectedItem?.trash_path === item.trash_path ? "bg-dark-800" : ""}
                  `}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-dark-200 truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-dark-500 truncate mt-0.5">
                        {item.original_path}
                      </p>
                      <p className="text-xs text-dark-600 mt-1">
                        Deleted {formatRelativeTime(item.deleted_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="p-1.5 text-dark-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(item);
                        }}
                        title="Restore"
                      >
                        <RestoreIcon />
                      </button>
                      <button
                        className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePermanentDelete(item);
                        }}
                        title="Delete permanently"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-dark-800 text-xs text-dark-500">
          Items in trash will be kept until manually deleted
        </div>
      </div>
    </div>
  );
}
