#!/usr/bin/env node
/**
 * Instantiate data/libdiscore.wasm through the de-minified glue reconstruction
 * (libdiscore_wasm_bg.original.js) instead of the hashed Discord asset.
 *
 * The instantiation contract is the same as original.mjs's:
 *   WebAssembly.Module(wasm bytes) -> read its declared imports ->
 *   resolve every import name against the glue module ->
 *   WebAssembly.Instance -> glue.setWasm(instance.exports) -> wasm.__wbindgen_start().
 *
 * Read operations are strictly read-only against
 * /home/wavedev/wavetools-revamped/opencode-workdir/discrapper-canary.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as glue from "./libdiscore_wasm_bg.original.js";

const wasmBytes = fs.readFileSync(
    new URL("../../../data/libdiscore.wasm", import.meta.url),
);

const IMPORT_MODULE = "./libdiscore_wasm_bg.js";

export function createRecoveredOracle({ onImport } = {}) {
    const module = new WebAssembly.Module(wasmBytes);
    const needed = WebAssembly.Module.imports(module);

    const importObject = {};
    for (const entry of needed) {
        if (entry.module !== IMPORT_MODULE) {
            throw new Error(`unexpected import module: ${entry.module}.${entry.name}`);
        }
        const fn = glue[entry.name];
        if (typeof fn !== "function") {
            throw new Error(`recovered glue is missing import '${entry.name}'`);
        }
        importObject[entry.name] = onImport
            ? (...args) => {
                onImport(`${entry.module}.${entry.name}`, args);
                return fn(...args);
            }
            : fn;
    }

    let wasm;
    wasm = new WebAssembly.Instance(module, { [IMPORT_MODULE]: importObject }).exports;
    glue.setWasm(wasm);
    wasm.__wbindgen_start();

    return {
        exports: wasm,
        BlockedDomainsStore: glue.BlockedDomainsStore,
        ExperimentCacher: glue.ExperimentCacher,
        FluxApi: glue.FluxApi,
        WasmCacheableExperimentConfig: glue.WasmCacheableExperimentConfig,
        rustMultiply: glue.rustMultiply,
        initLibdiscore: glue.initLibdiscore,
        crash: glue.crash,
        generateLaunchSignature: glue.generateLaunchSignature,
        installLogCallback: glue.installLogCallback,
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const oracle = createRecoveredOracle();
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {
        getRandomValues(bytes) {
            for (let i = 0; i < bytes.length; i++) bytes[i] = i;
            return bytes;
        },
    }});
    const result = {
        rustMultiply: oracle.rustMultiply(6, 7),
        launchSignature: oracle.generateLaunchSignature({}),
    };
    try {
        const api = new oracle.FluxApi();
        const connect = api.connectStore({ storeName: "GuildStore", databases: [] });
        result.fluxapi = JSON.stringify(connect);
        api.free();
    } catch (error) {
        result.fluxapi = `throw: ${error.message}`;
    }
    console.log(JSON.stringify(result, null, 1));
}
