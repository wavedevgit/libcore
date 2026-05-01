const fs = require('fs');
const wasm = fs.readFileSync('./data/libdiscore.wasm');

const mem = new Map();

function readULEB128(buf, p) {
    let result = 0,
        shift = 0,
        b;
    do {
        b = buf[p++];
        result |= (b & 0x7f) << shift;
        shift += 7;
    } while (b & 0x80);
    return { value: result, pos: p };
}

function readSLEB128(buf, p) {
    let result = 0,
        shift = 0,
        b;
    do {
        b = buf[p++];
        result |= (b & 0x7f) << shift;
        shift += 7;
    } while (b & 0x80);
    if (shift < 32 && b & 0x40) result |= -(1 << shift);
    return { value: result, pos: p };
}

// Parse sections
const sections = [];
let pos = 8;
while (pos < wasm.length) {
    const sectionId = wasm[pos++];
    const { value: len, pos: p } = readULEB128(wasm, pos);
    sections.push({ id: sectionId, offset: p, size: len });
    pos = p + len;
}

const dataSection = sections.find((s) => s.id === 11);

// Parse data section
if (dataSection) {
    let dp = dataSection.offset;
    const end = dataSection.offset + dataSection.size;
    const { value: numSegments, pos: dp1 } = readULEB128(wasm, dp);
    dp = dp1;

    for (let i = 0; i < numSegments && dp < end; i++) {
        const mode = wasm[dp++];
        let offsetVal = -1;

        if (mode === 0) {
            const opcode = wasm[dp++];
            if (opcode === 0x41) {
                const r = readSLEB128(wasm, dp);
                offsetVal = r.value;
                dp = r.pos;
            }
            if (wasm[dp] === 0x0b) dp++;
        } else if (mode === 2) {
            const r = readULEB128(wasm, dp);
            dp = r.pos;
            const opcode = wasm[dp++];
            if (opcode === 0x41) {
                const r2 = readSLEB128(wasm, dp);
                offsetVal = r2.value;
                dp = r2.pos;
            }
            if (wasm[dp] === 0x0b) dp++;
        }

        const { value: dataSize, pos: dp2 } = readULEB128(wasm, dp);
        dp = dp2;

        if (offsetVal >= 0 && dataSize > 0) {
            for (let j = 0; j < dataSize; j++) {
                mem.set(offsetVal + j, wasm[dp + j]);
            }
        }
        dp += dataSize;
    }
}

function readBytes(offset, len) {
    const result = [];
    for (let i = 0; i < len; i++) result.push(mem.get(offset + i) || 0);
    return result;
}

function readU32(offset) {
    return (
        (mem.get(offset) || 0) |
        ((mem.get(offset + 1) || 0) << 8) |
        ((mem.get(offset + 2) || 0) << 16) |
        ((mem.get(offset + 3) || 0) << 24)
    );
}

function decodeKeyString(offset, len) {
    const rawBytes = readBytes(offset, len);
    const raw = rawBytes.map((b) => String.fromCharCode(b)).join('');
    const decoded = [];
    for (let i = 0; i < raw.length; i += 2) {
        if (i + 1 < raw.length)
            decoded.push(parseInt(raw.substring(i, i + 2), 16) ^ 0x73);
    }
    return decoded
        .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ''))
        .join('');
}

function isValidDetectionKey(str) {
    if (str.length < 2) return false;
    if (/^s+$/.test(str)) return false;
    // Require a minimum fraction of non-'s' meaningful chars to filter garbage
    const meaningful = str.replace(/s/g, '');
    if (meaningful.length < str.length * 0.35) return false;
    return /[a-zA-Z_]/.test(str);
}

// Find detection blocks: contiguous arrays of (ptr:u32, len:u32) in memory
// that point to valid decoded key strings
function isValidKeyEntry(ptr, len) {
    if (ptr === 0 || len === 0 || len > 100) return false;
    const str = decodeKeyString(ptr, len);
    return isValidDetectionKey(str);
}

const detectionBlocks = [];
const visitedOffsets = new Set();

for (let offset = 1073700; offset < 1075000; offset += 4) {
    if (visitedOffsets.has(offset)) continue;
    const ptr = readU32(offset);
    const len = readU32(offset + 4);

    if (isValidKeyEntry(ptr, len)) {
        const block = [];
        let cur = offset;
        while (true) {
            const p = readU32(cur);
            const l = readU32(cur + 4);
            if (!isValidKeyEntry(p, l)) break;
            block.push({ ptr: p, len: l });
            visitedOffsets.add(cur);
            visitedOffsets.add(cur + 4);
            cur += 8;
        }
        if (block.length > 0) {
            detectionBlocks.push({ offset, entries: block });
        }
    }
}

console.log(`Found ${detectionBlocks.length} detection key blocks:`);
for (const block of detectionBlocks) {
    const keys = block.entries.map((e) => decodeKeyString(e.ptr, e.len));
    console.log(
        `  offset=${block.offset} count=${block.entries.length} keys=${JSON.stringify(keys)}`,
    );
}

// Scan the wasm code section for the bitIndex table.
// The pattern is: i32.const <bitIndex> i32.const <dataOffset> i32.const <count>
// where dataOffset matches a known detection block offset.
// This table lives in function 959 of this wasm.

