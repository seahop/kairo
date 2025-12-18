//! Git integration using git2-rs library
//!
//! This module provides native git operations with SSH authentication support.
//! Per-user configuration is stored in vault/.kairo/.user-git-config.json (gitignored).

pub mod config;
pub mod credentials;
pub mod error;
pub mod operations;

use std::path::PathBuf;
use std::sync::Mutex;

use git2::Repository;
use tauri::{AppHandle, Manager};

use crate::db;
pub use config::UserGitConfig;
pub use credentials::{create_credential_state, GitCredentialState};
pub use error::GitError;
pub use operations::{GitStatus, NoteVersion};

// Re-export for Tauri command registration
use operations::CredentialConfig;

/// Get the vault path from app state
fn get_vault_path(app: &AppHandle) -> Result<PathBuf, GitError> {
    db::get_current_vault_path(app).ok_or(GitError::NoVaultOpen)
}

/// Open a git repository at the vault path
fn open_repo(vault_path: &PathBuf) -> Result<Repository, GitError> {
    Repository::open(vault_path).map_err(|_| GitError::NotARepo)
}

/// Get credential config from app state and user config
fn get_cred_config<'a>(
    app: &AppHandle,
    vault_path: &PathBuf,
    passphrase: Option<&'a str>,
) -> Result<(UserGitConfig, Option<PathBuf>, Option<String>), GitError> {
    let user_config = UserGitConfig::read(vault_path)?;

    // Get SSH key path
    let ssh_key_path = user_config.get_ssh_key_path();

    // Get cached passphrase if available and no passphrase provided
    let cached_passphrase: Option<String> = if passphrase.is_none() && user_config.remember_passphrase {
        if let Some(ref key_path) = ssh_key_path {
            let cred_state = app.state::<Mutex<GitCredentialState>>();
            let result = cred_state
                .lock()
                .ok()
                .and_then(|state| state.get_passphrase(&key_path.to_string_lossy()));
            result
        } else {
            None
        }
    } else {
        passphrase.map(|s| s.to_string())
    };

    Ok((user_config, ssh_key_path, cached_passphrase))
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Get git status for the vault
#[tauri::command]
pub fn git_status(app: AppHandle) -> Result<GitStatus, String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;

    // Check if it's a git repo
    let repo = match Repository::open(&vault_path) {
        Ok(repo) => repo,
        Err(_) => return Ok(GitStatus::default()),
    };

    operations::get_status(&repo).map_err(|e| e.to_string())
}

/// Pull from remote
#[tauri::command]
pub async fn git_pull(app: AppHandle, passphrase: Option<String>) -> Result<String, String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;

    let (_user_config, ssh_key_path, cached_pass) =
        get_cred_config(&app, &vault_path, passphrase.as_deref()).map_err(|e| e.to_string())?;

    let final_passphrase = passphrase.or(cached_pass);

    let creds = CredentialConfig {
        ssh_key_path: ssh_key_path.as_deref(),
        passphrase: final_passphrase.as_deref(),
    };

    // Check if passphrase might be needed
    if let Some(ref key_path) = ssh_key_path {
        if UserGitConfig::key_is_encrypted(key_path) && final_passphrase.is_none() {
            return Err(serde_json::to_string(&GitError::PassphraseRequired {
                key_path: key_path.to_string_lossy().to_string(),
            })
            .unwrap());
        }
    }

    let result = operations::pull(&repo, &creds)
        .map_err(|e| serde_json::to_string(&e).unwrap_or(e.to_string()))?;

    // Re-index the vault to pick up any new/changed files from the pull
    db::index_vault(&app, &vault_path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Push to remote
#[tauri::command]
pub fn git_push(app: AppHandle, passphrase: Option<String>) -> Result<String, String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;

    let (_user_config, ssh_key_path, cached_pass) =
        get_cred_config(&app, &vault_path, passphrase.as_deref()).map_err(|e| e.to_string())?;

    let final_passphrase = passphrase.or(cached_pass);

    let creds = CredentialConfig {
        ssh_key_path: ssh_key_path.as_deref(),
        passphrase: final_passphrase.as_deref(),
    };

    // Check if passphrase might be needed
    if let Some(ref key_path) = ssh_key_path {
        if UserGitConfig::key_is_encrypted(key_path) && final_passphrase.is_none() {
            return Err(serde_json::to_string(&GitError::PassphraseRequired {
                key_path: key_path.to_string_lossy().to_string(),
            })
            .unwrap());
        }
    }

    operations::push(&repo, &creds).map_err(|e| serde_json::to_string(&e).unwrap_or(e.to_string()))
}

