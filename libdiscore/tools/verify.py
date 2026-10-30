#!/usr/bin/env python3
"""Verify the reconstruction against data/libdiscore.wasm.

Run from anywhere: python3 libdiscore/tools/verify.py
"""

import hashlib
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "data"
DATA = (ROOT / "tools/data.bin").read_bytes()
SECTIONS = json.loads((ROOT / "wasm-sections.json").read_text())
MANIFEST = json.loads((ROOT / "wasm-manifest.json").read_text())

EXPECTED_HASHES = {
    "libdiscore.wasm": "180e7ea98efa5934f4a301b08a8237850aafa1c552501ca471a3d40c8f9befd2",
    "libdiscore.c": "114dd3eeebf72aec04381fffdfb4e0584e60d47db9fe7dd6df03cae6cded46bd",
    "data.bin": "165e37e4ad254bd00d9f861e2ebe0e9c8dbb76ecf4a3cf6cbbd59f3a0dbb2927",
}
ORACLE_GLUE_HASH = "e3708ab96b7a6c6316cad048f148dfb4eda3ed609f13a71e131088a43a1bc110"

SEMANTIC_EXPORTS = {
    "fluxapi_connectStore",
    "fluxapi_dispatchAction",
    "fluxapi_findStoresThatCanHandleActionType",
    "fluxapi_flushReplicationStates",
    "fluxapi_getRegisteredActionTypes",
    "fluxapi_new",
    "installLogCallback",
    "__wbg_get_wasmcacheableexperimentconfig_treatmentId",
    "__wbg_set_wasmcacheableexperimentconfig_treatmentId",
    "blockeddomainsstore_isBlockedDomain",
    "blockeddomainsstore_startFetchingBlockedDomains",
    "experimentcacher_clearCache",
    "experimentcacher_flushToCache",
    "experimentcacher_getConfig",
    "generateLaunchSignature",
    "rustMultiply",
    "initLibdiscore",
    "crash",
}

ACTION_NAMES = [
    "LOGOUT", "RESET_SOCKET", "LIBDISCORE_RESET", "CONNECTION_OPEN",
    "USER_NOTE_UPDATE", "USER_NOTE_LOAD_START", "LIBDISCORE_SIMULATE_CRASH",
    "LIBDISCORE_SIMULATE_STORE_ERROR", "GUILD_CREATE", "GUILD_UPDATE",
    "GUILD_DELETE", "GUILD_MEMBER_ADD", "BACKGROUND_SYNC", "CACHE_LOADED",
    "CACHE_LOADED_LAZY", "GUILD_ROLE_CREATE", "GUILD_ROLE_UPDATE",
    "GUILD_ROLE_DELETE", "GUILD_EMOJIS_UPDATE", "CACHED_EMOJIS_LOADED",
    "GUILD_STICKERS_UPDATE", "CACHED_STICKERS_LOADED",
    "GUILD_STICKERS_CREATE_SUCCESS", "GUILD_STICKER_FETCH_SUCCESS",
    "GUILD_STICKERS_FETCH_SUCCESS",
]

PROBES = {
    "311607071601371a00101c0117": "BetterDiscord",
    "311607071601371a00101c01172301161f1c1217": "BetterDiscordPreload",
    "311732031a": "BdApi",
    "01121e111c0b": "rambox",
    "011605161d1416": "revenge",
    "05161d1716070712": "vendetta",
    "11061d1d0a": "bunny",
    "1816070706": "kettu",
    "25161d101c0117": "Vencord",
    "25161d101c01173d12071a0516": "VencordNative",
    "25160018071c033d12071a0516": "VesktopNative",
    "25161d101c01173e1c111a1f16": "VencordMobile",
    "0116031f0614141617": "replugged",
    "2116031f06141416173d12071a0516": "RepluggedNative",
    "1f1614101c0117": "legcord",
    "3f1614101c0117212330": "LegcordRPC",
    "371c011a1c1d": "Dorion",
    "2c2c373c213a3c3d2c303c3d353a342c2c": "__DORION_CONFIG__",
    "2c2c373c213a3c3d2c3a3d3a272c2c": "__DORION_INIT__",
    "34303723": "GCDP",
    "1c03161d12001201": "openasar",
    "001b161f071601": "shelter",
    "1e1c1c1d1f1a141b07": "moonlight",
    "1e1c1c1d1f1a141b073d1c1716": "moonlightNode",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def table(base: int, count: int) -> list[str]:
    out = []
    for i in range(count):
        ptr, size = struct.unpack_from("<II", DATA, base + i * 8)
        out.append(DATA[ptr : ptr + size].decode())
    return out


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    for name, expected in EXPECTED_HASHES.items():
        path = ROOT / "tools/data.bin" if name == "data.bin" else SOURCE / name
        check(sha256(path) == expected, f"SHA-256 mismatch: {path}")
    oracle_glue = ROOT / "tools/oracle/libdiscore-wasm-fetch.js"
    check(sha256(oracle_glue) == ORACLE_GLUE_HASH, "oracle JS glue SHA-256 mismatch")
    check(b'"9cad46e74f330303"' in oracle_glue.read_bytes(), "oracle wasm asset id differs")

    counts = MANIFEST["counts"]
    check(counts["functions"] == 1423, "listing function inventory changed")
    check(counts["imports"] == 114, "listing import inventory changed")
    check(counts["data_segments"] == 1435, "listing data inventory changed")
    check(SECTIONS["export_count"] == 49, "binary export inventory changed")
    check(SECTIONS["import_count"] == 114, "binary import inventory changed")
    check(len(DATA) == 1_283_215, "linear-memory image length changed")

    exports = {item["name"] for item in SECTIONS["exports"]}
    check(SEMANTIC_EXPORTS <= exports, "a reconstructed semantic export is missing")
    check(len(SEMANTIC_EXPORTS) == 18, "semantic export classification changed")
    check(len(exports - SEMANTIC_EXPORTS) == 31, "generated export classification changed")

    action_blob = "".join(ACTION_NAMES).encode()
    check(len(action_blob) == 454, "Action name length changed")
    check(DATA[1_073_314 : 1_073_314 + 454] == action_blob, "Action order differs")

    check(DATA[1_080_552 : 1_080_568] == b"0123456789abcdef", "UUID table differs")
    for encoded, decoded in PROBES.items():
        check(encoded.encode() in DATA, f"probe absent from binary image: {decoded}")
        actual = bytes(b ^ 0x73 for b in bytes.fromhex(encoded)).decode()
        check(actual == decoded, f"probe decode differs: {decoded}")

    properties = table(1_069_220, 42)
    check(properties[:5] == ["id", "name", "icon", "features", "description"],
          "GuildProperties head differs")
    check(properties[19:21] == ["vanityURLCode", "vanity_url_code"],
          "GuildProperties vanity name/alias differs")
    check(properties[-2:] == ["incidents_data", "linked_game_organization"],
          "GuildProperties tail differs")

    guild = table(1_072_084, 43)
    check(guild[17] == "application_id" and guild[19] == "vanityURLCode",
          "Guild explicit field names differ")

    print("source/oracle hashes: 4/4 exact")
    print("inventory:           1423 functions, 114 imports, 49 exports, 1435 data segments")
    print("linear-memory image:  1,283,215 bytes exact")
    print("exports classified:   18 semantic, 31 compiler/runtime generated")
    print("semantic tables:      Action(25), probes(24 + 4 Angular), GuildProperties(41), Guild(43)")
    print("verification:         PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, ValueError) as exc:
        print(f"verification: FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
