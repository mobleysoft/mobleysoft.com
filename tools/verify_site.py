#!/usr/bin/env python3
from __future__ import annotations

from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
from urllib.parse import urlparse
import wave


ROOT = Path(__file__).resolve().parents[1]
VENTURES = Path.home() / "ventures.json"
UNLOST_DIST = Path.home() / "mobley-kernel" / "dist"
SHOWBIZ_SOURCE_IMAGE = Path.home() / ".local/state/mobley/txtive-media/mhs-marketing-34723.png"
FORBIDDEN = ("arwencorp", "mailguy-ai.com", "mobeysoft.com", "mobley-helms.com", "mobleyhems.com")


class References(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.values: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"src", "href"} and value:
                self.values.append(value)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_local_references(index: Path) -> list[str]:
    parser = References()
    parser.feed(index.read_text(encoding="utf-8"))
    missing: list[str] = []
    for value in parser.values:
        parsed = urlparse(value)
        if parsed.scheme or value.startswith(("#", "data:", "mailto:")):
            continue
        if parsed.path.startswith("/"):
            candidate = ROOT / parsed.path.lstrip("/")
        else:
            candidate = index.parent / parsed.path
        if value.endswith("/"):
            candidate = candidate / "index.html"
        if not candidate.exists():
            missing.append(value)
    return missing


