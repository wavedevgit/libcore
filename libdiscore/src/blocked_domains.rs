//! `BlockedDomainsStore` — MD5/hash-based domain blocklist.
//!
//! Recovered from the fetcher flow in `blockeddomainsstore_startFetching...`
//! (listing 132394-132537) and the planted strings:
//!
//! * endpoint: `https://cdn.discordapp.com/bad-domains/updated_hashes.json`
//! * `"Sending {typ} request to {url}"`, `"Completed {cmd} request to {url}
//!   with status: {status}"`,
//! * `"Successfully fetched blocked domains"`,
//!   `"Failed to fetch blocked domains: {err}"`,
//! *"failed to parse revision"``,
//!   `"Delta update failed due to inconsistent state, falling back to full sync"`,
//! * KV entry `blocked_domains_state` in the `blocked_domains` namespace,
//! * persisted-state BinaryFormatException table — `Data too short: {n} bytes`,
//!   `"Corrupted data: hashes section length {n} is not a multiple of {k}"`,
//!   `"Version mismatch: expected {v}, found {f}"`,
//!   `"Revived {n}"`, `"Invalid byte range: start={s}, end={e}, file_size={n}"`.

use serde::{Deserialize, Serialize};

pub const ENDPOINT: &str = "https://cdn.discordapp.com/bad-domains/updated_hashes.json";
pub const SUCCESS: &str = "Successfully fetched blocked domains";
pub const FETCH_FAILED: &str = "Failed to fetch blocked domains: ";
pub const PARSE_REV: &str = "failed to parse revision";
pub const DELTA_FALLBACK: &str =
    "Delta update failed due to inconsistent state, falling back to full sync";
pub const KV_NAMESPACE: &str = "blocked_domains";
pub const KV_STATE_KEY: &str = "blocked_domains_state";
/// Per-hash length; the persisted-section check emits
/// `not a multiple of {HASH_LEN}`.
pub const HASH_LEN: usize = 8;
/// State-file format marker version.
pub const STATE_VERSION: u32 = 1;

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct BlockedDomainHashes {
    pub revision: Option<String>,
    pub hashes: Vec<String>,
}

/// Decoding of the persisted state blob — exact error strings from the module.
pub fn parse_state(bytes: &[u8]) -> Result<BlockedDomainHashes, ParseStateError> {
    if bytes.len() < 5 {
        return Err(ParseStateError::TooShort(bytes.len()));
    }
    let version = bytes[0] as u32;
    if version != STATE_VERSION {
        return Err(ParseStateError::VersionMismatch {
            expected: STATE_VERSION,
            found: version,
        });
    }
    let revision = u32::from_le_bytes(bytes[1..5].try_into().unwrap());
    let rest = &bytes[5..];
    if rest.len() % HASH_LEN != 0 {
        return Err(ParseStateError::CorruptedSection {
            length: rest.len(),
            multiple: HASH_LEN,
        });
    }
    let hashes = rest
        .chunks(HASH_LEN)
        .map(|hash| hash.iter().map(|byte| format!("{byte:02x}")).collect())
        .collect();
    Ok(BlockedDomainHashes {
        revision: Some(revision.to_string()),
        hashes,
    })
}

#[derive(Debug, Clone, PartialEq)]
pub enum ParseStateError {
    TooShort(usize),
    VersionMismatch { expected: u32, found: u32 },
    CorruptedSection { length: usize, multiple: usize },
    InvalidLength { got: usize, wanted: usize },
}

impl std::fmt::Display for ParseStateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseStateError::TooShort(n) => write!(f, "Data too short: {n} bytes"),
            ParseStateError::VersionMismatch { expected, found } => {
                write!(f, "Version mismatch: expected {expected}, found {found}")
            }
            ParseStateError::CorruptedSection { length, multiple } => write!(
                f,
                "Corrupted data: hashes section length {length} is not a multiple of {multiple}"
            ),
            ParseStateError::InvalidLength { got, wanted } => {
                write!(f, "invalid length {got}, expected {wanted}")
            }
        }
    }
}

impl std::error::Error for ParseStateError {}

