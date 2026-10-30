fn main() {
    let random = core::array::from_fn(|i| i as u8);
    println!("{}", libdiscore::rust_multiply(6.0, 7.0));
    println!(
        "{}",
        libdiscore::launch_signature::generate_from_random(random, [false; 11], false)
    );
    println!(
        "{}",
        libdiscore::launch_signature::generate_from_random([0; 16], [false; 11], true)
    );
    for group in 0..11 {
        let mut hits = [false; 11];
        hits[group] = true;
        println!(
            "{}",
            libdiscore::launch_signature::generate_from_random([0; 16], hits, false)
        );
    }

    use libdiscore::stores::{ConnectResult, FluxApi, StoreConnection};
    for name in [
        "GuildStore",
        "NoteStore",
        "GuildRoleStore",
        "RawGuildEmojiStore",
        "GuildStickersStore",
    ] {
        let mut api = FluxApi::new();
        let result = api.connect_store(StoreConnection {
            store_name: name.into(),
            databases: vec![],
        });
        let token = match result {
            ConnectResult::Ok(value) => value.store_token.0,
            ConnectResult::Err(error) => panic!("{error}"),
        };
        let mut actions: Vec<_> = api
            .get_registered_action_types()
            .into_iter()
            .map(|action| action.name())
            .collect();
        actions.sort_unstable();
        println!("{name}|{token}|{}", actions.join(","));
    }

    let mut api = FluxApi::new();
    let mut tokens = Vec::new();
    for _ in 0..3 {
        match api.connect_store(StoreConnection {
            store_name: "GuildStore".into(),
            databases: vec![],
        }) {
            ConnectResult::Ok(value) => tokens.push(value.store_token.0.to_string()),
            ConnectResult::Err(error) => panic!("{error}"),
        }
    }
    println!("duplicates|{}", tokens.join(","));

    let mut api = FluxApi::new();
    for name in [
        "GuildStore",
        "NoteStore",
        "GuildRoleStore",
        "RawGuildEmojiStore",
        "GuildStickersStore",
    ] {
        let _ = api.connect_store(StoreConnection {
            store_name: name.into(),
            databases: vec![],
        });
    }
    let guild = include_str!("../tools/oracle/guild.json").trim();
    let guild_create = format!(r#"{{"type":"GUILD_CREATE","guild":{guild}}}"#);
    let guild_update = format!(r#"{{"type":"GUILD_UPDATE","guild":{guild}}}"#);
    let background_full = format!(
        r#"{{"type":"BACKGROUND_SYNC","guilds":[{{"data_mode":"full","id":"1","properties":{guild},"roles":[]}}]}}"#
    );
    let background_partial = format!(
        r#"{{"type":"BACKGROUND_SYNC","guilds":[{{"data_mode":"partial","id":"1","properties":{guild},"partial_updates":[]}}]}}"#
    );
    for action in [
        r#"{"type":"LOGOUT"}"#,
        r#"{"type":"RESET_SOCKET"}"#,
        r#"{"type":"LIBDISCORE_RESET"}"#,
        r#"{"type":"CONNECTION_OPEN"}"#,
        r#"{"type":"CACHE_LOADED"}"#,
        r#"{"type":"CACHE_LOADED_LAZY"}"#,
        r#"{"type":"GUILD_DELETE","guild":{"id":"1","unavailable":false}}"#,
        r#"{"type":"USER_NOTE_UPDATE","id":"1","note":"hello"}"#,
        r#"{"type":"USER_NOTE_LOAD_START","userId":"1"}"#,
        r#"{"type":"GUILD_ROLE_DELETE","guildId":"1","roleId":"2"}"#,
        r#"{"type":"GUILD_ROLE_CREATE","guildId":"1","role":{"id":"2","name":"r","description":null,"permissions":"0","flags":0,"mentionable":false,"position":0,"color":1122867,"colors":{"primary_color":1122867,"secondary_color":4478310,"tertiary_color":null},"hoist":false,"managed":false,"icon":null,"unicodeEmoji":null,"tags":{},"version":1}}"#,
        r#"{"type":"GUILD_EMOJIS_UPDATE","guildId":"1","emojis":[]}"#,
        r#"{"type":"CACHED_EMOJIS_LOADED","guildId":"1","emojis":[]}"#,
        r#"{"type":"GUILD_STICKERS_UPDATE","guildId":"1","stickers":[]}"#,
        r#"{"type":"CACHED_STICKERS_LOADED","guildId":"1","stickers":[]}"#,
        r#"{"type":"GUILD_STICKERS_FETCH_SUCCESS","guildId":"1","stickers":[]}"#,
        r#"{"type":"GUILD_STICKERS_CREATE_SUCCESS","guildId":"1","sticker":{"id":"2","name":"s","tags":"x","description":null,"format_type":1,"available":true,"guild_id":"1","version":1,"user_id":null}}"#,
        r#"{"type":"GUILD_STICKER_FETCH_SUCCESS","sticker":{"id":"2","name":"s","tags":"x","description":null,"format_type":1,"available":true,"guild_id":"1","version":1,"user_id":null}}"#,
        r#"{"type":"LIBDISCORE_SIMULATE_STORE_ERROR"}"#,
        r#"{"type":"GUILD_MEMBER_ADD","guildId":"1","user":{"id":"2"}}"#,
        r#"{"type":"BACKGROUND_SYNC","guilds":[]}"#,
        &guild_create,
        &guild_update,
        &background_full,
        &background_partial,
        r#"{"type":"BACKGROUND_SYNC","guilds":[{"data_mode":"unavailable","id":"1"}]}"#,
    ] {
        let mut result = api.dispatch_json(action).unwrap();
        result
            .store_results
            .sort_by_key(|result| result.store_token.0);
        println!("{}", serde_json::to_string(&result).unwrap());
    }

    let mut fresh = FluxApi::new();
    for name in ["GuildStore", "GuildRoleStore", "RawGuildEmojiStore"] {
        let _ = fresh.connect_store(StoreConnection {
            store_name: name.into(),
            databases: vec![],
        });
    }
    let properties: serde_json::Value = serde_json::from_str(guild).unwrap();
    let mut guild_operation = properties.clone();
    let operation = guild_operation.as_object_mut().unwrap();
    operation.insert("properties".into(), properties);
    operation.insert("partial_updates".into(), serde_json::json!([]));
    for kind in ["GUILD_CREATE", "GUILD_UPDATE"] {
        let action = serde_json::json!({"type": kind, "guild": guild_operation}).to_string();
        let mut result = fresh.dispatch_json(&action).unwrap();
        result
            .store_results
            .sort_by_key(|result| result.store_token.0);
        println!("{}", serde_json::to_string(&result).unwrap());
    }
    // ----- Probed GUILD_CREATE/UPDATE semantics -----
    let guild_value: serde_json::Value = serde_json::from_str(guild).unwrap();
    let semantic = |api: &mut FluxApi, action: serde_json::Value| {
        let action = action.to_string();
        let printed = match api.dispatch_json(&action) {
            Ok(mut value) => {
                value
                    .store_results
                    .sort_by_key(|result| result.store_token.0);
                format!(
                    r#"{{"ok":true,"value":{}}}"#,
                    serde_json::to_string(&value).unwrap()
                )
            }
            Err(error) => format!(
                r#"{{"ok":false,"error":{}}}"#,
                serde_json::to_string(&error).unwrap()
            ),
        };
        println!("{printed}");
    };
    let min_props = serde_json::json!({
        "id": guild_value["id"],
        "name": guild_value["name"],
        "features": guild_value["features"],
        "verification_level": guild_value["verification_level"],
        "mfa_level": guild_value["mfa_level"],
        "explicit_content_filter": guild_value["explicit_content_filter"],
        "premium_tier": guild_value["premium_tier"],
        "nsfw_level": guild_value["nsfw_level"],
    });
    let mut ptivate = FluxApi::new();
    let _ = ptivate.connect_store(StoreConnection {
        store_name: "GuildStore".into(),
        databases: vec![],
    });
    // Minimal-props create: the template-record defaults surface.
    let mut props_a = min_props.clone();
    props_a["name"] = serde_json::json!("A");
    let mut create_a = guild_value.clone();
    create_a["properties"] = props_a.clone();
    semantic(
        &mut ptivate,
        serde_json::json!({"type": "GUILD_CREATE", "guild": create_a}),
    );
    // Create without props re-emits the stored record.
    semantic(
        &mut ptivate,
        serde_json::json!({"type": "GUILD_CREATE", "guild": guild_value.clone()}),
    );
    // Update merges the descriptor into the stored record.
    let mut update_c = guild_value.clone();
    update_c["name"] = serde_json::json!("C");
    semantic(
        &mut ptivate,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": update_c}),
    );
    // Delete, then update emits nothing (the record is gone).
    semantic(
        &mut ptivate,
        serde_json::json!({"type": "GUILD_DELETE", "guild": {"id": "1"}}),
    );
    let mut update_d = guild_value.clone();
    update_d["name"] = serde_json::json!("D");
    semantic(
        &mut ptivate,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": update_d}),
    );
    // Create without props and no record: the merge error.
    semantic(
        &mut ptivate,
        serde_json::json!({"type": "GUILD_CREATE", "guild": guild_value.clone()}),
    );
    let mut fresh_gs = FluxApi::new();
    let _ = fresh_gs.connect_store(StoreConnection {
        store_name: "GuildStore".into(),
        databases: vec![],
    });
    // Fresh updates: strict descriptor fields (with and without props).
    semantic(
        &mut fresh_gs,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": {"id": "1", "premium_subscription_count": 0}}),
    );
    let mut update_min_props = guild_value.clone();
    update_min_props["properties"] =
        serde_json::json!({"id": "1", "premium_subscription_count": 0});
    semantic(
        &mut fresh_gs,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": update_min_props}),
    );
    // props snapshot errors: missing `name`, `name: null`, `features: null`.
    let mut props_no_name = min_props.clone();
    props_no_name
        .as_object_mut()
        .unwrap()
        .remove("name")
        .unwrap();
    let mut create_no_name = guild_value.clone();
    create_no_name["properties"] = props_no_name;
    semantic(
        &mut fresh_gs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": create_no_name}),
    );
    let mut props_name_null = min_props.clone();
    props_name_null["name"] = serde_json::Value::Null;
    let mut create_name_null = guild_value.clone();
    create_name_null["properties"] = props_name_null;
    semantic(
        &mut fresh_gs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": create_name_null}),
    );
    let mut props_features_null = min_props.clone();
    props_features_null["features"] = serde_json::Value::Null;
    let mut create_features_null = guild_value.clone();
    create_features_null["properties"] = props_features_null;
    semantic(
        &mut fresh_gs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": create_features_null}),
    );
    // The descriptor's psub wins over the snapshot's.
    let mut props_e = min_props.clone();
    props_e["name"] = serde_json::json!("E");
    props_e["premium_subscription_count"] = serde_json::json!(0);
    let mut create_e = guild_value.clone();
    create_e["properties"] = props_e;
    create_e["premium_subscription_count"] = serde_json::json!(5);
    semantic(
        &mut fresh_gs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": create_e}),
    );
    let mut prs = FluxApi::new();
    let _ = prs.connect_store(StoreConnection {
        store_name: "GuildRoleStore".into(),
        databases: vec![],
    });
    let role9 = serde_json::json!({
        "id": "9", "name": "r", "permissions": "0", "flags": 0, "position": 0, "color": 0
    });
    let with_roles = |roles: serde_json::Value| {
        let mut action = guild_value.clone();
        action["roles"] = roles;
        action
    };
    // Fresh create without roles: partition-missing error.
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": guild_value.clone()}),
    );
    // full_sync syncs the partition content; repeated creates still re-emit.
    let full_sync = serde_json::json!({"op": "full_sync", "items": [role9.clone()]});
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(full_sync.clone())}),
    );
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(full_sync)}),
    );
    // Update replaces the partition with the roles array (or empties it).
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": guild_value.clone()}),
    );
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": with_roles(serde_json::json!([role9.clone()]))}),
    );
    // Equal content: no result at all.
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": guild_value.clone()}),
    );
    // Role upsert refreshes the partition silently.
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_ROLE_CREATE", "guildId": "1", "role": role9}),
    );
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": guild_value.clone()}),
    );
    // Role payload parse errors.
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!({"op": "update", "items": []}))}),
    );
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!({}))}),
    );
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!([]))}),
    );
    semantic(
        &mut prs,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": with_roles(serde_json::json!({}))}),
    );
    let mut seq = FluxApi::new();
    let _ = seq.connect_store(StoreConnection {
        store_name: "GuildRoleStore".into(),
        databases: vec![],
    });
    let role10 = serde_json::json!({"id": "10", "name": "r10", "permissions": "0", "flags": 0, "position": 0, "color": 3});
    // Sequence-form roles: [variant, items, removed].
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["update", [role9.clone()]]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["update", [role10.clone()]]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["update", [role9.clone()], ["10"]]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["update", [], ["11"]]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["full_sync", [role9.clone(), role10.clone()]]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!([0, [role9.clone()]]))}),
    );
    // Bare `["update"]` deserializes to touch-only (missing-partition error).
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["update"]))}),
    );
    // Tag/type and variant-length errors.
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!([5, []]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["x", []]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!([true]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!([["full_sync"]]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["full_sync"]))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!(["full_sync", [role9.clone()], 5]))}),
    );
    // Map-form update ignores its content keys entirely.
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!({"op": "update", "items": [[role9.clone()]]}))}),
    );
    semantic(
        &mut seq,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!({"op": "update", "removed": [role9.clone()]}))}),
    );
    // A store-level error poisons the store: every later semantic result is
    // suppressed until a reset clears it.
    let mut poison = FluxApi::new();
    let _ = poison.connect_store(StoreConnection {
        store_name: "GuildRoleStore".into(),
        databases: vec![],
    });
    semantic(
        &mut poison,
        serde_json::json!({"type": "GUILD_CREATE", "guild": guild_value.clone()}),
    );
    semantic(
        &mut poison,
        serde_json::json!({"type": "GUILD_CREATE", "guild": guild_value.clone()}),
    );
    semantic(
        &mut poison,
        serde_json::json!({"type": "GUILD_UPDATE", "guild": with_roles(serde_json::json!([role9.clone()]))}),
    );
    semantic(&mut poison, serde_json::json!({"type": "CACHE_LOADED"}));
    semantic(&mut poison, serde_json::json!({"type": "LOGOUT"}));
    semantic(
        &mut poison,
        serde_json::json!({"type": "GUILD_CREATE", "guild": with_roles(serde_json::json!({"op": "full_sync", "items": [role9]}))}),
    );
    semantic(
        &mut poison,
        serde_json::json!({"type": "GUILD_DELETE", "guild": {"id": "1"}}),
    );
    let mut roles = FluxApi::new();
    let _ = roles.connect_store(StoreConnection {
        store_name: "GuildRoleStore".into(),
        databases: vec![],
    });
    let mut role_guild: serde_json::Value = serde_json::from_str(guild).unwrap();
    role_guild.as_object_mut().unwrap().insert(
        "roles".into(),
        serde_json::json!({"op": "full_sync", "items": []}),
    );
    let mut result = roles
        .dispatch_json(
            &serde_json::json!({"type": "GUILD_CREATE", "guild": role_guild}).to_string(),
        )
        .unwrap();
    result
        .store_results
        .sort_by_key(|result| result.store_token.0);
    println!("{}", serde_json::to_string(&result).unwrap());
    println!("null");

    for action in libdiscore::action::Action::ALL {
        let mut malformed = FluxApi::new();
        let payload = serde_json::json!({"type": action.name()}).to_string();
        let envelope = match malformed.dispatch_json(&payload) {
            Ok(value) => format!(
                r#"{{"ok":true,"value":{}}}"#,
                serde_json::to_string(&value).unwrap()
            ),
            Err(error) => format!(
                r#"{{"ok":false,"error":{}}}"#,
                serde_json::to_string(&error).unwrap()
            ),
        };
        println!("{envelope}");
    }
}
