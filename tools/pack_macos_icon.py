#!/usr/bin/env python3
"""Pack the app's PNG icon sizes into a modern ICNS bundle."""

from __future__ import annotations

import struct
import sys
from pathlib import Path


def png_dimensions(data: bytes) -> tuple[int, int]:
    if not data.startswith(b"\x89PNG\r\n\x1a\n") or data[12:16] != b"IHDR":
        raise ValueError("Icon source is not a valid PNG")
    return struct.unpack(">II", data[16:24])


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: pack_macos_icon.py ICONSET_DIR OUTPUT.icns", file=sys.stderr)
        return 2

    iconset_dir = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    # These PNG-based ICNS records cover modern macOS display sizes. ic04/ic05
    # provide the smallest sizes without relying on legacy 16/32px PNG slots.
    records = [
        ("ic04", "icon_16x16.png", 16),
        ("ic05", "icon_16x16@2x.png", 32),
        ("ic07", "icon_128x128.png", 128),
        ("ic08", "icon_256x256.png", 256),
        ("ic09", "icon_512x512.png", 512),
        ("ic10", "icon_512x512@2x.png", 1024),
        ("ic11", "icon_16x16@2x.png", 32),
        ("ic12", "icon_32x32@2x.png", 64),
        ("ic13", "icon_128x128@2x.png", 256),
        ("ic14", "icon_256x256@2x.png", 512),
    ]

    chunks: list[bytes] = []
    for record_type, filename, expected_size in records:
        png_data = (iconset_dir / filename).read_bytes()
        width, height = png_dimensions(png_data)
        if width != expected_size or height != expected_size:
            raise ValueError(f"{filename} is {width}x{height}; expected {expected_size}x{expected_size}")
        chunks.append(record_type.encode("ascii") + struct.pack(">I", len(png_data) + 8) + png_data)

    icon_data = bytearray(b"icns\x00\x00\x00\x00" + b"".join(chunks))
    icon_data[4:8] = struct.pack(">I", len(icon_data))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(icon_data)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(f"Unable to create ICNS icon: {error}", file=sys.stderr)
        raise SystemExit(1)
