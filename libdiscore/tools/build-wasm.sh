#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

required=wasm-bindgen-cli
tool=wasm-bindgen
expected=0.2.100

if ! command -v "$tool" >/dev/null || [[ $("$tool" --version) != "wasm-bindgen $expected" ]]; then
    echo "installing $required $expected" >&2
    cargo install "$required" --version "$expected" --locked
fi

cargo build --release --target wasm32-unknown-unknown --features web
wasm-bindgen \
    target/wasm32-unknown-unknown/release/libdiscore.wasm \
    --target bundler \
    --out-dir . \
    --out-name libdiscore_wasm
