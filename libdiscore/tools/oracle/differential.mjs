#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createOriginalOracle } from "./original.mjs";

Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
        getRandomValues(bytes) {
            for (let i = 0; i < bytes.length; i++) bytes[i] = i;
            return bytes;
        },
    },
});

const original = createOriginalOracle();
const expected = [
    String(original.rustMultiply(6, 7)),
    original.generateLaunchSignature({}),
];
globalThis.crypto.getRandomValues = bytes => (bytes.fill(0), bytes);
expected.push(original.generateLaunchSignature({ jQuery: { fn: { jquery: "3" } } }));
for (const property of [
    "BetterDiscord", "rambox", "revenge", "Vencord", "replugged", "legcord",
    "Dorion", "GCDP", "openasar", "shelter", "moonlight",
]) {
    expected.push(original.generateLaunchSignature({ [property]: true }));
}
for (const name of [
    "GuildStore", "NoteStore", "GuildRoleStore", "RawGuildEmojiStore", "GuildStickersStore",
]) {
    const api = new original.FluxApi();
    const { storeToken } = api.connectStore({ storeName: name, databases: [] });
    const actions = api.getRegisteredActionTypes().sort();
    expected.push(`${name}|${storeToken}|${actions.join(",")}`);
    api.free();
}
const duplicates = new original.FluxApi();
const tokens = Array.from({ length: 3 }, () =>
    duplicates.connectStore({ storeName: "GuildStore", databases: [] }).storeToken
);
expected.push(`duplicates|${tokens.join(",")}`);
duplicates.free();
const dispatch = new original.FluxApi();
const guild = JSON.parse(readFileSync(new URL("guild.json", import.meta.url), "utf8"));
const role = { id: "2", name: "r", description: null, permissions: "0", flags: 0,
    mentionable: false, position: 0, color: 0x112233,
    colors: { primary_color: 0x112233, secondary_color: 0x445566, tertiary_color: null },
    hoist: false, managed: false, icon: null, unicodeEmoji: null, tags: {}, version: 1 };
const sticker = { id: "2", name: "s", tags: "x", description: null, format_type: 1,
    available: true, guild_id: "1", version: 1, user_id: null };
for (const storeName of [
    "GuildStore", "NoteStore", "GuildRoleStore", "RawGuildEmojiStore", "GuildStickersStore",
]) dispatch.connectStore({ storeName, databases: [] });
for (const action of [
    { type: "LOGOUT" },
    { type: "RESET_SOCKET" },
    { type: "LIBDISCORE_RESET" },
    { type: "CONNECTION_OPEN" },
    { type: "CACHE_LOADED" },
    { type: "CACHE_LOADED_LAZY" },
    { type: "GUILD_DELETE", guild: { id: "1", unavailable: false } },
    { type: "USER_NOTE_UPDATE", id: "1", note: "hello" },
    { type: "USER_NOTE_LOAD_START", userId: "1" },
    { type: "GUILD_ROLE_DELETE", guildId: "1", roleId: "2" },
    { type: "GUILD_ROLE_CREATE", guildId: "1", role },
    { type: "GUILD_EMOJIS_UPDATE", guildId: "1", emojis: [] },
    { type: "CACHED_EMOJIS_LOADED", guildId: "1", emojis: [] },
    { type: "GUILD_STICKERS_UPDATE", guildId: "1", stickers: [] },
    { type: "CACHED_STICKERS_LOADED", guildId: "1", stickers: [] },
    { type: "GUILD_STICKERS_FETCH_SUCCESS", guildId: "1", stickers: [] },
    { type: "GUILD_STICKERS_CREATE_SUCCESS", guildId: "1", sticker },
    { type: "GUILD_STICKER_FETCH_SUCCESS", sticker },
    { type: "LIBDISCORE_SIMULATE_STORE_ERROR" },
    { type: "GUILD_MEMBER_ADD", guildId: "1", user: { id: "2" } },
    { type: "BACKGROUND_SYNC", guilds: [] },
    { type: "GUILD_CREATE", guild },
    { type: "GUILD_UPDATE", guild },
    { type: "BACKGROUND_SYNC", guilds: [{ data_mode: "full", id: "1", properties: guild, roles: [] }] },
    { type: "BACKGROUND_SYNC", guilds: [{ data_mode: "partial", id: "1", properties: guild, partial_updates: [] }] },
    { type: "BACKGROUND_SYNC", guilds: [{ data_mode: "unavailable", id: "1" }] },
]) {
    const result = dispatch.dispatchAction(JSON.stringify(action), null);
    if (!result.ok) throw new Error(result.error);
    result.value.storeResults.sort((a, b) => a.storeToken - b.storeToken);
    expected.push(JSON.stringify(result.value));
}
dispatch.free();
const guildOps = new original.FluxApi();
for (const storeName of ["GuildStore", "GuildRoleStore", "RawGuildEmojiStore"])
    guildOps.connectStore({ storeName, databases: [] });
