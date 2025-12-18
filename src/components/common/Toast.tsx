import { useState } from "react";
import { create } from "zustand";
import { CloseIcon } from "@/components/common/Icons";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto-remove after duration
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Helper functions
export const toast = {
  success: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: "success", title, message }),
  error: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: "error", title, message, duration: 6000 }),
  info: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: "info", title, message }),
  warning: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: "warning", title, message }),
};

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);


function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200);
  };

  const iconMap = {
    success: <CheckIcon />,
    error: <ErrorIcon />,
    info: <InfoIcon />,
    warning: <WarningIcon />,
  };

  const colorMap = {
    success: "bg-green-950 border-green-800 text-green-100",
    error: "bg-red-950 border-red-800 text-red-100",
    info: "bg-blue-950 border-blue-800 text-blue-100",
    warning: "bg-yellow-950 border-yellow-800 text-yellow-100",
  };

  const iconColorMap = {
    success: "text-green-400",
    error: "text-red-400",
    info: "text-blue-400",
    warning: "text-yellow-400",
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg
        transition-all duration-200 ease-out min-w-[300px] max-w-[400px]
        transform-gpu [backface-visibility:hidden]
        ${colorMap[toast.type]}
        ${isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
      `}
    >
      <span className={iconColorMap[toast.type]}>{iconMap[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{toast.title}</p>
        {toast.message && (
          <p className="text-xs mt-0.5 opacity-80 truncate">{toast.message}</p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="p-1 text-dark-300 rounded"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-14 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
