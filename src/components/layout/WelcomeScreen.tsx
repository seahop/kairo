import { useState } from "react";
import { useVaultStore } from "@/stores/vaultStore";
import { open } from "@tauri-apps/plugin-dialog";

const FolderOpenIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
  </svg>
);

const PlusCircleIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export function WelcomeScreen() {
  const { openVault, createVault, isLoading, error, recentVaults } = useVaultStore();
  const [isCreating, setIsCreating] = useState(false);
  const [vaultName, setVaultName] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleOpenVault = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Vault Folder",
      });

      if (selected && typeof selected === "string") {
        await openVault(selected);
      }
    } catch (err) {
      console.error("Failed to open vault:", err);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Folder for New Vault",
      });

      if (selected && typeof selected === "string") {
        setSelectedPath(selected);
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  };

  const handleCreateVault = async () => {
    if (!selectedPath || !vaultName.trim()) return;

    try {
      const fullPath = `${selectedPath}/${vaultName.trim().replace(/\s+/g, "-").toLowerCase()}`;
      await createVault(fullPath, vaultName.trim());
    } catch (err) {
      console.error("Failed to create vault:", err);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-dark-950">
      <div className="max-w-lg w-full px-8">
        {/* Logo / Title */}
        <div className="text-center mb-12">
          <img
            src="/icon.png"
            alt="Kairo"
            className="w-20 h-20 mx-auto mb-4 rounded-2xl"
          />
          <h1 className="text-4xl font-bold text-dark-50 mb-2">Kairo</h1>
          <p className="text-dark-400">Team note-taking, reimagined</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {!isCreating ? (
          /* Main options */
          <div className="space-y-4">
            <button
              className="w-full p-6 card hover:border-accent-primary transition-colors flex items-center gap-4"
              onClick={handleOpenVault}
              disabled={isLoading}
            >
              <div className="text-accent-primary">
                <FolderOpenIcon />
              </div>
              <div className="text-left">
                <div className="font-semibold text-dark-100">Open Vault</div>
                <div className="text-sm text-dark-400">
                  Open an existing Kairo vault
                </div>
              </div>
            </button>

            <button
              className="w-full p-6 card hover:border-accent-primary transition-colors flex items-center gap-4"
              onClick={() => setIsCreating(true)}
              disabled={isLoading}
            >
              <div className="text-accent-secondary">
                <PlusCircleIcon />
              </div>
              <div className="text-left">
                <div className="font-semibold text-dark-100">Create New Vault</div>
                <div className="text-sm text-dark-400">
                  Start fresh with a new vault
                </div>
              </div>
            </button>

            {/* Recent Vaults */}
            {recentVaults.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 text-dark-400 mb-3">
                  <ClockIcon />
                  <span className="text-sm font-medium">Recent Vaults</span>
                </div>
                <div className="space-y-2">
                  {recentVaults.slice(0, 5).map((vault) => (
                    <button
                      key={vault.path}
                      className="w-full p-3 bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-dark-600 rounded-lg transition-colors text-left group"
                      onClick={() => openVault(vault.path)}
                      disabled={isLoading}
                    >
                      <div className="font-medium text-dark-200 group-hover:text-accent-primary">
                        {vault.name}
                      </div>
                      <div className="text-xs text-dark-500 truncate">
                        {vault.path}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Create vault form */
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-dark-100">Create New Vault</h2>

            <div>
              <label className="block text-sm text-dark-400 mb-1">Vault Name</label>
              <input
                type="text"
                className="input"
                placeholder="My Team Notes"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-1">Location</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Select a folder..."
                  value={selectedPath || ""}
                  readOnly
                />
                <button className="btn-secondary" onClick={handleSelectFolder}>
                  Browse
                </button>
              </div>
            </div>

            {selectedPath && vaultName && (
              <div className="text-sm text-dark-500">
                Vault will be created at:{" "}
                <span className="text-dark-300">
                  {selectedPath}/{vaultName.trim().replace(/\s+/g, "-").toLowerCase()}
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setIsCreating(false);
                  setVaultName("");
                  setSelectedPath(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={handleCreateVault}
                disabled={!selectedPath || !vaultName.trim() || isLoading}
              >
                {isLoading ? "Creating..." : "Create Vault"}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-dark-600">
          <p>Kairo v0.1.0</p>
        </div>
      </div>
    </div>
  );
}
