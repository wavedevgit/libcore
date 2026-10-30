let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


let WASM_VECTOR_LEN = 0;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

const lTextEncoder = typeof TextEncoder === 'undefined' ? (0, module.require)('util').TextEncoder : TextEncoder;

let cachedTextEncoder = new lTextEncoder('utf-8');

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_4.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

const lTextDecoder = typeof TextDecoder === 'undefined' ? (0, module.require)('util').TextDecoder : TextDecoder;

let cachedTextDecoder = new lTextDecoder('utf-8', { ignoreBOM: true, fatal: true });

cachedTextDecoder.decode();

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => {
    wasm.__wbindgen_export_5.get(state.dtor)(state.a, state.b)
});

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_5.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state);
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}
/**
 * @param {any} error
 * @param {any} warn
 * @param {any} info
 * @param {any} debug
 * @param {any} trace
 */
export function installLogCallback(error, warn, info, debug, trace) {
    wasm.installLogCallback(error, warn, info, debug, trace);
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_4.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}
/**
 * @param {any} globals
 * @returns {string}
 */
export function generateLaunchSignature(globals) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ret = wasm.generateLaunchSignature(globals);
        var ptr1 = ret[0];
        var len1 = ret[1];
        if (ret[3]) {
            ptr1 = 0; len1 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred2_0 = ptr1;
        deferred2_1 = len1;
        return getStringFromWasm0(ptr1, len1);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @returns {Promise<any>}
 */
export function initLibdiscore() {
    const ret = wasm.initLibdiscore();
    return ret;
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function rustMultiply(a, b) {
    const ret = wasm.rustMultiply(a, b);
    return ret;
}

export function crash() {
    wasm.crash();
}

function __wbg_adapter_46(arg0, arg1) {
    wasm._dyn_core_ed718c3d60ebd546___ops__function__FnMut_____Output______as_wasm_bindgen_f13aeecceba14d0d___closure__WasmClosure___describe__invoke______(arg0, arg1);
}

function __wbg_adapter_49(arg0, arg1, arg2) {
    wasm.closure158_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_172(arg0, arg1, arg2, arg3) {
    wasm.closure182_externref_shim(arg0, arg1, arg2, arg3);
}

const __wbindgen_enum_ReadableStreamType = ["bytes"];

const BlockedDomainsStoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_blockeddomainsstore_free(ptr >>> 0, 1));
/**
 * The membership check `blockeddomainsstore_isBlockedDomain(url)` walks:
 * parse the URL, extract the host, then probe the hash set.
 */
export class BlockedDomainsStore {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BlockedDomainsStoreFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_blockeddomainsstore_free(ptr, 0);
    }
    /**
     * @param {string} url
     * @returns {string | undefined}
     */
    static isBlockedDomain(url) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.blockeddomainsstore_isBlockedDomain(ptr0, len0);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * @param {string} delta_url
     */
    static startFetchingBlockedDomains(delta_url) {
        const ptr0 = passStringToWasm0(delta_url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.blockeddomainsstore_startFetchingBlockedDomains(ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}

const ExperimentCacherFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_experimentcacher_free(ptr >>> 0, 1));
/**
 * Zero-sized namespace class used by the original JS API's static methods.
 */
export class ExperimentCacher {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ExperimentCacherFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_experimentcacher_free(ptr, 0);
    }
    /**
     * @param {string} experiment
     * @returns {WasmCacheableExperimentConfig | undefined}
     */
    static getConfig(experiment) {
        const ptr0 = passStringToWasm0(experiment, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.experimentcacher_getConfig(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return ret[0] === 0 ? undefined : WasmCacheableExperimentConfig.__wrap(ret[0]);
    }
    static clearCache() {
        const ret = wasm.experimentcacher_clearCache();
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {string} snapshot
     */
    static flushToCache(snapshot) {
        const ptr0 = passStringToWasm0(snapshot, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.experimentcacher_flushToCache(ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}

const FluxApiFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_fluxapi_free(ptr >>> 0, 1));
/**
 * The FluxApi object the module exports (wasm-bindgen class `FluxApi`).
 */
export class FluxApi {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FluxApiFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_fluxapi_free(ptr, 0);
    }
    /**
     * FFI shape recovered from the listing:
     * `fluxapi_connectStore(a:int_ptr, b:externref) -> (int,int,int)`.
     * @param {any} connection
     * @returns {any}
     */
    connectStore(connection) {
        const ret = wasm.fluxapi_connectStore(this.__wbg_ptr, connection);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {string} action_json
     * @param {any} _external
     * @returns {any}
     */
    dispatchAction(action_json, _external) {
        const ptr0 = passStringToWasm0(action_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.fluxapi_dispatchAction(this.__wbg_ptr, ptr0, len0, _external);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {any}
     */
    flushReplicationStates() {
        const ret = wasm.fluxapi_flushReplicationStates(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {any}
     */
    getRegisteredActionTypes() {
        const ret = wasm.fluxapi_getRegisteredActionTypes(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    constructor() {
        const ret = wasm.fluxapi_new();
        this.__wbg_ptr = ret >>> 0;
        FluxApiFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {string} action
     * @returns {any}
     */
    findStoresThatCanHandleActionType(action) {
        const ptr0 = passStringToWasm0(action, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.fluxapi_findStoresThatCanHandleActionType(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}

const IntoUnderlyingByteSourceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingbytesource_free(ptr >>> 0, 1));

export class IntoUnderlyingByteSource {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(IntoUnderlyingByteSource.prototype);
        obj.__wbg_ptr = ptr;
        IntoUnderlyingByteSourceFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingByteSourceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingbytesource_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get autoAllocateChunkSize() {
        const ret = wasm.intounderlyingbytesource_autoAllocateChunkSize(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {ReadableByteStreamController} controller
     * @returns {Promise<any>}
     */
    pull(controller) {
        const ret = wasm.intounderlyingbytesource_pull(this.__wbg_ptr, controller);
        return ret;
    }
    /**
     * @param {ReadableByteStreamController} controller
     */
    start(controller) {
        wasm.intounderlyingbytesource_start(this.__wbg_ptr, controller);
    }
    /**
     * @returns {ReadableStreamType}
     */
    get type() {
        const ret = wasm.intounderlyingbytesource_type(this.__wbg_ptr);
        return __wbindgen_enum_ReadableStreamType[ret];
    }
    cancel() {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingbytesource_cancel(ptr);
    }
}

const IntoUnderlyingSinkFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingsink_free(ptr >>> 0, 1));

export class IntoUnderlyingSink {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(IntoUnderlyingSink.prototype);
        obj.__wbg_ptr = ptr;
        IntoUnderlyingSinkFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingSinkFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsink_free(ptr, 0);
    }
    /**
     * @param {any} reason
     * @returns {Promise<any>}
     */
    abort(reason) {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.intounderlyingsink_abort(ptr, reason);
        return ret;
    }
    /**
     * @returns {Promise<any>}
     */
    close() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.intounderlyingsink_close(ptr);
        return ret;
    }
    /**
     * @param {any} chunk
     * @returns {Promise<any>}
     */
    write(chunk) {
        const ret = wasm.intounderlyingsink_write(this.__wbg_ptr, chunk);
        return ret;
    }
}

const IntoUnderlyingSourceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_intounderlyingsource_free(ptr >>> 0, 1));

export class IntoUnderlyingSource {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(IntoUnderlyingSource.prototype);
        obj.__wbg_ptr = ptr;
        IntoUnderlyingSourceFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IntoUnderlyingSourceFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_intounderlyingsource_free(ptr, 0);
    }
    /**
     * @param {ReadableStreamDefaultController} controller
     * @returns {Promise<any>}
     */
    pull(controller) {
        const ret = wasm.intounderlyingsource_pull(this.__wbg_ptr, controller);
        return ret;
    }
    cancel() {
        const ptr = this.__destroy_into_raw();
        wasm.intounderlyingsource_cancel(ptr);
    }
}

const WasmCacheableExperimentConfigFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_wasmcacheableexperimentconfig_free(ptr >>> 0, 1));
/**
 * `struct CacheableExperimentConfig with 1 element` (getter/setter exported as
 * `wbg_get/set_wasmcacheableexperimentconfig_treatmentId`).
 */
export class WasmCacheableExperimentConfig {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(WasmCacheableExperimentConfig.prototype);
        obj.__wbg_ptr = ptr;
        WasmCacheableExperimentConfigFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        WasmCacheableExperimentConfigFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_wasmcacheableexperimentconfig_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get treatmentId() {
        const ret = wasm.__wbg_get_wasmcacheableexperimentconfig_treatmentId(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set treatmentId(arg0) {
        wasm.__wbg_set_wasmcacheableexperimentconfig_treatmentId(this.__wbg_ptr, arg0);
    }
}

export function __wbg_String_8f0eb39a4a4c2f66(arg0, arg1) {
    const ret = String(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbg_arrayBuffer_d1b44c4390db422f() { return handleError(function (arg0) {
    const ret = arg0.arrayBuffer();
    return ret;
}, arguments) };

export function __wbg_buffer_09165b52af8c5237(arg0) {
    const ret = arg0.buffer;
    return ret;
};

export function __wbg_buffer_609cc3eee51ed158(arg0) {
    const ret = arg0.buffer;
    return ret;
};

export function __wbg_byobRequest_77d9adf63337edfb(arg0) {
    const ret = arg0.byobRequest;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
};

export function __wbg_byteLength_e674b853d9c77e1d(arg0) {
    const ret = arg0.byteLength;
    return ret;
};

export function __wbg_byteOffset_fd862df290ef848d(arg0) {
    const ret = arg0.byteOffset;
    return ret;
};

export function __wbg_caches_550bbbcd16e33488() { return handleError(function (arg0) {
    const ret = arg0.caches;
    return ret;
}, arguments) };

export function __wbg_call_672a4d21634d4a24() { return handleError(function (arg0, arg1) {
    const ret = arg0.call(arg1);
    return ret;
}, arguments) };

export function __wbg_call_7cccdd69e0791ae2() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.call(arg1, arg2);
    return ret;
}, arguments) };

export function __wbg_close_304cc1fef3466669() { return handleError(function (arg0) {
    arg0.close();
}, arguments) };

export function __wbg_close_5ce03e29be453811() { return handleError(function (arg0) {
    arg0.close();
}, arguments) };

export function __wbg_delete_8d7d048660be060f(arg0, arg1) {
    const ret = arg0.delete(arg1);
    return ret;
};

export function __wbg_done_769e5ede4b31c67b(arg0) {
    const ret = arg0.done;
    return ret;
};

export function __wbg_enqueue_bb16ba72f537dc9e() { return handleError(function (arg0, arg1) {
    arg0.enqueue(arg1);
}, arguments) };

export function __wbg_fetch_b7bf320f681242d2(arg0, arg1) {
    const ret = arg0.fetch(arg1);
    return ret;
};

export function __wbg_get_67b2ba62fc30de12() { return handleError(function (arg0, arg1) {
    const ret = Reflect.get(arg0, arg1);
    return ret;
}, arguments) };

export function __wbg_get_b9b93047fe3cf45b(arg0, arg1) {
    const ret = arg0[arg1 >>> 0];
    return ret;
};

export function __wbg_getwithrefkey_1dc361bd10053bfe(arg0, arg1) {
    const ret = arg0[arg1];
    return ret;
};

export function __wbg_has_a5ea9117f258a0ec() { return handleError(function (arg0, arg1) {
    const ret = Reflect.has(arg0, arg1);
    return ret;
}, arguments) };

export function __wbg_instanceof_ArrayBuffer_e14585432e3737fc(arg0) {
    let result;
    try {
        result = arg0 instanceof ArrayBuffer;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_instanceof_Cache_68839760b07b7088(arg0) {
    let result;
    try {
        result = arg0 instanceof Cache;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_instanceof_Response_f2cc20d9f7dfd644(arg0) {
    let result;
    try {
        result = arg0 instanceof Response;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_instanceof_Uint8Array_17156bcf118086a9(arg0) {
    let result;
    try {
        result = arg0 instanceof Uint8Array;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_instanceof_Window_def73ea0955fc569(arg0) {
    let result;
    try {
        result = arg0 instanceof Window;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
};

export function __wbg_isArray_a1eab7e0d067391b(arg0) {
    const ret = Array.isArray(arg0);
    return ret;
};

export function __wbg_iterator_9a24c88df860dc65() {
    const ret = Symbol.iterator;
    return ret;
};

export function __wbg_length_a446193dc22c12f8(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_length_e2d2a49132c1b256(arg0) {
    const ret = arg0.length;
    return ret;
};

export function __wbg_match_5b6cb6a9ae1700aa(arg0, arg1) {
    const ret = arg0.match(arg1);
    return ret;
};

export function __wbg_new_018dcc2d6c8c2f6a() { return handleError(function () {
    const ret = new Headers();
    return ret;
}, arguments) };

export function __wbg_new_23a2665fac83c611(arg0, arg1) {
    try {
        var state0 = {a: arg0, b: arg1};
        var cb0 = (arg0, arg1) => {
            const a = state0.a;
            state0.a = 0;
            try {
                return __wbg_adapter_172(a, state0.b, arg0, arg1);
            } finally {
                state0.a = a;
            }
        };
        const ret = new Promise(cb0);
        return ret;
    } finally {
        state0.a = state0.b = 0;
    }
};

export function __wbg_new_405e22f390576ce2() {
    const ret = new Object();
    return ret;
};

export function __wbg_new_5e0be73521bc8c17() {
    const ret = new Map();
    return ret;
};

export function __wbg_new_78feb108b6472713() {
    const ret = new Array();
    return ret;
};

export function __wbg_new_a12002a7f91c75be(arg0) {
    const ret = new Uint8Array(arg0);
    return ret;
};

export function __wbg_new_c68d7209be747379(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return ret;
};

export function __wbg_newnoargs_105ed471475aaf50(arg0, arg1) {
    const ret = new Function(getStringFromWasm0(arg0, arg1));
    return ret;
};

export function __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a(arg0, arg1, arg2) {
    const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
    return ret;
};

export function __wbg_newwithintounderlyingbytesource_efd92db9d469fbc6() { return handleError(function (arg0) {
    const ret = new ReadableStream(IntoUnderlyingByteSource.__wrap(arg0));
    return ret;
}, arguments) };

export function __wbg_newwithintounderlyingsink_08f1a3e40fc70d83(arg0) {
    const ret = new WritableStream(IntoUnderlyingSink.__wrap(arg0));
    return ret;
};

export function __wbg_newwithintounderlyingsource_b47f6a6a596a7f24(arg0, arg1) {
    const ret = new ReadableStream(IntoUnderlyingSource.__wrap(arg0), arg1);
    return ret;
};

export function __wbg_newwithlength_a381634e90c276d4(arg0) {
    const ret = new Uint8Array(arg0 >>> 0);
    return ret;
};

export function __wbg_newwithoptu8arrayandinit_0a0dc8cd798712c6() { return handleError(function (arg0, arg1, arg2) {
    const ret = new Response(arg0 === 0 ? undefined : getArrayU8FromWasm0(arg0, arg1), arg2);
    return ret;
}, arguments) };

export function __wbg_newwithstr_78e86e03c4ae814e() { return handleError(function (arg0, arg1) {
    const ret = new Request(getStringFromWasm0(arg0, arg1));
    return ret;
}, arguments) };

export function __wbg_newwithstrandinit_06c535e0a867c635() { return handleError(function (arg0, arg1, arg2) {
    const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
    return ret;
}, arguments) };

export function __wbg_next_25feadfc0913fea9(arg0) {
    const ret = arg0.next;
    return ret;
};

export function __wbg_next_6574e1a8a62d1055() { return handleError(function (arg0) {
    const ret = arg0.next();
    return ret;
}, arguments) };

export function __wbg_open_97e7dd08648f7ba8(arg0, arg1, arg2) {
    const ret = arg0.open(getStringFromWasm0(arg1, arg2));
    return ret;
};

export function __wbg_put_75886410036f9ae5(arg0, arg1, arg2) {
    const ret = arg0.put(arg1, arg2);
    return ret;
};

export function __wbg_queueMicrotask_97d92b4fcc8a61c5(arg0) {
    queueMicrotask(arg0);
};

export function __wbg_queueMicrotask_d3219def82552485(arg0) {
    const ret = arg0.queueMicrotask;
    return ret;
};

export function __wbg_resolve_4851785c9c5f573d(arg0) {
    const ret = Promise.resolve(arg0);
    return ret;
};

export function __wbg_respond_1f279fa9f8edcb1c() { return handleError(function (arg0, arg1) {
    arg0.respond(arg1 >>> 0);
}, arguments) };

export function __wbg_setTimeout_f2fe5af8e3debeb3() { return handleError(function (arg0, arg1, arg2) {
    const ret = arg0.setTimeout(arg1, arg2);
    return ret;
}, arguments) };

export function __wbg_set_11cd83f45504cedf() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
    arg0.set(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
}, arguments) };

export function __wbg_set_37837023f3d740e8(arg0, arg1, arg2) {
    arg0[arg1 >>> 0] = arg2;
};

export function __wbg_set_3f1d0b984ed272ed(arg0, arg1, arg2) {
    arg0[arg1] = arg2;
};

export function __wbg_set_65595bdd868b3009(arg0, arg1, arg2) {
    arg0.set(arg1, arg2 >>> 0);
};

export function __wbg_set_8fc6bf8a5b1071d1(arg0, arg1, arg2) {
    const ret = arg0.set(arg1, arg2);
    return ret;
};

export function __wbg_setheaders_3b47c898e8de6d44(arg0, arg1) {
    arg0.headers = arg1;
};

export function __wbg_setheaders_834c0bdb6a8949ad(arg0, arg1) {
    arg0.headers = arg1;
};

export function __wbg_sethighwatermark_793c99c89830c8e9(arg0, arg1) {
    arg0.highWaterMark = arg1;
};

export function __wbg_setmethod_3c5280fe5d890842(arg0, arg1, arg2) {
    arg0.method = getStringFromWasm0(arg1, arg2);
};

export function __wbg_static_accessor_GLOBAL_88a902d13a557d07() {
    const ret = typeof global === 'undefined' ? null : global;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
};

export function __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0() {
    const ret = typeof globalThis === 'undefined' ? null : globalThis;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
};

export function __wbg_static_accessor_SELF_37c5d418e4bf5819() {
    const ret = typeof self === 'undefined' ? null : self;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
};

export function __wbg_static_accessor_WINDOW_5de37043a91a9c40() {
    const ret = typeof window === 'undefined' ? null : window;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
};

export function __wbg_text_7805bea50de2af49() { return handleError(function (arg0) {
    const ret = arg0.text();
    return ret;
}, arguments) };

export function __wbg_then_44b73946d2fb3e7d(arg0, arg1) {
    const ret = arg0.then(arg1);
    return ret;
};

export function __wbg_then_48b406749878a531(arg0, arg1, arg2) {
    const ret = arg0.then(arg1, arg2);
    return ret;
};

export function __wbg_value_cd1ffa7b1ab794f1(arg0) {
    const ret = arg0.value;
    return ret;
};

export function __wbg_view_fd8a56e8983f448d(arg0) {
    const ret = arg0.view;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
};

export function __wbindgen_bigint_from_i64(arg0) {
    const ret = arg0;
    return ret;
};

export function __wbindgen_bigint_from_u64(arg0) {
    const ret = BigInt.asUintN(64, arg0);
    return ret;
};

export function __wbindgen_boolean_get(arg0) {
    const v = arg0;
    const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
    return ret;
};

export function __wbindgen_cb_drop(arg0) {
    const obj = arg0.original;
    if (obj.cnt-- == 1) {
        obj.a = 0;
        return true;
    }
    const ret = false;
    return ret;
};

export function __wbindgen_closure_wrapper1147(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 159, __wbg_adapter_49);
    return ret;
};

export function __wbindgen_closure_wrapper474(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 77, __wbg_adapter_46);
    return ret;
};

export function __wbindgen_debug_string(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbindgen_error_new(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return ret;
};

export function __wbindgen_in(arg0, arg1) {
    const ret = arg0 in arg1;
    return ret;
};

export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_export_4;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
    ;
};

export function __wbindgen_is_function(arg0) {
    const ret = typeof(arg0) === 'function';
    return ret;
};

export function __wbindgen_is_null(arg0) {
    const ret = arg0 === null;
    return ret;
};

export function __wbindgen_is_object(arg0) {
    const val = arg0;
    const ret = typeof(val) === 'object' && val !== null;
    return ret;
};

export function __wbindgen_is_string(arg0) {
    const ret = typeof(arg0) === 'string';
    return ret;
};

export function __wbindgen_is_undefined(arg0) {
    const ret = arg0 === undefined;
    return ret;
};

export function __wbindgen_jsval_loose_eq(arg0, arg1) {
    const ret = arg0 == arg1;
    return ret;
};

export function __wbindgen_memory() {
    const ret = wasm.memory;
    return ret;
};

export function __wbindgen_number_get(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'number' ? obj : undefined;
    getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
};

export function __wbindgen_number_new(arg0) {
    const ret = arg0;
    return ret;
};

export function __wbindgen_string_get(arg0, arg1) {
    const obj = arg1;
    const ret = typeof(obj) === 'string' ? obj : undefined;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
};

export function __wbindgen_string_new(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
};

export function __wbindgen_throw(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
};

