//! Git error types with frontend-friendly serialization

use serde::Serialize;
use thiserror::Error;

/// Git operation errors that can be serialized to the frontend
#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum GitError {
    #[error("Not a git repository")]
    NotARepo,

    #[error("No vault is currently open")]
    NoVaultOpen,

    #[error("Authentication required")]
    AuthRequired {
        #[serde(rename = "authMethod")]
        method: String,
    },

    #[error("Passphrase required for SSH key")]
    PassphraseRequired {
        #[serde(rename = "keyPath")]
        key_path: String,
    },

    #[error("Authentication failed: {message}")]
    AuthFailed { message: String },

    #[error("Network error: {message}")]
    NetworkError { message: String },

    #[error("Merge required - cannot fast-forward")]
    MergeRequired,

    #[error("Repository has no commits yet")]
    EmptyRepository,

    #[error("No remote configured")]
    NoRemote,

    #[error("Invalid reference: {reference}")]
    InvalidReference { reference: String },

    #[error("File not found: {path}")]
    FileNotFound { path: String },

    #[error("Operation failed: {message}")]
    OperationFailed { message: String },
}

impl GitError {
    /// Check if this error indicates authentication is needed
    pub fn is_auth_error(&self) -> bool {
        matches!(
            self,
            GitError::AuthRequired { .. }
                | GitError::PassphraseRequired { .. }
                | GitError::AuthFailed { .. }
        )
    }

    /// Check if this error is recoverable with user action
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            GitError::PassphraseRequired { .. }
                | GitError::AuthRequired { .. }
                | GitError::MergeRequired
        )
    }
}

impl From<git2::Error> for GitError {
    fn from(err: git2::Error) -> Self {
        let message = err.message().to_string();
        let code = err.code();
        let class = err.class();

        // Check for authentication-related errors
        if class == git2::ErrorClass::Ssh || class == git2::ErrorClass::Net {
            if message.contains("authentication")
                || message.contains("credential")
                || message.contains("publickey")
            {
                return GitError::AuthFailed { message };
            }
            if message.contains("resolve host")
                || message.contains("network")
                || message.contains("connection")
            {
                return GitError::NetworkError { message };
            }
        }

        // Check for specific error codes
        match code {
            git2::ErrorCode::NotFound => {
                if message.contains("remote") {
                    GitError::NoRemote
                } else {
                    GitError::OperationFailed { message }
                }
            }
            git2::ErrorCode::Auth => GitError::AuthFailed { message },
            git2::ErrorCode::UnbornBranch => GitError::EmptyRepository,
            _ => GitError::OperationFailed { message },
        }
    }
}

impl From<std::io::Error> for GitError {
    fn from(err: std::io::Error) -> Self {
        GitError::OperationFailed {
            message: err.to_string(),
        }
    }
}

// Allow GitError to be returned as String for Tauri commands
impl From<GitError> for String {
    fn from(err: GitError) -> Self {
        // Serialize to JSON for structured error handling on frontend
        serde_json::to_string(&err).unwrap_or_else(|_| err.to_string())
    }
}
