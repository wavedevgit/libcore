//! `wasm/src/logger.rs` — the exported `installLogCallback` plumbing.
//! * `SetLoggerError` / `Failed to set logger {err}` wrap,
//! * level table `OFF ERROR WARN INFO DEBUG TRACE` (concatenated in the
//!   module's data at the log-level descriptor),
//! * the per-level callback slot error:
//!   `[LIBDISCORE] logger callback for level {level} not set`,
//! * the store panic bridge: `Store '{tok}' panicked while handling '{act}':{e}`.

use crate::action::{Action, StoreToken};

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum LogLevel {
    Off,
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

impl LogLevel {
    pub fn name(&self) -> &'static str {
        match self {
            LogLevel::Off => "OFF",
            LogLevel::Error => "ERROR",
            LogLevel::Warn => "WARN",
            LogLevel::Info => "INFO",
            LogLevel::Debug => "DEBUG",
            LogLevel::Trace => "TRACE",
        }
    }
}

pub const SET_LOGGER_FAILED: &str = "Failed to set logger";
pub const CALLBACK_NOT_SET: &str = "[LIBDISCORE] logger callback for level ";
/// suffix stored separately in the binary (` not set` after the int).
pub const CALLBACK_NOT_SET_TAIL: &str = " not set";
pub const STORE_PANIC_PREFIX: &str = "Store '";
pub const STORE_PANIC_MID: &str = "' panicked while handling '";
pub const STORE_PANIC_TAIL: &str = "':\n";

#[derive(Debug)]
pub enum LoggerError {
    SetLoggerError,
}

impl std::fmt::Display for LoggerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LoggerError::SetLoggerError => write!(f, "{SET_LOGGER_FAILED}"),
        }
    }
}

/// The exact store panic message renderer.
pub fn render_store_panic(token: StoreToken, action: Action, err: &str) -> String {
    format!(
        "{STORE_PANIC_PREFIX}{token}{STORE_PANIC_MID}{}",
        action.name()
    ) + &format!("{STORE_PANIC_TAIL}{err}")
}
