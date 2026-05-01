const fs = require('fs');
const wasm = fs.readFileSync('/home/wavedev/libcore/data/libdiscore.wasm');

// Properly parse wasm data sections
// Build memory map
const mem = new Map();

function readLEB128(p) {
  let result = 0, shift = 0;
  let b;
  do {
    b = wasm[p++];
    result |= (b & 0x7f) << shift;
    shift += 7;
  } while (b & 0x80);
  return { value: result, pos: p };
}

function readI32(p) {
  // signed LEB128
  let result = 0, shift = 0;
  let b;
  do {
    b = wasm[p++];
    result |= (b & 0x7f) << shift;
    shift += 7;
  } while (b & 0x80);
  if (shift < 32 && (b & 0x40)) {
    result |= -(1 << shift);
  }
  return { value: result, pos: p };
}

// Find data section (id=11)
let pos = 8;
while (pos < wasm.length) {
  const sectionId = wasm[pos++];
  let len = 0, shift = 0, b;
  do { b = wasm[pos++]; len |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
  
  if (sectionId === 11) {
    console.log('Data section at file offset:', pos, 'size:', len);
    let p = pos;
    const end = pos + len;
    
    // Read number of segments
    const { value: numSegments, pos: p1 } = readLEB128(p);
    p = p1;
    console.log('Number of segments:', numSegments);
    
    for (let i = 0; i < numSegments && p < end; i++) {
      const segStart = p;
      const mode = wasm[p++];
      let memIdx = 0;
      let offsetVal = 0;
      
      if (mode === 0) {
        // Active, memory 0, just expression
        // Read i32.const expression
        const opcode = wasm[p++];
        if (opcode === 0x41) { // i32.const
          const r = readI32(p);
          offsetVal = r.value;
          p = r.pos;
        }
        if (wasm[p] === 0x0b) p++; // end
      } else if (mode === 1) {
        // Passive segment, no offset
        offsetVal = -1; // mark as passive
      } else if (mode === 2) {
        // Active with memory index
        const r = readLEB128(p);
        memIdx = r.value;
        p = r.pos;
        const opcode = wasm[p++];
        if (opcode === 0x41) {
          const r2 = readI32(p);
          offsetVal = r2.value;
          p = r2.pos;
        }
        if (wasm[p] === 0x0b) p++;
      } else if (mode === 3) {
        // Declare passive
        offsetVal = -2;
      } else if (mode === 4) {
        // Active, memory index 0, expression with type info
        // Skip type
        p++; // memtype
        const opcode = wasm[p++];
        if (opcode === 0x41) {
          const r = readI32(p);
          offsetVal = r.value;
          p = r.pos;
        }
        if (wasm[p] === 0x0b) p++;
      } else {
        // Unknown mode, try to recover
        console.log(`Segment ${i}: unknown mode ${mode} at file offset ${segStart}`);
      }
      
      // Read data size
      const { value: dataSize, pos: p2 } = readLEB128(p);
      p = p2;
      
      if (offsetVal >= 0 && dataSize > 0) {
        for (let j = 0; j < dataSize; j++) {
          mem.set(offsetVal + j, wasm[p + j]);
        }
      }
      
      if (i < 5 || (offsetVal >= 1073700 && offsetVal < 1075000) || dataSize > 100) {
        console.log(`Segment ${i}: mode=${mode}, memIdx=${memIdx}, offset=${offsetVal}, dataLen=${dataSize}`);
      }
      
      p += dataSize;
    }
    break;
  }
  
  pos += len;
}

console.log('\nTotal memory bytes mapped:', mem.size);

// Helper to read bytes from memory map
function readBytes(offset, len) {
  const result = [];
  for (let i = 0; i < len; i++) {
    result.push(mem.get(offset + i) || 0);
  }
  return result;
}

function readU32(offset) {
  const b0 = mem.get(offset) || 0;
  const b1 = mem.get(offset + 1) || 0;
  const b2 = mem.get(offset + 2) || 0;
  const b3 = mem.get(offset + 3) || 0;
  return b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
}

// Detection key offsets
console.log('\n=== Detection Keys ===');
const keyOffsets = [
  { offset: 1073764, len: 12 },
  { offset: 1073776, len: 2 },
  { offset: 1073778, len: 4 },
  { offset: 1073782, len: 12 },
];

for (const { offset, len } of keyOffsets) {
  const bytes = readBytes(offset, len);
  const raw = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  const decoded = [];
  for (let i = 0; i < raw.length; i += 2) {
    const byte = parseInt(raw.substring(i, i + 2), 16) ^ 0x73;
    decoded.push((byte >= 0x20 && byte < 0x7f) ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, '0')}`);
  }
  console.log(`Offset ${offset} (len ${len}): raw="${raw}" decoded="${decoded.join('')}"`);
}

// Bitmask data
console.log('\n=== Bitmask Data ===');
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

for (const { offset, count } of bitmaskData) {
  console.log(`\nOffset ${offset} (${count} entries):`);
  for (let i = 0; i < count; i++) {
    const ptr = readU32(offset + i * 8);
    const len = readU32(offset + i * 8 + 4);
    if (ptr === 0 || len === 0) {
      console.log(`  Entry ${i}: ptr=${ptr}, len=${len}`);
      continue;
    }
    const rawBytes = readBytes(ptr, len);
    const raw = rawBytes.map(b => String.fromCharCode(b)).join('');
    const decoded = [];
    for (let j = 0; j < raw.length; j += 2) {
      if (j + 1 < raw.length) {
        const byte = parseInt(raw.substring(j, j + 2), 16) ^ 0x73;
        decoded.push((byte >= 0x20 && byte < 0x7f) ? String.fromCharCode(byte) : `\\x${byte.toString(16).padStart(2, '0')}`);
      }
    }
    console.log(`  Entry ${i}: ptr=${ptr}, len=${len} raw="${raw.substring(0, 60)}" decoded="${decoded.join('')}"`);
  }
}
