import {
    BASE_URL,
    CANARY_URL_APP,
    HEADERS,
    RSPACK_RUNTIME_START,
    WEB_JS,
} from './constants.js';
import { deminify, getRuntime } from './runtime.js';
import { get } from './fetch.js';
import { getModules } from './get_modules.js';
import fs from 'fs/promises';

async function main() {
    try {
        await fs.mkdir('./data');
    } catch {}

    const html = await get(CANARY_URL_APP, { headers: HEADERS });
    const web = await get(BASE_URL + '/assets/' + html.match(WEB_JS)[0], {
        headers: HEADERS,
    });
    let build = {
        buildNumber: html.match(/"BUILD_NUMBER":"(\d+)"/)?.[1],
        versionHash: html.match(/"VERSION_HASH":"([a-fA-F0-9]{40})"/)?.[1],
        builtAt: html.match(/"BUILT_AT":"(\d+)"/)?.[1],
        rspackVersion: web.match(/\.rv=\(\)=>"([\s\S]+?)",/)?.[1],
        libdiscore: null,
    };
    console.log('got main build info', build);

    console.log('trying to find libdiscore');

    const { js: modules } = await getModules(web);

    for (let module of Object.values(modules)) {
        break;
        const js = await get(BASE_URL + '/assets/' + module, {
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
    if (build.libdiscore)
        await fs.writeFile(
            './data/libdiscore.wasm',
            await get(BASE_URL + '/assets/' + build.libdiscore, {
                headers: HEADERS,
            }),
        );

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
    console.log('done, enjoy the data!');
}

main();
