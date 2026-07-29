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


ROOT = Path(__file__).resolve().parents[1]
KERNEL = Path(os.environ.get("MOBLEY_KERNEL", str(Path.home() / "mobley-kernel"))).resolve()
VALUATION = ROOT / "valuation"
SUMMARY = KERNEL / "dist/capability-evidence/de539b416556b2c79c5bcfa54d74252cd477d266a9d52c2a4d9f390581ecd022/summary.json"
VERIFICATION = KERNEL / "dist/diligence/latest-verification.json"
RELEASE = KERNEL / "dist/mobley-0.5.0-release-verification.json"
CAPABILITIES = KERNEL / "etc/morphogenesis-capabilities.json"

DEPENDENCIES = {
    "memory.ingest": ["memory.discovery"],
    "memory.normalize": ["memory.ingest"],
    "memory.exact-search": ["memory.normalize"],
    "memory.federation": ["memory.discovery", "memory.exact-search"],
    "memory.hydration": ["memory.provenance"],
    "memory.provenance": ["memory.exact-search"],
    "memory.privacy": ["memory.ingest"],
    "memory.freshness": ["memory.ingest"],
    "evolution.self-replacement": ["evolution.self-inspection"],
    "evolution.bounded-mutation": ["evolution.self-inspection", "evolution.self-replacement"],
    "evolution.crossover": ["evolution.bounded-mutation"],
    "evolution.judge-isolation": ["evolution.self-inspection"],
    "evolution.lineage": ["evolution.self-replacement", "evolution.crossover"],
    "evolution.retention": ["evolution.self-inspection", "evolution.self-replacement"],
    "evolution.rollback": ["evolution.self-inspection", "evolution.self-replacement"],
}


def read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return payload


def atomic_bytes(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def git_head() -> str:
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=KERNEL, text=True).strip()


def test_count(verification: dict[str, Any]) -> int:
    check = next((item for item in verification.get("checks", []) if item.get("name") == "python-tests"), {})
    match = re.search(r"Ran (\d+) tests", str(check.get("stderr_tail", "")))
    return int(match.group(1)) if match else 0


def sanitized_observations(capability_id: str) -> list[dict[str, Any]]:
    directory = SUMMARY.parent
    files = sorted(directory.glob(f"{capability_id}.*.json"))[-2:]
    observations: list[dict[str, Any]] = []
    for path in files:
        record = read_json(path)
        evidence = record.get("evidence", {})
        observations.append(
            {
                "evaluation_id": record.get("evaluation_id"),
                "split": record.get("split"),
                "normalized_score": record.get("normalized_score"),
                "hard_constraints_passed": record.get("hard_constraints_passed"),
                "evidence_class": evidence.get("evidence_class"),
                "assertions": evidence.get("assertions", {}),
                "evaluator_sha256": evidence.get("evaluator_sha256"),
                "test_id": evidence.get("test_id"),
                "test_source_sha256": evidence.get("test_source_sha256"),
                "module_source_sha256": evidence.get("module_source_sha256"),
                "stdout_sha256": evidence.get("stdout_sha256"),
            }
        )
    return observations


def build_payload() -> dict[str, Any]:
    summary = read_json(SUMMARY)
    verification = read_json(VERIFICATION)
    release = read_json(RELEASE)
    matrix = read_json(CAPABILITIES)
    definitions = {item["id"]: item for item in matrix.get("capabilities", [])}
    passing = int(summary.get("core_coverage", {}).get("passing", 0))
    required = int(summary.get("core_coverage", {}).get("required", 51))

    base_midpoint = 1_750_000
    evidence_premium = passing * 50_000
    midpoint = base_midpoint + evidence_premium
    low = midpoint - 400_000
    high = midpoint + 600_000
    ask = midpoint + 1_100_000

    capability_rows = []
    for item in summary.get("capabilities", []):
        capability_id = str(item.get("capability_id"))
        definition = definitions.get(capability_id, {})
        capability_rows.append(
            {
                "id": capability_id,
                "name": item.get("name") or definition.get("name"),
                "domain": definition.get("domain"),
                "target_score": item.get("target_score"),
                "latest_score": item.get("latest_score"),
                "minimum_recent_score": item.get("minimum_recent_score"),
                "observations": item.get("observations"),
                "minimum_required_observations": item.get("minimum_required_observations"),
                "passed": bool(item.get("passed")),
                "depends_on": DEPENDENCIES.get(capability_id, []),
                "evidence": sanitized_observations(capability_id),
            }
        )

    payload = {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "product": "Mobley",
        "version": release.get("version", "0.5.0"),
        "valuation": {
            "currency": "USD",
            "low": low,
            "midpoint": midpoint,
            "high": high,
            "strategic_ask": ask,
            "classification": "internal evidence-weighted acquisition estimate",
            "base_midpoint": base_midpoint,
            "first_party_capability_premium_each": 50_000,
            "disclaimer": "Not a certified appraisal. Revenue, external benchmarks, and independent security review remain unpriced.",
        },
        "coverage": {
            "passing": passing,
            "measured": int(summary.get("core_coverage", {}).get("measured", 0)),
            "required": required,
            "ratio": round(passing / required, 8) if required else 0,
            "observations_per_capability": int(summary.get("evaluations_per_capability", 0)),
            "evidence_class": summary.get("evidence_class"),
        },
        "verification": {
            "status": verification.get("status"),
            "tests_passed": test_count(verification),
            "source_commit": verification.get("source_commit"),
            "source_tree_sha256": verification.get("source_tree_sha256"),
            "source_working_tree_clean": verification.get("source_working_tree_clean"),
            "record_sha256": verification.get("record_sha256"),
            "evidence_commit": git_head(),
            "release_sha256": release.get("sha256"),
            "clean_home_install": release.get("clean_home_install"),
            "public_scrub": release.get("public_scrub"),
        },
        "capabilities": capability_rows,
        "remaining": {
            "next": [
                "evolution.bounded-mutation",
                "evolution.crossover",
                "evolution.judge-isolation",
                "evolution.lineage",
            ],
            "external_gaps": [
                "independent benchmark evidence",
                "independent security review",
                "paid customer validation",
            ],
        },
    }
    return payload


def serialize_payload(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")


def main() -> int:
    payload = build_payload()
    content = serialize_payload(payload)
    atomic_bytes(VALUATION / "data.json", content)
    digest = hashlib.sha256(content).hexdigest()
    atomic_bytes(VALUATION / "data.sha256", f"{digest}  data.json\n".encode("ascii"))
    coverage = payload["coverage"]
    print(
        json.dumps(
            {
                "status": "passed",
                "passing": coverage["passing"],
                "required": coverage["required"],
                "sha256": digest,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
