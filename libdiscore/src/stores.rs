//! Store registry: `FluxApi`, the registered stores and their connection
//! records.
//!
//! Reconstructed from:
//! * the `GuildStore` / `NoteStore` / `GuildRoleStore` /
//!   `GuildEmojiStore` (`RawGuildEmojiStore`) /
//!   `GuildStickersStore` names planted around their state tables,
//! * `StoreConnection` (`storeName, databases`) and `DatabaseInfo`
//!   (`name, type`),
//! * the `ok|value|error` closure-field names of the connection result,
//! * the exact panic contexts — `Stores not initialized` (panic points recorded
//!   at `(wasm/src/lib.rs, 41:19, 106:31, 135:31, 120:31, 59:31, 70:31)`).

use crate::action::{Action, StoreToken};

pub const STORES_NOT_INITIALIZED: &str = "Stores not initialized";
pub const UNKNOWN_STORE: &str = "Unknown store: ";
pub const UNKNOWN_TOKEN_FOR_ACTION: &str = "action_handlers references unknown store token ";
/// Store types a LOGOUT/RESET_SOCKET/LIBDISCORE_RESET clears (and unpoisons).
const RESET_STORE_TYPES: [&str; 5] = [
    "NoteStore",
    "GuildStore",
    "GuildStickersStore",
    "GuildRoleStore",
    "RawGuildEmojiStore",
];
/// The three table names the binary registers alongside
/// `BLOCKED_DOMAINS`/`EXPERIMENTS`/misc KV namespaces.
pub const KV_NAMESPACES: [&str; 2] = ["blocked_domains", "experiments"];

/// One registered store.
#[derive(Debug, Clone)]
pub struct RegisteredStore {
    /// `GuildStore` / `GuildRoleStore` / `GuildEmojiStore` / `GuildStickersStore`
    /// / `NoteStore` / `BlockedDomainsStore` / ... — the store's `type_name`.
    pub store_name: &'static str,
    /// `GuildStore`-side table names (`guilds`, `unavailableGuilds`, ...).
    pub tables: &'static [&'static str],
}

/// The registered store roster. Order matters: `fluxapi_getRegisteredActionTypes`
/// iterates the action-handler map in this registration order.
pub const REGISTERED_STORES: &[RegisteredStore] = &[
    RegisteredStore {
        store_name: "GuildStore",
        tables: &["guilds", "unavailableGuilds"],
    },
    RegisteredStore {
        store_name: "GuildRoleStore",
        tables: &[],
    },
    RegisteredStore {
        store_name: "RawGuildEmojiStore",
        tables: &[],
    },
    RegisteredStore {
        store_name: "GuildStickersStore",
        tables: &[],
    },
    RegisteredStore {
        store_name: "NoteStore",
        tables: &[],
    },
];

/// The `DispatchResult` shape returned inside `{ok:true,value:...}`.
#[derive(Debug, Clone, Default, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DispatchResult {
    pub store_results: Vec<StoreDispatchResult>,
    pub metrics: Option<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreDispatchResult {
    pub store_token: StoreToken,
    pub database_changes: Vec<DatabaseChange>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseChange {
    pub database_name: &'static str,
    pub opcodes: Vec<serde_json::Value>,
}

/// Actions that each connectable store handles. These sets are differential-
/// tested against the original wasm; lifecycle/guild actions intentionally
/// overlap across stores.
pub fn actions_handled(store_name: &str) -> &'static [Action] {
    match store_name {
        "GuildStore" => &[
            Action::Logout,
            Action::ResetSocket,
            Action::LibdiscoreReset,
            Action::ConnectionOpen,
            Action::GuildCreate,
            Action::GuildUpdate,
            Action::GuildDelete,
            Action::GuildMemberAdd,
            Action::BackgroundSync,
            Action::CacheLoaded,
            Action::CacheLoadedLazy,
        ],
        "NoteStore" => &[
            Action::Logout,
            Action::ResetSocket,
            Action::LibdiscoreReset,
            Action::ConnectionOpen,
            Action::UserNoteUpdate,
            Action::UserNoteLoadStart,
            Action::LibdiscoreSimulateCrash,
            Action::LibdiscoreSimulateStoreError,
        ],
        "GuildRoleStore" => &[
            Action::Logout,
            Action::ResetSocket,
            Action::LibdiscoreReset,
            Action::ConnectionOpen,
            Action::GuildCreate,
            Action::GuildUpdate,
            Action::GuildDelete,
            Action::BackgroundSync,
            Action::CacheLoaded,
            Action::CacheLoadedLazy,
            Action::GuildRoleCreate,
            Action::GuildRoleUpdate,
            Action::GuildRoleDelete,
        ],
        "RawGuildEmojiStore" => &[
            Action::Logout,
            Action::ResetSocket,
            Action::LibdiscoreReset,
            Action::ConnectionOpen,
            Action::GuildCreate,
            Action::GuildUpdate,
            Action::GuildDelete,
            Action::BackgroundSync,
            Action::GuildEmojisUpdate,
            Action::CachedEmojisLoaded,
        ],
        "GuildStickersStore" => &[
            Action::Logout,
            Action::ResetSocket,
            Action::LibdiscoreReset,
            Action::ConnectionOpen,
            Action::GuildCreate,
            Action::GuildDelete,
            Action::BackgroundSync,
            Action::GuildStickersUpdate,
            Action::CachedStickersLoaded,
            Action::GuildStickersCreateSuccess,
            Action::GuildStickerFetchSuccess,
            Action::GuildStickersFetchSuccess,
        ],
        _ => &[],
    }
}

