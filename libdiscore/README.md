# libdiscore reconstruction

Rust reconstruction of `data/libdiscore.wasm`, using the wasm binary as the
source of truth and `data/libdiscore.c` (wabt `--decompiler` output) for control
flow and symbol shape.

> **Current status:** behaviorally 1:1 across every differential-oracle path
> exercised so far. Binary inventory and recovered data are exact; the oracle's
> 121 differential vectors (29 dispatch paths, 25 malformed envelopes, 67
> semantic store sequences including store-level poison, sequence-form role
> sync payloads, guild record merges, role/sticker CRUD, background sync, and
> blocked-domain synchronization) all match bit-for-bit. The remaining pursuit
> is depth: more exotic serde error surfaces beyond the probed grammar.

## Verified coverage

Run:

```sh
cd libdiscore
python3 tools/verify.py
node tools/oracle/verify-glue.mjs
node tools/oracle/verify-generated.mjs
node tools/oracle/differential.mjs
```

The verifier pins the input artifact hashes and checks:

- **1,423/1,423** decompiler-listed functions inventoried;
- **114/114** imports and **49/49** exports inventoried from the wasm binary;
- **1,435/1,435** data segments reconstructed into a byte-exact
  **1,283,215-byte** linear-memory image (`tools/data.bin`);
- all 25 `Action` variants in binary order;
- all 24 client probes plus four Angular probes, including their original
  hex/XOR-`0x73` representation;
- binary serde field tables for `GuildProperties` (41 fields), `Guild` (43),
  roles, emojis, stickers, notes, and supporting payloads;
- recovered error messages, cache keys, endpoint, UUID formatting table, and
  panic source paths at their exact memory addresses.

The recovered binary tables established two otherwise-invisible serde details:
`vanityURLCode` is the canonical name in both guild structures, while
`GuildProperties` also accepts `vanity_url_code` as an alias.

`tools/oracle/original.mjs` instantiates the original Wasm using the exact
Discord JS glue for asset `9cad46e74f330303`. `differential.mjs` runs original
and Rust implementations with the same deterministic inputs and fails on any
different result. This caught the original UUID byte reversal and reserved
fingerprint bits that static inspection had missed.

The distributable `libdiscore_wasm.js`, `libdiscore_wasm_bg.js`, type files,
and `libdiscore_wasm_bg.wasm` are generated from this Rust clone by pinned
`wasm-bindgen-cli 0.2.100`; run `tools/build-wasm.sh` to regenerate them.

The finished original Wasm externalizes its host module, so wasm-bindgen cannot
regenerate that historical module from the processed artifact. Its oracle-only
recovery lives at `tools/oracle/libdiscore_wasm_bg.original.js`. Its source is
Discord canary chunks `841873.js` (implementation; SHA-256 `735096d5…cc65`) and
`5426.js` (canonical import map; SHA-256 `ebd2b031…1e3`). Use
`ORACLE=recovered` with either oracle suite; `verify-glue.mjs` checks all 114
original imports and public wrapper behavior.

The wasm build pins the original runtime versions: `wasm-bindgen 0.2.100`,
`js-sys`/`web-sys 0.3.77`, and `wasm-streams 0.4.2`. All thirteen original
wasm-streams source/byte-source/sink exports are emitted by those dependencies.

## Export map (49/49)

“Generated” means wasm-bindgen/allocator/wasm-streams ABI glue rather than an
independent libdiscore source behavior. Those exports are inventoried and
mapped, but intentionally left to the corresponding Rust compiler/runtime.

