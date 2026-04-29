# libcore

A minimal discord datamining repo that is meant to track rspack configuration and libdiscore, this repository is built so dataminers can fix trackers faster.

## Files:

`./data/build.json` - build metadata with info like build number, built at, libdiscore metadata, etc
`./data/rspack.runtime.js` - stripped down version of web.js that contains only rspack runtime & 1 minimal chunk to ensure code format is tracked
`./data/libdiscore.wasm` - libdiscore wasm binary file
`./data/libdiscore.c` - libdiscore decompiled c (using wabt)
