"""Fixed Loom-style caption overlay for the AgentTrust video.

The frame renderer composites this transparent image over every shot. Captions
never move to make room for a shot; the shot must leave the bottom clear.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


FRAME = (1920, 1080)
FONT_PATH = Path("/System/Library/Fonts/SFNS.ttf")
FONT_SIZE = 48
MAX_BOX_WIDTH = 1500
PAD_X, PAD_Y = 18, 9
RADIUS = 8
BOTTOM_MARGIN = 31
LINE_HEIGHT = 1.28
BOX_FILL = (38, 38, 44, 220)
TEXT_FILL = (255, 255, 255, 255)


@lru_cache(maxsize=1)
def _font() -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT_PATH), FONT_SIZE)
    font.set_variation_by_name("Semibold")
    return font


def caption_lines(text: str) -> tuple[str, ...]:
    """Validate and balance one caption into at most two lines.

    Use `` | `` when the spoken script needs a deliberate line break.
    Long captions should be split into shorter timed phrases at the caller.
    """
    normalized = " ".join(text.strip().split()) if " | " not in text else text.strip()
    if not normalized:
        raise ValueError("empty caption")
    font = _font()
    content_width = MAX_BOX_WIDTH - 2 * PAD_X

    if " | " in normalized:
        parts = tuple(" ".join(part.split()) for part in normalized.split(" | "))
        if len(parts) != 2 or any(not part for part in parts):
            raise ValueError("a caption may contain one deliberate ' | ' break")
    elif font.getlength(normalized) <= content_width:
        parts = (normalized,)
    else:
        words = normalized.split()
        candidates = [
            (" ".join(words[:index]), " ".join(words[index:]))
            for index in range(1, len(words))
        ]
        valid = [
            candidate for candidate in candidates
            if max(font.getlength(line) for line in candidate) <= content_width
        ]
        if not valid:
            raise ValueError(f"caption needs more than two lines: {text!r}")
        parts = min(
            valid,
            key=lambda candidate: abs(font.getlength(candidate[0]) - font.getlength(candidate[1])),
        )

    if any(font.getlength(line) > content_width for line in parts):
        raise ValueError(f"caption exceeds {MAX_BOX_WIDTH}px box: {text!r}")
    return tuple(parts)


def render_caption(text: str) -> Image.Image:
    """Return one 1920x1080 transparent RGBA caption layer."""
    lines = caption_lines(text)
    font = _font()
    line_height = round(FONT_SIZE * LINE_HEIGHT)
    box_width = round(max(font.getlength(line) for line in lines)) + 2 * PAD_X
    box_height = line_height * len(lines) + 2 * PAD_Y
    left = round((FRAME[0] - box_width) / 2)
    top = FRAME[1] - BOTTOM_MARGIN - box_height
    overlay = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rounded_rectangle(
        (left, top, left + box_width, top + box_height), radius=RADIUS, fill=BOX_FILL
    )
    for index, line in enumerate(lines):
        draw.text(
            (FRAME[0] / 2, top + PAD_Y + index * line_height + 2),
            line,
            font=font,
            fill=TEXT_FILL,
            anchor="ma",
        )
    return overlay
