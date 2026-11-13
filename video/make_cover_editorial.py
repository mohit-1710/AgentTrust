#!/usr/bin/env python3
"""Render the editorial AgentTrust NEAR X-video cover from local assets.

The three headline facts have separate provenance in docs/testnet-r4-evidence.md:
direct r4-16 refused A, the saved model run purchased B, and B returned the
checked 15-row synthetic audit. This cover does not depict a live UI state.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
OUT = ROOT / "final/agenttrust-near-product-cover.png"
W, H = 1920, 1080
PAPER = "#fbfaf9"
INK = "#0a0a0a"
VIOLET = "#6f4cff"
MUTED = "#64615e"
RULE = "#dedbd6"
FRAUNCES = REPO / "web/public/fonts/Fraunces-SemiBold.ttf"
GEIST_MONO = REPO / "web/public/fonts/GeistMono-Medium.ttf"
SANS = Path("/System/Library/Fonts/SFNS.ttf")
HERO_POSTER = REPO / "web/public/media/agenttrust-hero-poster.png"


@lru_cache(maxsize=None)
def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str,
         path: Path, size: int, color: str = INK) -> None:
    draw.text(xy, value, font=font(path, size), fill=color, anchor="lt")


def logo(draw: ImageDraw.ImageDraw) -> None:
    vertices = ((105, 67), (91, 96), (119, 96))
    draw.line((*vertices, vertices[0]), fill=VIOLET, width=5, joint="curve")
    for x, y in vertices:
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=VIOLET)


def hero_mark() -> Image.Image:
    """Keep the site's violet network mark, without its white poster rectangle."""
    source = Image.open(HERO_POSTER).convert("RGB")
    source = source.crop((430, 38, 1110, 525)).resize((750, 537), Image.Resampling.LANCZOS)
    motif = source.convert("RGBA")
    pixels = motif.load()
    for y in range(motif.height):
        for x in range(motif.width):
            red, green, blue, _ = pixels[x, y]
            violet_strength = max(0, blue - min(red, green) - 10)
            grey_strength = max(0, 242 - min(red, green, blue))
            alpha = min(145, violet_strength * 2) if violet_strength else min(26, grey_strength // 4)
            pixels[x, y] = (red, green, blue, alpha)
    return motif


def render() -> Image.Image:
    image = Image.new("RGBA", (W, H), PAPER)
    draw = ImageDraw.Draw(image)
    logo(draw)
    text(draw, (145, 62), "AgentTrust", FRAUNCES, 42)

    right = "NEAR TESTNET  /  RECORDED R4"
    right_x = W - 100 - round(draw.textlength(right, font=font(GEIST_MONO, 27)))
    text(draw, (right_x, 75), right, GEIST_MONO, 27, VIOLET)
    draw.line((100, 132, 1820, 132), fill=RULE, width=2)

    image.alpha_composite(hero_mark(), (1140, 225))
    draw = ImageDraw.Draw(image)
    text(draw, (100, 181), "DIRECT R4-16  /  SAVED MODEL R4  /  CHECKED REPORT",
         GEIST_MONO, 27, VIOLET)
    text(draw, (100, 235), "Direct A refused.", FRAUNCES, 144)
    text(draw, (100, 408), "Model call. B settled.", FRAUNCES, 144, VIOLET)
    text(draw, (100, 581), "15 rows checked.", FRAUNCES, 144)

    draw.line((100, 836, 1820, 836), fill=RULE, width=2)
    text(draw, (100, 862), "0.002 NEAR", FRAUNCES, 74, VIOLET)
    text(draw, (525, 881), "paid to B on testnet", SANS, 39, INK)
    text(draw, (101, 962), "8 ACCEPTED  /  7 REJECTED  ·  SYNTHETIC INVOICE AUDIT",
         GEIST_MONO, 26, MUTED)
    return image.convert("RGB")


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    render().save(OUT, optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