/// Stage all changes
#[tauri::command]
pub fn git_stage_all(app: AppHandle) -> Result<(), String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;

    operations::stage_all(&repo).map_err(|e| e.to_string())
}

/// Stage a specific file
#[tauri::command]
pub fn git_stage_file(app: AppHandle, path: String) -> Result<(), String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;

    operations::stage_file(&repo, &path).map_err(|e| e.to_string())
}

/// Unstage a specific file
#[tauri::command]
pub fn git_unstage_file(app: AppHandle, path: String) -> Result<(), String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;

    operations::unstage_file(&repo, &path).map_err(|e| e.to_string())
}

/// Commit staged changes
#[tauri::command]
pub fn git_commit(app: AppHandle, message: String) -> Result<String, String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;
    let user_config = UserGitConfig::read(&vault_path).map_err(|e| e.to_string())?;

    operations::commit(&repo, &message, &user_config).map_err(|e| e.to_string())
}

// ============================================================================
// User Configuration Commands
// ============================================================================

/// Get user git configuration for the current vault
#[tauri::command]
pub fn git_get_user_config(app: AppHandle) -> Result<UserGitConfig, String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    UserGitConfig::read(&vault_path).map_err(|e| e.to_string())
}

/// Set user git configuration for the current vault
#[tauri::command]
pub fn git_set_user_config(app: AppHandle, config: UserGitConfig) -> Result<(), String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    config.write(&vault_path).map_err(|e| e.to_string())
}

/// Store a passphrase in the session cache
#[tauri::command]
pub fn git_set_session_passphrase(
    app: AppHandle,
    key_path: String,
    passphrase: String,
) -> Result<(), String> {
    let cred_state = app.state::<Mutex<GitCredentialState>>();
    let mut state = cred_state.lock().map_err(|e| e.to_string())?;
    state.set_passphrase(&key_path, passphrase);
    Ok(())
}

/// Clear all cached credentials
#[tauri::command]
pub fn git_clear_session_credentials(app: AppHandle) -> Result<(), String> {
    let cred_state = app.state::<Mutex<GitCredentialState>>();
    let mut state = cred_state.lock().map_err(|e| e.to_string())?;
    state.clear();
    Ok(())
}

/// Check if an SSH key exists and if it's encrypted
#[tauri::command]
pub fn git_check_ssh_key(key_path: String) -> Result<SshKeyInfo, String> {
    use std::path::Path;

    let path = Path::new(&key_path);

    if !path.exists() {
        return Ok(SshKeyInfo {
            exists: false,
            encrypted: false,
            key_type: None,
        });
    }

    let encrypted = UserGitConfig::key_is_encrypted(path);
    let key_type = UserGitConfig::detect_key_type(path);

    Ok(SshKeyInfo {
        exists: true,
        encrypted,
        key_type,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyInfo {
    pub exists: bool,
    pub encrypted: bool,
    pub key_type: Option<String>,
}

// ============================================================================
// Note History Commands
// ============================================================================

/// Get the version history of a note
#[tauri::command]
pub fn git_note_history(app: AppHandle, note_path: String) -> Result<Vec<NoteVersion>, String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;

    operations::get_note_history(&repo, &note_path).map_err(|e| e.to_string())
}

/// Get the content of a note at a specific commit
#[tauri::command]
pub fn git_note_at_commit(
    app: AppHandle,
    note_path: String,
    commit_hash: String,
) -> Result<String, String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;

    operations::get_note_at_commit(&repo, &note_path, &commit_hash).map_err(|e| e.to_string())
}

/// Restore a note to a specific version (creates a new commit)
#[tauri::command]
pub fn git_restore_note_version(
    app: AppHandle,
    note_path: String,
    commit_hash: String,
) -> Result<String, String> {
    let vault_path = get_vault_path(&app).map_err(|e| e.to_string())?;
    let repo = open_repo(&vault_path).map_err(|e| e.to_string())?;
    let user_config = UserGitConfig::read(&vault_path).map_err(|e| e.to_string())?;

    // Get the content at the specified commit
    let content =
        operations::get_note_at_commit(&repo, &note_path, &commit_hash).map_err(|e| e.to_string())?;

    // Write the content to the file
    let full_path = vault_path.join(&note_path);
    std::fs::write(&full_path, &content).map_err(|e| e.to_string())?;

    // Stage and commit
    operations::stage_file(&repo, &note_path).map_err(|e| e.to_string())?;
    let message = format!(
        "Restore {} to version {}",
        note_path,
        &commit_hash[..7.min(commit_hash.len())]
    );
    operations::commit(&repo, &message, &user_config).map_err(|e| e.to_string())
}