| Wasm export | Reconstruction |
|---|---|
| `memory` | wasm linear memory; initial data image is `tools/data.bin` |
| `__wbg_fluxapi_free` | generated `FluxApi` drop glue |
| `fluxapi_connectStore` | `FluxApi::connect_store` |
| `fluxapi_dispatchAction` | `FluxApi::dispatch_action` |
| `fluxapi_findStoresThatCanHandleActionType` | `FluxApi::find_stores_that_can_handle_action_type` |
| `fluxapi_flushReplicationStates` | `FluxApi::flush_replication_states` |
| `fluxapi_getRegisteredActionTypes` | `FluxApi::get_registered_action_types` |
| `fluxapi_new` | `FluxApi::new` |
| `installLogCallback` | `logger` callback state |
| `__wbg_blockeddomainsstore_free` | generated `BlockedDomainsStore` drop glue |
| `__wbg_experimentcacher_free` | generated experiment cacher drop glue |
| `__wbg_get_wasmcacheableexperimentconfig_treatmentId` | `CacheableExperimentConfig::treatment_id` getter |
| `__wbg_set_wasmcacheableexperimentconfig_treatmentId` | treatment ID setter |
| `__wbg_wasmcacheableexperimentconfig_free` | generated config drop glue |
| `blockeddomainsstore_isBlockedDomain` | `BlockedDomainsStore::is_blocked` |
| `blockeddomainsstore_startFetchingBlockedDomains` | blocked-domain fetch/update flow and constants |
| `experimentcacher_clearCache` | experiment cache clear flow |
| `experimentcacher_flushToCache` | `ExperimentSnapshot::to_bytes` cache flow |
| `experimentcacher_getConfig` | `CacheableExperimentConfig` |
| `generateLaunchSignature` | `launch_signature` + `uuid_v4` |
| `rustMultiply` | `rust_multiply` |
| `initLibdiscore` | logger/store initialization glue |
| `crash` | `crash` |
| `__wbg_intounderlyingbytesource_free` | generated wasm-streams drop glue |
| `intounderlyingbytesource_autoAllocateChunkSize` | generated wasm-streams adapter |
| `intounderlyingbytesource_cancel` | generated wasm-streams adapter |
| `intounderlyingbytesource_pull` | generated wasm-streams adapter |
| `intounderlyingbytesource_start` | generated wasm-streams adapter |
| `intounderlyingbytesource_type` | generated wasm-streams adapter |
| `__wbg_intounderlyingsource_free` | generated wasm-streams drop glue |
| `intounderlyingsource_cancel` | generated wasm-streams adapter |
| `intounderlyingsource_pull` | generated wasm-streams adapter |
| `__wbg_intounderlyingsink_free` | generated wasm-streams drop glue |
| `intounderlyingsink_abort` | generated wasm-streams adapter |
| `intounderlyingsink_close` | generated wasm-streams adapter |
| `intounderlyingsink_write` | generated wasm-streams adapter |
| `__wbindgen_malloc` | generated allocator ABI |
| `__wbindgen_realloc` | generated allocator ABI |
| `__wbindgen_exn_store` | generated exception ABI |
| `__externref_table_alloc` | generated externref ABI |
| `__wbindgen_export_4` | generated function table |
| `__wbindgen_export_5` | generated function table |
| `__externref_table_dealloc` | generated externref ABI |
| `__wbindgen_free` | generated allocator ABI |
| `_dyn_core_f73ed7932dd6acc___ops__function__FnMut_____Output______as_wasm_bindgen_9353bb4e5bfa4c18___closure__WasmClosure___describe__invoke______` | generated closure invoke glue |
| `_dyn_core_f73ed7932dd6acc___ops__function__FnMut_____Output______as_wasm_bindgen_9353bb4e5bfa4c18___closure__WasmClosure___describe__invoke______10` | generated closure invoke glue |
| `closure712_externref_shim` | generated closure shim |
| `closure751_externref_shim` | generated closure shim |
| `__wbindgen_start` | generated wasm-bindgen startup |

## Layout

- `src/action.rs` — exact action enum names and dispatch order.
- `src/model.rs` — recovered serde payload model and field aliases.
- `src/stores.rs` — store registry, handler routing, and Flux API behavior.
- `src/blocked_domains.rs` — persisted state parser and blocklist store.
- `src/experiment_cacher.rs` — versioned experiment snapshots.
- `src/launch_signature.rs` — client probe table and decoder.
- `src/uuid_v4.rs` — launch-signature UUID formatting.
- `src/wasm_glue.rs` — source-level wasm export mapping.
- `tools/parse_wasm_bin.py` — authoritative binary inventory/data extractor.
- `tools/parse_wat.py` — complete decompiler-listing inventory.
- `tools/extract_strpairs.py` — `(ptr,len)` Rust string/table recovery.
- `tools/verify.py` — reproducible fidelity checks.

## Fidelity boundary

This is a source-level reconstruction, not an attempt to reproduce rustc's
exact machine-code layout. Libdiscore-owned models, strings, ordering, and
recoverable behavior are represented in Rust. Allocator internals,
wasm-bindgen closure shims, externref bookkeeping, and wasm-streams adapters are
compiler/dependency implementation details; their original exports and bytes
remain fully inventoried, while a wasm build delegates them to the current Rust
toolchain and dependencies.

The original `data/libdiscore.wasm` and `data/libdiscore.c` are read-only inputs.
