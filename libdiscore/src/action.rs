//! The 25-variant `Action` dispatch enum (internally tagged `"type"`).
//!
//! Variant order and spelling are recovered byte-exact from the module data
//! section (`LOGOUTRESET_SOCKETLIBDISCORE_RESET...GUILD_STICKERS_FETCH_SUCCESS`
//! appears three times — for `Action`, `RawGuildEmojiStore`'s handler table and
//! the `Result::unwrap_throw()` error rendering).

use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(
    feature = "serde",
    serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")
)]
pub enum Action {
    Logout,
    ResetSocket,
    LibdiscoreReset,
    ConnectionOpen,
    UserNoteUpdate,
    UserNoteLoadStart,
    LibdiscoreSimulateCrash,
    LibdiscoreSimulateStoreError,
    GuildCreate,
    GuildUpdate,
    GuildDelete,
    GuildMemberAdd,
    BackgroundSync,
    CacheLoaded,
    CacheLoadedLazy,
    GuildRoleCreate,
    GuildRoleUpdate,
    GuildRoleDelete,
    GuildEmojisUpdate,
    CachedEmojisLoaded,
    GuildStickersUpdate,
    CachedStickersLoaded,
    GuildStickersCreateSuccess,
    GuildStickerFetchSuccess,
    GuildStickersFetchSuccess,
}

impl Action {
    /// All variants in dispatch order — byte-exact order of the binary's
    /// concatenated variant-name string.
    pub const ALL: [Action; 25] = [
        Action::Logout,
        Action::ResetSocket,
        Action::LibdiscoreReset,
        Action::ConnectionOpen,
        Action::UserNoteUpdate,
        Action::UserNoteLoadStart,
        Action::LibdiscoreSimulateCrash,
        Action::LibdiscoreSimulateStoreError,
        Action::GuildCreate,
        Action::GuildUpdate,
        Action::GuildDelete,
        Action::GuildMemberAdd,
        Action::BackgroundSync,
        Action::CacheLoaded,
        Action::CacheLoadedLazy,
        Action::GuildRoleCreate,
        Action::GuildRoleUpdate,
        Action::GuildRoleDelete,
        Action::GuildEmojisUpdate,
        Action::CachedEmojisLoaded,
        Action::GuildStickersUpdate,
        Action::CachedStickersLoaded,
        Action::GuildStickersCreateSuccess,
        Action::GuildStickerFetchSuccess,
        Action::GuildStickersFetchSuccess,
    ];

    /// The serde-serialized name (`LOGOUT`, `GUILD_ROLE_UPDATE`, ...).
    pub fn name(&self) -> &'static str {
        match self {
            Action::Logout => "LOGOUT",
            Action::ResetSocket => "RESET_SOCKET",
            Action::LibdiscoreReset => "LIBDISCORE_RESET",
            Action::ConnectionOpen => "CONNECTION_OPEN",
            Action::UserNoteUpdate => "USER_NOTE_UPDATE",
            Action::UserNoteLoadStart => "USER_NOTE_LOAD_START",
            Action::LibdiscoreSimulateCrash => "LIBDISCORE_SIMULATE_CRASH",
            Action::LibdiscoreSimulateStoreError => "LIBDISCORE_SIMULATE_STORE_ERROR",
            Action::GuildCreate => "GUILD_CREATE",
            Action::GuildUpdate => "GUILD_UPDATE",
            Action::GuildDelete => "GUILD_DELETE",
            Action::GuildMemberAdd => "GUILD_MEMBER_ADD",
            Action::BackgroundSync => "BACKGROUND_SYNC",
            Action::CacheLoaded => "CACHE_LOADED",
            Action::CacheLoadedLazy => "CACHE_LOADED_LAZY",
            Action::GuildRoleCreate => "GUILD_ROLE_CREATE",
            Action::GuildRoleUpdate => "GUILD_ROLE_UPDATE",
            Action::GuildRoleDelete => "GUILD_ROLE_DELETE",
            Action::GuildEmojisUpdate => "GUILD_EMOJIS_UPDATE",
            Action::CachedEmojisLoaded => "CACHED_EMOJIS_LOADED",
            Action::GuildStickersUpdate => "GUILD_STICKERS_UPDATE",
            Action::CachedStickersLoaded => "CACHED_STICKERS_LOADED",
            Action::GuildStickersCreateSuccess => "GUILD_STICKERS_CREATE_SUCCESS",
            Action::GuildStickerFetchSuccess => "GUILD_STICKER_FETCH_SUCCESS",
            Action::GuildStickersFetchSuccess => "GUILD_STICKERS_FETCH_SUCCESS",
        }
    }

    pub fn from_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|action| action.name() == name)
    }

    /// The `dyn Error` variant-index message the binary embeds:
    /// "variant index 0 <= i < 30" (the *combined* count of Action plus the
    /// internally-tagged `BackgroundSyncGuild` variants handled by the same
    /// deserializer path in the original).
    pub const VARIANT_INDEX_BOUND: usize = 30;
}

/// `StoreToken` — token that identifies a registered store inside
/// `action_handlers` (message: "action_handlers references unknown store token
/// {token} for action '{action}'").
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
#[cfg_attr(feature = "serde", serde(transparent))]
pub struct StoreToken(pub u32);

impl StoreToken {
    pub const fn new(token: u32) -> Self {
        StoreToken(token)
    }
}

impl std::fmt::Display for StoreToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
