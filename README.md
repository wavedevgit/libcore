# libcore

A minimal discord datamining repo that is meant to track rspack configuration and libdiscore, this repository is built so dataminers can fix trackers faster.

## Files:

`./data/build.json` - build metadata with info like build number, built at, libdiscore metadata, etc
`./data/rspack.runtime.js` - stripped down version of web.js that contains only rspack runtime & 1 minimal chunk to ensure code format is tracked
`./data/libdiscore.wasm` - libdiscore wasm binary file
`./data/libdiscore.c` - libdiscore decompiled c (using wabt)

Set `WEBHOOK_URL` to receive a Discord webhook notification when the build,
Rspack version, or libdiscore hash changes. GitHub Actions reads it from the
repository secret with the same name. Libdiscore notifications also list newly
seen Wasm imports and exports when `wasm-objdump` is available.
