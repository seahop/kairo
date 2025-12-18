//! Session-based credential caching for git operations
//! Passphrases are XOR-obfuscated in memory to prevent casual memory scraping

use rand::Rng;
use std::collections::HashMap;
use std::sync::Mutex;

/// An obfuscated passphrase stored with its XOR key
/// The passphrase is XOR'd with a random key of the same length
struct ObfuscatedPassphrase {
    /// XOR-obfuscated passphrase bytes
    data: Vec<u8>,
    /// Random key used for XOR obfuscation
    key: Vec<u8>,
}

impl ObfuscatedPassphrase {
    /// Create a new obfuscated passphrase from plaintext
    fn new(passphrase: &str) -> Self {
        let passphrase_bytes = passphrase.as_bytes();
        let mut rng = rand::rng();

        // Generate a random key the same length as the passphrase
        let key: Vec<u8> = (0..passphrase_bytes.len()).map(|_| rng.random()).collect();

        // XOR the passphrase with the key
        let data: Vec<u8> = passphrase_bytes
            .iter()
            .zip(key.iter())
            .map(|(p, k)| p ^ k)
            .collect();

        Self { data, key }
    }

    /// Recover the plaintext passphrase
    fn decrypt(&self) -> String {
        let decrypted: Vec<u8> = self
            .data
            .iter()
            .zip(self.key.iter())
            .map(|(d, k)| d ^ k)
            .collect();

        String::from_utf8_lossy(&decrypted).into_owned()
    }
}

/// Session-based cache for SSH passphrases
/// Passphrases are XOR-obfuscated in memory and never persisted to disk
#[derive(Default)]
pub struct CredentialCache {
    /// Map of SSH key path -> obfuscated passphrase
    passphrases: HashMap<String, ObfuscatedPassphrase>,
}

impl CredentialCache {
    /// Create a new empty credential cache
    pub fn new() -> Self {
        Self {
            passphrases: HashMap::new(),
        }
    }

    /// Get a cached passphrase for an SSH key (decrypts on access)
    pub fn get_passphrase(&self, key_path: &str) -> Option<String> {
        self.passphrases.get(key_path).map(|p| p.decrypt())
    }

    /// Store a passphrase for an SSH key (encrypts before storing)
    pub fn set_passphrase(&mut self, key_path: &str, passphrase: String) {
        self.passphrases
            .insert(key_path.to_string(), ObfuscatedPassphrase::new(&passphrase));
    }

    /// Remove a cached passphrase
    pub fn remove_passphrase(&mut self, key_path: &str) {
        self.passphrases.remove(key_path);
    }

    /// Clear all cached credentials
    pub fn clear(&mut self) {
        self.passphrases.clear();
    }

    /// Check if we have a cached passphrase for a key
    #[allow(dead_code)]
    pub fn has_passphrase(&self, key_path: &str) -> bool {
        self.passphrases.contains_key(key_path)
    }
}

/// Global credential state managed by Tauri
/// Use `app.state::<Mutex<GitCredentialState>>()` to access
#[derive(Default)]
pub struct GitCredentialState {
    pub cache: CredentialCache,
}

impl GitCredentialState {
    /// Create a new credential state
    pub fn new() -> Self {
        Self {
            cache: CredentialCache::new(),
        }
    }

    /// Get a cached passphrase for an SSH key
    pub fn get_passphrase(&self, key_path: &str) -> Option<String> {
        self.cache.get_passphrase(key_path)
    }

    /// Store a passphrase for an SSH key in the session cache
    pub fn set_passphrase(&mut self, key_path: &str, passphrase: String) {
        self.cache.set_passphrase(key_path, passphrase);
    }

    /// Remove a cached passphrase
    #[allow(dead_code)]
    pub fn remove_passphrase(&mut self, key_path: &str) {
        self.cache.remove_passphrase(key_path);
    }

    /// Clear all cached credentials (e.g., on vault close or app exit)
    pub fn clear(&mut self) {
        self.cache.clear();
    }
}

/// Helper type for managing credential state in Tauri
pub type ManagedCredentialState = Mutex<GitCredentialState>;

/// Create a new managed credential state for Tauri
pub fn create_credential_state() -> ManagedCredentialState {
    Mutex::new(GitCredentialState::new())
}
