#!/usr/bin/env python3
"""Byte-exact extraction from data/libdiscore.wasm via a minimal binary parser.

Sections parsed: type (1), import (2), function (3), export (7), code (10), data (11).
Why: the wabt --decompiler listing (data/libdiscore.c) renders data bytes as quoted
strings that can contain raw '"' characters, so the listing alone cannot give a
byte-exact memory image. The binary can.

Outputs (byte-exact, used to verify the Rust reconstruction):
  libdiscore/tools/data.bin         - complete linear-memory data-segment image
  libdiscore/wasm-sections.json     - imports, exports (name/index/kind), data segments,
                                      function count, section byte ranges

Run:  python3 tools/parse_wasm_bin.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "data" / "libdiscore.wasm"
BLOB = ROOT / "tools" / "data.bin"
OUT = ROOT / "wasm-sections.json"


class Reader:
    def __init__(self, buf: bytes, pos: int = 0):
        self.buf = buf
        self.pos = pos

    def byte(self) -> int:
        b = self.buf[self.pos]
        self.pos += 1
        return b

    def uleb(self) -> int:
        shift = result = 0
        while True:
            b = self.byte()
            result |= (b & 0x7F) << shift
            if b < 0x80:
                return result
            shift += 7

    def vec(self) -> int:
        return self.uleb()

    def take(self, n: int) -> bytes:
        out = self.buf[self.pos : self.pos + n]
        self.pos += n
        return out


SECTION_NAMES = {
    0: "custom",
    1: "type",
    2: "import",
    3: "function",
    4: "table",
    5: "memory",
    6: "global",
    7: "export",
    8: "start",
    9: "element",
    10: "code",
    11: "data",
    12: "data_count",
}


def main() -> int:
    buf = SRC.read_bytes()
    assert buf[:4] == b"\x00asm", "not a wasm module"
    r = Reader(buf)
    version = r.take(4)
    sections = {}
    while r.pos < len(buf):
        sid = r.byte()
        size = r.uleb()
        start = r.pos
        body_end = start + size
        sections.setdefault(SECTION_NAMES.get(sid, f"unknown_{sid}"), []).append(
            {"id": sid, "start": start, "size": size}
        )
        r.take(size)
        if sid == 11:  # data section body
            d = Reader(buf, start)
            count = d.vec()
            segments = []
            blob = bytearray()
            for _ in range(count):
                flag = d.byte()
                seg = {"flag": flag}
                if flag == 0:
                    if d.byte() != 0x41:
                        raise AssertionError(f"segment {_} flag {flag}: expected i32.const offset expr")
                    seg["offset"] = d.uleb()
                    # consume `0b` end-of-expr
                    d.byte()
                elif flag == 2:
                    d.byte()
                    d.byte()
                    off = d.uleb()
                    seg["offset"] = off
                else:  # flag == 1: passive
                    seg["offset"] = None
                size = d.vec()
                payload = d.take(size)
                seg["size"] = size
                segments.append(seg)
                if seg["offset"] is not None:
                    end = seg["offset"] + size
                    if end > len(blob):
                        blob.extend(bytes(end - len(blob)))
                    blob[seg["offset"] : end] = payload
            sections["data"][-1]["count"] = count
            BLOB.write_bytes(bytes(blob))

    # export section - name, kind, index
    body = sections["export"][0]
    d = Reader(buf, body["start"])
    count = d.vec()
    exports = []
    for _ in range(count):
        n = d.vec()
        name = d.take(n).decode()
        kind = d.byte()
        idx = d.uleb()
        exports.append({"name": name, "kind": ["func", "table", "memory", "global"][kind], "index": idx})

    imports = []
    if "import" in sections:
        body = sections["import"][0]
        d = Reader(buf, body["start"])
        count = d.vec()
        for _ in range(count):
            mod_n = d.vec()
            mod = d.take(mod_n).decode()
            nm_n = d.vec()
            name = d.take(nm_n).decode()
            kind = d.byte()
            imports.append({"module": mod, "name": name, "kind": ["func", "table", "memory", "global"][kind]})
            if kind == 0:
                d.uleb()  # typeidx

    manifest = {
        "binary": str(SRC),
        "size": len(buf),
        "format_version": int.from_bytes(version, "little"),
        "sections": sections,
        "imports": imports,
        "exports": exports,
        "export_count": len(exports),
        "import_count": len(imports),
    }
    OUT.write_text(json.dumps(manifest, indent=1))
    data_segs = sections["data"][-1].get("count", 0) if "data" in sections else 0
    print(
        f"module {SRC.name}: {len(buf)} bytes, {len(exports)} exports, {len(imports)} imports, "
        f"{data_segs} data segments, data blob {len(BLOB.read_bytes()) if BLOB.exists() else 0} bytes"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
