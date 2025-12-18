import { useState, useEffect, useRef } from "react";

const KeyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
    />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
    />
  </svg>
);

interface PassphraseModalProps {
  keyPath: string;
  onSubmit: (passphrase: string, remember: boolean) => void;
  onCancel: () => void;
}

export function PassphraseModal({ keyPath, onSubmit, onCancel }: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase) {
      onSubmit(passphrase, remember);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  // Extract just the filename from the path for display
  const keyFileName = keyPath.split("/").pop() || keyPath;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-dark-900 border border-dark-700 rounded-xl shadow-2xl max-w-md w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent-primary/10 rounded-lg text-accent-primary">
                <KeyIcon />
              </div>
              <h3 className="text-lg font-semibold text-dark-100">
                SSH Passphrase Required
              </h3>
            </div>

            {/* Description */}
            <p className="text-sm text-dark-400 mb-4">
              Enter the passphrase for your SSH key to authenticate with the
              remote repository.
            </p>

            {/* Key path */}
            <div className="mb-4 p-2 bg-dark-800 rounded-lg">
              <span className="text-xs text-dark-500 block mb-1">SSH Key</span>
              <code className="text-sm text-dark-300 break-all">{keyFileName}</code>
            </div>

            {/* Passphrase input */}
            <div className="relative mb-4">
              <input
                ref={inputRef}
                type={showPassword ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="input w-full pr-10"
                placeholder="Enter passphrase..."
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-200 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {/* Remember checkbox */}
            <label className="flex items-center gap-2 text-sm text-dark-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
              />
              Remember for this session
            </label>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 bg-dark-850 border-t border-dark-700 rounded-b-xl">
            <button
              type="button"
              className="btn-ghost"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!passphrase}
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
