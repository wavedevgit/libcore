/**
 * Oracle-only de-minified reconstruction of Discord's `libdiscore_wasm_bg.js` — the
 * wasm-bindgen host glue for `data/libdiscore.wasm` (asset id
 * `9cad46e74f330303`).
 *
 * Provenance (Discord canary):
 *  - `chunks/841873.js`: the obfuscated glue module itself (webpack factory).
 *  - `chunks/5426.js`: its export map — resolves every import-surface name the
 *    wasm looks up under `./libdiscore_wasm_bg.js` (e.g. `__wbindgen_string_new`)
 *    to a minified symbol (e.g. `yc`), plus the class/function exports
 *    (`GZ` = FluxApi, `nx` = BlockedDomainsStore, `lI` = the internal
 *    wasm-export setter, ...).
 *
 * This file keeps the original browser semantics; names are de-minified to
 * canonical wasm-bindgen names. The webpack-only Node `require("util")`
 * TextEncoder/TextDecoder fallback is omitted because this standalone ESM
 * targets the same browser globals used by Discord (modern Node has them too).
 */

// ---------------------------------------------------------------------------
// Internal wasm-exports handle (glue's `lI`).
// ---------------------------------------------------------------------------

/** The wasm module exports, set once at instantiation. */
let wasm;

/** The glue's exported wasm setter (`lI` in the original chunk). */
export function setWasm(handle) {
    wasm = handle;
}

// ---------------------------------------------------------------------------
// Memory views, string codec primitives.
// ---------------------------------------------------------------------------

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (
        cachedUint8ArrayMemory0 === null ||
        cachedUint8ArrayMemory0.byteLength === 0
    ) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

const ENC = new TextEncoder("utf-8");

const encodeString = typeof ENC.encodeInto === "function"
    ? function (text, view) { return ENC.encodeInto(text, view); }
    : function (text, view) {
        const bytes = ENC.encode(text);
        view.set(bytes);
        return { read: text.length, written: bytes.length };
    };

/** `WASM_VECTOR_LEN` — length written by the most recent pass-string call. */
let WASM_VECTOR_LEN = 0;

/**
 * wasm-bindgen's string->wasm pass: with `realloc` absent, allocates exactly;
 * with it, escalates through UTF-16 code units (each may become up to 3 UTF-8
 * bytes) exactly like the generated glue. Mutates `WASM_VECTOR_LEN`.
 */
function passStringToWasm0(text, malloc, realloc) {
    if (realloc === undefined) {
        const bytes = ENC.encode(text);
        const ptr = malloc(bytes.length, 1) >>> 0;
        getUint8ArrayMemory0()
            .subarray(ptr, ptr + bytes.length)
            .set(bytes);
        WASM_VECTOR_LEN = bytes.length;
        return ptr;
    }

    let len = text.length;
    let ptr = malloc(len, 1) >>> 0;
    const mem = getUint8ArrayMemory0();
    let written = 0;
    for (; written < len; written++) {
        const code = text.charCodeAt(written);
        if (code > 127) break;
        mem[ptr + written] = code;
    }

    if (written !== len) {
        if (written !== 0) {
            text = text.slice(written);
        }
        ptr = realloc(
            ptr,
            len,
            (len = written + text.length * 3),
            1,
        ) >>> 0;
        const chunk = encodeString(text, getUint8ArrayMemory0().subarray(ptr + written, ptr + len));
        written += chunk.written;
        ptr = realloc(ptr, len, written, 1) >>> 0;
    }

    WASM_VECTOR_LEN = written;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (
        cachedDataViewMemory0 === null ||
        (cachedDataViewMemory0.buffer.detached === true) ||
        (cachedDataViewMemory0.buffer.detached === undefined &&
            cachedDataViewMemory0.buffer !== wasm.memory.buffer)
    ) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

const DEC = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });

DEC.decode(); // explicit no-op priming decode, present in the original.

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return DEC.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

