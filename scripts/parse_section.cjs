const fs = require('fs');
const c = fs.readFileSync('/home/wavedev/libcore/data/libdiscore.c', 'utf8');

// Find the section starting at 1073472
const startIdx = c.indexOf('data d_zlrHYj_attemptedtotakeowners(offset: 1073472)');
let endIdx = c.indexOf(';', startIdx + 1);
const section = c.substring(startIdx, endIdx + 1);

// Extract all quoted strings and concatenate them
const strParts = [];
const re = /"([^"]*)"/g;
let m;
while ((m = re.exec(section)) !== null) {
  strParts.push(m[1]);
}
const raw = strParts.join('');

function parseEscape(str) {
  const bytes = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const next = str[i + 1];
      if (/[0-7]/.test(next)) {
        let oct = next;
        let j = i + 2;
        while (j < str.length && /[0-7]/.test(str[j]) && oct.length < 3) { oct += str[j]; j++; }
        bytes.push(parseInt(oct, 8));
        i = j;
      } else if (next === '\\') { bytes.push(0x5C); i += 2; }
      else { bytes.push(str.charCodeAt(i + 1)); i += 2; }
    } else {
      bytes.push(str.charCodeAt(i));
      i++;
    }
  }
  return bytes;
}

const bytes = parseEscape(raw);
console.log('Total bytes:', bytes.length);

// Check offsets
const targetOffsets = [1073764, 1073776, 1073778, 1073782, 1073872, 1073908, 1073968, 1074092, 1074172, 1074224, 1074316, 1074348, 1074372, 1074396, 1074448];
const baseOffset = 1073472;

for (const off of targetOffsets) {
  const idx = off - baseOffset;
  if (idx < 0 || idx >= bytes.length) {
    console.log(`Offset ${off}: OUT OF RANGE (idx=${idx}, total=${bytes.length})`);
    continue;
  }
  const slice = bytes.slice(idx, idx + 24);
  const hex = slice.map(b => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = slice.map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
  console.log(`Offset ${off} (idx ${idx}): [${hex}] "${ascii}"`);
}