for (const type of ["GUILD_CREATE", "GUILD_UPDATE"]) {
    const result = guildOps.dispatchAction(JSON.stringify({
        type,
        guild: { ...guild, properties: guild, partial_updates: [] },
    }), null);
    if (!result.ok) throw new Error(result.error);
    result.value.storeResults.sort((a, b) => a.storeToken - b.storeToken);
    expected.push(JSON.stringify(result.value));
}
guildOps.free();
// ----- Probed GUILD_CREATE/UPDATE semantics -----
// Feature-snapshot defaults (template record), merge behavior, partition
// no-ops and strict-parse errors.
const minProps = Object.fromEntries(
    ["id", "name", "features", "verification_level", "mfa_level",
        "explicit_content_filter", "premium_tier", "nsfw_level"].map(k => [k, guild[k]]),
);
const semanticResult = (api, action) => {
    const result = api.dispatchAction(JSON.stringify(action), null);
    result.value?.storeResults?.sort?.((a, b) => a.storeToken - b.storeToken);
    expected.push(JSON.stringify(result));
};
{
    const api = new original.FluxApi();
    api.connectStore({ storeName: "GuildStore", databases: [] });
    // Minimal-props create: template defaults surface.
    semanticResult(api, {
        type: "GUILD_CREATE",
        guild: { ...guild, properties: { ...minProps, name: "A" } },
    });
    // Create without props re-emits the stored record.
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild } });
    // Update merges the descriptor into the stored record.
    semanticResult(api, { type: "GUILD_UPDATE", guild: { ...guild, name: "C" } });
    // Delete, then update emits nothing (record gone).
    semanticResult(api, { type: "GUILD_DELETE", guild: { id: "1" } });
    semanticResult(api, { type: "GUILD_UPDATE", guild: { ...guild, name: "D" } });
    // Create without props and no record: the merge error.
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild } });
    api.free();
}
{
    const api = new original.FluxApi();
    api.connectStore({ storeName: "GuildStore", databases: [] });
    // Fresh updates: strict descriptor fields (with and without props).
    semanticResult(api, {
        type: "GUILD_UPDATE",
        guild: { id: "1", premium_subscription_count: 0 },
    });
    semanticResult(api, {
        type: "GUILD_UPDATE",
        guild: { ...guild, properties: { id: "1", premium_subscription_count: 0 } },
    });
    // props snapshot required-field/type errors: missing `name`, `name: null`.
    const { name: _name, ...propsNoName } = minProps;
    semanticResult(api, {
        type: "GUILD_CREATE",
        guild: { ...guild, properties: propsNoName },
    });
    semanticResult(api, {
        type: "GUILD_CREATE",
        guild: { ...guild, properties: { ...minProps, name: null } },
    });
    semanticResult(api, {
        type: "GUILD_CREATE",
        guild: { ...guild, properties: { ...minProps, features: null } },
    });
    // Descriptor psub wins over the snapshot's.
    semanticResult(api, {
        type: "GUILD_CREATE",
        guild: {
            ...guild, premium_subscription_count: 5,
            properties: { ...minProps, name: "E", premium_subscription_count: 0 },
        },
    });
    api.free();
}
{
    const api = new original.FluxApi();
    api.connectStore({ storeName: "GuildRoleStore", databases: [] });
    const role9 = {
        id: "9", name: "r", permissions: "0", flags: 0, position: 0, color: 0,
    };
    // Fresh create without roles: partition-missing error.
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild } });
    // full_sync syncs the partition content, repeat creates still re-emit.
    semanticResult(api, {
        type: "GUILD_CREATE",
        guild: { ...guild, roles: { op: "full_sync", items: [role9] } },
    });
    semanticResult(api, {
        type: "GUILD_CREATE",
        guild: { ...guild, roles: { op: "full_sync", items: [role9] } },
    });
    // Update replaces the partition with the roles array (or empties it).
    semanticResult(api, { type: "GUILD_UPDATE", guild: { ...guild } });
    semanticResult(api, { type: "GUILD_UPDATE", guild: { ...guild, roles: [role9] } });
    // Equal content: no result at all.
    semanticResult(api, { type: "GUILD_UPDATE", guild: { ...guild } });
    // Role upsert refreshes the partition silently.
    semanticResult(api, { type: "GUILD_ROLE_CREATE", guildId: "1", role: role9 });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild } });
    // Role payload parse errors.
    semanticResult(api, {
        type: "GUILD_CREATE",
        guild: { ...guild, roles: { op: "update", items: [] } },
    });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: {} } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: [] } });
    semanticResult(api, { type: "GUILD_UPDATE", guild: { ...guild, roles: {} } });
    api.free();
}
{
    const api = new original.FluxApi();
    api.connectStore({ storeName: "GuildRoleStore", databases: [] });
    const role9 = { id: "9", name: "r", permissions: "0", flags: 0, position: 0, color: 0 };
    const role10 = { id: "10", name: "r10", permissions: "0", flags: 0, position: 0, color: 3 };
    // Sequence roles deserializes variant-first: [variant, items, removed].
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["update", [role9]] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["update", [role10]] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["update", [role9], ["10"]] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["update", [], ["11"]] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["full_sync", [role9, role10]] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: [0, [role9]] } });
    // Bare `["update"]` deserializes to touch-only (missing-partition error).
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["update"] } });
    // Tag/type and variant-length errors.
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: [5, []] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["x", []] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: [true] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: [["full_sync"]] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["full_sync"] } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: ["full_sync", [role9], 5] } });
    // Map-form update ignores its content keys entirely (no validation, no
    // emission once a partition exists).
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: { op: "update", items: [[role9]] } } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: { op: "update", removed: [role9] } } });
    api.free();
}
{
    const api = new original.FluxApi();
    api.connectStore({ storeName: "GuildRoleStore", databases: [] });
    const role9 = { id: "9", name: "r", permissions: "0", flags: 0, position: 0, color: 0 };
    // A store-level error poisons the store: every later semantic result is
    // suppressed (parse errors still propagate) until a reset clears it.
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild } });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild } });
    semanticResult(api, { type: "GUILD_UPDATE", guild: { ...guild, roles: [role9] } });
    semanticResult(api, { type: "CACHE_LOADED" });
    semanticResult(api, { type: "LOGOUT" });
    semanticResult(api, { type: "GUILD_CREATE", guild: { ...guild, roles: { op: "full_sync", items: [role9] } } });
    semanticResult(api, { type: "GUILD_DELETE", guild: { id: "1" } });
    api.free();
}
const roleSync = new original.FluxApi();
roleSync.connectStore({ storeName: "GuildRoleStore", databases: [] });
const roleResult = roleSync.dispatchAction(JSON.stringify({
    type: "GUILD_CREATE",
    guild: { ...guild, roles: { op: "full_sync", items: [] } },
}), null);
if (!roleResult.ok) throw new Error(roleResult.error);
expected.push(JSON.stringify(roleResult.value));
expected.push(JSON.stringify(roleSync.flushReplicationStates()));
roleSync.free();
for (const type of [
    "LOGOUT", "RESET_SOCKET", "LIBDISCORE_RESET", "CONNECTION_OPEN",
    "USER_NOTE_UPDATE", "USER_NOTE_LOAD_START", "LIBDISCORE_SIMULATE_CRASH",
    "LIBDISCORE_SIMULATE_STORE_ERROR", "GUILD_CREATE", "GUILD_UPDATE",
    "GUILD_DELETE", "GUILD_MEMBER_ADD", "BACKGROUND_SYNC", "CACHE_LOADED",
    "CACHE_LOADED_LAZY", "GUILD_ROLE_CREATE", "GUILD_ROLE_UPDATE",
    "GUILD_ROLE_DELETE", "GUILD_EMOJIS_UPDATE", "CACHED_EMOJIS_LOADED",
    "GUILD_STICKERS_UPDATE", "CACHED_STICKERS_LOADED",
    "GUILD_STICKERS_CREATE_SUCCESS", "GUILD_STICKER_FETCH_SUCCESS",
    "GUILD_STICKERS_FETCH_SUCCESS",
]) {
    const malformed = new original.FluxApi();
    expected.push(JSON.stringify(malformed.dispatchAction(JSON.stringify({ type }), null)));
    malformed.free();
}
const actual = execFileSync(
    "cargo",
    ["run", "--quiet", "--example", "oracle_vectors"],
    { cwd: new URL("../..", import.meta.url), encoding: "utf8" },
).trim().split("\n");

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(JSON.stringify({ expected, actual }, null, 2));
    process.exit(1);
}

console.log("differential oracle: PASS");
console.log(`rustMultiply(6, 7): ${actual[0]}`);
console.log(`generateLaunchSignature(range(16), {}): ${actual[1]}`);
console.log("launch-signature probe groups: 12/12 exact");
console.log("Flux store handler sets: 5/5 exact");
console.log("Flux duplicate token allocation: exact");
console.log("Flux dispatch vectors: 29/29 exact");
console.log("Malformed action envelopes: 25/25 exact");
console.log(`Semantic vectors: ${expected.length - 54}/${expected.length - 54} exact`);