function extractBitIndexTable() {
    const codeSection = sections.find((s) => s.id === 10);
    if (!codeSection) return [];

    // Parse functions
    let cp = codeSection.offset;
    const { value: numCodeFuncs, pos: cp1 } = readULEB128(wasm, cp);
    cp = cp1;

    // Collect all detection block offsets for fast lookup
    const blockOffsetSet = new Set(detectionBlocks.map((b) => b.offset));

    // Find the function that contains the most matching (bitIndex, dataOffset, count) triples
    const funcScores = [];

    for (let fi = 0; fi < numCodeFuncs; fi++) {
        const { value: bodySize, pos: p2 } = readULEB128(wasm, cp);
        cp = p2;
        if (bodySize < 30) {
            cp += bodySize;
            continue;
        }

        const body = wasm.subarray(cp, cp + bodySize);
        let bp = 0;
        // Skip locals
        if (bp < body.length) {
            const { value: nl, pos: lp } = readULEB128(body, bp);
            bp = lp;
            for (let j = 0; j < nl; j++) {
                const { value: cnt, pos: clp } = readULEB128(body, bp);
                bp = clp;
                bp++;
            }
        }

        // Collect i32.const values
        const consts = [];
        while (bp < body.length - 2) {
            const opcode = body[bp++];
            if (opcode === 0x41) {
                const { value, pos: np } = readSLEB128(body, bp);
                consts.push(value);
                bp = np;
            }
        }

        // Look for pattern: (bitIndex, [optional resultPtrOff,] dataOffset, count)
        // For BetterDiscord the pattern is: 19, 28, 1073872, 3 (has resultPtrOff)
        // For others it is: 27, 1073908, 1 (no resultPtrOff)
        const matches = [];
        for (let ci = 1; ci < consts.length - 1; ci++) {
            const dataOffset = consts[ci];
            if (!blockOffsetSet.has(dataOffset)) continue;

            const countIdx = ci + 1;
            if (countIdx >= consts.length) continue;
            const count = consts[countIdx];
            if (count < 1 || count > 10) continue;

            // Find bitIndex: look at value(s) before dataOffset
            const before = consts[ci - 1];
            const before2 = ci >= 2 ? consts[ci - 2] : null;

            let bitIndex;
            if (before2 !== null && before2 >= 7 && before2 <= 200) {
                // Two values before dataOffset - first is bitIndex, second is resultPtr offset
                bitIndex = before2;
            } else if (before >= 7 && before <= 200) {
                // One value before dataOffset - it's the bitIndex
                bitIndex = before;
            } else {
                continue;
            }

            matches.push({ bitIndex, dataOffset, count });
        }

        if (matches.length > 0) {
            funcScores.push({ funcIdx: fi, matches });
        }
    }

    // Pick the function with the most matches (should be the table function)
    funcScores.sort((a, b) => b.matches.length - a.matches.length);
    if (funcScores.length === 0) return [];

    const best = funcScores[0];
    console.log(
        `  -> Table found in function ${best.funcIdx} (${best.matches.length} matches)`,
    );

    // Deduplicate: for each dataOffset, take the first occurrence
    const seen = new Map();
    for (const m of best.matches) {
        if (!seen.has(m.dataOffset)) {
            seen.set(m.dataOffset, m);
        }
    }

    return Array.from(seen.values());
}

const bitIndexTable = extractBitIndexTable();

console.log(`\nFound ${bitIndexTable.length} bitIndex table entries:`);
for (const e of bitIndexTable) {
    console.log(
        `  bitIndex=${e.bitIndex} dataOffset=${e.dataOffset} count=${e.count}`,
    );
}

// Map detection block offsets to bitIndices
const blockToBitIndex = new Map();
for (const e of bitIndexTable) {
    blockToBitIndex.set(e.dataOffset, e.bitIndex);
}

const sortedBlocks = [...detectionBlocks].sort((a, b) => a.offset - b.offset);

// Build final output
const mods = [];

// jQuery at bitIndex 8 → 8 ^ 127 = 119
const jqueryKeys = [];
for (const [offset] of mem) {
    for (const len of [2, 4, 12]) {
        const str = decodeKeyString(offset, len);
        if (
            (str === 'jQuery' ||
                str === '$' ||
                str === 'fn' ||
                str === 'jquery') &&
            !jqueryKeys.includes(str)
        ) {
            jqueryKeys.push(str);
        }
    }
}
const jqueryOrder = ['jQuery', '$', 'fn', 'jquery'];
jqueryKeys.sort((a, b) => jqueryOrder.indexOf(a) - jqueryOrder.indexOf(b));

if (jqueryKeys.length > 0) {
    const jqueryBi = 8;
    const shift = jqueryBi ^ 127;
    mods.push({
        keys: jqueryKeys,
        bitmask: shift,
        bitmask_raw: `1 << ${shift}`,
        name: jqueryKeys[0],
    });
}

for (const block of sortedBlocks) {
    const bitIndex = blockToBitIndex.get(block.offset);
    if (bitIndex === undefined) continue;

    const keys = block.entries.map((e) => decodeKeyString(e.ptr, e.len));
    const shift = bitIndex ^ 127;
    mods.push({
        keys,
        bitmask: shift,
        bitmask_raw: `1 << ${shift}`,
        name: keys[0],
    });
}

// Sort by bitIndex
mods.sort((a, b) => {
    const aIdx = parseInt(a.bitmask_raw.match(/\d+/)[0]);
    const bIdx = parseInt(b.bitmask_raw.match(/\d+/)[0]);
    return aIdx - bIdx;
});

fs.writeFileSync(
    './data/libdiscore-launch-signature-metadata.json',
    JSON.stringify(mods, null, 2),
);
console.log(`\nSaved ${mods.length} entries:`);
mods.forEach((m, i) => {
    console.log(
        `  [${i}] "${m.name}" keys=${JSON.stringify(m.keys)} bitmask_raw="${m.bitmask_raw}"`,
    );
});
