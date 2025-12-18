//! Core git2 operations for repository management

use git2::{
    build::CheckoutBuilder, Cred, FetchOptions, IndexAddOption, PushOptions, RemoteCallbacks,
    Repository, Signature, StatusOptions,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

use super::config::UserGitConfig;
use super::error::GitError;

/// Git repository status
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub ahead: i32,
    pub behind: i32,
    pub staged: Vec<String>,
    pub modified: Vec<String>,
    pub untracked: Vec<String>,
    pub has_remote: bool,
}

/// Note version information from git history
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteVersion {
    pub commit_hash: String,
    pub short_hash: String,
    pub date: i64,
    pub message: String,
    pub author: String,
}

/// Credential configuration for git operations
pub struct CredentialConfig<'a> {
    pub ssh_key_path: Option<&'a Path>,
    pub passphrase: Option<&'a str>,
}

impl<'a> CredentialConfig<'a> {
    /// Create callback for git2 remote operations
    pub fn create_callbacks(&self) -> RemoteCallbacks<'a> {
        let ssh_key_path = self.ssh_key_path.map(|p| p.to_path_buf());
        let passphrase = self.passphrase.map(|s| s.to_string());

        let mut callbacks = RemoteCallbacks::new();

        callbacks.credentials(move |_url, username_from_url, allowed_types| {
            let username = username_from_url.unwrap_or("git");

            // Try SSH key first
            if allowed_types.contains(git2::CredentialType::SSH_KEY) {
                if let Some(ref key_path) = ssh_key_path {
                    return Cred::ssh_key(username, None, key_path, passphrase.as_deref());
                }

                // Try default SSH key locations
                if let Some(home) = dirs::home_dir() {
                    let ssh_dir = home.join(".ssh");
                    for name in &["id_ed25519", "id_ecdsa", "id_rsa"] {
                        let key = ssh_dir.join(name);
                        if key.exists() {
                            return Cred::ssh_key(username, None, &key, passphrase.as_deref());
                        }
                    }
                }
            }

            // Try SSH agent (USERNAME is used for agent-based auth)
            if allowed_types.contains(git2::CredentialType::USERNAME) {
                if let Ok(cred) = Cred::ssh_key_from_agent(username) {
                    return Ok(cred);
                }
            }

            // Try default credentials (for HTTPS)
            if allowed_types.contains(git2::CredentialType::DEFAULT) {
                return Cred::default();
            }

            Err(git2::Error::from_str(
                "No valid authentication method found",
            ))
        });

        callbacks
    }
}

/// Get the status of a git repository
pub fn get_status(repo: &Repository) -> Result<GitStatus, GitError> {
    // Get current branch
    let branch = match repo.head() {
        Ok(head) => head.shorthand().unwrap_or("HEAD").to_string(),
        Err(_) => "HEAD".to_string(),
    };

    // Check for remotes
    let remotes = repo.remotes()?;
    let has_remote = !remotes.is_empty();

    // Get ahead/behind counts
    let (ahead, behind) = if has_remote {
        get_ahead_behind(repo).unwrap_or((0, 0))
    } else {
        (0, 0)
    };

    // Get file statuses
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts))?;

    let mut staged = vec![];
    let mut modified = vec![];
    let mut untracked = vec![];

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        // Staged files
        if status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_index_renamed()
        {
            staged.push(path.clone());
        }

        // Modified in worktree
        if (status.is_wt_modified() || status.is_wt_deleted()) && !staged.contains(&path) {
            modified.push(path.clone());
        }

        // Untracked
        if status.is_wt_new() && !status.is_index_new() {
            untracked.push(path);
        }
    }

    Ok(GitStatus {
        is_repo: true,
        branch,
        ahead,
        behind,
        staged,
        modified,
        untracked,
        has_remote,
    })
}

/// Get ahead/behind counts relative to upstream
fn get_ahead_behind(repo: &Repository) -> Result<(i32, i32), GitError> {
    let head = repo.head()?;

    // Get the upstream branch
    let branch = repo.find_branch(head.shorthand().unwrap_or("HEAD"), git2::BranchType::Local)?;

    let upstream = match branch.upstream() {
        Ok(u) => u,
        Err(_) => return Ok((0, 0)), // No upstream configured
    };

    let local_oid = head.target().ok_or(GitError::InvalidReference {
        reference: "HEAD".to_string(),
    })?;

    let upstream_oid = upstream.get().target().ok_or(GitError::InvalidReference {
        reference: "upstream".to_string(),
    })?;

    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;

    Ok((ahead as i32, behind as i32))
}

/// Fetch from remote
pub fn fetch(repo: &Repository, creds: &CredentialConfig) -> Result<(), GitError> {
    let mut remote = repo.find_remote("origin").map_err(|_| GitError::NoRemote)?;

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(creds.create_callbacks());

    let refspecs: &[&str] = &[];
    remote.fetch(refspecs, Some(&mut fetch_opts), None)?;

    Ok(())
}

/// Pull from remote (fetch + merge)
pub fn pull(repo: &Repository, creds: &CredentialConfig) -> Result<String, GitError> {
    // Fetch first
    fetch(repo, creds)?;

    // Get the current branch
    let head = repo.head()?;
    let branch_name = head.shorthand().unwrap_or("HEAD");

    // Find the FETCH_HEAD reference
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;

    // Perform merge analysis
    let (analysis, _preference) = repo.merge_analysis(&[&fetch_commit])?;

    if analysis.is_up_to_date() {
        return Ok("Already up to date".to_string());
    }

    if analysis.is_fast_forward() {
        // Fast-forward merge
        let mut reference = repo.find_reference(&format!("refs/heads/{}", branch_name))?;
        reference.set_target(fetch_commit.id(), "Fast-forward pull")?;

        // Checkout the updated HEAD
        let mut checkout_opts = CheckoutBuilder::new();
        checkout_opts.force();
        repo.checkout_head(Some(&mut checkout_opts))?;

        Ok(format!(
            "Fast-forwarded to {}",
            &fetch_commit.id().to_string()[..7]
        ))
    } else if analysis.is_normal() {
        // Normal merge required
        Err(GitError::MergeRequired)
    } else {
        Err(GitError::OperationFailed {
            message: "Unable to determine merge strategy".to_string(),
        })
    }
}

