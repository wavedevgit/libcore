import { decode } from '@webassemblyjs/wasm-parser';
import fs from 'fs';

function extractStrings(buf, minLen = 4) {
    const bytes = new Uint8Array(buf);
    let current = '';
    const out = [];

    for (let i = 0; i < bytes.length; i++) {
        const c = bytes[i];

        // printable ASCII range
        if (c >= 32 && c <= 126) {
            current += String.fromCharCode(c);
        } else {
            if (current.length >= minLen) {
                out.push(current);
            }
            current = '';
        }
    }

    if (current.length >= minLen) {
        out.push(current);
    }

    return [...new Set(out)];
}

export function extractMetadata(buf) {
    const ast = decode(buf);
    const md = ast?.body?.[0]?.metadata ?? {};

    const producersRaw = md.producers?.[0]?.producers ?? [];

    const producers = {};
    for (const p of producersRaw) {
        const key = p.name || p.type || 'unknown';
        const val = p.value || p.version || p;
        producers[key] = val;
    }

    const sections = (md.sections ?? []).map((s) => ({
        section: s.section,
        startOffset: s.startOffset,
        size: typeof s.size === 'object' ? (s.size?.value ?? s.size) : s.size,
    }));

    const targetFeatures = producersRaw
        .flatMap((p) => p.features ?? [])
        .filter(Boolean);

    const strings = extractStrings(buf);

    // write to file
    fs.writeFileSync(
        'data/extracted-strings.txt',
        strings.join('\n'),
        'utf-8'
    );

    return {
        sections,
        producers,
        target_features: [...new Set(targetFeatures)],
        strings_count: strings.length,
        strings_file: 'data/extracted-strings.txt',
    };
}