/// JSON payload validation inferred from the original dispatch deserializer.
/// It is intentionally kept separate from mutation so all callers get the
/// same failure before a store sees malformed input.
pub fn validate_action_payload(action: Action, value: &serde_json::Value) -> Result<(), String> {
    match action {
        Action::GuildCreate | Action::GuildUpdate => {
            let guild = value
                .get("guild")
                .ok_or_else(|| "missing field `guild`".to_string())?;
            required_id(guild, "id").map(|_| ())
        }
        Action::GuildMemberAdd => {
            let user = value
                .get("user")
                .ok_or_else(|| "missing field `user`".to_string())?;
            required_id(user, "id").map(|_| ())
        }
        Action::BackgroundSync => value
            .get("guilds")
            .and_then(|guilds| guilds.as_array())
            .map(|_| ())
            .ok_or_else(|| "missing field `guilds`".to_string()),
        Action::GuildDelete => {
            let guild = value
                .get("guild")
                .ok_or_else(|| "missing field `guild`".to_string())?;
            required_id(guild, "id").map(|_| ())
        }
        Action::GuildRoleCreate | Action::GuildRoleUpdate => {
            required_id(value, "guildId")?;
            value
                .get("role")
                .ok_or_else(|| "missing field `role`".to_string())?;
            Ok(())
        }
        Action::GuildRoleDelete => {
            required_id(value, "guildId")?;
            required_id(value, "roleId").map(|_| ())
        }
        Action::GuildEmojisUpdate => {
            required_id(value, "guildId")?;
            value
                .get("emojis")
                .and_then(|items| items.as_array())
                .map(|_| ())
                .ok_or_else(|| "missing field `emojis`".to_string())
        }
        Action::CachedEmojisLoaded => value
            .get("emojis")
            .and_then(|items| items.as_array())
            .map(|_| ())
            .ok_or_else(|| "missing field `emojis`".to_string()),
        Action::GuildStickersUpdate | Action::GuildStickersFetchSuccess => {
            required_id(value, "guildId")?;
            value
                .get("stickers")
                .and_then(|items| items.as_array())
                .map(|_| ())
                .ok_or_else(|| "missing field `stickers`".to_string())
        }
        Action::CachedStickersLoaded => value
            .get("stickers")
            .and_then(|items| items.as_array())
            .map(|_| ())
            .ok_or_else(|| "missing field `stickers`".to_string()),
        Action::GuildStickersCreateSuccess => {
            required_id(value, "guildId")?;
            value
                .get("sticker")
                .map(|_| ())
                .ok_or_else(|| "missing field `sticker`".to_string())
        }
        Action::GuildStickerFetchSuccess => value
            .get("sticker")
            .map(|_| ())
            .ok_or_else(|| "missing field `sticker`".to_string()),
        _ => Ok(()),
    }
}

/// `DatabaseInfo` (name/type) carried per connection; re-declared with the
/// model's JSON shape for the connection record.
pub use crate::model::DatabaseInfo;

/// `StoreConnection` — `{ storeName, databases }` (over the wire).
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreConnection {
    pub store_name: String,
    pub databases: Vec<DatabaseInfo>,
}

/// Successful `fluxapi_connectStore` value.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectValue {
    pub store_token: StoreToken,
    /// Empty for a fresh in-memory connection; persisted database hydration is
    /// handled by the cache backend.
    pub initial_state: Vec<String>,
}

/// Result of `fluxapi_connectStore`: `{storeToken, initialState}` or an error.
#[derive(Debug, Clone, PartialEq)]
pub enum ConnectResult {
    Ok(ConnectValue),
    Err(String),
}

/// The FluxApi object the module exports (wasm-bindgen class `FluxApi`).
#[derive(Debug)]
#[cfg_attr(
    all(feature = "web", target_arch = "wasm32"),
    wasm_bindgen::prelude::wasm_bindgen
)]
pub struct FluxApi {
    connections: Vec<(StoreToken, StoreConnection)>,
    /// Guild-role partition contents per guild, mirroring the original's
    /// in-memory store state (used for the create/update partition no-ops).
    role_partitions: std::collections::HashMap<String, serde_json::Value>,
    /// Persisted guild record per guild (`GuildStore` in-memory state).
    guild_records: std::collections::HashMap<String, serde_json::Value>,
    /// Store types that hit a store-level error (probed: an error permanently
    /// poisons that store type — every later semantic result for it is
    /// suppressed, but envelope/parse errors still surface) until a
    /// LOGOUT/RESET_SOCKET/LIBDISCORE_RESET clears it.
    poisoned: std::collections::HashSet<String>,
}

impl FluxApi {
    /// `fluxapi_new` — registers the store roster (three logical groups in the
    /// binary: guild domain, note domain, peripheral caches).
    #[cfg(not(all(feature = "web", target_arch = "wasm32")))]
    pub fn new() -> Self {
        Self::empty()
    }

    #[cfg(all(feature = "web", target_arch = "wasm32"))]
    pub(crate) fn new_inner() -> Self {
        Self::empty()
    }

    fn empty() -> Self {
        FluxApi {
            connections: Vec::new(),
            role_partitions: Default::default(),
            guild_records: Default::default(),
            poisoned: Default::default(),
        }
    }

    /// `fluxapi_connectStore({storeName, databases})` — tokens are assigned to
    /// connections, not store types; duplicate store connections are valid.
    pub fn connect_store(&mut self, connection: StoreConnection) -> ConnectResult {
        let store_name = connection.store_name.as_str();
        let found = REGISTERED_STORES
            .iter()
            .find(|s| s.store_name == store_name);
        match found {
            None => ConnectResult::Err(format!("{UNKNOWN_STORE}{store_name}")),
            Some(_) => {
                let token = StoreToken::new(self.connections.len() as u32);
                self.connections.push((token, connection));
                ConnectResult::Ok(ConnectValue {
                    store_token: token,
                    initial_state: Vec::new(),
                })
            }
        }
    }

    /// `fluxapi_getRegisteredActionTypes` — every action type across the
    /// registered handlers. The original collects into a HashSet, so its
    /// observable iteration order depends on the connected-store set.
    pub fn get_registered_action_types(&self) -> Vec<Action> {
        let mut out = std::collections::HashSet::new();
        for (_, connection) in &self.connections {
            for action in actions_handled(&connection.store_name) {
                out.insert(*action);
            }
        }
        out.into_iter().collect()
    }

    /// `fluxapi_findStoresThatCanHandleActionType` — tokens of connected
    /// stores whose handler table contains `action`.
    pub fn find_stores_that_can_handle_action_type(&self, action: Action) -> Vec<StoreToken> {
        let mut out = Vec::new();
        for (token, conn) in &self.connections {
            if actions_handled(&conn.store_name).contains(&action) {
                out.push(*token);
            }
        }
        out
    }

    /// `fluxapi_dispatchAction` — routes `action` to each connected handler
    /// store; fails with the exact handler-mapping error if a store with a
    /// registered token for `action` is not connected.
    pub fn dispatch_action(&mut self, action: Action) -> DispatchResult {
        if matches!(
            action,
            Action::Logout | Action::ResetSocket | Action::LibdiscoreReset
        ) {
            self.role_partitions.clear();
            self.guild_records.clear();
        }
        let store_results = match action {
            Action::Logout | Action::ResetSocket | Action::LibdiscoreReset => {
                // These clearDatabase emissions are unconditional (probed on a
                // poisoned store) and they clear the store-level poison.
                self.poisoned
                    .retain(|name| !RESET_STORE_TYPES.contains(&name.as_str()));
                self.connections_by_type(&RESET_STORE_TYPES)
                    .into_iter()
                    .map(|(token, connection)| clear_result(token, &connection.store_name))
                    .collect()
            }
            Action::ConnectionOpen => self
                .connections_by_type(&["NoteStore"])
                .into_iter()
                .filter(|(_, connection)| !self.poisoned.contains(&connection.store_name))
                .map(|(token, connection)| clear_result(token, &connection.store_name))
                .collect(),
            Action::CacheLoaded => self
                .connections_by_type(&["GuildStore", "GuildRoleStore"])
                .into_iter()
                .filter(|(_, connection)| !self.poisoned.contains(&connection.store_name))
                .map(|(token, connection)| clear_result(token, &connection.store_name))
                .collect(),
            _ => Vec::new(),
        };
        DispatchResult {
            store_results,
            metrics: None,
        }
    }