/// The membership check `blockeddomainsstore_isBlockedDomain(url)` walks:
/// parse the URL, extract the host, then probe the hash set.
#[derive(Debug, Clone)]
#[cfg_attr(
    all(feature = "web", target_arch = "wasm32"),
    wasm_bindgen::prelude::wasm_bindgen
)]
pub struct BlockedDomainsStore {
    revision: u32,
    hashes: std::collections::HashSet<[u8; HASH_LEN]>,
}

impl Default for BlockedDomainsStore {
    fn default() -> Self {
        BlockedDomainsStore {
            revision: 0,
            hashes: Default::default(),
        }
    }
}

impl BlockedDomainsStore {
    /// Hex hash of a domain, RFC — the store records 24-byte entries as
    /// captured from the fetcher; the matching uses the lowercase ascii hex of
    /// the host hashed with the module's recorded digest input.
    pub fn is_blocked(&self, url: &str) -> bool {
        self.blocked_domain(url).is_some()
    }

    pub fn blocked_domain(&self, input: &str) -> Option<String> {
        use sha2::{Digest, Sha256};

        let parsed = url::Url::parse(input)
            .or_else(|_| url::Url::parse(&format!("https://{input}")))
            .ok()?;
        let host = parsed
            .host_str()?
            .trim_end_matches('.')
            .to_ascii_lowercase();
        let labels: Vec<_> = host.split('.').collect();
        for start in 0..labels.len().saturating_sub(1) {
            let candidate = labels[start..].join(".");
            let digest = Sha256::digest(candidate.as_bytes());
            let hash: [u8; HASH_LEN] = digest[..HASH_LEN].try_into().unwrap();
            if self.hashes.contains(&hash) {
                return Some(candidate);
            }
        }
        None
    }

    pub fn load_from(&mut self, hashes: Vec<String>) {
        self.hashes = hashes
            .into_iter()
            .filter_map(|hash| {
                let hash = normalized(&hash);
                if hash.len() < HASH_LEN * 2 {
                    return None;
                }
                u64::from_str_radix(&hash[..HASH_LEN * 2], 16)
                    .ok()
                    .map(u64::to_be_bytes)
            })
            .collect();
    }

    pub fn replace(&mut self, revision: u32, hashes: Vec<String>) {
        self.revision = revision;
        self.load_from(hashes);
    }

    pub fn apply_delta(&mut self, revision: u32, added: Vec<String>, removed: Vec<String>) -> bool {
        let decode = |hash: String| {
            let hash = normalized(&hash);
            (hash.len() >= HASH_LEN * 2)
                .then(|| u64::from_str_radix(&hash[..HASH_LEN * 2], 16).ok())
                .flatten()
                .map(u64::to_be_bytes)
        };
        let added: Vec<_> = added.into_iter().filter_map(&decode).collect();
        let removed: Vec<_> = removed.into_iter().filter_map(decode).collect();
        if removed.iter().any(|hash| !self.hashes.contains(hash)) {
            return false;
        }
        self.hashes.extend(added);
        for hash in removed {
            self.hashes.remove(&hash);
        }
        self.revision = revision;
        true
    }

    pub fn revision(&self) -> u32 {
        self.revision
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(5 + self.hashes.len() * HASH_LEN);
        bytes.push(STATE_VERSION as u8);
        bytes.extend_from_slice(&self.revision.to_le_bytes());
        let mut hashes: Vec<_> = self.hashes.iter().collect();
        hashes.sort_unstable();
        for hash in hashes {
            bytes.extend_from_slice(hash);
        }
        bytes
    }

    pub fn load_state(&mut self, bytes: &[u8]) -> Result<(), ParseStateError> {
        let state = parse_state(bytes)?;
        self.revision = state
            .revision
            .as_deref()
            .and_then(|revision| revision.parse().ok())
            .unwrap_or_default();
        self.load_from(state.hashes);
        Ok(())
    }

    pub fn len(&self) -> usize {
        self.hashes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.hashes.is_empty()
    }
}

/// Case-fold the hex hash for membership checks (the JSON list ships in the
/// module's canonical lowercase; matching enforces lowercase).
fn normalized(s: &str) -> String {
    s.trim().to_ascii_lowercase()
}

/// URL-scheme door check from the listing: the head of the URL must include
/// the scheme prefix (`https://` = bytes `68 74 74 70 73 3a 2f 2f`).
pub fn has_http_scheme(bytes: &[u8]) -> bool {
    bytes.starts_with(b"https://") || bytes.starts_with(b"http://")
}
