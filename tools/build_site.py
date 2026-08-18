#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Any

from build_showbiz_canary import build_canary


ROOT = Path(__file__).resolve().parents[1]
VENTURES_PATH = Path(os.environ.get("MOBLEYSOFT_VENTURES", str(Path.home() / "ventures.json"))).resolve()
UNLOST_ROOT = Path(os.environ.get("UNLOST_ROOT", str(Path.home() / "mobley-kernel"))).resolve()
UNLOST_VERSION = os.environ.get("UNLOST_VERSION") or subprocess.check_output(
    [str(UNLOST_ROOT / "bin" / "unlost"), "--version"], text=True
).strip().split()[-1]
UNLOST_DIST = Path(
    os.environ.get(
        "UNLOST_DIST",
        str(UNLOST_ROOT / "dist" / f"unlost-{UNLOST_VERSION}-macos.zip"),
    )
).resolve()
UNLOST_BENCHMARK = Path(
    os.environ.get(
        "UNLOST_BENCHMARK",
        str(UNLOST_ROOT / "dist" / f"unlost-{UNLOST_VERSION}-benchmark.json"),
    )
).resolve()
UNLOST_RELEASE_VERIFICATION = Path(
    os.environ.get(
        "UNLOST_RELEASE_VERIFICATION",
        str(UNLOST_ROOT / "dist" / f"unlost-{UNLOST_VERSION}-release-verification.json"),
    )
).resolve()
DOMAIN_PATTERN = re.compile(r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
FORBIDDEN_DOMAINS = {
    "arwencorp.com",
    "mailguy-ai.com",
    "mobeysoft.com",
    "mobley-helms.com",
    "mobleyhems.com",
}

SHOWBIZ_SEQUENCE = (
    {
        "domain": "literacraft.com",
        "stage": "Source",
        "product": "Story Forge",
        "application": "Develop and refine original written IP.",
        "handoff": "Manuscript, story bible, and rights record",
    },
    {
        "domain": "mobleybooks.com",
        "stage": "Catalog",
        "product": "Title Library",
        "application": "Package, discover, and manage adaptable titles.",
        "handoff": "Searchable title and rights catalog",
    },
    {
        "domain": "book2film.cc",
        "stage": "Adapt",
        "product": "Book2Film",
        "application": "Transform written content into production-ready scripts.",
        "handoff": "Screenplay, scene map, and production brief",
    },
    {
        "domain": "conseiv.com",
        "stage": "Design",
        "product": "Conseiv",
        "application": "Turn the production brief into spatial and manufactured design data.",
        "handoff": "Sets, props, layouts, and fabrication models",
    },
    {
        "domain": "animetrope.com",
        "stage": "Visualize",
        "product": "Animetrope",
        "application": "Generate animation, previsualization, and visual sequences.",
        "handoff": "Boards, animatics, and animated shots",
    },
    {
        "domain": "audiovizai.com",
        "stage": "Score",
        "product": "AudioVizAI",
        "application": "Create synchronized sound, voice, music, and visual timing.",
        "handoff": "Timed audiovisual package",
    },
    {
        "domain": "filmline.cc",
        "stage": "Finish",
        "product": "Filmline",
        "application": "Assemble virtual production, editing, and final delivery.",
        "handoff": "Master, trailer, and delivery package",
    },
    {
        "domain": "gamegob.com",
        "stage": "Extend",
        "product": "GameGob",
        "application": "Convert the same world and assets into interactive experiences.",
        "handoff": "Playable prototype and reusable world assets",
    },
    {
        "domain": "marketingium.com",
        "stage": "Reach",
        "product": "Marketingium",
        "application": "Package, test, distribute, and measure the campaign.",
        "handoff": "Campaign, audience funnel, and performance record",
    },
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def atomic_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, dict) else {}


def unlost_json(*arguments: str) -> dict[str, Any]:
    completed = subprocess.run(
        [str(UNLOST_ROOT / "bin" / "unlost"), *arguments],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        detail = completed.stderr.strip() or completed.stdout.strip() or "no command output"
        raise RuntimeError(f"Unlost command failed: {' '.join(arguments)}: {detail}") from error
    if not isinstance(payload, dict):
        raise ValueError(f"Unlost command returned non-object JSON: {' '.join(arguments)}")
    if completed.returncode and (
        payload.get("status") != "observed" or not isinstance(payload.get("verification"), dict)
    ):
        detail = completed.stderr.strip() or json.dumps(payload, sort_keys=True)
        raise RuntimeError(f"Unlost command failed: {' '.join(arguments)}: {detail}")
    return payload


def build_fleet(generated_at: str) -> dict[str, Any]:
    payload = json.loads(VENTURES_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"ventures source must be an array: {VENTURES_PATH}")
    domains: list[str] = []
    for entry in payload:
        if not isinstance(entry, dict) or not isinstance(entry.get("name"), str):
            raise ValueError("every venture must have a string name")
        domain = entry["name"].strip().casefold()
        if not DOMAIN_PATTERN.fullmatch(domain):
            raise ValueError(f"invalid venture domain: {domain}")
        if domain in FORBIDDEN_DOMAINS or "arwencorp" in domain:
            raise ValueError(f"retired or mistaken venture domain: {domain}")
        domains.append(domain)
    if len(domains) != len(set(domains)):
        raise ValueError("ventures source contains duplicate domains")
    ventures = [
        {
            "domain": domain,
            "url": f"https://{domain}/",
        }
        for domain in sorted(domains)
    ]
    result = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "source": "ventures.json",
        "source_sha256": sha256(VENTURES_PATH),
        "count": len(ventures),
        "ventures": ventures,
    }
    atomic_json(ROOT / "data" / "fleet.json", result)
    return result


def build_showbiz_pipeline(generated_at: str) -> dict[str, Any]:
    payload = json.loads(VENTURES_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"ventures source must be an array: {VENTURES_PATH}")
    ventures = {
        str(entry.get("name", "")).casefold(): entry
        for entry in payload
        if isinstance(entry, dict)
    }
    stages: list[dict[str, Any]] = []
    for position, contract in enumerate(SHOWBIZ_SEQUENCE, start=1):
        domain = contract["domain"]
        venture = ventures.get(domain)
        if not venture:
            raise ValueError(f"ShowBiz pipeline venture missing from canonical ledger: {domain}")
        stages.append(
            {
                **contract,
                "position": position,
                "division": venture.get("division"),
                "canonical_spec": venture.get("spec"),
                "role_status": "verified-in-canonical-ledger",
                "delivery_status": "proposed-integrated-handoff",
            }
        )
    result = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "event": "ShowBizCA: Small Business Connections",
        "event_date": "2026-08-13",
        "source": "ventures.json",
        "source_sha256": sha256(VENTURES_PATH),
        "status_boundary": (
            "Venture roles are verified in the canonical ledger. The integrated handoffs are "
            "the proposed operating model and are not represented as completed customer delivery."
        ),
        "count": len(stages),
        "stages": stages,
    }
    atomic_json(ROOT / "showbiz" / "pipeline.json", result)
    return result


