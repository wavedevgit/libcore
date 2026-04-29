export function formatTimeDiff(a, b = Date.now()) {
    let diff = Math.abs(b - a);

    const units = [
        { label: 'd', ms: 86_400_000 },
        { label: 'h', ms: 3_600_000 },
        { label: 'm', ms: 60_000 },
        { label: 's', ms: 1000 },
    ];

    for (const u of units) {
        if (diff >= u.ms) {
            const value = Math.floor(diff / u.ms);
            return `${value}${u.label} ago`;
        }
    }

    return '0s';
}