def png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        signature = handle.read(24)
    if signature[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    return struct.unpack(">II", signature[16:24])


def main() -> int:
    errors: list[str] = []
    index = ROOT / "index.html"
    source_text = "\n".join(
        path.read_text(encoding="utf-8", errors="replace")
        for path in (index, ROOT / "app.js", ROOT / "styles.css", ROOT / "blackhole.js")
    ).casefold()
    errors.extend(f"forbidden estate name present: {value}" for value in FORBIDDEN if value in source_text)

    pages = [
        index,
        ROOT / "showbiz" / "index.html",
        ROOT / "showbiz" / "canary" / "index.html",
        *sorted((ROOT / "backgrounds").glob("*.html")),
    ]
    for page in pages:
        missing = verify_local_references(page)
        errors.extend(f"{page.relative_to(ROOT)}: missing local reference: {value}" for value in missing)

    background_manifest_path = ROOT / "backgrounds" / "manifest.json"
    background_manifest = json.loads(background_manifest_path.read_text(encoding="utf-8"))
    background_candidates = background_manifest.get("candidates", [])
    if len(background_candidates) != 4:
        errors.append("background archive must enumerate four recovered candidates")
    for candidate in background_candidates:
        for field in ("script", "preview"):
            artifact = ROOT / str(candidate.get(field, "")).lstrip("/")
            if not artifact.is_file():
                errors.append(f"background candidate {candidate.get('id')} missing {field}")
        expected_hash = candidate.get("sha256")
        if expected_hash:
            script = ROOT / str(candidate["script"]).lstrip("/")
            if script.is_file() and sha256(script) != expected_hash:
                errors.append(f"background candidate {candidate.get('id')} hash differs from provenance manifest")

    if background_manifest.get("selected_candidate") != "A":
        errors.append("background archive does not identify candidate A as selected")
    canonical_path = ROOT / str(background_manifest.get("canonical_release", "")).lstrip("/") / "manifest.json"
    if not canonical_path.is_file():
        errors.append("canonical background release manifest is missing")
    else:
        canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
        canonical_artifacts = (
            (canonical.get("source", {}), canonical_path.parent / "blackhole.source.js"),
            (canonical.get("runtime", {}), ROOT / "blackhole.js"),
            (canonical.get("dependency", {}), ROOT / "assets" / "vendor" / "three-r128.min.js"),
        )
        for metadata, artifact in canonical_artifacts:
            if not artifact.is_file():
                errors.append(f"canonical background artifact is missing: {artifact.name}")
            elif metadata.get("sha256") != sha256(artifact):
                errors.append(f"canonical background hash differs: {artifact.name}")

    fleet = json.loads((ROOT / "data" / "fleet.json").read_text(encoding="utf-8"))
    ventures = json.loads(VENTURES.read_text(encoding="utf-8"))
    source_domains = sorted(str(entry["name"]).casefold() for entry in ventures)
    built_domains = sorted(str(entry["domain"]).casefold() for entry in fleet["ventures"])
    if fleet.get("count") != len(built_domains):
        errors.append("fleet count does not match fleet entries")
    if built_domains != source_domains:
        errors.append("generated fleet differs from ventures.json")
    if fleet.get("source_sha256") != sha256(VENTURES):
        errors.append("fleet provenance hash does not match ventures.json")

    timeline = json.loads((ROOT / "evolution" / "manifest.json").read_text(encoding="utf-8"))
    if timeline.get("count") != len(timeline.get("frames", [])) or not timeline.get("frames"):
        errors.append("timeline manifest is empty or inconsistent")
    for frame in timeline.get("frames", []):
        if not (ROOT / str(frame["image"]).lstrip("/")).is_file():
            errors.append(f"missing timeline frame: {frame['image']}")

    product = json.loads((ROOT / "products" / "unlost" / "product.json").read_text(encoding="utf-8"))
    verified_product_statuses = {"verified-local-alpha", "usable-private-release-payment-gated"}
    allowed_product_statuses = {*verified_product_statuses, "source-alpha"}
    if product.get("status") not in allowed_product_statuses:
        errors.append("Unlost product status is not recognized")
    if product.get("payment", {}).get("status") not in {"not-connected", "gated"}:
        errors.append("payment status is neither disconnected nor gated")
    if product.get("payment", {}).get("public_download") is not False:
        errors.append("release must not be public before entitlement delivery exists")
    if product.get("status") in verified_product_statuses:
        release_name = str(
            product.get("release", {}).get("artifact")
            or product.get("release", {}).get("filename")
            or ""
        )
        release_path = UNLOST_DIST / release_name
        if not release_name or Path(release_name).name != release_name:
            errors.append("Unlost release artifact name is absent or unsafe")
        elif not release_path.is_file() or product.get("release", {}).get("sha256") != sha256(release_path):
            errors.append("private Unlost release is missing or its hash differs")
        for field in ("clean_install_verified", "first_search_verified", "localhost_interface_verified"):
            if product.get("release", {}).get(field) is not True:
                errors.append(f"Unlost release evidence missing: {field}")
    baseline = product.get("observed_baseline", {})
    artifact_count = baseline.get("local_artifacts_indexed") or baseline.get("artifacts_indexed")
    if int(artifact_count or 0) <= 0:
        errors.append("Unlost artifact baseline is absent")
    if int(baseline.get("federated_shards") or 0) < 1:
        errors.append("Unlost federated shard count is invalid")
    if product.get("status") in verified_product_statuses and (
        baseline.get("search_median_seconds") is None or baseline.get("find_median_seconds") is None
    ):
        errors.append("Unlost benchmark evidence is absent")

    if 'class="brand-wordmark"' not in index.read_text(encoding="utf-8"):
        errors.append("typographic Mobleysoft fallback mark is missing")

    showbiz = json.loads((ROOT / "showbiz" / "pipeline.json").read_text(encoding="utf-8"))
    if showbiz.get("count") != 9 or len(showbiz.get("stages", [])) != 9:
        errors.append("ShowBiz pipeline must contain nine ordered stages")
    if showbiz.get("source_sha256") != sha256(VENTURES):
        errors.append("ShowBiz pipeline provenance hash does not match ventures.json")
    for stage in showbiz.get("stages", []):
        if stage.get("role_status") != "verified-in-canonical-ledger":
            errors.append(f"ShowBiz stage lacks ledger verification: {stage.get('domain')}")

    canary_root = ROOT / "showbiz" / "canary"
    canary = json.loads((canary_root / "manifest.json").read_text(encoding="utf-8"))
    canary_stages = canary.get("stages", [])
    if canary.get("stage_count") != 9 or len(canary_stages) != 9:
        errors.append("ShowBiz canary must contain nine generated stages")
    if canary.get("pipeline_source_sha256") != showbiz.get("source_sha256"):
        errors.append("ShowBiz canary is not tied to the current canonical venture pipeline")
    if "NBCUniversal commission" not in str(canary.get("claim_boundary")):
        errors.append("ShowBiz canary claim boundary is absent")

    source_record = canary.get("source", {})
    source_artifact = ROOT / str(source_record.get("path", "")).lstrip("/")
    if not source_artifact.is_file() or source_record.get("sha256") != sha256(source_artifact):
        errors.append("ShowBiz canary source record is missing or its hash differs")
    else:
        normalized_source = json.loads(source_artifact.read_text(encoding="utf-8"))
        if normalized_source.get("evidence", {}).get("published") is not False:
            errors.append("ShowBiz private invitation must not be marked public")
        if SHOWBIZ_SOURCE_IMAGE.is_file() and (
            normalized_source.get("evidence", {}).get("sha256") != sha256(SHOWBIZ_SOURCE_IMAGE)
        ):
            errors.append("ShowBiz source evidence hash differs from the inspected invitation")

    previous_path = source_record.get("path")
    previous_hash = source_record.get("sha256")
    for position, stage in enumerate(canary_stages, start=1):
        expected_stages = showbiz.get("stages", [])
        expected_contract = expected_stages[position - 1] if len(expected_stages) >= position else {}
        if stage.get("position") != position or stage.get("domain") != expected_contract.get("domain"):
            errors.append(f"ShowBiz canary contract order differs at stage {position}")
        if stage.get("status") != "generated-integration-canary":
            errors.append(f"ShowBiz canary status differs at stage {position}")
        if stage.get("input", {}).get("path") != previous_path or stage.get("input", {}).get("sha256") != previous_hash:
            errors.append(f"ShowBiz canary lineage breaks at stage {position}")
        output = stage.get("output", {})
        output_path = ROOT / str(output.get("path", "")).lstrip("/")
        if not output_path.is_file() or output.get("sha256") != sha256(output_path):
            errors.append(f"ShowBiz canary output is missing or differs at stage {position}")
        for supplemental in stage.get("supplemental_outputs", []):
            supplemental_path = ROOT / str(supplemental.get("path", "")).lstrip("/")
            if not supplemental_path.is_file() or supplemental.get("sha256") != sha256(supplemental_path):
                errors.append(f"ShowBiz supplemental output is missing or differs at stage {position}")
        previous_path = output.get("path")
        previous_hash = output.get("sha256")
    if canary_stages and canary.get("final_output_sha256") != canary_stages[-1].get("output", {}).get("sha256"):
        errors.append("ShowBiz canary final output hash is inconsistent")

    audio_path = canary_root / "artifacts" / "06-score" / "handoff-sting.wav"
    try:
        with wave.open(str(audio_path), "rb") as audio:
            if audio.getnchannels() != 1 or audio.getframerate() != 22050 or audio.getnframes() != 264600:
                errors.append("ShowBiz canary audio contract differs")
    except (FileNotFoundError, wave.Error):
        errors.append("ShowBiz canary audio is missing or malformed")
    if any(path.suffix.casefold() in {".png", ".jpg", ".jpeg"} for path in canary_root.rglob("*")):
        errors.append("ShowBiz private invitation or another unmanifested raster entered the public canary")

    if re.search(r"\b(?:app|cloud|data|platform|startup|tool|web)\d{2,3}\.(?:co|io|ai)\b", source_text):
        errors.append("synthetic MobleyWeb domain leaked into public source")

    result = {
        "status": "passed" if not errors else "failed",
        "fleet_count": fleet.get("count"),
        "timeline_frames": timeline.get("count"),
        "background_candidates": len(background_candidates),
        "brand_mode": "typographic-fallback",
        "showbiz_pipeline_stages": showbiz.get("count"),
        "showbiz_canary_stages": canary.get("stage_count"),
        "showbiz_canary_final_sha256": canary.get("final_output_sha256"),
        "unlost_release_sha256": product.get("release", {}).get("sha256"),
        "errors": errors,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
