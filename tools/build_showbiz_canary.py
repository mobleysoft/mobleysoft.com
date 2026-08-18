#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime
import hashlib
import html
import io
import json
import math
import os
from pathlib import Path
import struct
import tempfile
from typing import Any
import wave


ROOT = Path(__file__).resolve().parents[1]
SOURCE_IMAGE = Path(
    os.environ.get(
        "SHOWBIZ_SOURCE_IMAGE",
        str(Path.home() / ".local/state/mobley/txtive-media/mhs-marketing-34723.png"),
    )
).resolve()
CANARY_ROOT = ROOT / "showbiz" / "canary"
PROJECT_ID = "showbizca-the-handoff-2026"
CLAIM_BOUNDARY = (
    "This is a Mobleysoft integration canary exercising nine venture handoff contracts. "
    "It is not represented as an NBCUniversal commission, customer delivery, or proof that "
    "each venture's independent production runtime generated its assigned artifact."
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def atomic_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def atomic_text(path: Path, payload: str) -> None:
    atomic_bytes(path, payload.encode("utf-8"))


def atomic_json(path: Path, payload: Any) -> None:
    atomic_text(path, json.dumps(payload, indent=2, sort_keys=True) + "\n")


def relative(path: Path) -> str:
    return "/" + str(path.relative_to(ROOT))


def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"ShowBiz source evidence is not a PNG: {path}")
    return struct.unpack(">II", header[16:24])


def contract(pipeline: dict[str, Any], domain: str) -> dict[str, Any]:
    return next(stage for stage in pipeline["stages"] if stage["domain"] == domain)


def envelope(
    generated_at: str,
    stage: dict[str, Any],
    artifact_kind: str,
    input_path: str,
    input_hash: str,
) -> dict[str, Any]:
    return {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "project_id": PROJECT_ID,
        "status": "generated-integration-canary",
        "venture_contract": stage["domain"],
        "position": stage["position"],
        "stage": stage["stage"],
        "product": stage["product"],
        "artifact_kind": artifact_kind,
        "input": {"path": input_path, "sha256": input_hash},
        "claim_boundary": CLAIM_BOUNDARY,
    }


