#!/usr/bin/env node
/** Run the original wasm through its exact Discord/wasm-bindgen host glue.
 *
 * The vendored chunk has wasm asset id 9cad46e74f330303, exactly matching
 * data/build.json and data/libdiscore.wasm. This is the behavioral oracle for
 * differential tests; do not replace it with guessed host imports.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createRecoveredOracle } from "./recovered.mjs";

const require = createRequire(import.meta.url);
const here = fileURLToPath(new URL(".", import.meta.url));
const chunk = fs.readFileSync(`${here}/libdiscore-wasm-fetch.js`, "utf8");
const wasmBytes = fs.readFileSync(new URL("../../../data/libdiscore.wasm", import.meta.url));

function bodyBetween(startMarker, endMarker) {
    const start = chunk.indexOf(startMarker);
    if (start < 0) throw new Error(`missing chunk marker: ${startMarker}`);
    const bodyStart = start + startMarker.length;
    const end = chunk.indexOf(endMarker, bodyStart);
    if (end < 0) throw new Error(`missing chunk marker: ${endMarker}`);
    return chunk.slice(bodyStart, end);
}

function loadGlue() {
    const module = { exports: {}, require };
    const webpackRequire = () => ({}); // side-effect-only browser polyfills
    webpackRequire.d = (target, definitions) => {
        for (const [name, getter] of Object.entries(definitions)) {
            Object.defineProperty(target, name, { enumerable: true, get: getter });
        }
    };
    webpackRequire.hmd = value => value;

    const body = bodyBetween("841873(e,t,n){", "},5426(e,t,n){");
    Function("e", "t", "n", body)(module, module.exports, webpackRequire);
    return module.exports;
}

function instantiate(onImport) {
    const glue = loadGlue();
    let wasm;
    const module = { id: 5426, exports: {} };
    const webpackRequire = id => {
        if (id === 841873) return glue;
        return {};
    };
    webpackRequire.v = (_target, _id, assetId, imports) => {
        if (assetId !== "9cad46e74f330303") {
            throw new Error(`wrong wasm asset: ${assetId}`);
        }
        if (onImport) {
            for (const [moduleName, moduleImports] of Object.entries(imports)) {
                for (const [name, fn] of Object.entries(moduleImports)) {
                    if (typeof fn !== "function") continue;
                    moduleImports[name] = (...args) => {
                        onImport(`${moduleName}.${name}`, args);
                        return fn(...args);
                    };
                }
            }
        }
        wasm = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), imports).exports;
        glue.lI(wasm); // wasm-bindgen glue's internal `wasm = exports` setter
        wasm.__wbindgen_start();
        return wasm;
    };

    const body = bodyBetween("5426(e,t,n){", "}},b={};function");
    Function("e", "t", "n", body)(module, module.exports, webpackRequire);
    return { glue, wasm, raw: module.exports };
}

export function createOriginalOracle({ onImport } = {}) {
    if (process.env.ORACLE === "recovered") {
        // Oracle-only de-minified glue reconstruction;
        // same results expected for every oracle call. Differential.mjs and
        // stateful.mjs run through this path when ORACLE=recovered is set.
        return createRecoveredOracle({ onImport });
    }
    const { glue, wasm } = instantiate(onImport);
    return {
        exports: wasm,
        BlockedDomainsStore: glue.nx,
        ExperimentCacher: glue.eT,
        FluxApi: glue.GZ,
        WasmCacheableExperimentConfig: glue.cV,
        rustMultiply: glue.t7,
        initLibdiscore: glue.Ph,
        crash: glue.vb,
        generateLaunchSignature: glue.xy,
        installLogCallback: glue.rf,
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const oracle = createOriginalOracle();
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {
        getRandomValues(bytes) {
            for (let i = 0; i < bytes.length; i++) bytes[i] = i;
            return bytes;
        },
    }});
    const result = {
        rustMultiply: oracle.rustMultiply(6, 7),
        launchSignature: oracle.generateLaunchSignature({}),
        exports: Object.keys(oracle.exports),
    };
    console.log(JSON.stringify(result, null, 2));
}