/// Push to remote
pub fn push(repo: &Repository, creds: &CredentialConfig) -> Result<String, GitError> {
    let mut remote = repo.find_remote("origin").map_err(|_| GitError::NoRemote)?;

    // Get current branch
    let head = repo.head()?;
    let branch_name = head.shorthand().unwrap_or("HEAD");
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(creds.create_callbacks());

    remote.push(&[&refspec], Some(&mut push_opts))?;

    Ok(format!("Pushed to origin/{}", branch_name))
}

/// Stage all changes
pub fn stage_all(repo: &Repository) -> Result<(), GitError> {
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

/// Stage a specific file
pub fn stage_file(repo: &Repository, path: &str) -> Result<(), GitError> {
    let mut index = repo.index()?;
    index.add_path(Path::new(path))?;
    index.write()?;
    Ok(())
}

/// Unstage a specific file
pub fn unstage_file(repo: &Repository, path: &str) -> Result<(), GitError> {
    let head = repo.head()?;
    let head_commit = head.peel_to_commit()?;

    repo.reset_default(Some(&head_commit.into_object()), [Path::new(path)])?;

    Ok(())
}

/// Commit staged changes
pub fn commit(
    repo: &Repository,
    message: &str,
    config: &UserGitConfig,
) -> Result<String, GitError> {
    if message.trim().is_empty() {
        return Err(GitError::OperationFailed {
            message: "Commit message cannot be empty".to_string(),
        });
    }

    // Get signature
    let signature = get_signature(repo, config)?;

    // Get the current index
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    // Get parent commit(s)
    let parents = match repo.head() {
        Ok(head) => {
            let commit = head.peel_to_commit()?;
            vec![commit]
        }
        Err(_) => vec![], // Initial commit
    };

    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    // Create the commit
    let oid = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        &parent_refs,
    )?;

    Ok(format!("Committed: {}", &oid.to_string()[..7]))
}

/// Get the signature for commits
fn get_signature(
    repo: &Repository,
    config: &UserGitConfig,
) -> Result<Signature<'static>, GitError> {
    // Try user-provided config first
    if let (Some(name), Some(email)) = (&config.user_name, &config.user_email) {
        return Signature::now(name, email).map_err(|e| GitError::OperationFailed {
            message: format!("Invalid signature: {}", e),
        });
    }

    // Fall back to git config
    let git_config = repo.config()?;

    let name = git_config
        .get_string("user.name")
        .unwrap_or_else(|_| "Kairo User".to_string());

    let email = git_config
        .get_string("user.email")
        .unwrap_or_else(|_| "user@kairo.local".to_string());

    Signature::now(&name, &email).map_err(|e| GitError::OperationFailed {
        message: format!("Invalid signature: {}", e),
    })
}

/// Get the history of a note file
pub fn get_note_history(repo: &Repository, note_path: &str) -> Result<Vec<NoteVersion>, GitError> {
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;

    let mut versions = Vec::new();

    for oid in revwalk {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;

        // Check if this commit affected the note file
        let dominated_by_note = commit_affects_path(repo, &commit, note_path)?;

        if dominated_by_note {
            let time = commit.time();
            versions.push(NoteVersion {
                commit_hash: oid.to_string(),
                short_hash: oid.to_string()[..7].to_string(),
                date: time.seconds(),
                message: commit.message().unwrap_or("").to_string(),
                author: commit.author().name().unwrap_or("Unknown").to_string(),
            });
        }
    }

    Ok(versions)
}

/// Check if a commit affects a specific path
fn commit_affects_path(
    _repo: &Repository,
    commit: &git2::Commit,
    path: &str,
) -> Result<bool, GitError> {
    let tree = commit.tree()?;

    // Check if path exists in this commit
    let exists_in_commit = tree.get_path(Path::new(path)).is_ok();

    // Check parent
    if commit.parent_count() == 0 {
        // Initial commit - check if file exists
        return Ok(exists_in_commit);
    }

    let parent = commit.parent(0)?;
    let parent_tree = parent.tree()?;
    let exists_in_parent = parent_tree.get_path(Path::new(path)).is_ok();

    // File was added, modified, or deleted
    if exists_in_commit != exists_in_parent {
        return Ok(true);
    }

    // Check if content changed
    if exists_in_commit && exists_in_parent {
        let current_entry = tree.get_path(Path::new(path))?;
        let parent_entry = parent_tree.get_path(Path::new(path))?;
        return Ok(current_entry.id() != parent_entry.id());
    }

    Ok(false)
}

/// Get the content of a note at a specific commit
pub fn get_note_at_commit(
    repo: &Repository,
    note_path: &str,
    commit_hash: &str,
) -> Result<String, GitError> {
    let oid = git2::Oid::from_str(commit_hash).map_err(|_| GitError::InvalidReference {
        reference: commit_hash.to_string(),
    })?;

    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;

    let entry = tree
        .get_path(Path::new(note_path))
        .map_err(|_| GitError::FileNotFound {
            path: note_path.to_string(),
        })?;

    let blob = repo.find_blob(entry.id())?;
    let content = std::str::from_utf8(blob.content()).map_err(|_| GitError::OperationFailed {
        message: "File content is not valid UTF-8".to_string(),
    })?;

    Ok(content.to_string())
}
