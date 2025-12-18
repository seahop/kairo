//! Per-user git configuration stored in vault

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use super::error::GitError;

/// Per-user git configuration for a vault
/// Stored in vault/.kairo/.user-git-config.json (gitignored)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserGitConfig {
    /// Path to the SSH private key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_key_path: Option<String>,

    /// Type of SSH key (ed25519, rsa, etc.) - for display purposes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_key_type: Option<String>,

    /// Whether the user wants to cache the passphrase for the session
    #[serde(default)]
    pub remember_passphrase: bool,

    /// Git user name for commits (overrides global config)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_name: Option<String>,

    /// Git user email for commits (overrides global config)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_email: Option<String>,
}

impl UserGitConfig {
    /// Get the config file path for a vault
    pub fn config_path(vault_path: &Path) -> PathBuf {
        vault_path.join(".kairo").join(".user-git-config.json")
    }

    /// Read the user git config for a vault
    /// Returns default config if file doesn't exist
    pub fn read(vault_path: &Path) -> Result<Self, GitError> {
        let config_path = Self::config_path(vault_path);

        if !config_path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&config_path)?;
        serde_json::from_str(&content).map_err(|e| GitError::OperationFailed {
            message: format!("Failed to parse git config: {}", e),
        })
    }

    /// Write the user git config for a vault
    /// Also ensures the config file is gitignored
    pub fn write(&self, vault_path: &Path) -> Result<(), GitError> {
        let config_path = Self::config_path(vault_path);

        // Ensure .kairo directory exists
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Write config
        let content = serde_json::to_string_pretty(self).map_err(|e| GitError::OperationFailed {
            message: format!("Failed to serialize git config: {}", e),
        })?;
        fs::write(&config_path, content)?;

        // Ensure config is gitignored
        Self::ensure_gitignored(vault_path)?;

        Ok(())
    }

    /// Ensure the user git config file is in .gitignore
    fn ensure_gitignored(vault_path: &Path) -> Result<(), GitError> {
        let gitignore_path = vault_path.join(".gitignore");
        let gitignore_entry = ".kairo/.user-git-config.json";

        if gitignore_path.exists() {
            let content = fs::read_to_string(&gitignore_path).unwrap_or_default();
            if !content.lines().any(|line| line.trim() == gitignore_entry) {
                // Add to .gitignore
                let new_content = if content.ends_with('\n') || content.is_empty() {
                    format!("{}{}\n", content, gitignore_entry)
                } else {
                    format!("{}\n{}\n", content, gitignore_entry)
                };
                fs::write(&gitignore_path, new_content)?;
            }
        } else {
            // Create .gitignore with the entry
            fs::write(&gitignore_path, format!("{}\n", gitignore_entry))?;
        }

        Ok(())
    }

    /// Get the SSH key path, falling back to default locations
    pub fn get_ssh_key_path(&self) -> Option<PathBuf> {
        // Use configured path if available
        if let Some(ref path) = self.ssh_key_path {
            let path = PathBuf::from(shellexpand::tilde(path).to_string());
            if path.exists() {
                return Some(path);
            }
        }

        // Fall back to default SSH key locations
        if let Some(home) = dirs::home_dir() {
            let ssh_dir = home.join(".ssh");

            // Try common key names in order of preference
            let key_names = ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"];

            for name in &key_names {
                let key_path = ssh_dir.join(name);
                if key_path.exists() {
                    return Some(key_path);
                }
            }
        }

        None
    }

    /// Check if the configured SSH key exists
    pub fn ssh_key_exists(&self) -> bool {
        self.get_ssh_key_path().is_some()
    }

    /// Detect SSH key type from the key file
    pub fn detect_key_type(key_path: &Path) -> Option<String> {
        let content = fs::read_to_string(key_path).ok()?;
        let first_line = content.lines().next()?;

        if first_line.contains("ED25519") {
            Some("ed25519".to_string())
        } else if first_line.contains("ECDSA") {
            Some("ecdsa".to_string())
        } else if first_line.contains("RSA") {
            Some("rsa".to_string())
        } else if first_line.contains("DSA") {
            Some("dsa".to_string())
        } else {
            None
        }
    }

    /// Check if an SSH key file is encrypted (requires passphrase)
    pub fn key_is_encrypted(key_path: &Path) -> bool {
        if let Ok(content) = fs::read_to_string(key_path) {
            // Old PEM format has "ENCRYPTED" in the header
            if content.contains("ENCRYPTED") {
                return true;
            }

            // New OpenSSH format (-----BEGIN OPENSSH PRIVATE KEY-----)
            // We need to parse the binary content to check encryption
            // The key data is base64 encoded after the header
            if content.contains("BEGIN OPENSSH PRIVATE KEY") {
                // Try to decode and check for encryption marker
                // OpenSSH format has "none" for cipher name if unencrypted
                // We can check by trying to parse with ssh-key crate or
                // looking for the cipher field in the decoded data

                // Simple heuristic: try to load it without passphrase using git2
                // If it fails, it's likely encrypted
                if let Ok(()) = Self::try_load_key_without_passphrase(key_path) {
                    return false; // Key loaded without passphrase
                }
                return true; // Couldn't load, probably encrypted
            }

            false
        } else {
            false
        }
    }

    /// Try to load an SSH key without a passphrase to check if it's encrypted
    fn try_load_key_without_passphrase(key_path: &Path) -> Result<(), ()> {
        use std::process::Command;

        // Use ssh-keygen to check if key needs passphrase
        // ssh-keygen -y -P "" -f <keyfile> will fail if passphrase needed
        let output = Command::new("ssh-keygen")
            .args(["-y", "-P", "", "-f"])
            .arg(key_path)
            .output();

        match output {
            Ok(result) if result.status.success() => Ok(()),
            _ => Err(()),
        }
    }
}

/// Expand shell tilde in paths
mod shellexpand {
    use std::borrow::Cow;

    pub fn tilde(path: &str) -> Cow<'_, str> {
        if path.starts_with("~/") {
            if let Some(home) = dirs::home_dir() {
                return Cow::Owned(format!("{}{}", home.display(), &path[1..]));
            }
        }
        Cow::Borrowed(path)
    }
}
