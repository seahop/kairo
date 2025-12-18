import { useState } from "react";
import { useGitStore } from "./store";

const LockIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

/**
 * Standalone passphrase modal that renders at app level.
 * This ensures it appears on top of everything when SSH authentication is needed.
 */
export function GitPassphraseModal() {
  const {
    passphraseRequired,
    pendingKeyPath,
    submitPassphrase,
    cancelPassphrase,
  } = useGitStore();

  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!passphraseRequired || !pendingKeyPath) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    setIsSubmitting(true);
    try {
      await submitPassphrase(passphrase, remember);
      setPassphrase("");
      setRemember(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setPassphrase("");
    setRemember(false);
    cancelPassphrase();
  };

  // Extract just the filename from the key path
  const keyName = pendingKeyPath.split("/").pop() || pendingKeyPath;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center"
      onClick={handleCancel}
    >
      <div
        className="bg-dark-900 rounded-lg p-6 w-full max-w-sm border border-dark-700 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-accent-primary/20 rounded-lg text-accent-primary">
            <LockIcon />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-dark-100">SSH Passphrase</h2>
            <p className="text-xs text-dark-500">{keyName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter passphrase..."
            className="input w-full mb-4"
            autoFocus
            disabled={isSubmitting}
          />

          <label className="flex items-center gap-2 text-sm text-dark-400 cursor-pointer select-none mb-4">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
              disabled={isSubmitting}
            />
            Remember for this session
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!passphrase.trim() || isSubmitting}
            >
              {isSubmitting ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
