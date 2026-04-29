import { decode } from '@webassemblyjs/wasm-parser';

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

    return {
        sections,
        producers,
        target_features: [...new Set(targetFeatures)],
    };
}
