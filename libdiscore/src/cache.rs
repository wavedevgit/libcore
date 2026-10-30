//! `common/rust/src/core/cache.rs` (wasm cache-storage glue) — recovered
//! strings and namespace table.
//!
//! * context type: `Cache` (`libdiscore_common::core::cache::wasm`)
//! * errors: `Failed to cast to Response`, `Failed to cast to Cache`,
//!   `no global window exists`, `caches not available in this browser`
//! * entry names: `blocked_domains`, `experiments`
//! * the `Content-Length`, `Content-Type`, `application/octet-stream` header
//!   set used by replication writes.

/// exact error strings from the module
pub const FAILED_CAST_RESPONSE: &str = "Failed to cast to Response";
pub const FAILED_CAST_CACHE: &str = "Failed to cast to Cache";
pub const NO_WINDOW: &str = "no global window exists";
pub const NO_CACHES: &str = "caches not available in this browser";
/// wasm-bindgen generic error for `Repr` failures.
pub const WASM_BINDGEN_MSG: &str = "W определяется";

pub const ENTRY_BLOCKED_DOMAINS: &str = "blocked_domains";
pub const ENTRY_EXPERIMENTS: &str = "experiments";
pub const HEADER_CONTENT_LENGTH: &str = "Content-Length";
pub const HEADER_CONTENT_TYPE: &str = "Content-Type";
pub const OCTET_STREAM: &str = "application/octet-stream";

/// The two cache entries the module reads/writes.
pub const CACHE_ENTRIES: [&str; 2] = ["blocked_domains", "experiments"];
