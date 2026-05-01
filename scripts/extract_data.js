import fs from 'fs';

const FILE_PATH = './data/libdiscore.c';
const XOR_KEY = 0x73;

// Parse a data string containing escape sequences
function parseDataString(str) {
    const bytes = [];
    let i = 0;
    while (i < str.length) {
        if (str[i] === '\\') {
            if (i + 1 < str.length && str[i + 1] === '\\') {
                // Escaped backslash
                if (
                    i + 2 < str.length &&
                    (str[i + 2] === '"' || str[i + 2] === '\\')
                ) {
                    bytes.push(str[i + 2].charCodeAt(0));
                    i += 3;
                } else {
                    bytes.push('\\'.charCodeAt(0));
                    i += 1;
                }
            } else if (
                i + 3 <= str.length &&
                /^[0-9a-fA-F]{2}$/.test(str.substring(i + 1, i + 3))
            ) {
                // \XX format (hex byte)
                const hex = str.substring(i + 1, i + 3);
                bytes.push(parseInt(hex, 16));
                i += 3;
            } else if (i + 1 < str.length) {
                // Other escape sequences
                const ch = str[i + 1];
                switch (ch) {
                    case 'n':
                        bytes.push(0x0a);
                        break;
                    case 'r':
                        bytes.push(0x0d);
                        break;
                    case 't':
                        bytes.push(0x09);
                        break;
                    default:
                        bytes.push(ch.charCodeAt(0));
                }
                i += 2;
            } else {
                bytes.push(str[i].charCodeAt(0));
                i += 1;
            }
        } else {
            bytes.push(str[i].charCodeAt(0));
            i += 1;
        }
    }
    return bytes;
}

// Read and parse the file to build memory map
function parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const memoryMap = {}; // offset -> byte value
    const dataEntries = [];

    let currentOffset = null;
    let currentBytes = [];
    let inDataEntry = false;
    let expectingDataString = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line starts a new data entry
        const dataMatch = line.match(/^data\s+(\w+)\(offset:\s*(\d+)\)\s*=/);
        if (dataMatch) {
            // Save previous entry if exists
            if (currentOffset !== null && currentBytes.length > 0) {
                dataEntries.push({
                    offset: currentOffset,
                    bytes: [...currentBytes],
                });
                for (let j = 0; j < currentBytes.length; j++) {
                    memoryMap[currentOffset + j] = currentBytes[j];
                }
            }

            // Start new entry
            currentOffset = parseInt(dataMatch[2], 10);
            currentBytes = [];
            inDataEntry = true;
            expectingDataString = true;
            continue;
        }

        // Check if this line has an inline data string: = "...";
        const inlineMatch = line.match(
            /^data\s+(\w+)\(offset:\s*(\d+)\)\s*=\s*"(.*)";/,
        );
        if (inlineMatch) {
            // Save previous entry if exists
            if (currentOffset !== null && currentBytes.length > 0) {
                dataEntries.push({
                    offset: currentOffset,
                    bytes: [...currentBytes],
                });
                for (let j = 0; j < currentBytes.length; j++) {
                    memoryMap[currentOffset + j] = currentBytes[j];
                }
            }

            currentOffset = parseInt(inlineMatch[2], 10);
            currentBytes = parseDataString(inlineMatch[3]);

            dataEntries.push({
                offset: currentOffset,
                bytes: [...currentBytes],
            });
            for (let j = 0; j < currentBytes.length; j++) {
                memoryMap[currentOffset + j] = currentBytes[j];
            }

            currentOffset = null;
            currentBytes = [];
            inDataEntry = false;
            expectingDataString = false;
            continue;
        }

        // If we're in a data entry, parse the data string lines
        if (inDataEntry) {
            const trimmed = line.trim();

            // Skip empty lines
            if (trimmed.length === 0) continue;

            // Check if this line starts a new data entry (shouldn't happen, but safety check)
            if (trimmed.startsWith('data ')) {
                // Save current entry
                if (currentOffset !== null && currentBytes.length > 0) {
                    dataEntries.push({
                        offset: currentOffset,
                        bytes: [...currentBytes],
                    });
                    for (let j = 0; j < currentBytes.length; j++) {
                        memoryMap[currentOffset + j] = currentBytes[j];
                    }
                }
                currentOffset = null;
                currentBytes = [];
                inDataEntry = false;
                expectingDataString = false;
                // Reprocess this line
                i--;
                continue;
            }

            // Parse data string line
            let dataStr = trimmed;

            // Remove leading quote if present
            if (dataStr.startsWith('"')) {
                dataStr = dataStr.substring(1);
            }

            // Check if this line ends the data
            if (dataStr.endsWith('";')) {
                dataStr = dataStr.substring(0, dataStr.length - 2); // Remove ";
                const parsed = parseDataString(dataStr);
                currentBytes.push(...parsed);
                // Save and reset
                dataEntries.push({
                    offset: currentOffset,
                    bytes: [...currentBytes],
                });
                for (let j = 0; j < currentBytes.length; j++) {
                    memoryMap[currentOffset + j] = currentBytes[j];
                }
                currentOffset = null;
                currentBytes = [];
                inDataEntry = false;
            } else {
                // Middle of multi-line data
                if (dataStr.endsWith('"')) {
                    dataStr = dataStr.substring(0, dataStr.length - 1); // Remove trailing quote
                }
                const parsed = parseDataString(dataStr);
                currentBytes.push(...parsed);
            }
        }
    }

    // Don't forget the last entry
    if (currentOffset !== null && currentBytes.length > 0) {
        dataEntries.push({ offset: currentOffset, bytes: [...currentBytes] });
        for (let j = 0; j < currentBytes.length; j++) {
            memoryMap[currentOffset + j] = currentBytes[j];
        }
    }

    // Sort entries by offset
    dataEntries.sort((a, b) => a.offset - b.offset);

    return { memoryMap, dataEntries };
}

