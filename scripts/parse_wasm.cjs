const fs = require('fs');
const { decode } = require('@webassemblyjs/wasm-parser');

const wasm = fs.readFileSync('./data/libdiscore.wasm');
const ast = decode(wasm.buffer);

// Build memory map from data sections
const mem = {};
for (const section of ast.body) {
    if (section.id === 'data') {
        for (const entry of section.entries) {
            if (entry.init && entry.offset) {
                // Get offset value
                let offsetVal = 0;
                if (entry.offset.args && entry.offset.args.length > 0) {
                    offsetVal = entry.offset.args[0].value;
                }
                // Get bytes
                const bytes = entry.init.bytes || entry.init.value || [];
                for (let i = 0; i < bytes.length; i++) {
                    mem[offsetVal + i] = bytes[i];
                }
                console.log(
                    `Data section at memory offset ${offsetVal}, ${bytes.length} bytes`,
                );
            }
        }
    }
}

console.log('\nTotal memory bytes mapped:', Object.keys(mem).length);

// Now extract the detection keys
function readU32(off) {
    return (
        (mem[off] || 0) |
        ((mem[off + 1] || 0) << 8) |
        ((mem[off + 2] || 0) << 16) |
        ((mem[off + 3] || 0) << 24)
    );
}

// Detection key offsets and lengths
const keyOffsets = [
    { offset: 1073764, len: 12 },
    { offset: 1073776, len: 2 },
    { offset: 1073778, len: 4 },
    { offset: 1073782, len: 12 },
];

console.log('\n=== Detection Keys ===');
for (const { offset, len } of keyOffsets) {
    const bytes = [];
    for (let i = 0; i < len; i++) bytes.push(mem[offset + i] || 0);
    const raw = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    // Decode: hex parse then XOR 0x73
    const hexPairs = [];
    for (let i = 0; i < raw.length; i += 2) {
        hexPairs.push(parseInt(raw.substring(i, i + 2), 16));
    }
    const decoded = hexPairs
        .map((b) => {
            const d = b ^ 0x73;
            return d >= 0x20 && d < 0x7f
                ? String.fromCharCode(d)
                : `\\x${d.toString(16).padStart(2, '0')}`;
        })
        .join('');
    console.log(
        `Offset ${offset} (len ${len}): raw="${raw}" decoded="${decoded}"`,
    );
}

// Bitmask data
const bitmaskData = [
    { offset: 1073872, count: 3 },
    { offset: 1073908, count: 1 },
    { offset: 1073968, count: 4 },
    { offset: 1074092, count: 4 },
    { offset: 1074172, count: 2 },
    { offset: 1074224, count: 2 },
    { offset: 1074316, count: 3 },
    { offset: 1074348, count: 1 },
    { offset: 1074372, count: 1 },
    { offset: 1074396, count: 1 },
    { offset: 1074448, count: 2 },
];

console.log('\n=== Bitmask Data (mod detection entries) ===');
for (const { offset, count } of bitmaskData) {
    console.log(`\nOffset ${offset} (${count} entries):`);
    for (let i = 0; i < count; i++) {
        const ptr = readU32(offset + i * 8);
        const len = readU32(offset + i * 8 + 4);
        if (ptr === 0) {
            console.log(`  Entry ${i}: ptr=0, len=0`);
            continue;
        }
        const keyBytes = [];
        for (let j = 0; j < len; j++) keyBytes.push(mem[ptr + j] || 0);
        const raw = keyBytes.map((b) => String.fromCharCode(b)).join('');
        // This is hex-encoded, decode it
        const decoded = [];
        for (let j = 0; j < raw.length; j += 2) {
            const byte = parseInt(raw.substring(j, j + 2), 16) ^ 0x73;
            decoded.push(
                byte >= 0x20 && byte < 0x7f
                    ? String.fromCharCode(byte)
                    : `\\x${byte.toString(16).padStart(2, '0')}`,
            );
        }
        console.log(
            `  Entry ${i}: ptr=${ptr}, len=${len}, raw="${raw.substring(0, 60)}..." decoded="${decoded.join('')}"`,
        );
    }
}
