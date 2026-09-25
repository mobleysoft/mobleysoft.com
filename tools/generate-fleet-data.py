#!/usr/bin/env python3
"""Regenerate data/fleet.json from the canonical estate ventures.json.

The homepage fleet browser (index.html's #fleet-strip) claims its data is
"Generated from ventures.json, never a hand-copied domain list." Until this
script existed, that was only true of the file's origin, not of its
freshness: data/fleet.json was a one-off hand-run export with no reusable
generator anywhere in the repo or the estate, so it silently drifted stale
(found 2026-09-25: the file's own source_sha256 no longer matched the real
ventures.json, dated 2026-09-03). Run this whenever ventures.json changes.
"""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

VENTURES_JSON = Path("/Users/johnmobley/ventures.json")
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "fleet.json"


def main():
    raw = VENTURES_JSON.read_bytes()
    source_sha256 = hashlib.sha256(raw).hexdigest()
    data = json.loads(raw)
    ventures = data["ventures"] if isinstance(data, dict) else data

    fleet = sorted(
        (
            {"domain": v["name"], "url": f"https://{v['name']}/"}
            for v in ventures
            if v.get("name")
        ),
        key=lambda v: v["domain"],
    )

    payload = {
        "count": len(fleet),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "schema_version": "1.0",
        "source": "ventures.json",
        "source_sha256": source_sha256,
        "ventures": fleet,
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {len(fleet)} ventures to {OUTPUT_PATH} (source_sha256={source_sha256[:12]}...)")


if __name__ == "__main__":
    sys.exit(main())