// ---------------------------------------------------------------------------
// Externref heap machinery.
// ---------------------------------------------------------------------------

/** Adds an arbitrary JS value to the wasm's externref table, index as ptr. */
function addHeapObject(value) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_4.set(idx, value);
    return idx;
}

/** Takes a JS value back out of the externref table, freeing the slot. */
function takeObject(idx) {
    const value = wasm.__wbindgen_export_4.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

function handleError(error, stackFn) {
    try {
        return error.apply(this, stackFn);
    } catch (thrown) {
        const idx = addHeapObject(thrown);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(value) {
    return value == null;
}

// FinalizationRegistry fallback when the runtime lacks it.
const dtorRegistry =
    typeof FinalizationRegistry === "undefined"
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry((handle) => {
            wasm.__wbindgen_export_5.get(handle.dtor)(handle.a, handle.b);
        });

/** wasm-bindgen `makeMutClosure` wrapping (the `T` machinery). */
function makeMutClosure(a, b, dtorIndex, invoke) {
    const state = { a, b, cnt: 1, dtor: dtorIndex };
    const real = function (...args) {
        state.cnt++;
        const savedA = state.a;
        state.a = 0;
        try {
            return invoke(savedA, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_5.get(state.dtor)(savedA, state.b);
                dtorRegistry.unregister(state);
            } else {
                state.a = savedA;
            }
        }
    };
    real.original = state;
    dtorRegistry.register(real, state, state);
    return real;
}

/** The glue's exported wasm-setter alias visible to the wasm bootstrap. */
export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_export_4;
    const base = table.grow(4);
    table.set(0, undefined);
    table.set(base + 0, undefined);
    table.set(base + 1, null);
    table.set(base + 2, true);
    table.set(base + 3, false);
}

// ---------------------------------------------------------------------------
// Probes + byte-source/sink.
// ---------------------------------------------------------------------------

export function rustMultiply(a, b) {
    return wasm.rustMultiply(a, b);
}

export function initLibdiscore() {
    return wasm.initLibdiscore();
}

export function crash() {
    wasm.crash();
}

export function generateLaunchSignature(input) {
    let ptr, len;
    try {
        const ret = wasm.generateLaunchSignature(input);
        ptr = ret[0];
        len = ret[1];
        return getStringFromWasm0(ptr, len);
    } finally {
        wasm.__wbindgen_free(ptr, len, 1);
    }
}

/* eslint-disable no-new-func */
export function __wbindgen_string_new(ptr, len) {
    return getStringFromWasm0(ptr, len);
}

export function __wbindgen_number_new(value) {
    return value;
}

export function __wbg_warn_2159aed0435b2f46(ptr, len) {
    console.warn(getStringFromWasm0(ptr, len));
}

export function __wbindgen_is_undefined(value) {
    return value === undefined;
}

export function __wbindgen_is_string(value) {
    return typeof value === "string";
}

export function __wbindgen_error_new(ptr, len) {
    return Error(getStringFromWasm0(ptr, len));
}

export function __wbindgen_string_get(addr, value) {
    const text = typeof value === "string" ? value : undefined;
    let ptr = isLikeNone(text) ? 0 : passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    let len = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(addr + 4, len, true);
    getDataViewMemory0().setInt32(addr + 0, ptr, true);
}

export function __wbindgen_is_null(value) {
    return value === null;
}

export function __wbindgen_is_object(value) {
    const typ = typeof value === "object" && value !== null;
    return typ;
}

export function __wbindgen_in(key, target) {
    return key in target;
}

export function __wbg_set_3f1d0b984ed272ed(target, key, value) {
    target[key] = value;
}

export function __wbindgen_jsval_loose_eq(a, b) {
    return a == b;
}

export function __wbindgen_boolean_get(value) {
    return typeof value === "boolean" ? +!!value : 2;
}

export function __wbindgen_number_get(addr, value) {
    const num = typeof value === "number" ? value : undefined;
    getDataViewMemory0().setFloat64(addr + 8, isLikeNone(num) ? 0 : num, true);
    getDataViewMemory0().setInt32(addr + 0, !isLikeNone(num), true);
}

export function __wbg_getwithrefkey_1dc361bd10053bfe(target, key) {
    return target[key];
}

export function __wbg_String_8f0eb39a4a4c2f66(addr, value) {
    const ptr = passStringToWasm0(String(value), wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(addr + 4, len, true);
    getDataViewMemory0().setInt32(addr + 0, ptr, true);
}

export function __wbindgen_bigint_from_i64(value) {
    return value;
}

export function __wbindgen_bigint_from_u64(value) {
    return BigInt.asUintN(64, value);
}

export function __wbg_getRandomValues_38097e921c2494c3(array, length) {
    globalThis.crypto.getRandomValues(
        ((array = array >>> 0), getUint8ArrayMemory0().subarray(array, array + length)),
    );
}

export function __wbindgen_cb_drop(dropState) {
    const original = dropState.original;
    if (1 === original.cnt--) {
        original.a = 0;
        return true;
    }
    return false;
}

export function __wbg_setTimeout_db2dbaeefb6f39c7(fn, delay) {
    return handleError(function () {
        return setTimeout(fn, delay);
    }, arguments);
}

export function __wbg_clearTimeout_5a54f8841c30079a(handle) {
    return clearTimeout(handle);
}

export function __wbg_setTimeout_2e707715f8cc9497(fn, delay) {
    return setTimeout(fn, delay);
}

export function __wbg_clearTimeout_86721db0036bea98(handle) {
    return clearTimeout(handle);
}

export function __wbg_fetch_d36a73832f0a45e8(resource) {
    return fetch(resource);
}

export function __wbg_performance_c185c0cdc2766575(recv) {
    const value = recv.performance;
    return isLikeNone(value) ? 0 : addHeapObject(value);
}

export function __wbg_caches_550bbbcd16e33488(recv) {
    return handleError(function () {
        return recv.caches;
    }, arguments);
}

export function __wbg_instanceof_Window_def73ea0955fc569(value) {
    let result;
    try {
        result = value instanceof Window;
    } catch {
        result = false;
    }
    return result;
}

export function __wbg_fetch_509096533071c657(recv, resource) {
    return recv.fetch(resource);
}

export function __wbg_setstatus_51b4fc011091cbb3(target, status) {
    target.status = status;
}

export function __wbg_setheaders_3b47c898e8de6d44(target, headers) {
    target.headers = headers;
}

export function __wbg_new_018dcc2d6c8c2f6a() {
    return handleError(function () {
        return new Headers();
    }, arguments);
}

export function __wbg_byobRequest_77d9adf63337edfb(recv) {
    const byobRequest = recv.byobRequest;
    return isLikeNone(byobRequest) ? 0 : addHeapObject(byobRequest);
}

export function __wbg_close_5ce03e29be453811(recv) {
    return handleError(function () {
        recv.close();
    }, arguments);
}

export function __wbg_append_8c7dd8d641a5f01b(headers, name, nameLen, value, valueLen) {
    return handleError(function () {
        headers.append(getStringFromWasm0(name, nameLen), getStringFromWasm0(value, valueLen));
    }, arguments);
}

export function __wbg_open_97e7dd08648f7ba8(target, method, methodLen) {
    return target.open(getStringFromWasm0(method, methodLen));
}

export function __wbg_set_11cd83f45504cedf(headers, name, nameLen, value, valueLen) {
    return handleError(function () {
        headers.set(getStringFromWasm0(name, nameLen), getStringFromWasm0(value, valueLen));
    }, arguments);
}

export function __wbg_newwithstrandinit_06c535e0a867c635() {
    return handleError(function (url, urlLen, options) {
        return new Request(getStringFromWasm0(url, urlLen), options);
    }, arguments);
}

export function __wbg_signal_aaf9ad74119f20a4(controller) {
    return controller.signal;
}

export function __wbg_view_fd8a56e8983f448d(recv) {
    const view = recv.view;
    return isLikeNone(view) ? 0 : addHeapObject(view);
}

export function __wbg_new_e25e5aab09ff45db() {
    return handleError(function () {
        return new AbortController();
    }, arguments);
}

export function __wbg_respond_1f279fa9f8edcb1c(recv, bytes) {
    return handleError(function () {
        recv.respond(bytes >>> 0);
    }, arguments);
}

export function __wbg_close_304cc1fef3466669(recv) {
    return handleError(function () {
        recv.close();
    }, arguments);
}

export function __wbg_abort_775ef1d17fc65868(recv) {
    recv.abort();
}

export function __wbg_abort_410ec47a64ac6117(recv, reason) {
    recv.abort(reason);
}

export function __wbg_enqueue_bb16ba72f537dc9e(controller, chunk) {
    return handleError(function () {
        controller.enqueue(chunk);
    }, arguments);
}

export function __wbg_delete_8d7d048660be060f(cache, key) {
    return cache.delete(key);
}

export function __wbg_match_5b6cb6a9ae1700aa(cache, request) {
    return cache.match(request);
}

export function __wbg_now_d18023d54d4e5500(performance) {
    return performance.now();
}

export function __wbg_put_75886410036f9ae5(cache, key, value) {
    return cache.put(key, value);
}

export function __wbg_instanceof_Cache_68839760b07b7088(value) {
    let result;
    try {
        result = value instanceof Cache;
    } catch {
        result = false;
    }
    return result;
}

export function __wbg_setcredentials_c3a22f1cd105a2c6(init, credentials) {
    init.credentials = ["omit", "same-origin", "include"][credentials];
}

export function __wbg_setbody_5923b78a95eedf29(init, body) {
    init.body = body;
}

export function __wbg_setmode_5dc300b865044b65(init, mode) {
    init.mode = ["same-origin", "no-cors", "cors", "navigate"][mode];
}

export function __wbg_setmethod_3c5280fe5d890842(init, method, methodLen) {
    init.method = getStringFromWasm0(method, methodLen);
}

export function __wbg_setsignal_75b21ef3a81de905(init, signal) {
    init.signal = signal;
}

export function __wbg_setheaders_834c0bdb6a8949ad(init, headers) {
    init.headers = headers;
}

export function __wbg_url_ae10c34ca209681d(addr, request) {
    const ptr = passStringToWasm0(request.url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(addr + 4, len, true);
    getDataViewMemory0().setInt32(addr + 0, ptr, true);
}

export function __wbg_status_f6360336ca686bf0(response) {
    return response.status;
}

export function __wbg_newwithu8arraysequence_1e24f242a67f6fdd() {
    return handleError(function (array) {
        return new Blob(array);
    }, arguments);
}

export function __wbg_headers_9cb51cfd2ac780a4(response) {
    return response.headers;
}

export function __wbg_newwithoptblobandinit_813b17381b1c8c7d() {
    return handleError(function (blob, init) {
        return new Response(blob, init);
    }, arguments);
}

export function __wbg_arrayBuffer_d1b44c4390db422f(response) {
    return handleError(function () {
        return response.arrayBuffer();
    }, arguments);
}

export function __wbg_instanceof_Response_f2cc20d9f7dfd644(value) {
    let result;
    try {
        result = value instanceof Response;
    } catch {
        result = false;
    }
    return result;
}

export function __wbg_queueMicrotask_d3219def82552485(recv) {
    return recv.queueMicrotask;
}

export function __wbindgen_is_function(value) {
    return typeof value === "function";
}

export function __wbg_queueMicrotask_97d92b4fcc8a61c5(fn) {
    queueMicrotask(fn);
}

export function __wbg_iterator_9a24c88df860dc65() {
    return Symbol.iterator;
}

export function __wbg_get_67b2ba62fc30de12(target, key) {
    return handleError(function () {
        return Reflect.get(target, key);
    }, arguments);
}

export function __wbg_call_672a4d21634d4a24(recv, thisArg) {
    return handleError(function () {
        return recv.call(thisArg);
    }, arguments);
}

export function __wbg_next_25feadfc0913fea9(iterator) {
    return iterator.next;
}

export function __wbg_push_737cfc8c1432c2c6(array, value) {
    return array.push(value);
}

export function __wbg_new_78feb108b6472713() {
    return [];
}

export function __wbg_get_b9b93047fe3cf45b(target, index) {
    return target[index >>> 0];
}

export function __wbg_set_37837023f3d740e8(target, index, value) {
    target[index >>> 0] = value;
}

export function __wbg_isArray_a1eab7e0d067391b(value) {
    return Array.isArray(value);
}

export function __wbg_length_e2d2a49132c1b256(value) {
    return value.length;
}

export function __wbg_new_c68d7209be747379(ptr, len) {
    return Error(getStringFromWasm0(ptr, len));
}

export function __wbg_new_5e0be73521bc8c17() {
    return new Map();
}

export function __wbg_set_8fc6bf8a5b1071d1(map, key, value) {
    return map.set(key, value);
}

export function __wbg_newnoargs_105ed471475aaf50(fnName, fnNameLen) {
    return Function(getStringFromWasm0(fnName, fnNameLen));
}

export function __wbg_call_7cccdd69e0791ae2(fn, thisArg, extraArg) {
    return handleError(function () {
        return fn.call(thisArg, extraArg);
    }, arguments);
}

export function __wbg_next_6574e1a8a62d1055(iterator) {
    return handleError(function () {
        return iterator.next();
    }, arguments);
}

export function __wbg_done_769e5ede4b31c67b(iteratorResult) {
    return iteratorResult.done;
}

export function __wbg_value_cd1ffa7b1ab794f1(iteratorResult) {
    return iteratorResult.value;
}

export function __wbg_new_405e22f390576ce2() {
    return {};
}

export function __wbg_buffer_609cc3eee51ed158(value) {
    return value.buffer;
}

export function __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a(buffer, offset, length) {
    return new Uint8Array(buffer, offset >>> 0, length >>> 0);
}

export function __wbg_length_a446193dc22c12f8(value) {
    return value.length;
}

export function __wbg_new_a12002a7f91c75be(buffer) {
    return new Uint8Array(buffer);
}

export function __wbg_set_65595bdd868b3009(target, source, length) {
    target.set(source, length >>> 0);
}

export function __wbg_new_23a2665fac83c611(a, b) {
    var state;
    try {
        state = { a, b };
        return new Promise((resolve, reject) => {
            const savedA = state.a;
            state.a = 0;
            try {
                var savedB;
                return ((savedB = state.b), wasm.closure751_externref_shim(savedA, savedB, resolve, reject));
            } finally {
                state.a = savedA;
            }
        });
    } finally {
        state.a = state.b = 0;
    }
}

export function __wbg_resolve_4851785c9c5f573d(value) {
    return Promise.resolve(value);
}

export function __wbg_then_44b73946d2fb3e7d(promise, onFulfilled) {
    return promise.then(onFulfilled);
}

export function __wbg_then_48b406749878a531(promise, onFulfilled, onRejected) {
    return promise.then(onFulfilled, onRejected);
}

export function __wbg_buffer_09165b52af8c5237(value) {
    return value.buffer;
}

export function __wbg_byteLength_e674b853d9c77e1d(value) {
    return value.byteLength;
}

export function __wbg_byteOffset_fd862df290ef848d(value) {
    return value.byteOffset;
}

export function __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0() {
    const value = typeof globalThis === "undefined" ? null : globalThis;
    return isLikeNone(value) ? 0 : addHeapObject(value);
}

export function __wbg_static_accessor_SELF_37c5d418e4bf5819() {
    const value = typeof self === "undefined" ? null : self;
    return isLikeNone(value) ? 0 : addHeapObject(value);
}

export function __wbg_static_accessor_GLOBAL_88a902d13a557d07() {
    const value = typeof global === "undefined" ? null : global;
    return isLikeNone(value) ? 0 : addHeapObject(value);
}

export function __wbg_static_accessor_WINDOW_5de37043a91a9c40() {
    const value = typeof window === "undefined" ? null : window;
    return isLikeNone(value) ? 0 : addHeapObject(value);
}

export function __wbg_instanceof_Uint8Array_17156bcf118086a9(value) {
    let result;
    try {
        result = value instanceof Uint8Array;
    } catch {
        result = false;
    }
    return result;
}

export function __wbg_instanceof_ArrayBuffer_e14585432e3737fc(value) {
    let result;
    try {
        result = value instanceof ArrayBuffer;
    } catch {
        result = false;
    }
    return result;
}

export function __wbg_stringify_f7ed6987935b4a24(value) {
    return handleError(function () {
        return JSON.stringify(value);
    }, arguments);
}

export function __wbg_has_a5ea9117f258a0ec(target, key) {
    return handleError(function () {
        return Reflect.has(target, key);
    }, arguments);
}

export function __wbg_set_bb8cecf6a62b9f46(target, key, value) {
    return handleError(function () {
        return Reflect.set(target, key, value);
    }, arguments);
}

export function __wbindgen_memory() {
    return wasm.memory;
}

export function __wbindgen_throw(ptr, len) {
    throw new Error(getStringFromWasm0(ptr, len));
}

export function __wbindgen_debug_string(addr, value) {
    // wasm-bindgen's recursive value describer, kept verbatim.
    let described = value;
    const describe = function (val) {
        let typ = typeof val;
        if (typ === "number" || typ === "boolean" || val == null) return `${val}`;
        if (typ === "string") return `"${val}"`;
        if (typ === "symbol") {
            const d = val.description;
            return d == null ? "Symbol" : `Symbol(${d})`;
        }
        if (typ === "function") {
            const n = val.name;
            return typeof n === "string" && n.length > 0 ? `Function(${n})` : "Function";
        }
        if (Array.isArray(val)) {
            const length = val.length;
            let out = "[";
            if (length > 0) out += describe(val[0]);
            for (let i = 1; i < length; i++) out += ", " + describe(val[i]);
            return out + "]";
        }
        const match = /\[object ([^\]]+)\]/.exec(toString.call(val));
        if (!match || !(match.length > 1)) return toString.call(val);
        const className = match[1];
        if (className === "Object") {
            try {
                return "Object(" + JSON.stringify(val) + ")";
            } catch {
                return "Object";
            }
        }
        return (
            val instanceof Error
                ? `${val.name}: ${val.message}\n${val.stack}`
                : className
        );
    };
    described = describe(value);
    const ptr = passStringToWasm0(described, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(addr + 4, len, true);
    getDataViewMemory0().setInt32(addr + 0, ptr, true);
}

// Closure invoke shims (the glue's `R`, `L`, `y`) — funcref-table dtor
// indices 532 / 553 / 713; the invoke shim that runs follows the wrapper
// that produced the closure (`__wbindgen_closure_wrapper*`).
function invoke_532(a, b) {
    wasm._dyn_core_f73ed7932dd6acc___ops__function__FnMut_____Output______as_wasm_bindgen_9353bb4e5bfa4c18___closure__WasmClosure___describe__invoke______(
        a,
        b,
    );
}

function invoke_553(a, b) {
    wasm._dyn_core_f73ed7932dd6acc___ops__function__FnMut_____Output______as_wasm_bindgen_9353bb4e5bfa4c18___closure__WasmClosure___describe__invoke______10(
        a,
        b,
    );
}

function invoke_713(a, b, c) {
    wasm.closure712_externref_shim(a, b, c);
}

export function __wbindgen_closure_wrapper1677(a, b, dtor) {
    return makeMutClosure(a, b, 532, invoke_532);
}

export function __wbindgen_closure_wrapper1714(a, b, dtor) {
    return makeMutClosure(a, b, 553, invoke_553);
}

export function __wbindgen_closure_wrapper2571(a, b, dtor) {
    return makeMutClosure(a, b, 713, invoke_713);
}

// The supplied canary chunk is one wasm-bindgen wrapper ordinal newer than
// data/libdiscore.wasm. Ordinals are names only; bodies/dtor indices match.
export const __wbindgen_closure_wrapper1676 = __wbindgen_closure_wrapper1677;
export const __wbindgen_closure_wrapper1713 = __wbindgen_closure_wrapper1714;
export const __wbindgen_closure_wrapper2570 = __wbindgen_closure_wrapper2571;

export function installLogCallback(fn, a, b, c, d) {
    wasm.installLogCallback(fn, a, b, c, d);
}

// ---------------------------------------------------------------------------
// Discord-facing classes.
// ---------------------------------------------------------------------------

class BlockedDomainsStore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BLOCKED_DOMAINS_STORE_FINALIZATION.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_blockeddomainsstore_free(ptr, 0);
    }

    static isBlockedDomain(domain) {
        const ptr0 = passStringToWasm0(domain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.blockeddomainsstore_isBlockedDomain(ptr0, len0);
        if (ret[3]) throw takeObject(ret[2]);
        let result;
        if (ret[0] !== 0) {
            result = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return result;
    }

    static startFetchingBlockedDomains(config) {
        const ptr0 = passStringToWasm0(config, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.blockeddomainsstore_startFetchingBlockedDomains(ptr0, len0);
        if (ret[1]) throw takeObject(ret[0]);
    }
}

const BLOCKED_DOMAINS_STORE_FINALIZATION =
    typeof FinalizationRegistry === "undefined"
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry((ptr) =>
            wasm.__wbg_blockeddomainsstore_free(ptr >>> 0, 1));

class ExperimentCacher {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EXPERIMENT_CACHER_FINALIZATION.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_experimentcacher_free(ptr, 0);
    }

    static getConfig(id) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.experimentcacher_getConfig(ptr0, len0);
        if (ret[2]) throw takeObject(ret[1]);
        return ret[0] === 0 ? undefined : WasmCacheableExperimentConfig.__wrap(ret[0]);
    }

    static clearCache() {
        const ret = wasm.experimentcacher_clearCache();
        if (ret[1]) throw takeObject(ret[0]);
    }

    static flushToCache(snapshot) {
        const ptr0 = passStringToWasm0(snapshot, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.experimentcacher_flushToCache(ptr0, len0);
        if (ret[1]) throw takeObject(ret[0]);
    }
}

const EXPERIMENT_CACHER_FINALIZATION =
    typeof FinalizationRegistry === "undefined"
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry((ptr) =>
            wasm.__wbg_experimentcacher_free(ptr >>> 0, 1));

class FluxApi {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FLUX_API_FINALIZATION.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fluxapi_free(ptr, 0);
    }

    connectStore(connection) {
        const ret = wasm.fluxapi_connectStore(this.__wbg_ptr, connection);
        if (ret[2]) throw takeObject(ret[1]);
        return takeObject(ret[0]);
    }

    dispatchAction(action, meta) {
        const ptr0 = passStringToWasm0(action, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        return wasm.fluxapi_dispatchAction(this.__wbg_ptr, ptr0, len0, meta);
    }

    flushReplicationStates() {
        return wasm.fluxapi_flushReplicationStates(this.__wbg_ptr);
    }

    getRegisteredActionTypes() {
        return wasm.fluxapi_getRegisteredActionTypes(this.__wbg_ptr);
    }

    findStoresThatCanHandleActionType(actionType) {
        const ptr0 = passStringToWasm0(actionType, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        return wasm.fluxapi_findStoresThatCanHandleActionType(this.__wbg_ptr, ptr0, len0);
    }

    constructor() {
        const ret = wasm.fluxapi_new();
        this.__wbg_ptr = ret >>> 0;
        FLUX_API_FINALIZATION.register(this, this.__wbg_ptr, this);
        return this;
    }
}

const FLUX_API_FINALIZATION =
    typeof FinalizationRegistry === "undefined"
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry((ptr) => wasm.__wbg_fluxapi_free(ptr >>> 0, 1));

class IntoUnderlyingByteSource {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        INTO_UNDERLYING_BYTE_SOURCE_FINALIZATION.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingbytesource_free(ptr, 0);
    }

    get autoAllocateChunkSize() {
        return wasm.intounderlyingbytesource_autoAllocateChunkSize(this.__wbg_ptr) >>> 0;
    }

    pull(controller) {
        return wasm.intounderlyingbytesource_pull(this.__wbg_ptr, controller);
    }

    start(controller) {
        wasm.intounderlyingbytesource_start(this.__wbg_ptr, controller);
    }

    get type() {
        return ["bytes"][wasm.intounderlyingbytesource_type(this.__wbg_ptr)];
    }

    cancel(reason) {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingbytesource_cancel(ptr, reason);
    }
}

const INTO_UNDERLYING_BYTE_SOURCE_FINALIZATION =
    typeof FinalizationRegistry === "undefined"
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry((ptr) =>
            wasm.__wbg_intounderlyingbytesource_free(ptr >>> 0, 1));

class IntoUnderlyingSink {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        INTO_UNDERLYING_SINK_FINALIZATION.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsink_free(ptr, 0);
    }

    abort(reason) {
        const ptr = this.__destroy_into_raw();
        return wasm.intounderlyingsink_abort(ptr, reason);
    }

    close() {
        const ptr = this.__destroy_into_raw();
        return wasm.intounderlyingsink_close(ptr);
    }

    write(chunk) {
        return wasm.intounderlyingsink_write(this.__wbg_ptr, chunk);
    }
}

const INTO_UNDERLYING_SINK_FINALIZATION =
    typeof FinalizationRegistry === "undefined"
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry((ptr) =>
            wasm.__wbg_intounderlyingsink_free(ptr >>> 0, 1));

class IntoUnderlyingSource {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        INTO_UNDERLYING_SOURCE_FINALIZATION.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsource_free(ptr, 0);
    }

    pull(controller) {
        return wasm.intounderlyingsource_pull(this.__wbg_ptr, controller);
    }

    cancel(reason) {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingsource_cancel(ptr, reason);
    }
}

const INTO_UNDERLYING_SOURCE_FINALIZATION =
    typeof FinalizationRegistry === "undefined"
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry((ptr) =>
            wasm.__wbg_intounderlyingsource_free(ptr >>> 0, 1));

class WasmCacheableExperimentConfig {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmCacheableExperimentConfig.prototype);
        obj.__wbg_ptr = ptr;
        WASM_CACHEABLE_EXPERIMENT_CONFIG_FINALIZATION.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WASM_CACHEABLE_EXPERIMENT_CONFIG_FINALIZATION.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmcacheableexperimentconfig_free(ptr, 0);
    }

    get treatmentId() {
        return wasm.__wbg_get_wasmcacheableexperimentconfig_treatmentId(this.__wbg_ptr);
    }

    set treatmentId(value) {
        wasm.__wbg_set_wasmcacheableexperimentconfig_treatmentId(this.__wbg_ptr, value);
    }
}

const WASM_CACHEABLE_EXPERIMENT_CONFIG_FINALIZATION =
    typeof FinalizationRegistry === "undefined"
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry((ptr) =>
            wasm.__wbg_wasmcacheableexperimentconfig_free(ptr >>> 0, 1));

export {
    BlockedDomainsStore,
    ExperimentCacher,
    FluxApi,
    IntoUnderlyingByteSource,
    IntoUnderlyingSink,
    IntoUnderlyingSource,
    WasmCacheableExperimentConfig,
};