    /// Parse the JSON string accepted by the JS `dispatchAction` wrapper.
    pub fn dispatch_json(&mut self, json: &str) -> Result<DispatchResult, String> {
        let value: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
        let action: Action = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
        validate_action_payload(action, &value)?;
        if matches!(
            action,
            Action::CachedEmojisLoaded | Action::CachedStickersLoaded | Action::CacheLoadedLazy
        ) {
            return Ok(DispatchResult::default());
        }
        if matches!(action, Action::UserNoteUpdate | Action::UserNoteLoadStart) {
            let id = required_id(
                &value,
                if action == Action::UserNoteUpdate {
                    "id"
                } else {
                    "userId"
                },
            )?;
            let note = (action == Action::UserNoteUpdate).then(|| {
                value
                    .get("note")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_owned()
            });
            return Ok(self.single_store_change(
                "NoteStore",
                serde_json::json!({
                    "clusteringKey": id,
                    "opcode": "setRecord",
                    "partitionKey": 0,
                    "value": {"id": id, "loading": note.is_none(), "note": note},
                }),
            ));
        }
        if action == Action::GuildMemberAdd {
            return Ok(DispatchResult::default());
        }
        if matches!(action, Action::GuildCreate | Action::GuildUpdate) {
            let guild = value.get("guild").unwrap();
            let guild_id = required_id(guild, "id")?;
            let properties = guild.get("properties").filter(|value| value.is_object());
            let mut store_results = Vec::new();
            let mut role_partition: Option<serde_json::Map<String, serde_json::Value>> = None;
            let mut role_payload: Option<RolePayload> = None;
            let mut mark_empty_roles = false;
            let mut new_record: Option<serde_json::Value> = None;
            if action == Action::GuildCreate {
                // Create: the descriptor requires `id` +
                // `premium_subscription_count`; a `properties` snapshot
                // additionally validates its 8 fields with typed nulls
                // (probes: props errors surface before descriptor errors;
                // `properties.psub` null passes through).
                if let Some(properties) = properties {
                    require_fields(properties, &GUILD_PROPS_REQUIRED)?;
                    typed_check(properties, "name")?;
                    typed_check(properties, "features")?;
                }
                require_fields(guild, &GUILD_CREATE_REQUIRED)?;
                typed_check(guild, "premium_subscription_count")?;
                role_payload = Some(build_role_payload(guild, &guild_id)?);
                if let Some(properties) = properties {
                    new_record = Some(serde_json::Value::Object(guild_record_value(
                        properties, guild,
                    )?));
                }
            } else {
                // Update: the descriptor stays strict even when `properties`
                // is present (probed name/psub/features nulls); the snapshot
                // itself is not re-validated at all.
                require_fields(guild, &GUILD_UPDATE_REQUIRED)?;
                typed_check(guild, "name")?;
                typed_check(guild, "premium_subscription_count")?;
                typed_check(guild, "features")?;
                role_partition = Some(build_role_partition_update(guild, &guild_id)?);
            }
            let targets: Vec<(StoreToken, String)> = self
                .connections_by_type(&["GuildStore", "GuildRoleStore"])
                .into_iter()
                .map(|(token, connection)| (token, connection.store_name.clone()))
                .collect();
            for (token, store_name) in targets {
                let poisoned = self.poisoned.contains(&store_name);
                if action == Action::GuildCreate {
                    match store_name.as_str() {
                        "GuildStore" => {
                            let record = match new_record.clone() {
                                Some(record) => record,
                                None => {
                                    if let Some(record) = self
                                        .guild_records
                                        .get(&guild_id)
                                        .map(|record| sorted_object(record.clone()))
                                    {
                                        record
                                    } else if !poisoned {
                                        self.poisoned.insert(store_name.clone());
                                        store_results.push(StoreDispatchResult {
                                            store_token: token,
                                            database_changes: Vec::new(),
                                            error: Some(format!(
                                                "{} failed handling GUILD_CREATE: Guild {guild_id} has no properties and no existing record to merge with",
                                                store_name
                                            )),
                                        });
                                        continue;
                                    } else {
                                        continue;
                                    }
                                }
                            };
                            if !poisoned {
                                store_results.push(StoreDispatchResult {
                                    store_token: token,
                                    database_changes: vec![DatabaseChange {
                                        database_name: "guilds",
                                        opcodes: vec![serde_json::json!({
                                            "clusteringKey": guild_id,
                                            "opcode": "setRecord",
                                            "partitionKey": 0,
                                            "value": record,
                                        })],
                                    }],
                                    error: None,
                                });
                            }
                        }
                        _ => {
                            match &role_payload {
                                Some(RolePayload::FullSync(partition)) => {
                                    if !poisoned {
                                        store_results.push(StoreDispatchResult {
                                            store_token: token,
                                            database_changes: vec![DatabaseChange {
                                                database_name: "guild_roles",
                                                opcodes: vec![serde_json::json!({
                                                    "opcode": "setPartition",
                                                    "partition": partition,
                                                    "partitionKey": guild_id,
                                                })],
                                            }],
                                            error: None,
                                        });
                                    }
                                }
                                Some(RolePayload::UpdateSeq { items, removed }) => {
                                    if !poisoned {
                                        if let Some(_existing) = self.role_partitions.get(&guild_id)
                                        {
                                            // Upsert against an existing partition:
                                            // removes first, then per-role setRecords
                                            // in one change (probed order).
                                            let mut opcodes: Vec<serde_json::Value> = removed
                                                .iter()
                                                .map(|id| {
                                                    serde_json::json!({
                                                        "clusteringKey": id,
                                                        "opcode": "removeRecord",
                                                        "partitionKey": guild_id,
                                                    })
                                                })
                                                .collect();
                                            for (id, record) in items {
                                                opcodes.push(serde_json::json!({
                                                    "clusteringKey": id,
                                                    "opcode": "setRecord",
                                                    "partitionKey": guild_id,
                                                    "value": record,
                                                }));
                                            }
                                            store_results.push(StoreDispatchResult {
                                                store_token: token,
                                                database_changes: vec![DatabaseChange {
                                                    database_name: "guild_roles",
                                                    opcodes,
                                                }],
                                                error: None,
                                            });
                                        } else {
                                            let mut partition = serde_json::Map::new();
                                            for (id, record) in items {
                                                partition.insert(id.clone(), record.clone());
                                            }
                                            store_results.push(StoreDispatchResult {
                                                store_token: token,
                                                database_changes: vec![DatabaseChange {
                                                    database_name: "guild_roles",
                                                    opcodes: vec![serde_json::json!({
                                                        "opcode": "setPartition",
                                                        "partition": partition,
                                                        "partitionKey": guild_id,
                                                    })],
                                                }],
                                                error: None,
                                            });
                                        }
                                    }
                                }
                                _ => {
                                    if !self.role_partitions.contains_key(&guild_id) {
                                        if !poisoned {
                                            self.poisoned.insert(store_name.clone());
                                            store_results.push(StoreDispatchResult {
                                                store_token: token,
                                                database_changes: Vec::new(),
                                                error: Some(format!(
                                                    "{} failed handling GUILD_CREATE: Guild data was missing from store for guild {guild_id}: got empty role update with no existing partition",
                                                    store_name
                                                )),
                                            });
                                        }
                                        mark_empty_roles = true;
                                    }
                                }
                            }
                        }
                    }
                    continue;
                }
                if poisoned {
                    continue;
                }
                match store_name.as_str() {
                    "GuildStore" => {
                        if let Some(record) = self.guild_records.get_mut(&guild_id) {
                            for (key, field) in guild_fragment(guild)? {
                                record
                                    .as_object_mut()
                                    .expect("stored guild record is an object")
                                    .insert(key, field);
                            }
                            store_results.push(StoreDispatchResult {
                                store_token: token,
                                database_changes: vec![DatabaseChange {
                                    database_name: "guilds",
                                    opcodes: vec![serde_json::json!({
                                        "clusteringKey": guild_id,
                                        "opcode": "setRecord",
                                        "partitionKey": 0,
                                        "value": sorted_object(record.clone()),
                                    })],
                                }],
                                error: None,
                            });
                        }
                    }
                    _ => {
                        let partition = role_partition
                            .as_ref()
                            .map(|partition| serde_json::Value::Object(partition.clone()))
                            .unwrap_or(serde_json::Value::Object(Default::default()));
                        if self.role_partitions.get(&guild_id) != Some(&partition) {
                            store_results.push(StoreDispatchResult {
                                store_token: token,
                                database_changes: vec![DatabaseChange {
                                    database_name: "guild_roles",
                                    opcodes: vec![serde_json::json!({
                                        "opcode": "setPartition",
                                        "partition": partition,
                                        "partitionKey": guild_id,
                                    })],
                                }],
                                error: None,
                            });
                        }
                    }
                }
            }
            if action == Action::GuildCreate {
                match &role_payload {
                    Some(RolePayload::FullSync(partition)) => {
                        self.role_partitions.insert(
                            guild_id.clone(),
                            serde_json::Value::Object(partition.clone()),
                        );
                    }
                    Some(RolePayload::UpdateSeq { items, removed }) => {
                        let entry = self
                            .role_partitions
                            .entry(guild_id.clone())
                            .or_insert_with(|| serde_json::json!({}));
                        if let Some(object) = entry.as_object_mut() {
                            for id in removed {
                                object.remove(id);
                            }
                            for (id, record) in items {
                                object.insert(id.clone(), record.clone());
                            }
                        }
                    }
                    _ => {
                        if mark_empty_roles {
                            self.role_partitions
                                .entry(guild_id.clone())
                                .or_insert_with(|| serde_json::json!({}));
                        }
                    }
                }
                if let Some(record) = new_record {
                    self.guild_records.insert(guild_id.clone(), record);
                }
            } else {
                if let Some(partition) = role_partition {
                    self.role_partitions
                        .insert(guild_id.clone(), serde_json::Value::Object(partition));
                } else {
                    self.role_partitions
                        .entry(guild_id.clone())
                        .or_insert_with(|| serde_json::json!({}));
                }
            }
            for (token, _) in self.connections_by_type(&["RawGuildEmojiStore"]) {
                if self.poisoned.contains("RawGuildEmojiStore") {
                    continue;
                }
                store_results.push(StoreDispatchResult {
                    store_token: token,
                    database_changes: vec![DatabaseChange {
                        database_name: "guild_emojis",
                        opcodes: vec![serde_json::json!({
                            "opcode": "setPartition",
                            "partition": {},
                            "partitionKey": guild_id,
                        })],
                    }],
                    error: None,
                });
            }
            return Ok(DispatchResult {
                store_results,
                metrics: None,
            });
        }
        if action == Action::BackgroundSync {
            let guilds = value
                .get("guilds")
                .and_then(|guilds| guilds.as_array())
                .ok_or_else(|| "missing field `guilds`".to_string())?;
            if guilds.is_empty() {
                let store_results = self
                    .connections_by_type(&["RawGuildEmojiStore", "GuildStickersStore"])
                    .into_iter()
                    .filter(|(_, connection)| !self.poisoned.contains(&connection.store_name))
                    .map(|(token, connection)| clear_result(token, &connection.store_name))
                    .collect();
                return Ok(DispatchResult {
                    store_results,
                    metrics: None,
                });
            }
            let mut full_guilds = Vec::new();
            // Poisoned GuildRoleStore suppresses its BACKGROUND_SYNC emission.
            let sync_role_live = !self.poisoned.contains("GuildRoleStore");
            for guild in guilds {
                let mode = guild
                    .get("data_mode")
                    .and_then(|mode| mode.as_str())
                    .ok_or_else(|| "missing field `data_mode`".to_string())?;
                match mode {
                    "full" => {
                        let id = required_id(guild, "id")?;
                        guild
                            .get("properties")
                            .ok_or_else(|| "missing field `properties`".to_string())?;
                        // Same roles-array parse as GUILD_UPDATE: content
                        // replaces the stored partition.
                        let partition = build_role_partition_update(guild, &id)?;
                        self.role_partitions
                            .insert(id.clone(), serde_json::Value::Object(partition));
                        full_guilds.push(id);
                    }
                    "partial" => {
                        required_id(guild, "id")?;
                        guild
                            .get("properties")
                            .ok_or_else(|| "missing field `properties`".to_string())?;
                        guild
                            .get("partial_updates")
                            .ok_or_else(|| "missing field `partial_updates`".to_string())?;
                    }
                    "unavailable" => {
                        required_id(guild, "id")?;
                    }
                    other => {
                        return Err(format!(
                            "unknown variant `{other}`, expected one of `full`, `partial`, `unavailable`"
                        ));
                    }
                }
            }
            let mut store_results = Vec::new();
            for (token, _) in self.connections_by_type(&["GuildRoleStore"]) {
                let opcodes = full_guilds
                    .iter()
                    .map(|id| {
                        serde_json::json!({
                            "opcode": "setPartition",
                            "partition": {},
                            "partitionKey": id,
                        })
                    })
                    .collect();
                if !full_guilds.is_empty() && sync_role_live {
                    store_results.push(StoreDispatchResult {
                        store_token: token,
                        database_changes: vec![DatabaseChange {
                            database_name: "guild_roles",
                            opcodes,
                        }],
                        error: None,
                    });
                }
            }
            for (token, connection) in self
                .connections_by_type(&["RawGuildEmojiStore", "GuildStickersStore"])
                .into_iter()
                .filter(|(_, c)| !self.poisoned.contains(&c.store_name))
            {
                store_results.push(StoreDispatchResult {
                    store_token: token,
                    database_changes: vec![DatabaseChange {
                        database_name: database_name(&connection.store_name),
                        opcodes: vec![serde_json::json!({"opcode": "clearDatabase"})],
                    }],
                    error: None,
                });
            }
            return Ok(DispatchResult {
                store_results,
                metrics: None,
            });
        }
        if action == Action::LibdiscoreSimulateStoreError {
            self.poisoned.insert("NoteStore".into());
            let results = self
                .connections_by_type(&["NoteStore"])
                .into_iter()
                .map(|(store_token, connection)| StoreDispatchResult {
                    store_token,
                    database_changes: Vec::new(),
                    error: Some(format!(
                        "{} failed handling LIBDISCORE_SIMULATE_STORE_ERROR: simulated error",
                        connection.store_name
                    )),
                })
                .collect();
            return Ok(DispatchResult {
                store_results: results,
                metrics: None,
            });
        }
        if action == Action::LibdiscoreSimulateCrash {
            // The original route reaches `unreachable`, not the dispatcher
            // `{ok:false,error}` envelope. Panicking preserves that Wasm-trap
            // behavior when called through the wasm-bindgen export.
            if !self.connections_by_type(&["NoteStore"]).is_empty() {
                panic!("simulated crash");
            }
            return Ok(DispatchResult::default());
        }
        if matches!(action, Action::GuildRoleCreate | Action::GuildRoleUpdate) {
            let guild_id = required_id(&value, "guildId")?;
            let role = value
                .get("role")
                .cloned()
                .ok_or_else(|| "missing field `role`".to_string())?;
            require_fields(&role, &ROLE_REQUIRED)?;
            let role_id = required_id(&role, "id")?;
            let record = role_record(&role, &guild_id);
            // An upsert marks the partition as existing even without an
            // explicit setPartition (probed: guild create after role upsert
            // no longer reports the missing-partition error).
            self.role_partitions
                .entry(guild_id.clone())
                .or_insert_with(|| serde_json::json!({}));
            if let Some(partition) = self.role_partitions.get_mut(&guild_id) {
                if let Some(object) = partition.as_object_mut() {
                    object.insert(role_id.clone(), record.clone());
                }
            }
            return Ok(self.single_store_change(
                "GuildRoleStore",
                serde_json::json!({
                    "clusteringKey": role_id,
                    "opcode": "setRecord",
                    "partitionKey": guild_id,
                    "value": record,
                }),
            ));
        }
        if matches!(
            action,
            Action::GuildStickersCreateSuccess | Action::GuildStickerFetchSuccess
        ) {
            let sticker = value
                .get("sticker")
                .cloned()
                .ok_or_else(|| "missing field `sticker`".to_string())?;
            let guild_id = value
                .get("guildId")
                .map(id_string)
                .or_else(|| sticker.get("guild_id").map(id_string))
                .ok_or_else(|| "missing field `guildId`".to_string())?;
            let sticker_id = required_id(&sticker, "id")?;
            let mut value = sticker;
            value
                .as_object_mut()
                .expect("sticker object")
                .insert("type".into(), serde_json::json!(2));
            let value = sorted_object(value);
            return Ok(self.single_store_change(
                "GuildStickersStore",
                serde_json::json!({
                    "clusteringKey": sticker_id,
                    "opcode": "setRecord",
                    "partitionKey": guild_id,
                    "value": value,
                }),
            ));
        }
        if action == Action::GuildRoleDelete {
            return Ok(self.single_store_change(
                "GuildRoleStore",
                serde_json::json!({
                    "clusteringKey": required_id(&value, "roleId")?,
                    "opcode": "removeRecord",
                    "partitionKey": required_id(&value, "guildId")?,
                }),
            ));
        }
        if matches!(
            action,
            Action::GuildEmojisUpdate
                | Action::GuildStickersUpdate
                | Action::GuildStickersFetchSuccess
        ) {
            let guild_id = required_id(&value, "guildId")?;
            let field = if action == Action::GuildEmojisUpdate {
                "emojis"
            } else {
                "stickers"
            };
            let mut partition = serde_json::Map::new();
            for item in value
                .get(field)
                .and_then(|items| items.as_array())
                .ok_or_else(|| format!("missing field `{field}`"))?
            {
                if let Some(id) = item.get("id") {
                    partition.insert(id_string(id), sorted_object(item.clone()));
                }
            }
            return Ok(self.single_store_change(
                if action == Action::GuildEmojisUpdate {
                    "RawGuildEmojiStore"
                } else {
                    "GuildStickersStore"
                },
                serde_json::json!({
                    "opcode": "setPartition",
                    "partition": partition,
                    "partitionKey": guild_id,
                }),
            ));
        }
        if action != Action::GuildDelete {
            return Ok(self.dispatch_action(action));
        }

        let id = value
            .pointer("/guild/id")
            .map(id_string)
            .ok_or_else(|| "missing field `guild`".to_string())?;
        // Probed: delete clears both the in-memory guild record and role
        // partitions (later create/update/no-emit paths confirm).
        self.role_partitions.remove(&id);
        self.guild_records.remove(&id);
        let mut store_results = Vec::new();
        for (token, connection) in self
            .connections_by_type(&[
                "GuildStore",
                "GuildStickersStore",
                "GuildRoleStore",
                "RawGuildEmojiStore",
            ])
            .into_iter()
            .filter(|(_, c)| !self.poisoned.contains(&c.store_name))
        {
            let opcode = if connection.store_name == "GuildStore" {
                serde_json::json!({
                    "clusteringKey": id,
                    "opcode": "removeRecord",
                    "partitionKey": 0,
                })
            } else {
                serde_json::json!({"opcode": "removePartition", "partitionKey": id})
            };
            store_results.push(StoreDispatchResult {
                store_token: token,
                database_changes: vec![DatabaseChange {
                    database_name: database_name(&connection.store_name),
                    opcodes: vec![opcode],
                }],
                error: None,
            });
        }
        Ok(DispatchResult {
            store_results,
            metrics: None,
        })
    }

