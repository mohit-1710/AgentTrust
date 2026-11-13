#!/usr/bin/env python3
"""AgentTrust owner-boundary insert for the NEAR demo video.

The values and attempt boundaries come from docs/testnet-r4-evidence.md. These
slides summarize saved evidence; they are not a live contract or model view.

The slide has stages 0–3. Stage 0 is its title. Stages 1–3 reveal one evidence
unit over six frames at 30 fps (200 ms), while earlier units remain fixed.
`progress` overrides the frame-derived reveal amount when fitting a voice cue.
The caller adds the fixed Loom captions after composing these images.
"""

from __future__ import annotations

import argparse
from functools import lru_cache
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
W, H = 1920, 1080
REVEAL_FRAMES = 6

CREAM = "#fbfaf9"
INK = "#0a0a0a"
VIOLET = "#6f4cff"
MUTED = "#666461"
RULE = "#dedbd6"

FRAUNCES = REPO / "web/public/fonts/Fraunces-SemiBold.ttf"
GEIST_MONO = REPO / "web/public/fonts/GeistMono-Medium.ttf"
SANS = Path("/System/Library/Fonts/SFNS.ttf")


@lru_cache(maxsize=None)
def _font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def _text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str,
          face: Path, size: int, color: str = INK) -> None:
    draw.text(xy, value, font=_font(face, size), fill=color, anchor="lt")


def _label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str,
           color: str = MUTED, size: int = 26) -> None:
    _text(draw, xy, value.upper(), GEIST_MONO, size, color)


def _base(section: str) -> Image.Image:
    image = Image.new("RGBA", (W, H), CREAM)
    draw = ImageDraw.Draw(image)

    # The site wordmark and one hairline provide continuity with real footage.
    a = ((104, 64), (91, 91), (117, 91))
    draw.line((a[0], a[1], a[2], a[0]), fill=VIOLET, width=4, joint="curve")
    for x, y in a:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=VIOLET)
    _text(draw, (143, 58), "AgentTrust", FRAUNCES, 37)

    header = f"NEAR TESTNET  /  {section}"
    header_font = _font(GEIST_MONO, 24)
    header_x = W - 100 - round(draw.textlength(header, font=header_font))
    _label(draw, (header_x, 68), header, VIOLET, 24)
    draw.line((100, 126, 1820, 126), fill=RULE, width=2)
    return image


def _ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def _amount(stage: int, unit: int, progress: float) -> float:
    if stage > unit:
        return 1.0
    if stage == unit:
        return _ease(progress)
    return 0.0


def _reveal(image: Image.Image, amount: float,
            draw_unit: Callable[[ImageDraw.ImageDraw], None]) -> None:
    if amount <= 0:
        return
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_unit(ImageDraw.Draw(layer))
    dy = round((1.0 - amount) * 16)
    if dy:
        shifted = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        shifted.paste(layer.crop((0, 0, W, H - dy)), (0, dy))
        layer = shifted
    if amount < 1:
        layer.putalpha(layer.getchannel("A").point(lambda alpha: round(alpha * amount)))
    image.alpha_composite(layer)


def render_owner_rule(stage: int = 3, frame: int = REVEAL_FRAMES,
                      progress: float | None = None) -> Image.Image:
    """Reveal the owner's identity, credential, spend and worker boundaries."""
    if stage not in range(4):
        raise ValueError("owner stage must be 0–3")
    reveal = min(max(frame / REVEAL_FRAMES, 0.0), 1.0) if progress is None else progress
    image = _base("OWNER BOUNDARY")
    draw = ImageDraw.Draw(image)
    _text(draw, (100, 174), "The owner sets the limit.", FRAUNCES, 113)

    def owner_conditions(d: ImageDraw.ImageDraw) -> None:
        d.line((100, 331, 1820, 331), fill=RULE, width=2)
        _label(d, (104, 371), "Who and what", VIOLET, 29)
        _text(d, (103, 428), "A + B exact identities", SANS, 52)
        _text(d, (103, 513), "invoice.audit.v1", GEIST_MONO, 47, VIOLET)
        _text(d, (105, 594), "accepted issuer pinned", SANS, 43)

    def purchase_ceiling(d: ImageDraw.ImageDraw) -> None:
        d.line((980, 370, 980, 680), fill=RULE, width=2)
        _label(d, (1025, 371), "r4 / session purchase cap", VIOLET, 25)
        _text(d, (1016, 434), "0.01 NEAR", FRAUNCES, 136, VIOLET)
        _text(d, (1025, 603), "maximum per purchase", SANS, 40)

    def authority_path(d: ImageDraw.ImageDraw) -> None:
        d.line((100, 727, 1820, 727), fill=RULE, width=2)
        _label(d, (103, 754), "Owner", INK, 37)
        _text(d, (105, 821), "sets the rules", SANS, 35, MUTED)

        d.line((325, 784, 603, 784), fill=VIOLET, width=3)
        d.polygon(((603, 784), (589, 775), (589, 793)), fill=VIOLET)
        _label(d, (661, 754), "Native core", INK, 37)
        _text(d, (663, 821), "enforces them", SANS, 35, MUTED)

        d.line((1042, 784, 1289, 784), fill=VIOLET, width=3)
        d.polygon(((1042, 784), (1056, 775), (1056, 793)), fill=VIOLET)
        _label(d, (1347, 754), "Restricted worker key", INK, 34)
        _text(d, (1349, 821), "execute_payment only", GEIST_MONO, 35)

    for unit, painter in ((1, owner_conditions), (2, purchase_ceiling), (3, authority_path)):
        _reveal(image, _amount(stage, unit, reveal), painter)
    return image.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path)
    parser.add_argument("--stage", type=int, default=3, choices=range(4))
    parser.add_argument("--frame", type=int, default=REVEAL_FRAMES)
    parser.add_argument("--progress", type=float)
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    render_owner_rule(args.stage, args.frame, args.progress).save(args.out)


if __name__ == "__main__":
    main()
