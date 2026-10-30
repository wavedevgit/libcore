//! `experiment_manager` / `libdiscore_common::core::experiment_cacher` — the
//! wasm-cacheable experiment pipeline.
//!
//! Recovered strings/paths (data section):
//! * module path: `libdiscore_common::core::experiment_cacher`
//! * cache key: `experiments_snapshot`
//! * state KV: `experiments`
//! * messages: `Loading from cache`, `Loaded experiments from cache`,
//!   `Cleared experiments cache`, `clear_cache called, sending clear message
//!   to flusher`, `Failed to send clear message to flusher, flusher may have
//!   stopped`, `Failed to send experiments snapshot to flusher, flusher may
//!   have stopped`, `Failed to serialize snapshot`, `Data too short to contain
//!   version`, `Version mismatch: expected {v}, found {f}`,
//!   `Unsupported version: {v}`, `Failed to load experiments state: {err}`,
//!   `Failed to load state from cache: {err}`,
//!   `Failed to process experiment cache operation: {err}`,
//!   `struct CacheableExperimentConfig with 1 element`.

use serde::{Deserialize, Serialize};
#[cfg(all(feature = "web", target_arch = "wasm32"))]
#[allow(unused_imports)]
use wasm_bindgen::prelude::wasm_bindgen;

pub const CACHE_KEY: &str = "experiments_snapshot";
pub const KV_NAMESPACE: &str = "experiments";
pub const MODULE_PATH: &str = "libdiscore_common::core::experiment_cacher";
pub const LOADED_FROM_CACHE: &str = "Loaded experiments from cache";
pub const CLEARED_CACHE: &str = "Cleared experiments cache";
pub const CLEAR_SENT: &str = "clear_cache called, sending clear message to flusher";
pub const CLEAR_SEND_FAILED: &str =
    "Failed to send clear message to flusher, flusher may have stopped";
pub const SNAPSHOT_SEND_FAILED: &str =
    "Failed to send experiments snapshot to flusher, flusher may have stopped";
pub const SNAPSHOT_SERIALIZE_FAILED: &str = "Failed to serialize snapshot";
pub const TOO_SHORT: &str = "Data too short to contain version";
pub const UNSUPPORTED_VERSION: &str = "Unsupported version: ";
pub const LOAD_FAILED: &str = "Failed to load experiments state: ";
pub const LOAD_CACHE_FAILED: &str = "Failed to load state from cache: ";
pub const OP_FAILED: &str = "Failed to process experiment cache operation: ";

/// `struct CacheableExperimentConfig with 1 element` (getter/setter exported as
/// `wbg_get/set_wasmcacheableexperimentconfig_treatmentId`).
#[derive(Copy, Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(
    all(feature = "web", target_arch = "wasm32"),
    wasm_bindgen::prelude::wasm_bindgen(js_name = WasmCacheableExperimentConfig)
)]
pub struct CacheableExperimentConfig {
    #[cfg_attr(
        all(feature = "web", target_arch = "wasm32"),
        wasm_bindgen(js_name = treatmentId)
    )]
    pub treatment_id: i32,
}

/// Zero-sized namespace class used by the original JS API's static methods.
#[cfg(all(feature = "web", target_arch = "wasm32"))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub struct ExperimentCacher;

/// Snapshot of the handled experiments cache.
#[derive(Clone, Debug, PartialEq)]
pub struct ExperimentSnapshot {
    version: u32,
    payload: Vec<u8>,
}

impl ExperimentSnapshot {
    pub fn new(version: u32, payload: Vec<u8>) -> Self {
        ExperimentSnapshot { version, payload }
    }

    pub fn version(&self) -> u32 {
        self.version
    }

    pub fn payload(&self) -> &[u8] {
        &self.payload
    }

    /// The 4-byte version prefix + payload serialization used by the flusher.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(4 + self.payload.len());
        out.extend_from_slice(&self.version.to_be_bytes());
        out.extend_from_slice(&self.payload);
        out
    }
}

/// Decode the persisted snapshot header. The payload is intentionally opaque:
/// the original hands it to the experiment manager after validating only the
/// version prefix.
pub fn from_bytes(bytes: &[u8]) -> Result<ExperimentSnapshot, String> {
    if bytes.len() < 4 {
        return Err(TOO_SHORT.into());
    }
    let version = u32::from_be_bytes(bytes[..4].try_into().unwrap());
    if !supported_versions().contains(&version) {
        return Err(format!("{UNSUPPORTED_VERSION}{version}"));
    }
    Ok(ExperimentSnapshot::new(version, bytes[4..].to_vec()))
}

pub fn supported_versions() -> [u32; 1] {
    [1]
}