    /// `fluxapi_flushReplicationStates` — flushes all connections.
    pub fn flush_replication_states(&mut self) {
        self.connections.shrink_to_fit();
    }

    fn connections_by_type(&self, store_names: &[&str]) -> Vec<(StoreToken, &StoreConnection)> {
        store_names
            .iter()
            .flat_map(|name| {
                self.connections
                    .iter()
                    .filter(move |(_, connection)| connection.store_name == *name)
                    .map(|(token, connection)| (*token, connection))
            })
            .collect()
    }

    fn single_store_change(&self, store_name: &str, opcode: serde_json::Value) -> DispatchResult {
        // A poisoned store type produces no results at all (probed).
        if self.poisoned.contains(store_name) {
            return DispatchResult::default();
        }
        DispatchResult {
            store_results: self
                .connections_by_type(&[store_name])
                .into_iter()
                .map(|(store_token, connection)| StoreDispatchResult {
                    store_token,
                    database_changes: vec![DatabaseChange {
                        database_name: database_name(&connection.store_name),
                        opcodes: vec![opcode.clone()],
                    }],
                    error: None,
                })
                .collect(),
            metrics: None,
        }
    }
}

fn id_string(value: &serde_json::Value) -> String {
    value
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| value.to_string())
}

// ------------------------------------------------------------ guild record