def git_generations() -> dict[str, dict[str, str]]:
    output = subprocess.check_output(
        ["git", "log", "--reverse", "--format=%H%x09%ct%x09%s", "--", "genetic_timelapse"],
        cwd=ROOT,
        text=True,
    )
    generations: dict[str, dict[str, str]] = {}
    for line in output.splitlines():
        commit, timestamp, subject = line.split("\t", 2)
        match = re.search(r"generation (\d+)", subject, flags=re.IGNORECASE)
        if match:
            generations[match.group(1)] = {"commit": commit, "timestamp": timestamp, "subject": subject}
    return generations


def build_timeline(generated_at: str) -> dict[str, Any]:
    generations = git_generations()
    frames: list[dict[str, str]] = []
    for path in sorted((ROOT / "genetic_timelapse").glob("generation_*.png")):
        generation = path.stem.removeprefix("generation_")
        commit = generations.get(generation, {})
        timestamp = int(commit.get("timestamp", generation))
        observed = datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat(timespec="seconds")
        frames.append(
            {
                "id": f"mutation-{generation}",
                "label": f"Automated mutation {len(frames) + 1:02d}",
                "observed_at": observed,
                "commit": commit.get("commit", ""),
                "image": f"/genetic_timelapse/{path.name}",
                "tier": "mutation-archive",
            }
        )
    current = ROOT / "evolution" / "current.png"
    if current.is_file():
        source_digest = hashlib.sha256()
        for source in (ROOT / "index.html", ROOT / "styles.css", ROOT / "app.js", ROOT / "blackhole.js"):
            source_digest.update(source.read_bytes())
        observed = datetime.fromtimestamp(current.stat().st_mtime, tz=timezone.utc).isoformat(timespec="seconds")
        frames.append(
            {
                "id": "current",
                "label": "Unlost restoration working tree",
                "observed_at": observed,
                "commit": f"source-{source_digest.hexdigest()}",
                "image": "/evolution/current.png",
                "tier": "verified-release",
            }
        )
    result = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "site": "mobleysoft.com",
        "shortcut": "Control+Shift+~",
        "mobile_trigger": "pi",
        "movie": "/genetic_timelapse/evolution_timelapse.mp4",
        "count": len(frames),
        "frames": frames,
    }
    atomic_json(ROOT / "evolution" / "manifest.json", result)
    return result