def write_sting(path: Path) -> None:
    sample_rate = 22050
    duration = 12.0
    stage_times = [0.35 + index * 1.25 for index in range(9)]
    frames = bytearray()
    for sample in range(int(sample_rate * duration)):
        time = sample / sample_rate
        fade_in = min(1.0, time / 0.7)
        fade_out = min(1.0, (duration - time) / 1.0)
        pad = (
            math.sin(2 * math.pi * 55 * time)
            + 0.45 * math.sin(2 * math.pi * 82.5 * time)
            + 0.22 * math.sin(2 * math.pi * 110 * time)
        ) * 0.09 * fade_in * fade_out
        pulse = 0.0
        for index, onset in enumerate(stage_times):
            elapsed = time - onset
            if 0 <= elapsed < 0.34:
                frequency = 220 * (2 ** ((index % 5) / 12))
                pulse += math.sin(2 * math.pi * frequency * elapsed) * math.exp(-elapsed * 11) * 0.23
        value = max(-1.0, min(1.0, pad + pulse))
        frames.extend(struct.pack("<h", int(value * 32767)))
    output = io.BytesIO()
    with wave.open(output, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(bytes(frames))
    atomic_bytes(path, output.getvalue())


def design_svg(metadata: dict[str, Any], stages: list[dict[str, Any]]) -> str:
    stations = []
    for index, stage in enumerate(stages):
        x = 70 + index * 122
        accent = "#e6b44d" if index % 3 == 0 else "#89d4be" if index % 3 == 1 else "#ec6f36"
        stations.append(
            f'<g transform="translate({x} 250)"><rect width="96" height="150" rx="4" fill="#0a1816" '
            f'stroke="{accent}"/><text x="12" y="26" fill="{accent}" class="mono">{index + 1:02d}</text>'
            f'<circle cx="48" cy="70" r="22" fill="none" stroke="{accent}"/>'
            f'<text x="48" y="118" text-anchor="middle" fill="#f0eadc" class="label">{html.escape(stage["stage"])}</text>'
            f'<text x="48" y="136" text-anchor="middle" fill="#73817c" class="domain">{html.escape(stage["domain"])}</text></g>'
        )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">The Handoff spatial production plan</title>
<desc id="desc">Nine production stations arranged along one continuous context corridor.</desc>
<metadata>{html.escape(json.dumps(metadata, sort_keys=True))}</metadata>
<style>.mono{{font:12px ui-monospace,monospace;letter-spacing:2px}}.label{{font:17px Georgia,serif}}.domain{{font:8px ui-monospace,monospace}}</style>
<rect width="1200" height="675" fill="#07100f"/><path d="M70 218H1138M70 430H1138" stroke="#263d37"/>
<path d="M118 325H1088" stroke="#e6b44d" stroke-width="2" stroke-dasharray="8 10"/>
<text x="70" y="82" fill="#e6b44d" class="mono">CONSEIV / CONTEXT CORRIDOR C-01</text>
<text x="70" y="128" fill="#f0eadc" font-family="Georgia,serif" font-size="44">One brief. Nine accountable stations.</text>
<text x="70" y="165" fill="#73817c" class="mono">Every threshold transfers an artifact, its hash, and its governing decision record.</text>
{''.join(stations)}
<text x="70" y="548" fill="#73817c" class="mono">INPUT / VERIFIED EVENT BRIEF</text>
<text x="1138" y="548" text-anchor="end" fill="#73817c" class="mono">OUTPUT / MEASURABLE CAMPAIGN</text>
<path d="M70 570H1138" stroke="#263d37"/><text x="70" y="608" fill="#ec6f36" class="mono">INTEGRATION CANARY - NOT A CUSTOMER FACILITY PLAN</text>
</svg>'''


def storyboard_svg(metadata: dict[str, Any], stages: list[dict[str, Any]]) -> str:
    panels = []
    for index, stage in enumerate(stages):
        column = index % 3
        row = index // 3
        x = 44 + column * 375
        y = 132 + row * 164
        motif = (
            f'<circle cx="{x + 176}" cy="{y + 69}" r="{18 + index * 3}" fill="none" stroke="#e6b44d"/>'
            if index % 3 == 0
            else f'<path d="M{x + 84} {y + 92}L{x + 176} {y + 34}L{x + 268} {y + 92}" fill="none" stroke="#89d4be"/>'
            if index % 3 == 1
            else f'<rect x="{x + 116}" y="{y + 27}" width="120" height="78" fill="none" stroke="#ec6f36" transform="rotate({index * 2} {x + 176} {y + 66})"/>'
        )
        panels.append(
            f'<g><rect x="{x}" y="{y}" width="350" height="138" rx="3" fill="#0a1816" stroke="#263d37"/>{motif}'
            f'<text x="{x + 16}" y="{y + 23}" fill="#e6b44d" class="mono">{index + 1:02d} / {html.escape(stage["stage"])}</text>'
            f'<text x="{x + 16}" y="{y + 120}" fill="#73817c" class="domain">{html.escape(stage["product"])}</text></g>'
        )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
<title id="title">The Handoff nine-frame storyboard</title>
<desc id="desc">A production brief transforms through nine specialist stages.</desc>
<metadata>{html.escape(json.dumps(metadata, sort_keys=True))}</metadata>
<style>.mono{{font:10px ui-monospace,monospace;letter-spacing:1.6px}}.domain{{font:10px ui-monospace,monospace;letter-spacing:1px}}</style>
<rect width="1200" height="675" fill="#07100f"/>
<text x="44" y="55" fill="#e6b44d" class="mono">ANIMETROPE / BOARD A</text>
<text x="44" y="96" fill="#f0eadc" font-family="Georgia,serif" font-size="38">THE HANDOFF / 00:12</text>
{''.join(panels)}
<text x="1156" y="642" text-anchor="end" fill="#73817c" class="mono">HASH-LINKED PREVIS CANARY</text>
</svg>'''


def build_canary(generated_at: str, pipeline: dict[str, Any]) -> dict[str, Any]:
    if not SOURCE_IMAGE.is_file():
        raise FileNotFoundError(f"ShowBiz source evidence is missing: {SOURCE_IMAGE}")
    if pipeline.get("count") != 9 or len(pipeline.get("stages", [])) != 9:
        raise ValueError("ShowBiz canary requires exactly nine pipeline contracts")

    width, height = png_dimensions(SOURCE_IMAGE)
    source_path = CANARY_ROOT / "artifacts" / "00-brief" / "event-brief.json"
    source = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "project_id": PROJECT_ID,
        "status": "observed-source-brief",
        "event": "ShowBizCA: Small Business Connections",
        "organizer": "NBCUniversal",
        "purpose": "Connect California small businesses and suppliers with television and film production professionals.",
        "date": "2026-08-13",
        "venue": "The Commons Event Center, Universal City, CA 91604",
        "entry_point": "3900 Lankershim Blvd., Universal City, CA 91608",
        "schedule": [
            {"start": "10:00", "end": "11:00", "activity": "Arrival / Check-In"},
            {"start": "11:00", "end": "12:00", "activity": "NBCU Presentation"},
            {"start": "12:00", "end": "13:00", "activity": "Lunch Buffet"},
            {"start": "13:00", "end": "14:00", "activity": "Interactive networking expo for direct vendor engagement"},
        ],
        "creative_objective": "Create a concise supplier proof showing one brief passing through nine explicit production contracts.",
        "evidence": {
            "kind": "private-invitation-screenshot",
            "sha256": sha256(SOURCE_IMAGE),
            "pixel_width": width,
            "pixel_height": height,
            "published": False,
            "verification": "visually-inspected-on-source-machine",
        },
        "rights_boundary": "Original Mobleysoft canary; event facts only. No NBCUniversal mark, footage, endorsement, or commission is claimed.",
    }
    atomic_json(source_path, source)
    previous_path = relative(source_path)
    previous_hash = sha256(source_path)
    records: list[dict[str, Any]] = []

    def register(stage: dict[str, Any], path: Path, supplemental: list[Path] | None = None) -> None:
        nonlocal previous_path, previous_hash
        extras = supplemental or []
        record = {
            "position": stage["position"],
            "stage": stage["stage"],
            "product": stage["product"],
            "domain": stage["domain"],
            "status": "generated-integration-canary",
            "input": {"path": previous_path, "sha256": previous_hash},
            "output": {"path": relative(path), "sha256": sha256(path), "bytes": path.stat().st_size},
            "supplemental_outputs": [
                {"path": relative(item), "sha256": sha256(item), "bytes": item.stat().st_size}
                for item in extras
            ],
        }
        records.append(record)
        previous_path = record["output"]["path"]
        previous_hash = record["output"]["sha256"]

    stage = contract(pipeline, "literacraft.com")
    path = CANARY_ROOT / "artifacts" / "01-source" / "story-bible.json"
    payload = {
        **envelope(generated_at, stage, "story-bible", previous_path, previous_hash),
        "title": "THE HANDOFF",
        "format": "12-second interactive proof; expandable to a 60-second supplier film",
        "logline": "A single production brief crosses nine accountable thresholds and arrives as a world that remembers how it was made.",
        "theme": "Context should compound across production boundaries instead of being discarded.",
        "visual_grammar": ["one object transforming", "visible thresholds", "persistent gold lineage line"],
        "beats": [f'{item["stage"]}: {item["handoff"]}' for item in pipeline["stages"]],
        "rights": "Original Mobleysoft promotional concept derived from public-facing event logistics.",
    }
    atomic_json(path, payload)
    register(stage, path)

    stage = contract(pipeline, "mobleybooks.com")
    path = CANARY_ROOT / "artifacts" / "02-catalog" / "title-record.json"
    payload = {
        **envelope(generated_at, stage, "rights-aware-title-record", previous_path, previous_hash),
        "identifier": "mobleysoft:showbizca:the-handoff:2026",
        "title": "The Handoff",
        "creator": "Mobleysoft",
        "language": "en",
        "genres": ["brand film", "production technology", "interactive proof"],
        "rights_holder": "Mobleysoft",
        "third_party_assets": [],
        "adaptation_status": "cleared-for-canary",
        "source_record": previous_path,
    }
    atomic_json(path, payload)
    register(stage, path)

    stage = contract(pipeline, "book2film.cc")
    path = CANARY_ROOT / "artifacts" / "03-adapt" / "screenplay.fountain"
    metadata = envelope(generated_at, stage, "timed-screenplay", previous_path, previous_hash)
    screenplay = f'''/* {json.dumps(metadata, sort_keys=True)} */
Title: THE HANDOFF
Credit: Integration canary
Author: Mobleysoft
Draft date: {datetime.fromisoformat(generated_at).date().isoformat()}

INT. ABSTRACT PRODUCTION FLOOR - TIMELESS

BLACK. A single production BRIEF strikes a table. A gold line wakes beneath it.

NARRATOR (V.O.)
One brief.

The brief crosses nine illuminated thresholds. At each threshold it changes form: STORY. CATALOG. SCRIPT. SPACE. IMAGE. SOUND. MASTER. WORLD. AUDIENCE.

NARRATOR (V.O.) (CONT'D)
Nine specialists. One world that remembers how it was made.

The nine forms lock into one living production graph.

SUPER: BRING US A TITLE. LEAVE WITH A WORLD.

SUPER: MOBLEYSOFT.COM/SHOWBIZ
'''
    atomic_text(path, screenplay)
    register(stage, path)

    stage = contract(pipeline, "conseiv.com")
    path = CANARY_ROOT / "artifacts" / "04-design" / "production-layout.svg"
    metadata = envelope(generated_at, stage, "spatial-production-plan", previous_path, previous_hash)
    atomic_text(path, design_svg(metadata, pipeline["stages"]))
    register(stage, path)

    stage = contract(pipeline, "animetrope.com")
    path = CANARY_ROOT / "artifacts" / "05-visualize" / "storyboard.svg"
    metadata = envelope(generated_at, stage, "nine-frame-storyboard", previous_path, previous_hash)
    atomic_text(path, storyboard_svg(metadata, pipeline["stages"]))
    register(stage, path)

    stage = contract(pipeline, "audiovizai.com")
    audio_path = CANARY_ROOT / "artifacts" / "06-score" / "handoff-sting.wav"
    write_sting(audio_path)
    path = CANARY_ROOT / "artifacts" / "06-score" / "cue-sheet.json"
    payload = {
        **envelope(generated_at, stage, "synchronized-cue-sheet", previous_path, previous_hash),
        "duration_seconds": 12,
        "sample_rate_hz": 22050,
        "soundtrack": {"path": relative(audio_path), "sha256": sha256(audio_path), "kind": "original-procedural-instrumental"},
        "voiceover": [
            {"at": 0.2, "text": "One brief."},
            {"at": 3.8, "text": "Nine specialists."},
            {"at": 7.2, "text": "One world that remembers how it was made."},
        ],
        "stage_pulses": [{"at": round(0.35 + index * 1.25, 2), "stage": item["stage"]} for index, item in enumerate(pipeline["stages"])],
        "voice_render_status": "scripted-not-synthesized",
    }
    atomic_json(path, payload)
    register(stage, path, [audio_path])

    stage = contract(pipeline, "filmline.cc")
    path = CANARY_ROOT / "artifacts" / "07-finish" / "master.json"
    payload = {
        **envelope(generated_at, stage, "interactive-master-manifest", previous_path, previous_hash),
        "master": {"duration_seconds": 12, "format": "browser-native-interactive-master", "aspect_ratios": ["16:9", "9:16"]},
        "edit_decisions": [
            {"in": 0.0, "out": 1.25, "picture": "verified brief", "audio": "low pulse"},
            {"in": 1.25, "out": 5.0, "picture": "source through design", "audio": "stage pulses 1-4"},
            {"in": 5.0, "out": 9.75, "picture": "visual through interactive", "audio": "stage pulses 5-8"},
            {"in": 9.75, "out": 12.0, "picture": "campaign lockup and call to action", "audio": "stage pulse 9 and resolve"},
        ],
        "delivery": {"url": "/showbiz/canary/#master", "captions": True, "autoplay": False},
    }
    atomic_json(path, payload)
    register(stage, path)

    stage = contract(pipeline, "gamegob.com")
    path = CANARY_ROOT / "artifacts" / "08-extend" / "playable-prototype.json"
    payload = {
        **envelope(generated_at, stage, "playable-handoff-prototype", previous_path, previous_hash),
        "objective": "Activate all nine production contracts in order without losing lineage.",
        "rules": ["Only the next unlocked stage accepts input.", "Every activation exposes the input and output hashes.", "Completion unlocks the final campaign artifact."],
        "controls": {"pointer": "select the next stage", "keyboard": "ArrowRight or Space advances; ArrowLeft reviews"},
        "implementation": "/showbiz/canary/canary.js",
        "play_url": "/showbiz/canary/#play",
    }
    atomic_json(path, payload)
    register(stage, path)

    stage = contract(pipeline, "marketingium.com")
    path = CANARY_ROOT / "artifacts" / "09-reach" / "campaign.json"
    payload = {
        **envelope(generated_at, stage, "measurable-campaign-package", previous_path, previous_hash),
        "campaign": "One Brief / Nine Handoffs",
        "audiences": ["production sourcing professionals", "independent producers", "California small-business suppliers"],
        "message": "Bring us a title. Leave with a world whose source and decisions remain traceable.",
        "call_to_action": "Scope one production-supplier pilot with explicit acceptance criteria.",
        "landing_page": "https://mobleysoft.com/showbiz/canary/",
        "channels": ["live event demo", "direct follow-up", "mobile landing page"],
        "measurement_plan": ["qualified conversations", "pilot briefs received", "artifact-chain reviews completed"],
        "restricted_claims": ["No NBCUniversal endorsement", "No completed customer deployment claim", "No fabricated performance metrics"],
    }
    atomic_json(path, payload)
    register(stage, path)

    manifest = {
        "schema_version": "1.0",
        "generated_at": generated_at,
        "project_id": PROJECT_ID,
        "title": "THE HANDOFF",
        "status": "generated-integration-canary",
        "source": {"path": relative(source_path), "sha256": sha256(source_path), "private_evidence_sha256": source["evidence"]["sha256"]},
        "pipeline_source_sha256": pipeline["source_sha256"],
        "stage_count": len(records),
        "stages": records,
        "final_output_sha256": records[-1]["output"]["sha256"],
        "claim_boundary": CLAIM_BOUNDARY,
    }
    atomic_json(CANARY_ROOT / "manifest.json", manifest)
    return manifest


if __name__ == "__main__":
    pipeline = json.loads((ROOT / "showbiz" / "pipeline.json").read_text(encoding="utf-8"))
    result = build_canary(datetime.now().astimezone().isoformat(timespec="seconds"), pipeline)
    print(json.dumps(result, indent=2, sort_keys=True))