/// Required-field lists of the typed guild parse the original materialised
/// (probed: create descriptors require `id`+`premium_subscription_count`,
/// update descriptors additionally require `name`/`features`/levels/tier in
/// declaration order, and a `properties` snapshot is strict in between; the
/// snapshot's errors win over the descriptor's when both are bad).
const GUILD_CREATE_REQUIRED: [&str; 2] = ["id", "premium_subscription_count"];
const GUILD_PROPS_REQUIRED: [&str; 8] = [
    "id",
    "name",
    "features",
    "verification_level",
    "mfa_level",
    "explicit_content_filter",
    "premium_tier",
    "nsfw_level",
];
const GUILD_UPDATE_REQUIRED: [&str; 9] = [
    "id",
    "name",
    "features",
    "verification_level",
    "mfa_level",
    "explicit_content_filter",
    "premium_tier",
    "nsfw_level",
    "premium_subscription_count",
];
const ROLE_REQUIRED: [&str; 6] = ["id", "name", "permissions", "flags", "position", "color"];

fn require_fields(raw: &serde_json::Value, fields: &[&str]) -> Result<(), String> {
    let Some(object) = raw.as_object() else {
        return Ok(());
    };
    for field in fields {
        if !object.contains_key(*field) {
            return Err(format!("missing field `{field}`"));
        }
    }
    Ok(())
}

