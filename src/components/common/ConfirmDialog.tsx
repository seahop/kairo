import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/uiStore";

const WarningIcon = () => (
  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const DangerIcon = () => (
  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export function ConfirmDialog() {
  const { confirmDialog, closeConfirmDialog } = useUIStore();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmDialog) {
      // Focus the confirm button when dialog opens
      setTimeout(() => confirmButtonRef.current?.focus(), 0);
    }
  }, [confirmDialog]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!confirmDialog) return;

      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter") {
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmDialog]);

  if (!confirmDialog) return null;

  const handleConfirm = () => {
    confirmDialog.onConfirm();
    closeConfirmDialog();
  };

  const handleCancel = () => {
    confirmDialog.onCancel?.();
    closeConfirmDialog();
  };

  const Icon = confirmDialog.variant === 'danger' ? DangerIcon :
               confirmDialog.variant === 'info' ? InfoIcon : WarningIcon;

  const confirmButtonClass = confirmDialog.variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-accent-primary hover:bg-accent-primary/90 text-dark-950';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="relative bg-dark-900 border border-dark-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 p-6">
          <div className="flex-shrink-0">
            <Icon />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-dark-100">
              {confirmDialog.title}
            </h3>
            <p className="mt-2 text-sm text-dark-400">
              {confirmDialog.message}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-dark-850 border-t border-dark-700">
          <button
            className="px-4 py-2 text-sm font-medium text-dark-300 hover:text-dark-100 bg-dark-800 hover:bg-dark-700 rounded-lg transition-colors"
            onClick={handleCancel}
          >
            {confirmDialog.cancelText || "Cancel"}
          </button>
          <button
            ref={confirmButtonRef}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmButtonClass}`}
            onClick={handleConfirm}
          >
            {confirmDialog.confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
