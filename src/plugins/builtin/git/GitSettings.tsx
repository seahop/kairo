import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const XCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

export interface UserGitConfig {
  sshKeyPath: string | null;
  sshKeyType: string | null;
  rememberPassphrase: boolean;
  userName: string | null;
  userEmail: string | null;
}

interface SshKeyInfo {
  exists: boolean;
  encrypted: boolean;
  keyType: string | null;
}

export function GitSettings() {
  const [config, setConfig] = useState<UserGitConfig | null>(null);
  const [keyInfo, setKeyInfo] = useState<SshKeyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local form state
  const [sshKeyPath, setSshKeyPath] = useState("");
  const [rememberPassphrase, setRememberPassphrase] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (sshKeyPath) {
      checkSshKey(sshKeyPath);
    } else {
      setKeyInfo(null);
    }
  }, [sshKeyPath]);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const cfg = await invoke<UserGitConfig>("git_get_user_config");
      setConfig(cfg);
      setSshKeyPath(cfg.sshKeyPath || "");
      setRememberPassphrase(cfg.rememberPassphrase);
      setUserName(cfg.userName || "");
      setUserEmail(cfg.userEmail || "");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const checkSshKey = async (path: string) => {
    try {
      const info = await invoke<SshKeyInfo>("git_check_ssh_key", { keyPath: path });
      setKeyInfo(info);
    } catch {
      setKeyInfo(null);
    }
  };

  const selectKeyFile = async () => {
    try {
      const selected = await open({
        title: "Select SSH Private Key",
        directory: false,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        setSshKeyPath(selected);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const saveConfig = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const newConfig: UserGitConfig = {
        sshKeyPath: sshKeyPath || null,
        sshKeyType: keyInfo?.keyType || null,
        rememberPassphrase,
        userName: userName || null,
        userEmail: userEmail || null,
      };

      await invoke("git_set_user_config", { config: newConfig });
      setConfig(newConfig);
      setSuccessMessage("Settings saved successfully");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    if (!config) return false;
    return (
      (sshKeyPath || null) !== config.sshKeyPath ||
      rememberPassphrase !== config.rememberPassphrase ||
      (userName || null) !== config.userName ||
      (userEmail || null) !== config.userEmail
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-dark-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="p-3 bg-green-900/20 border border-green-800 rounded-lg text-green-400 text-sm flex items-center gap-2">
          <CheckCircleIcon />
          {successMessage}
        </div>
      )}

      {/* SSH Key Section */}
      <div>
        <h3 className="text-sm font-medium text-dark-200 mb-3">SSH Key</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={sshKeyPath}
              onChange={(e) => setSshKeyPath(e.target.value)}
              className="input flex-1"
              placeholder="~/.ssh/id_ed25519"
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={selectKeyFile}
            >
              <FolderIcon />
              <span className="ml-2">Browse</span>
            </button>
          </div>

          {/* Key status */}
          {sshKeyPath && keyInfo && (
            <div className="flex items-center gap-2 text-sm">
              {keyInfo.exists ? (
                <>
                  <CheckCircleIcon />
                  <span className="text-accent-success">Key found</span>
                  {keyInfo.keyType && (
                    <span className="text-dark-500">({keyInfo.keyType})</span>
                  )}
                  {keyInfo.encrypted && (
                    <span className="flex items-center gap-1 text-accent-warning">
                      <LockIcon />
                      Encrypted
                    </span>
                  )}
                </>
              ) : (
                <>
                  <XCircleIcon />
                  <span className="text-red-400">Key not found</span>
                </>
              )}
            </div>
          )}

          {/* Remember passphrase option */}
          {keyInfo?.encrypted && (
            <label className="flex items-center gap-2 text-sm text-dark-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberPassphrase}
                onChange={(e) => setRememberPassphrase(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
              />
              Remember passphrase for this session
            </label>
          )}
        </div>
      </div>

      {/* Git Identity Section */}
      <div>
        <h3 className="text-sm font-medium text-dark-200 mb-3">Git Identity (Optional)</h3>
        <p className="text-xs text-dark-500 mb-3">
          Override git config for commits in this vault. Leave empty to use global git config.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-dark-500 mb-1 block">Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="input w-full"
              placeholder="Your Name"
            />
          </div>
          <div>
            <label className="text-xs text-dark-500 mb-1 block">Email</label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="input w-full"
              placeholder="you@example.com"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-4 border-t border-dark-800">
        <button
          type="button"
          className="btn-primary"
          onClick={saveConfig}
          disabled={isSaving || !hasChanges()}
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Info note */}
      <div className="text-xs text-dark-500 p-3 bg-dark-800/50 rounded-lg">
        <strong className="text-dark-400">Note:</strong> These settings are stored locally
        in your vault and are not shared with other users. The config file is automatically
        added to .gitignore.
      </div>
    </div>
  );
}