/// Observable serde type constraints (probed null-type errors only; other
/// mismatches pass through unseen).
fn typed_check(raw: &serde_json::Value, field: &str) -> Result<(), String> {
    let Some(value) = raw.get(field) else {
        return Ok(());
    };
    if !value.is_null() {
        return Ok(());
    }
    Err(format!(
        "invalid type: null, expected {}",
        match field {
            "premium_subscription_count" => "i64",
            "features" => "a sequence",
            _ => "a string",
        }
    ))
}

/// (raw key, record key, ids serialize as strings) — the exact mapping the
/// original's typed guild serializer emits; ids coerce to strings
/// (`ownerId`/`rulesChannelId`/...), `application_id` keeps its snake name,
/// and `vanityURLCode`/`vanity_url_code` both map to `vanityURLCode`.
const GUILD_FIELDS: &[(&str, &str, bool)] = &[
    ("id", "id", true),
    ("name", "name", false),
    ("icon", "icon", false),
    ("features", "features", false),
    ("description", "description", false),
    ("splash", "splash", false),
    ("discovery_splash", "discoverySplash", false),
    ("banner", "banner", false),
    ("home_header", "homeHeader", false),
    ("preferred_locale", "preferredLocale", false),
    ("afk_channel_id", "afkChannelId", true),
    ("afk_timeout", "afkTimeout", false),
    ("system_channel_id", "systemChannelId", true),
    ("verification_level", "verificationLevel", false),
    (
        "default_message_notifications",
        "defaultMessageNotifications",
        false,
    ),
    ("owner_id", "ownerId", true),
    ("application_id", "application_id", true),
    ("mfa_level", "mfaLevel", false),
    ("explicit_content_filter", "explicitContentFilter", false),
    ("vanityURLCode", "vanityURLCode", false),
    ("vanity_url_code", "vanityURLCode", false),
    ("premium_tier", "premiumTier", false),
    ("system_channel_flags", "systemChannelFlags", false),
    ("rules_channel_id", "rulesChannelId", true),
    ("safety_alerts_channel_id", "safetyAlertsChannelId", true),
    (
        "premium_progress_bar_enabled",
        "premiumProgressBarEnabled",
        false,
    ),
    (
        "premium_progress_bar_enabled_user_updated_at",
        "premiumProgressBarEnabledUserUpdatedAt",
        false,
    ),
    ("public_updates_channel_id", "publicUpdatesChannelId", true),
    (
        "max_stage_video_channel_users",
        "maxStageVideoChannelUsers",
        false,
    ),
    ("max_video_channel_users", "maxVideoChannelUsers", false),
    ("max_members", "maxMembers", false),
    ("nsfw_level", "nsfwLevel", false),
    ("hub_type", "hubType", false),
    (
        "latest_onboarding_question_id",
        "latestOnboardingQuestionId",
        true,
    ),
    ("profile", "profile", false),
    ("premium_features", "premiumFeatures", false),
    ("moderator_reporting", "moderatorReporting", false),
    (
        "owner_configured_content_level",
        "ownerConfiguredContentLevel",
        false,
    ),
    ("verification_role_id", "verificationRoleId", true),
    ("game_application_ids", "gameApplicationIds", false),
    ("incidents_data", "incidentsData", false),
    ("linked_game_organization", "linkedGameOrganization", false),
    (
        "premium_subscription_count",
        "premiumSubscriberCount",
        false,
    ),
];

fn record_field(raw_key: &str) -> Option<(&'static str, bool)> {
    GUILD_FIELDS
        .iter()
        .find(|field| field.0 == raw_key)
        .map(|field| (field.1, field.2))
}

/// Non-null fragment of a guild/properties body mapped through the record
/// serializer. Unknown keys are dropped (the typed parse ignores them).
fn guild_fragment(
    raw: &serde_json::Value,
) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    let mut output = serde_json::Map::new();
    if let Some(object) = raw.as_object() {
        for (key, value) in object {
            if value.is_null() {
                continue;
            }
            let Some((record_key, ids)) = record_field(key) else {
                continue;
            };
            let value = if ids {
                serde_json::Value::String(snowflake(value)?)
            } else {
                value.clone()
            };
            output.insert(record_key.to_owned(), value);
        }
    }
    Ok(output)
}

