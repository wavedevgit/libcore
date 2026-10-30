#!/usr/bin/env node
/** Smoke-test the checked-in wasm-bindgen distributable against the oracle. */

import fs from "node:fs";
import * as generated from "../../libdiscore_wasm_bg.js";
import { createOriginalOracle } from "./original.mjs";

const bytes = fs.readFileSync(new URL("../../libdiscore_wasm_bg.wasm", import.meta.url));
const module = new WebAssembly.Module(bytes);
const importObject = {};
for (const { module: namespace, name } of WebAssembly.Module.imports(module)) {
    const fn = generated[name];
    if (typeof fn !== "function") throw new Error(`generated glue is missing ${name}`);
    (importObject[namespace] ??= {})[name] = fn;
}
const wasm = new WebAssembly.Instance(module, importObject).exports;
generated.__wbg_set_wasm(wasm);
wasm.__wbindgen_start();

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
const probe = api => {
    const flux = new api.FluxApi();
    const values = [
        api.rustMultiply(6, 7),
        api.generateLaunchSignature({}),
        flux.connectStore({ storeName: "GuildStore", databases: [] }),
        // The original exposes a HashSet iteration order; compare the contract
        // as a set, as the main differential oracle does.
        flux.getRegisteredActionTypes().sort(),
        flux.findStoresThatCanHandleActionType("GUILD_CREATE"),
        flux.dispatchAction(JSON.stringify({ type: "CACHE_LOADED" }), null),
    ];
    flux.free();
    return values;
};

const expected = JSON.stringify(probe(original));
const actual = JSON.stringify(probe(generated));
if (actual !== expected) {
    throw new Error(`generated binding mismatch\nexpected: ${expected}\nactual:   ${actual}`);
}

console.log("wasm-bindgen distributable: PASS");
