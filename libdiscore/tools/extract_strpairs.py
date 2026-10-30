#!/usr/bin/env python3
"""Extract every (ptr, len) string reference pair from the linear-memory image.

rustc materialises `&str` constants as two adjacent u32s (ptr, len) with
0x00100000 <= ptr < 0x00200000 (the wasm data segment range). Resolving each
pair yields the exact, ordered field-name tables the compiler built for every
serde-serialized struct/enum in libdiscore.

Run:  python3 tools/extract_strpairs.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLOB = ROOT / "tools" / "data.bin"
LOW, HIGH = 0x100000, 0x140000  # generous data-range window


def main() -> int:
    blob = BLOB.read_bytes()
    pairs = []
    i = 0
    while i + 8 <= len(blob):
        # LE u32 ptr 0x0010xxxx (wabt listing showed pointers like 0x1049e8)
        if blob[i + 2] == 0x10 and blob[i + 3] == 0x00:
            ptr = int.from_bytes(blob[i : i + 4], "little")
            if LOW <= ptr < HIGH:
                length = int.from_bytes(blob[i + 4 : i + 8], "little")
                if 0 < length <= 4096:
                    try:
                        s = blob[ptr : ptr + length].decode("utf-8")
                    except UnicodeDecodeError:
                        s = None
                    if s is not None and "\x00" not in s:
                        pairs.append({"at": i, "ptr": ptr, "len": length, "str": s})
        i += 1  # allow overlapping scans to catch tightly packed tables
    out = ROOT / "tools" / "strpairs.txt"
    with out.open("w") as f:
        for p in pairs:
            f.write(f"{p['at']:>8} ptr=0x{p['ptr']:06x} len={p['len']:>4} | {p['str']}\n")
    print(f"resolved {len(pairs)} string references -> {out.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