/// The full record the create path serializes, with typed defaults for every
/// field the snapshot omits (probed on a minimal descriptor: `ownerId` null,
/// `maxMembers` -1, `premiumFeatures` null, locale 'en-US', `joinedAt` null).
fn create_template() -> serde_json::Map<String, serde_json::Value> {
    let null_keys = [
        "afkChannelId",
        "application_id",
        "banner",
        "description",
        "discoverySplash",
        "gameApplicationIds",
        "homeHeader",
        "hubType",
        "icon",
        "incidentsData",
        "joinedAt",
        "latestOnboardingQuestionId",
        "linkedGameOrganization",
        "moderatorReporting",
        "ownerConfiguredContentLevel",
        "ownerId",
        "premiumFeatures",
        "premiumProgressBarEnabledUserUpdatedAt",
        "profile",
        "publicUpdatesChannelId",
        "rulesChannelId",
        "safetyAlertsChannelId",
        "splash",
        "systemChannelId",
        "vanityURLCode",
        "verificationRoleId",
    ];
    let mut record = serde_json::Map::new();
    for key in null_keys {
        record.insert(key.to_owned(), serde_json::Value::Null);
    }
    record.insert("afkTimeout".into(), serde_json::json!(0));
    record.insert("defaultMessageNotifications".into(), serde_json::json!(0));
    record.insert("premiumProgressBarEnabled".into(), serde_json::json!(false));
    record.insert("premiumSubscriberCount".into(), serde_json::json!(0));
    record.insert("systemChannelFlags".into(), serde_json::json!(0));
    record.insert("preferredLocale".into(), serde_json::json!("en-US"));
    record.insert("maxMembers".into(), serde_json::json!(-1));
    record.insert("maxStageVideoChannelUsers".into(), serde_json::json!(-1));
    record.insert("maxVideoChannelUsers".into(), serde_json::json!(-1));
    record
}

fn guild_record_value(
    properties: &serde_json::Value,
    guild: &serde_json::Value,
) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    let mut record = create_template();
    for (key, field) in guild_fragment(properties)? {
        record.insert(key, field);
    }
    // The descriptor's `premium_subscription_count` overrides the snapshot's
    // (probed: raw count 5 wins over a snapshot count 0).
    if let Some(count) = guild
        .get("premium_subscription_count")
        .filter(|v| !v.is_null())
    {
        record.insert("premiumSubscriberCount".into(), count.clone());
    }
    Ok(sorted_map(record))
}

/// Role-sync items on create: only the `full_sync` variant syncs a full
/// partition; `update` never syncs; non-map shapes abort (probed texts).
enum RolePayload {
    /// full_sync — replace the partition unconditionally.
    FullSync(serde_json::Map<String, serde_json::Value>),
    /// Sequence-form update — upsert each item, `removeRecord` each removed id.
    UpdateSeq {
        items: Vec<(String, serde_json::Value)>,
        removed: Vec<String>,
    },
    /// Content-less update ("got empty role update…" when no partition).
    Touch,
}

fn build_role_payload(guild: &serde_json::Value, guild_id: &str) -> Result<RolePayload, String> {
    let Some(roles) = guild.get("roles") else {
        return Ok(RolePayload::Touch);
    };
    if let Some(object) = roles.as_object() {
        return match object.get("op").and_then(serde_json::Value::as_str) {
            Some("full_sync") => {
                let items = object
                    .get("items")
                    .ok_or_else(|| "missing field `items`".to_string())?;
                let mut partition = serde_json::Map::new();
                for (id, record) in parse_role_items(items, guild_id)? {
                    partition.insert(id, record);
                }
                Ok(RolePayload::FullSync(partition))
            }
            // Map-form `update` ignores `items`/`removed` keys entirely
            // (probed: invalid bag items do not error; valid items stay a
            // no-op touch).
            Some("update") => Ok(RolePayload::Touch),
            Some(other) => Err(format!(
                "unknown variant `{other}`, expected `full_sync` or `update`"
            )),
            None => Err("missing field `op`".into()),
        };
    }
    let Some(seq) = roles.as_array() else {
        return Err(format!(
            "invalid type: {}, expected internally tagged enum GuildEntitySyncOperation",
            describe_value(roles)
        ));
    };
    if seq.is_empty() {
        return Err("missing field `op`".into());
    }
    let update = match &seq[0] {
        serde_json::Value::String(tag) => match tag.as_str() {
            "full_sync" => false,
            "update" => true,
            other => {
                return Err(format!(
                    "unknown variant `{other}`, expected `full_sync` or `update`"
                ))
            }
        },
        serde_json::Value::Number(number) => {
            if number.is_u64() {
                match number.as_u64() {
                    Some(0) => false,
                    Some(1) => true,
                    Some(index) if index > 1 => {
                        return Err(format!(
                            "invalid value: integer `{index}`, expected variant index 0 <= i < 2"
                        ))
                    }
                    _ => unreachable!("0 and 1 handled above"),
                }
            } else {
                return Err(format!(
                    "invalid type: {}, expected variant identifier",
                    describe_value(&seq[0])
                ));
            }
        }
        other => {
            return Err(format!(
                "invalid type: {}, expected variant identifier",
                describe_value(other)
            ))
        }
    };
    let rest = &seq[1..];
    if !update {
        // FullSync is a single-field struct variant; the sequence must carry
        // exactly the items element.
        if rest.is_empty() {
            return Err(
                "invalid length 0, expected struct variant GuildEntitySyncOperation::FullSync with 1 element"
                    .into(),
            );
        }
        if rest.len() > 1 {
            return Err(format!(
                "invalid length {}, expected 1 element in sequence",
                rest.len()
            ));
        }
        let mut partition = serde_json::Map::new();
        for (id, record) in parse_role_items(&rest[0], guild_id)? {
            partition.insert(id, record);
        }
        return Ok(RolePayload::FullSync(partition));
    }
    // Sequence-form update: fields are positional [items, removed]; the bare
    // `["update"]` shape deserializes both to defaults (touch semantics).
    if rest.is_empty() {
        return Ok(RolePayload::Touch);
    }
    let items = parse_role_items(&rest[0], guild_id)?;
    // # ponytail: only the first extra element is validated (probed shapes);
    // >2-element `removed`/further positional fields never probed.
    let removed = match rest.get(1) {
        Some(value) => parse_removed_ids(value)?,
        None => Vec::new(),
    };
    Ok(RolePayload::UpdateSeq { items, removed })
}

fn parse_role_items(
    items: &serde_json::Value,
    guild_id: &str,
) -> Result<Vec<(String, serde_json::Value)>, String> {
    let Some(items) = items.as_array() else {
        return Err(format!(
            "invalid type: {}, expected a sequence",
            describe_value(items)
        ));
    };
    items
        .iter()
        .map(|item| parse_role_item(item, guild_id))
        .collect()
}

/// `ServerGuildRole` from a value: objects are read by name; sequences
/// (bags) deserialize positionally and trip on `id` first.
fn parse_role_item(
    item: &serde_json::Value,
    guild_id: &str,
) -> Result<(String, serde_json::Value), String> {
    match item {
        serde_json::Value::Object(role) => {
            require_fields(item, &ROLE_REQUIRED)?;
            let _ = role;
            Ok((required_id(item, "id")?, role_record(item, guild_id)))
        }
        serde_json::Value::Array(bag) => {
            // Probed bags: `[["9"]…]` — id comes first positionally.
            let first = bag
                .first()
                .ok_or_else(|| "invalid length 0, expected struct ServerGuildRole".to_string())?;
            snowflake(first)?;
            Err(format!(
                "invalid length {}, expected struct ServerGuildRole with 15 elements",
                bag.len()
            ))
        }
        other => Err(format!(
            "invalid type: {}, expected struct ServerGuildRole",
            describe_value(other)
        )),
    }
}

