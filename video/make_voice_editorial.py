#!/usr/bin/env python3
"""Make a local, licensed guide voice for the AgentTrust editorial cut.

The guide is replaceable by one real founder take. It never calls a provider,
uses a credential, or touches a chain. Output stays in the ignored voice folder.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parent
RATE = 24_000
LEAD = 0.6
GAP = 0.28
TAIL = 1.1


def spoken(text: str) -> str:
    substitutions = {
        "AgentTrust": "Agent Trust",
        "invoice.audit.v1": "invoice audit version one",
        "execute_payment": "execute payment",
        "0.002 NEAR": "zero point zero zero two near",
        "A-100": "A one hundred",
        "r4-16": "R four sixteen",
        "r4-17": "R four seventeen",
        "r4-18": "R four eighteen",
        "MCP": "M C P",
        "CSV": "C S V",
        "MISSING": "missing",
        "NEAR": "near",
    }
    for source, replacement in substitutions.items():
        text = text.replace(source, replacement)
    return text


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=0.94)
    parser.add_argument("--shotlist", type=Path, default=ROOT / "shotlist_editorial.json")
    args = parser.parse_args()

    shots = json.loads(args.shotlist.read_text(encoding="utf-8"))["shots"]
    model = Kokoro(str(ROOT / "work/kokoro-v1.0.onnx"), str(ROOT / "work/voices-v1.0.bin"))
    if args.voice not in model.get_voices():
        raise ValueError(f"unknown local voice {args.voice}")

    output = ROOT / "voice"
    output.mkdir(exist_ok=True)
    combined = [np.zeros(round(LEAD * RATE), dtype=np.float32)]
    scene_times = []
    cursor = LEAD
    for index, shot in enumerate(shots, start=1):
        raw = shot["narration"]
        language = "en-gb" if args.voice.startswith("b") else "en-us"
        samples, rate = model.create(spoken(raw), voice=args.voice, speed=args.speed,
                                     lang=language)
        if rate != RATE:
            raise ValueError(f"unexpected sample rate {rate}")
        samples = np.asarray(samples, dtype=np.float32)
        length = len(samples) / RATE
        sf.write(output / f"editorial-scene-{index:02d}.wav", samples, RATE, subtype="PCM_16")
        scene_times.append({"id": shot["id"], "scene": index, "start": round(cursor, 3),
                            "end": round(cursor + length, 3), "duration": round(length, 3),
                            "text": raw, "spoken": spoken(raw)})
        combined.append(samples)
        cursor += length
        if index < len(shots):
            combined.append(np.zeros(round(GAP * RATE), dtype=np.float32))
            cursor += GAP
    combined.append(np.zeros(round(TAIL * RATE), dtype=np.float32))
    sf.write(output / "editorial-narration.wav", np.concatenate(combined), RATE, subtype="PCM_16")
    timing = {"voice": args.voice, "speed": args.speed, "sample_rate": RATE, "lead": LEAD,
              "gap": GAP, "tail": TAIL, "duration": round(cursor + TAIL, 3), "scenes": scene_times}
    (output / "editorial-timing.json").write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")
    for scene in scene_times:
        print(f"scene {scene['scene']:02d}: {scene['start']:.2f}–{scene['end']:.2f}s")
    print(f"total: {timing['duration']:.2f}s")


if __name__ == "__main__":
    main()
