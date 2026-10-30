//! `libdiscore` — reverse-engineered Rust reconstruction of Discord's
//! `libdiscore.wasm` (see `data/libdiscore.c`, the wabt --decompiler listing of
//! `data/libdiscore.wasm`).
//!
//! Coverage model (see `README.md` in this crate for the full methodology):
//!
//! * **Inventory** — `tools/parse_wat.py` + `tools/parse_wasm_bin.py` capture
//!   *every* reserved function (1423), export (49), import (114) and data
//!   segment (1435) of the original module, plus its byte-exact linear-memory
//!   image (`tools/data.bin`, 1,283,215 bytes).
//! * **Semantics** — all 25 exported entry points with human names are
//!   reconstructed against constants recovered from the binary's data section
//!   and differential behavior from the original Wasm.
//! * Launch-signature probe table, the 25-entry `Action` dispatch enum, the
//!   guild/note/role/emoji/sticker serde data model, blocked-domain and
//!   experiment caches, logger and cache-storage glue are all reconstructed
//!   with byte-exact strings and field order.
//!
//! Modules mirror the translation units named by the original panic locations
//! (`common/rust/src/...`, `wasm/src/...` — recovered verbatim from the binary).

pub mod action;
pub mod blocked_domains;
pub mod cache;
pub mod experiment_cacher;
pub mod launch_signature;
pub mod launch_signature_hex;
pub mod logger;
pub mod model;
pub mod stores;
pub mod uuid_v4;
pub mod wasm_glue;

/// Artificial crash helper (`export crash` in the wasm module).
///
/// Reconstruction, byte-exact from the listing (crash body references file
/// `wasm/src/lib.rs`):
pub fn crash() -> ! {
    panic!("artificial crash");
}

/// `export rustMultiply` — returns `a * b` (IEEE f64 multiply).
pub fn rust_multiply(a: f64, b: f64) -> f64 {
    a * b
}

pub use crate::action::StoreToken;
pub use crate::stores::{DatabaseInfo, StoreConnection, STORES_NOT_INITIALIZED};
pub use stores::FluxApi;

/// Stable, reconstructed log/error strings live in the modules that use them.
pub const CRATE_SOURCE_FILES: &str = "common/rust/src/lib.rs, wasm/src/lib.rs";
