import { BASE_URL, CANARY_URL_APP, HEADERS, WEB_JS } from './constants.js';
import { deminify, getRuntime } from './runtime.js';
import { get } from './fetch.js';
import { getModules } from './get_modules.js';
import fs, { readFile } from 'fs/promises';
import { extractMetadata } from './wasm-metadata.js';
import { formatTimeDiff } from './time.js';

async function notify(build, changes) {
    if (!process.env.WEBHOOK_URL || changes.length === 0) return;

    const response = await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            embeds: [
                {
                    title: 'New Discord build data',
                    description: changes.join('\n'),
                    color: 0x5865f2,
                    fields: [
                        { name: 'Build', value: build.buildNumber ?? 'unknown', inline: true },
                        { name: 'Rspack', value: build.rspackVersion ?? 'unknown', inline: true },
                        { name: 'Libdiscore', value: build.libdiscore ?? 'not found', inline: true },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) throw new Error(`Webhook failed with HTTP ${response.status}`);
}

async function main() {
    try {
        await fs.mkdir('./data');
    } catch {}

    let old = {};
    try {
        old = JSON.parse(await readFile('./data/build.json', 'utf-8'));
    } catch {}
    const html = await get(CANARY_URL_APP, { headers: HEADERS });
    const web = await get(BASE_URL + '/assets/' + html.match(WEB_JS)[0], {
        headers: HEADERS,
    });

    const builtAt = html.match(/"BUILT_AT":"(\d+)"/)?.[1];
    let build = {
        buildNumber: html.match(/"BUILD_NUMBER":"(\d+)"/)?.[1],
        versionHash: html.match(/"VERSION_HASH":"([a-fA-F0-9]{40})"/)?.[1],
        builtAt,
        timeSinceLastBuild:
            typeof old?.builtAt === 'undefined'
                ? null
                : formatTimeDiff(old.builtAt, builtAt),
        rspackVersion: web.match(/\.rv=\(\)=>"([\s\S]+?)",/)?.[1],
        libdiscore: null,
        'libdiscore-metadata': {
            producer: null,
            language: null,
            'processed-by': null,
            target_features: null,
        },
    };
    console.log('got main build info', build);

    console.log('trying to find libdiscore');

    // its on one of the js files in html
    const modules = await getModules(html);

    for (let module of modules) {
        const js = await get(BASE_URL + module, {
            headers: HEADERS,
        });
        // main string that is in chunk that has the wasm file name
        if (!js.includes('"./libdiscore_wasm_bg.js":{')) continue;
        build.libdiscore = js.match(
            /[\w_]+\.exports(\s+|)=(\s+|)[\w_]+\.v\([\w_]+,(\s+|)[\w_]+\.id,(\s+|)"(?<id>[a-f0-9]{16})",(\s+|){/,
        ).groups?.id;
        break;
    }

    if (!build.libdiscore) {
        console.log("couldn't find libdiscore, sadly...");
        console.log('something changed.');
    }

    const libdiscoreBuffer = build.libdiscore
        ? await get(BASE_URL + '/assets/' + build.libdiscore + '.module.wasm', {
              headers: HEADERS,
              binary: true,
          })
        : null;

    if (libdiscoreBuffer)
        await fs.writeFile('./data/libdiscore.wasm', libdiscoreBuffer);

    // gets metadata
    if (libdiscoreBuffer) build['libdiscore-metadata'] = extractMetadata(libdiscoreBuffer);

    // its time to extract rspack runtime only

    const rspackRuntime = getRuntime(web);

    await fs.writeFile(
        './data/rspack.runtime.js',
        deminify(rspackRuntime),
        'utf-8',
    );
    await fs.writeFile(
        './data/build.json',
        JSON.stringify(build, null, 4),
        'utf-8',
    );
    const changes = [];
    if (build.buildNumber !== old.buildNumber)
        changes.push(`Build: ${old.buildNumber ?? 'none'} → ${build.buildNumber ?? 'unknown'}`);
    if (build.libdiscore !== old.libdiscore)
        changes.push(`Libdiscore: ${old.libdiscore ?? 'none'} → ${build.libdiscore ?? 'not found'}`);
    if (build.rspackVersion !== old.rspackVersion)
        changes.push(`Rspack: ${old.rspackVersion ?? 'none'} → ${build.rspackVersion ?? 'unknown'}`);
    await notify(build, changes);
    console.log('done, enjoy the data!');
}

main();
