#!/usr/bin/env node
/** Verify the recovered libdiscore_wasm_bg.js against the wasm import table. */

import fs from "node:fs";
import * as glue from "./libdiscore_wasm_bg.original.js";
import { createOriginalOracle } from "./original.mjs";
import { createRecoveredOracle } from "./recovered.mjs";

const bytes = fs.readFileSync(new URL("../../../data/libdiscore.wasm", import.meta.url));
const module = new WebAssembly.Module(bytes);
const imports = WebAssembly.Module.imports(module);
const missing = imports.filter(({ name }) => typeof glue[name] !== "function");
if (missing.length) {
    throw new Error(`missing glue imports: ${missing.map(({ name }) => name).join(", ")}`);
}

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
const recovered = createRecoveredOracle();
const probes = oracle => {
    const api = new oracle.FluxApi();
    const result = [
        oracle.rustMultiply(6, 7),
        oracle.generateLaunchSignature({}),
        api.connectStore({ storeName: "GuildStore", databases: [] }),
        api.getRegisteredActionTypes(),
        api.findStoresThatCanHandleActionType("GUILD_CREATE"),
    ];
    api.free();
    return result;
};

const expected = JSON.stringify(probes(original));
const actual = JSON.stringify(probes(recovered));
if (actual !== expected) {
    throw new Error(`glue probe mismatch\nexpected: ${expected}\nactual:   ${actual}`);
}

console.log(`libdiscore_wasm_bg.js: PASS (${imports.length}/${imports.length} imports)`);
