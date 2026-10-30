//! Client/launcher fingerprint detection used by
//! `export generateLaunchSignature(externref) -> (i64 pair = serde JsValue)`.
//!
//! Recovered from the generator body (listing 132538-132787) and verified
//! byte-exact against the original Wasm:
//!
//! * 16 random bytes are pulled through the imported `getRandomValues` and
//!   turned into an RFC 4122-v4 UUID string (dashed, lower case).
//! * The detector concatenates *obfuscated hex probe strings* (each byte
//!   serialized as two hex digits and XORed with `0x73`; encoded
//!   representation lives in the wasm data section). Groups are then scanned
//!   for marker strings. Each group controls one reserved bit in the UUID.
//! * The function returns the UUID string directly. This was confirmed against
//!   the original wasm through `tools/oracle/original.mjs`.

use serde::{Deserialize, Serialize};

/// XOR key for the obfuscated hex probe strings.
pub const OBFUSCATION_XOR_KEY: u8 = 0x73;

/// Angular-JS probe markers recovered from the first group — the four JS
/// globals the detector queries on `window`; `jQuery`'s exact bit (119) is
/// documented in `data/libdiscore-launch-signature-metadata.json`.
pub const ANGULAR_PROBES: [&str; 4] = ["jQuery", "$", "fn", "jquery"];
/// The metadata file's bit for the `jQuery` marker (1 << 119).
pub const JQUERY_BIT: u32 = 119;

/// Probe-group bits as numbered by the wasm helper `f_bt`. Numbering is
/// big-endian over the final 16 UUID bytes (bit 0 is byte 0's high bit).
pub const GROUP_BITS: [usize; 11] = [19, 27, 36, 43, 52, 66, 72, 79, 89, 103, 116];

/// The Angular probe is written to bit 119 before the wasm's byte reversal,
/// which is bit 8 in the final UUID bytes.
pub const ANGULAR_OUTPUT_BIT: usize = 8;

/// The 11 property-name groups used by `f_bt`; any present property raises the
/// group's bit.
pub const PROBE_GROUPS: [&[&str]; 11] = [
    &["BetterDiscord", "BetterDiscordPreload", "BdApi"],
    &["rambox"],
    &["revenge", "vendetta", "bunny", "kettu"],
    &["Vencord", "VencordNative", "VesktopNative", "VencordMobile"],
    &["replugged", "RepluggedNative"],
    &["legcord", "LegcordRPC"],
    &["Dorion", "__DORION_CONFIG__", "__DORION_INIT__"],
    &["GCDP"],
    &["openasar"],
    &["shelter"],
    &["moonlight", "moonlightNode"],
];

/// Stable marker identifiers. Multiple markers share a group bit; use
/// `GROUP_BITS` for the actual output positions.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LaunchMarker {
    JQuery = 0,
    Dollar,
    Fn,
    JqueryLower,
    BetterDiscord,
    BetterDiscordPreload,
    BdApi,
    Rambox,
    Revenge,
    Vendetta,
    Bunny,
    Kettu,
    Vencord,
    VencordNative,
    VesktopNative,
    VencordMobile,
    Replugged,
    RepluggedNative,
    Legcord,
    LegcordRPC,
    Dorion,
    DorionConfig,
    DorionInit,
    Gcdp,
    OpenAsar,
    Shelter,
    Moonlight,
    MoonlightNode,
}

/// Serialized probe groups — 11 substring-groups / 24 markers plus the four
/// Angular path components = 28 marker strings. Each is stored as its *obfuscated hex pair
/// sequence* exactly as the binary materialises it; the runtime decodes with
/// the `OBFUSCATION_XOR_KEY` XOR.
pub struct ProbeGroup {
    pub encoded_hex: &'static [&'static str],
    pub decoded: &'static [&'static str],
}

pub fn decode_probe(encoded_hex: &str) -> String {
    let raw = crate::launch_signature_hex::from(encoded_hex);
    raw.iter()
        .map(|b| (b ^ OBFUSCATION_XOR_KEY) as char)
        .collect()
}

/// Resolve the 11 property groups without tying the source-level logic to a
/// particular JS object representation.
pub fn detect_probe_groups(mut has_property: impl FnMut(&str) -> bool) -> [bool; 11] {
    PROBE_GROUPS.map(|group| group.iter().any(|name| has_property(name)))
}

/// Reproduce `generateLaunchSignature` after `getRandomValues` and JS property
/// probing. `angular_probe` means the `jQuery/$ -> fn -> jquery` chain exists.
pub fn generate_from_random(
    mut random: [u8; 16],
    group_hits: [bool; 11],
    angular_probe: bool,
) -> String {
    crate::uuid_v4::prepare_random_uuid_v4(&mut random);
    set_output_bit(&mut random, ANGULAR_OUTPUT_BIT, angular_probe);
    for (bit, present) in GROUP_BITS.into_iter().zip(group_hits) {
        set_output_bit(&mut random, bit, present);
    }
    crate::uuid_v4::hyphenated_uuid_v4(&random)
}

fn set_output_bit(bytes: &mut [u8; 16], bit: usize, value: bool) {
    let mask = 1 << (7 - bit % 8);
    if value {
        bytes[bit / 8] |= mask;
    } else {
        bytes[bit / 8] &= !mask;
    }
}
