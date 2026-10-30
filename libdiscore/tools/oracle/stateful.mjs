#!/usr/bin/env node

import assert from "node:assert/strict";
import { createOriginalOracle } from "./original.mjs";

class Window {}
class Cache {
    async match() { return undefined; }
    async put(request, response) {
        writes.set(request.url, Buffer.from(await response.clone().arrayBuffer()).toString("hex"));
    }
    async delete(request) {
        deletes.push(request.url);
        return true;
    }
}

const writes = new Map();
const deletes = [];
const nativeSetTimeout = globalThis.setTimeout;
let timers = 0;
globalThis.Window = Window;
Object.setPrototypeOf(globalThis, Window.prototype);
Object.assign(globalThis, {
    window: globalThis,
    Cache,
    caches: { open: async () => new Cache() },
    setTimeout(callback, delay) {
        if (timers++ === 0) queueMicrotask(callback);
        return delay;
    },
    fetch: async request => {
        const body = request.url.endsWith("current_revision.txt")
            ? "1"
            : `["a379a6f6eeafb9a55e378c118034e2751e682fab9f2d30ab13d2125586ce1947"]`;
        const response = new Response(body, { status: 200 });
        Object.defineProperty(response, "url", { value: request.url });
        return response;
    },
});

const oracle = createOriginalOracle();
oracle.installLogCallback(...Array.from({ length: 5 }, () => () => {}));
await oracle.initLibdiscore();
oracle.ExperimentCacher.flushToCache('{"x":{"treatmentId":3}}');
oracle.BlockedDomainsStore.startFetchingBlockedDomains("https://example.com/delta");
await new Promise(resolve => nativeSetTimeout(resolve, 100));

assert.equal(
    writes.get("https://libdiscore.discordapp.com/experiments_snapshot"),
    "000000017b2278223a7b2274726561746d656e744964223a337d7d",
);
assert.equal(
    writes.get("https://libdiscore.discordapp.com/blocked_domains_state"),
    "0101000000a379a6f6eeafb9a5",
);
assert.equal(oracle.BlockedDomainsStore.isBlockedDomain("https://www.example.com/path"), "example.com");
oracle.ExperimentCacher.clearCache();
await new Promise(resolve => nativeSetTimeout(resolve, 20));
assert.deepEqual(deletes, ["https://libdiscore.discordapp.com/experiments_snapshot"]);

console.log("stateful oracle: PASS");
console.log("experiment snapshot: big-endian v1 + JSON");
console.log("blocked-domain state: u8 v1 + little-endian revision + 8-byte SHA-256 prefixes");
process.exit(0);