/// `removed: Vec<Snowflake>` from the seq-update content.
fn parse_removed_ids(value: &serde_json::Value) -> Result<Vec<String>, String> {
    let Some(array) = value.as_array() else {
        return Err(format!(
            "invalid type: {}, expected a sequence",
            describe_value(value)
        ));
    };
    array.iter().map(snowflake).collect()
}

/// Keys in the exact (alphabetical) order the original emits for
/// raw-passthrough records; recursive. Needed now that `serde_json`
/// preserves input order (`preserve_order`).
fn sorted_object(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut entries: Vec<(String, serde_json::Value)> = map
                .into_iter()
                .map(|(key, value)| (key, sorted_object(value)))
                .collect::<Vec<(String, _)>>();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            serde_json::Value::Object(entries.into_iter().collect())
        }
        other => other,
    }
}

/// `sorted_object` returning a raw map (for record constructors).
fn sorted_map(
    map: serde_json::Map<String, serde_json::Value>,
) -> serde_json::Map<String, serde_json::Value> {
    match sorted_object(serde_json::Value::Object(map)) {
        serde_json::Value::Object(fixed) => fixed,
        _ => unreachable!("sorted_object of an object stays an object"),
    }
}

fn describe_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "null".into(),
        serde_json::Value::Bool(b) => format!("boolean `{b}`"),
        serde_json::Value::Number(number) => {
            if number.is_u64() {
                format!("integer `{number}`")
            } else {
                format!("floating point `{number}`")
            }
        }
        serde_json::Value::String(text) => format!("string {text:?}"),
        serde_json::Value::Array(_) => "sequence".into(),
        serde_json::Value::Object(_) => "map".into(),
    }
}

/// Guild updates carry the role list as a plain sequence (missing → empty
/// replacement partition); anything else aborts (probed texts).
fn build_role_partition_update(
    guild: &serde_json::Value,
    guild_id: &str,
) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    let roles = match guild.get("roles") {
        None => return Ok(serde_json::Map::new()),
        Some(roles) => roles,
    };
    let Some(items) = roles.as_array() else {
        return Err("invalid type: map, expected a sequence".into());
    };
    let mut partition = serde_json::Map::new();
    for item in items {
        require_fields(item, &ROLE_REQUIRED)?;
        partition.insert(required_id(item, "id")?, role_record(item, guild_id));
    }
    Ok(partition)
}

fn role_record(item: &serde_json::Value, guild_id: &str) -> serde_json::Value {
    fn color_hex(value: Option<&serde_json::Value>) -> serde_json::Value {
        value
            .and_then(serde_json::Value::as_u64)
            .filter(|color| *color != 0)
            .map(|color| serde_json::Value::String(format!("#{color:06x}")))
            .unwrap_or(serde_json::Value::Null)
    }
    let mut record = item.as_object().cloned().unwrap_or_default();
    record.insert("guildId".into(), serde_json::Value::String(guild_id.into()));
    record.insert("colorString".into(), color_hex(item.get("color")));
    let color_strings = match item.get("colors").filter(|v| !v.is_null()) {
        Some(colors) => serde_json::json!({
            "primaryColor": colors
                .get("primary_color")
                .and_then(serde_json::Value::as_u64)
                .filter(|color| *color != 0)
                .map(|color| serde_json::Value::String(format!("#{color:06x}")))
                .unwrap_or(serde_json::json!("#99aab5")),
            "secondaryColor": color_hex(colors.get("secondary_color")),
            "tertiaryColor": color_hex(colors.get("tertiary_color")),
        }),
        None => serde_json::Value::Null,
    };
    record.insert("colorStrings".into(), color_strings);
    let mut output = serde_json::Map::new();
    // Canonical field order as the original emits (alphabetical).
    for key in [
        "color",
        "colorString",
        "colorStrings",
        "colors",
        "description",
        "flags",
        "guildId",
        "hoist",
        "icon",
        "id",
        "managed",
        "mentionable",
        "name",
        "permissions",
        "position",
        "tags",
        "unicodeEmoji",
        "version",
    ] {
        output.insert(
            key.to_owned(),
            record.remove(key).unwrap_or(match key {
                "description" | "colors" | "colorString" | "colorStrings" | "icon"
                | "unicodeEmoji" | "version" => serde_json::Value::Null,
                "mentionable" | "hoist" | "managed" => serde_json::json!(false),
                "tags" => serde_json::json!({}),
                "position" | "flags" | "color" => serde_json::json!(0),
                _ => serde_json::Value::Null,
            }),
        );
    }
    serde_json::Value::Object(output)
}

const SNOWFLAKE: &str =
    "a snowflake as either a string or a number, which parses to a non-zero u64";

/// The exact serde snowflake surface: string parses to non-zero u64,
/// integers/floating points/null are type errors.
fn snowflake(raw: &serde_json::Value) -> Result<String, String> {
    match raw {
        serde_json::Value::String(text) => {
            let parsed = text.parse::<u64>().ok().filter(|id| *id != 0);
            match parsed {
                Some(id) => Ok(id.to_string()),
                None => Err(format!(
                    "invalid value: string {text:?}, expected {SNOWFLAKE}"
                )),
            }
        }
        serde_json::Value::Number(number) => {
            if number.is_i64() || number.is_u64() {
                match number.as_u64() {
                    Some(id @ 1..) => Ok(id.to_string()),
                    _ => Err(format!(
                        "invalid type: integer `{number}`, expected {SNOWFLAKE}"
                    )),
                }
            } else {
                Err(format!(
                    "invalid type: floating point `{number}`, expected {SNOWFLAKE}"
                ))
            }
        }
        serde_json::Value::Null => Err(format!("invalid type: null, expected {SNOWFLAKE}")),
        _ => Err(format!(
            "invalid type: {}, expected {SNOWFLAKE}",
            describe_value(raw)
        )),
    }
}

/// The exact serde snowflake surface at the option-key level: absent key →
/// `missing field`.
fn required_id(value: &serde_json::Value, field: &str) -> Result<String, String> {
    let Some(raw) = value.get(field) else {
        return Err(format!("missing field `{field}`"));
    };
    snowflake(raw)
}

fn database_name(store_name: &str) -> &'static str {
    match store_name {
        "GuildStore" => "guilds",
        "NoteStore" => "notes",
        "GuildRoleStore" => "guild_roles",
        "RawGuildEmojiStore" => "guild_emojis",
        "GuildStickersStore" => "guildStickers",
        _ => "",
    }
}

fn clear_result(token: StoreToken, store_name: &str) -> StoreDispatchResult {
    StoreDispatchResult {
        store_token: token,
        database_changes: vec![DatabaseChange {
            database_name: database_name(store_name),
            opcodes: vec![serde_json::json!({"opcode": "clearDatabase"})],
        }],
        error: None,
    }
}