// Extract bytes from memory map
function extractBytes(memoryMap, offset, length) {
    const bytes = [];
    for (let i = 0; i < length; i++) {
        const byte = memoryMap[offset + i];
        if (byte === undefined) {
            throw new Error(`No data at offset ${offset + i}`);
        }
        bytes.push(byte);
    }
    return bytes;
}

// XOR decode bytes
function xorDecode(bytes, key) {
    return bytes.map((b) => b ^ key);
}

// Convert bytes to hex string
function toHexString(bytes) {
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

// Convert bytes to string (printable)
function bytesToString(bytes) {
    return bytes
        .map((b) => {
            if (b >= 32 && b <= 126) {
                return String.fromCharCode(b);
            } else if (b === 0) {
                return '\\0';
            } else {
                return `\\x${b.toString(16).padStart(2, '0')}`;
            }
        })
        .join('');
}

// Find length for "need length" offsets
function findLength(dataEntries, targetOffset) {
    // Find the entry that contains this offset
    for (let i = 0; i < dataEntries.length; i++) {
        const entry = dataEntries[i];
        if (
            targetOffset >= entry.offset &&
            targetOffset < entry.offset + entry.bytes.length
        ) {
            return entry.offset + entry.bytes.length - targetOffset;
        }
    }

    throw new Error(
        `Could not find data entry containing offset ${targetOffset}`,
    );
}

// Main
function main() {
    const { memoryMap, dataEntries } = parseFile(FILE_PATH);

    console.log(`Parsed ${dataEntries.length} data entries`);
    console.log(`Memory map has ${Object.keys(memoryMap).length} bytes\n`);

    // Print some entries for debugging
    console.log('First 5 entries:');
    for (let i = 0; i < Math.min(5, dataEntries.length); i++) {
        const e = dataEntries[i];
        console.log(`  offset ${e.offset}: ${e.bytes.length} bytes`);
    }
    console.log();

    console.log('Last 5 entries:');
    for (
        let i = Math.max(0, dataEntries.length - 5);
        i < dataEntries.length;
        i++
    ) {
        const e = dataEntries[i];
        console.log(`  offset ${e.offset}: ${e.bytes.length} bytes`);
    }
    console.log();

    // Find the entry containing offset 1073764
    console.log('Looking for entry containing offset 1073764...');
    for (let i = 0; i < dataEntries.length; i++) {
        const entry = dataEntries[i];
        if (
            1073764 >= entry.offset &&
            1073764 < entry.offset + entry.bytes.length
        ) {
            console.log(
                `  Found! Entry at offset ${entry.offset}, length ${entry.bytes.length}`,
            );
            console.log(
                `  Contains offsets ${entry.offset} to ${entry.offset + entry.bytes.length - 1}`,
            );
            break;
        }
    }
    console.log();

    console.log('=== Extracting bytes at specified offsets ===\n');

    // Fixed length offsets
    const fixedOffsets = [
        { offset: 1073764, length: 12 },
        { offset: 1073776, length: 2 },
        { offset: 1073778, length: 4 },
        { offset: 1073782, length: 12 },
    ];

    for (const { offset, length } of fixedOffsets) {
        try {
            const bytes = extractBytes(memoryMap, offset, length);
            const decoded = xorDecode(bytes, XOR_KEY);
            console.log(`Offset ${offset} (length ${length}):`);
            console.log(`  Raw bytes (hex): ${toHexString(bytes)}`);
            console.log(
                `  XOR 0x${XOR_KEY.toString(16)} decoded: ${bytesToString(decoded)}`,
            );
            console.log(`  Decoded bytes (hex): ${toHexString(decoded)}`);
            console.log();
        } catch (e) {
            console.log(`Offset ${offset}: ERROR - ${e.message}`);
            console.log();
        }
    }

    // Bitmask data offsets (need to find lengths)
    const bitmaskOffsets = [
        1073872, 1073908, 1073968, 1074092, 1074172, 1074224, 1074316, 1074348,
        1074372, 1074396, 1074448,
    ];

    console.log(
        '\n=== Bitmask data offsets (with auto-detected lengths) ===\n',
    );

    for (const offset of bitmaskOffsets) {
        try {
            const length = findLength(dataEntries, offset);
            const bytes = extractBytes(memoryMap, offset, length);
            const decoded = xorDecode(bytes, XOR_KEY);
            console.log(`Offset ${offset} (length ${length}):`);
            console.log(`  Raw bytes (hex): ${toHexString(bytes)}`);
            console.log(
                `  XOR 0x${XOR_KEY.toString(16)} decoded: ${bytesToString(decoded)}`,
            );
            console.log(`  Decoded bytes (hex): ${toHexString(decoded)}`);
            console.log();
        } catch (e) {
            console.log(`Offset ${offset}: ERROR - ${e.message}`);
            console.log();
        }
    }
}

main();
