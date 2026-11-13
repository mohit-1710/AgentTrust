#!/usr/bin/env python3
"""Generate the locally licensed, scene-aligned demo narration.

Install the ignored local environment per video/README.md. No network or API key
is used by this script. Its outputs stay under video/voice/ and out of Git.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parent
RATE = 24_000
VOICE = "af_heart"
SPEED = 0.94
LEAD = 0.45
GAP = 0.35
TAIL = 1.2


def script_paragraphs() -> list[str]:
    lines = (ROOT / "narration.md").read_text(encoding="utf-8").splitlines()
    paragraphs = [line for line in lines if line and not line.startswith("#") and not line.startswith("Working script")]
    if len(paragraphs) != 8:
        raise ValueError(f"expected eight narration scenes, found {len(paragraphs)}")
    return paragraphs


def spoken(text: str) -> str:
    text = text.replace("`", "")
    substitutions = {
        "AgentTrust": "Agent Trust",
        "NEAR": "near",
        "MCP": "M C P",
        "CSV": "C S V",
        "pay_service": "pay service",
        "MISSING": "missing",
        "A-100": "A one hundred",
        "r4-16": "R four sixteen",
        "r4-17": "R four seventeen",
        "r4-18": "R four eighteen",
        "duplicate: true": "duplicate true",
    }
    for source, replacement in substitutions.items():
        text = text.replace(source, replacement)
    return text


def silence(seconds: float) -> np.ndarray:
    return np.zeros(round(seconds * RATE), dtype=np.float32)


def main() -> None:
    output = ROOT / "voice"
    output.mkdir(exist_ok=True)
    model = Kokoro(str(ROOT / "work/kokoro-v1.0.onnx"), str(ROOT / "work/voices-v1.0.bin"))
    sections = script_paragraphs()
    joined = [silence(LEAD)]
    scene_times = []
    cursor = LEAD
    for index, raw in enumerate(sections, start=1):
        samples, sample_rate = model.create(spoken(raw), voice=VOICE, speed=SPEED, lang="en-us")
        if sample_rate != RATE:
            raise ValueError(f"unexpected sample rate {sample_rate}")
        samples = np.asarray(samples, dtype=np.float32)
        duration = len(samples) / RATE
        path = output / f"scene-{index:02d}.wav"
        sf.write(path, samples, RATE, subtype="PCM_16")
        scene_times.append({"scene": index, "start": round(cursor, 3), "end": round(cursor + duration, 3), "duration": round(duration, 3), "text": raw, "spoken": spoken(raw)})
        joined.append(samples)
        cursor += duration
        if index < len(sections):
            joined.append(silence(GAP))
            cursor += GAP
    joined.append(silence(TAIL))
    sf.write(output / "narration.wav", np.concatenate(joined), RATE, subtype="PCM_16")
    metadata = {"voice": VOICE, "speed": SPEED, "sample_rate": RATE, "lead": LEAD, "gap": GAP, "tail": TAIL, "duration": round(cursor + TAIL, 3), "scenes": scene_times}
    (output / "timing.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    for scene in scene_times:
        print(f"scene {scene['scene']:02d}: {scene['start']:.2f}–{scene['end']:.2f}s ({scene['duration']:.2f}s)")
    print(f"total: {metadata['duration']:.2f}s")


if __name__ == "__main__":
    main()