def build_unlost_product(generated_at: str) -> dict[str, Any]:
    product_path = ROOT / "products" / "unlost" / "product.json"
    existing = read_json(product_path)
    index = unlost_json("index", "status")
    doctor = unlost_json("doctor")
    benchmark = read_json(UNLOST_BENCHMARK)
    release_verification = read_json(UNLOST_RELEASE_VERIFICATION)
    release_present = UNLOST_DIST.is_file()
    release_hash = sha256(UNLOST_DIST) if release_present else None
    release_ready = bool(
        release_present
        and release_verification.get("status") == "passed"
        and release_verification.get("version") == UNLOST_VERSION
        and release_verification.get("sha256") == release_hash
    )
    existing_release = existing.get("release", {}) if isinstance(existing.get("release"), dict) else {}
    existing_release_name = existing_release.get("artifact") or existing_release.get("filename")
    existing_release_ready = bool(
        release_present
        and existing.get("version") == UNLOST_VERSION
        and existing_release_name == UNLOST_DIST.name
        and existing_release.get("sha256") == release_hash
        and existing_release.get("clean_install_verified") is True
        and existing_release.get("first_search_verified") is True
        and existing_release.get("localhost_interface_verified") is True
        and existing.get("payment", {}).get("public_download") is False
    )
    if not release_ready and existing_release_ready:
        # Preserve newer, verified release evidence when the runtime has advanced
        # beyond the separately versioned benchmark and verification artifacts.
        return existing
    connector_statuses = {
        str(connector["id"]): str(connector["status"])
        for connector in doctor.get("connectors", [])
        if isinstance(connector, dict) and connector.get("id")
    }
    cross_device = next(
        (
            connector
            for connector in doctor.get("connectors", [])
            if isinstance(connector, dict) and connector.get("id") == "cross-device"
        ),
        {},
    )
    frontier = index.get("frontier", {}) if isinstance(index.get("frontier"), dict) else {}
    benchmark_summary = benchmark.get("summary", {}) if isinstance(benchmark.get("summary"), dict) else {}
    result = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "product": "Unlost",
        "version": UNLOST_VERSION,
        "status": "verified-local-alpha" if release_ready else "source-alpha",
        "price_usd": 1,
        "payment": {
            "status": "not-connected",
            "public_download": False,
            "reason": "Checkout and entitlement delivery require a verified payment route.",
        },
        "release": {
            "ready": release_ready,
            "platform": "macOS",
            "sha256": release_hash,
            "size": UNLOST_DIST.stat().st_size if release_present else None,
            "artifact": UNLOST_DIST.name if release_present else None,
            "clean_install_verified": bool(release_verification.get("clean_install")),
            "first_search_verified": bool(release_verification.get("first_search")),
            "localhost_interface_verified": bool(release_verification.get("localhost_interface")),
            "signed": False,
            "public_path": None,
        },
        "observed_baseline": {
            "local_artifacts_indexed": int(index.get("files_indexed") or 0),
            "frontier_queued": int(frontier.get("queued") or 0),
            "frontier_retryable_errors": int(frontier.get("error") or 0),
            "federated_shards": int(cross_device.get("shards") or 1),
            "search_median_seconds": benchmark_summary.get("search_median_seconds"),
            "search_p95_seconds": benchmark_summary.get("search_p95_seconds"),
            "find_median_seconds": benchmark_summary.get("find_median_seconds"),
            "find_p95_seconds": benchmark_summary.get("find_p95_seconds"),
            "benchmark_queries": benchmark.get("verification", {}).get("queries"),
        },
        "connectors": {
            "local_files": connector_statuses.get("local-files", "unverified"),
            "codex_jsonl": "available",
            "antigravity_jsonl": "available",
            "zip_tar": connector_statuses.get("zip-tar", "unverified"),
            "sqlite_read_only": connector_statuses.get("sqlite", "unverified"),
            "gmail_mbox": connector_statuses.get("gmail-mbox", "unverified"),
            "gmail_live": connector_statuses.get("gmail", "unverified"),
            "google_drive_folder": connector_statuses.get("google-drive-folder", "unverified"),
            "google_drive_live": connector_statuses.get("google-drive", "unverified"),
            "cross_device": connector_statuses.get("cross-device", "unverified"),
        },
    }
    atomic_json(product_path, result)
    return result


def main() -> int:
    generated_at = now_iso()
    fleet = build_fleet(generated_at)
    showbiz = build_showbiz_pipeline(generated_at)
    showbiz_canary = build_canary(generated_at, showbiz)
    timeline = build_timeline(generated_at)
    unlost = build_unlost_product(generated_at)
    manifest = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "site": "mobleysoft.com",
        "source_root": "mobleysoft",
        "fleet_count": fleet["count"],
        "showbiz_pipeline_stages": showbiz["count"],
        "showbiz_canary_stages": showbiz_canary["stage_count"],
        "showbiz_canary_final_sha256": showbiz_canary["final_output_sha256"],
        "timeline_frames": timeline["count"],
        "unlost_status": unlost["status"],
        "payment_status": unlost["payment"]["status"],
    }
    atomic_json(ROOT / "build.json", manifest)
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
