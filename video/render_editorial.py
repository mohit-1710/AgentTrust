#!/usr/bin/env python3
"""Render the AgentTrust NEAR product walkthrough from dated public captures.

The site/docs images are still captures; only the two Decisions WebMs contain
recorded page interaction. Camera crops and editorial labels never stand in for
a new model call, a website purchase action, or a fresh chain transaction.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from editorial_slides import render_owner_rule
from loom_captions import render_caption


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
W, H, FPS = 1920, 1080, 30
CREAM, INK, VIOLET = "#fbfaf9", "#0a0a0a", "#6f4cff"
RED, GREEN, MUTED, RULE = "#c13b26", "#1f7a3d", "#666461", "#dedbd6"
FRAUNCES = REPO / "web/public/fonts/Fraunces-SemiBold.ttf"
GEIST = REPO / "web/public/fonts/GeistMono-Medium.ttf"
SANS = Path("/System/Library/Fonts/SFNS.ttf")
ASSETS = ROOT / "assets"
WORK = ROOT / "work"
SITE = ASSETS / "site-2026-11-13.png"
DOC_MODEL = ASSETS / "docs-r4-model-2026-11-13.png"
DOC_RESULT = ASSETS / "docs-r4-result-2026-11-13.png"
DOC_DIRECT = ASSETS / "docs-r4-direct-2026-11-13.png"
DOC_TOP = ASSETS / "docs-r4-top-2026-11-13.png"
CLIP_A = ASSETS / "decisions-direct-a-2026-11-13.webm"
CLIP_B = ASSETS / "decisions-model-b-2026-11-13.webm"
HERO = REPO / "web/public/media/agenttrust-hero-loop.mp4"
HOOK_DIRECT_CLIP_END = 6.55
HOOK_DIRECT_DOC_END = 10.75
HOOK_MODEL_B_END = 17.6

SOURCE_LABELS = (
    "READ-ONLY DECISIONS CAPTURE  /  SEPARATE DIRECT r4-16",
    "DATED PUBLIC SITE CAPTURE  /  NATIVE NEAR",
    "R4 OWNER CONFIGURATION  /  NEAR TESTNET",
    "SAVED r4 LOCAL MODEL + MCP TRACE  /  SELF-RECORDED",
    "SAVED r4 MODEL B  /  FINAL CONTRACT VIEW",
    "SAVED r4 MODEL B  /  FINAL NEAR RECEIPT",
    "CONTROLLED SYNTHETIC FIXTURE  /  CHECKED REPORT",
    "SEPARATE DIRECT r4-17/18  /  EXACT RETRY",
    "PUBLIC r4 PROOF  /  LOCAL TESTNET SCOPE",
)


@lru_cache(maxsize=None)
def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


@lru_cache(maxsize=12)
def source(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def smooth(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def camera(image: Image.Image, zoom: float, focus_x: float = 960, focus_y: float = 540) -> Image.Image:
    """A documentary camera move over a real saved capture."""
    if zoom <= 1.001:
        return image.copy()
    crop_w, crop_h = W / zoom, H / zoom
    left = min(max(focus_x - crop_w / 2, 0), W - crop_w)
    top = min(max(focus_y - crop_h / 2, 0), H - crop_h)
    return image.crop((round(left), round(top), round(left + crop_w), round(top + crop_h))).resize(
        (W, H), Image.Resampling.BICUBIC
    )


def prepare_frames(source_file: Path, folder: Path) -> list[Path]:
    folder.mkdir(parents=True, exist_ok=True)
    frames = sorted(folder.glob("frame-*.jpg"))
    if not frames:
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source_file),
                        "-vf", f"fps={FPS}", "-q:v", "3", str(folder / "frame-%04d.jpg")], check=True)
        frames = sorted(folder.glob("frame-*.jpg"))
    if len(frames) < 150:
        raise ValueError(f"short capture: {source_file}")
    return frames


@lru_cache(maxsize=24)
def frame_image(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def clip_frame(frames: list[Path], second: float) -> Image.Image:
    index = min(len(frames) - 1, max(0, int(second * FPS)))
    return frame_image(frames[index])


def hero_site(second: float, hero_frames: list[Path]) -> Image.Image:
    image = source(SITE).copy()
    index = int(second * FPS) % len(hero_frames)
    video = frame_image(hero_frames[index]).resize((1840, 803), Image.Resampling.BICUBIC)
    image.paste(video, (40, 590))
    draw = ImageDraw.Draw(image)
    draw.line((40, 590, 1880, 590), fill="#eeebe8", width=1)
    return image


def site_walkthrough(local_t: float, duration: float, hero_frames: list[Path]) -> Image.Image:
    """Guide the camera across real site copy without simulating a page action."""
    image = hero_site(local_t, hero_frames)
    u = local_t / max(duration, 0.01)
    if u < 0.38:
        return image
    if u < 0.57:
        zoom = 1.0 + 0.45 * smooth((u - 0.38) / 0.19)
        return camera(image, zoom, 640, 410)
    if u < 0.68:
        return camera(image, 1.45, 640, 410)
    if u < 0.75:
        zoom = 1.45 - 0.45 * smooth((u - 0.68) / 0.07)
        return camera(image, zoom, 640, 410)
    # Magnify the actual site's scoped-worker panel as that line is spoken.
    panel_crop = image.crop((1641, 160, 1840, 565))
    grow = smooth((u - 0.75) / 0.14)
    x0 = round(1641 - 201 * grow)
    y0 = round(160 - 40 * grow)
    width = round(199 + 201 * grow)
    height = round(405 + 409 * grow)
    image.paste(panel_crop.resize((width, height), Image.Resampling.BICUBIC), (x0, y0))
    ImageDraw.Draw(image).rectangle((x0, y0, x0 + width, y0 + height), outline=VIOLET, width=3)
    return image


def model_b_view(second: float, frames: list[Path], zoom: float = 1.4) -> Image.Image:
    """Frame only the saved model B row from the dated read-only capture."""
    image = camera(clip_frame(frames, second), zoom, 700, 510)
    draw = panel(image, 1490)
    label(draw, 1525, 250, "SAVED MODEL B", VIOLET, 22)
    text(draw, 1519, 326, "SETTLED", 65, GREEN, GEIST)
    text(draw, 1522, 470, "0.002 NEAR", 43, INK, FRAUNCES)
    label(draw, 1525, 582, "PAYMENT ID", MUTED, 20)
    text(draw, 1522, 622, "ZIu51g…JJaHo=", 27, INK, GEIST)
    label(draw, 1525, 752, "RECEIPT IN PUBLIC r4 PROOF", VIOLET, 20)
    return image


def panel(image: Image.Image, x0: int = 1420) -> ImageDraw.ImageDraw:
    veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(veil).rectangle((x0, 80, W, 936), fill=(251, 250, 249, 255))
    image.paste(veil, (0, 0), veil)
    draw = ImageDraw.Draw(image)
    draw.line((x0, 125, x0, 906), fill=VIOLET, width=3)
    return draw


def text(draw: ImageDraw.ImageDraw, x: int, y: int, value: str,
         size: int, color: str = INK, face: Path = SANS) -> None:
    draw.text((x, y), value, font=font(face, size), fill=color, anchor="lt")


def label(draw: ImageDraw.ImageDraw, x: int, y: int, value: str,
          color: str = VIOLET, size: int = 24) -> None:
    text(draw, x, y, value.upper(), size, color, GEIST)


def slide_base(section: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(image)
    pts = ((104, 64), (91, 91), (117, 91))
    draw.line((*pts, pts[0]), fill=VIOLET, width=4, joint="curve")
    for x, y in pts:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=VIOLET)
    text(draw, 143, 58, "AgentTrust", 37, INK, FRAUNCES)
    title = f"NEAR TESTNET  /  {section}"
    right = W - 100 - round(draw.textlength(title, font=font(GEIST, 24)))
    label(draw, right, 68, title)
    draw.line((100, 126, 1820, 126), fill=RULE, width=2)
    return image, draw


def receipt_slide(local_t: float, duration: float) -> Image.Image:
    image, draw = slide_base("MODEL B RECEIPT")
    text(draw, 100, 175, "A final transfer. Then a callback.", 92, INK, FRAUNCES)
    draw.line((100, 386, 1820, 386), fill=RULE, width=2)
    label(draw, 105, 430, "TRANSFER  /  FINAL RECEIPT")
    text(draw, 100, 482, "0.002 NEAR", 149, VIOLET, FRAUNCES)
    text(draw, 107, 677, "Core", 50)
    text(draw, 260, 677, "→", 58, VIOLET)
    text(draw, 362, 677, "Provider B", 50)
    if local_t / max(duration, 0.01) >= 0.3:
        draw.line((965, 436, 965, 865), fill=RULE, width=2)
        label(draw, 1012, 432, "FINAL TRANSACTION")
        text(draw, 1007, 481, "EAmDN…GfSF", 46, INK, GEIST)
        label(draw, 1012, 580, "CORE → B TRANSFER RECEIPT")
        text(draw, 1007, 632, "HS3f…QSaX5j", 42, INK, GEIST)
    if local_t / max(duration, 0.01) >= 0.62:
        draw.line((1009, 754, 1710, 754), fill=VIOLET, width=3)
        label(draw, 1012, 784, "LATER PRIVATE CALLBACK", VIOLET, 22)
        text(draw, 1007, 820, "SETTLED", 52, GREEN, GEIST)
    return image


def report_slide(local_t: float, duration: float) -> Image.Image:
    image, draw = slide_base("CHECKED AUDIT")
    text(draw, 100, 174, "The payment buys an answer.", 97, INK, FRAUNCES)
    label(draw, 105, 333, "CONTROLLED SYNTHETIC INPUT  /  INVOICE.AUDIT.V1", VIOLET, 25)
    draw.line((100, 390, 1820, 390), fill=RULE, width=2)
    label(draw, 104, 435, "CSV ROW", MUTED, 24)
    label(draw, 368, 435, "VENDOR / INVOICE", MUTED, 24)
    label(draw, 874, 435, "EVIDENCE", MUTED, 24)
    draw.line((100, 485, 1110, 485), fill=RULE, width=2)
    text(draw, 105, 513, "01–02", 38, INK, GEIST)
    text(draw, 365, 513, "acme / A-100", 39, INK, GEIST)
    text(draw, 875, 513, "duplicate", 34, VIOLET)
    draw.line((100, 594, 1110, 594), fill=RULE, width=2)
    if local_t / max(duration, 0.01) >= 0.48:
        text(draw, 105, 625, "09", 42, INK, GEIST)
        text(draw, 365, 625, "bad / B-1", 39, INK, GEIST)
        text(draw, 855, 625, "-0.01 USD", 35, RED, GEIST)
        text(draw, 365, 695, "NEGATIVE_AMOUNT", 30, RED, GEIST)
    draw.line((1160, 435, 1160, 856), fill=RULE, width=2)
    if local_t / max(duration, 0.01) >= 0.20:
        label(draw, 1205, 435, "CHECKED REPORT", VIOLET)
        text(draw, 1198, 480, "15", 171, INK, FRAUNCES)
        text(draw, 1450, 594, "rows", 41, MUTED)
    if local_t / max(duration, 0.01) >= 0.33:
        draw.line((1203, 713, 1790, 713), fill=RULE, width=2)
        text(draw, 1203, 741, "8 accepted", 45, GREEN)
        text(draw, 1500, 741, "7 rejected", 43, RED)
    if local_t / max(duration, 0.01) >= 0.78:
        text(draw, 1205, 830, "verified against this fixed input", 29, MUTED)
    return image


def scene_image(index: int, local_t: float, duration: float,
                clips: dict[str, list[Path]]) -> Image.Image:
    u = local_t / max(duration, 0.01)
    if index == 0:
        if local_t < HOOK_DIRECT_CLIP_END:
            second = min(7.45, 2.5 + local_t)
            raw = clip_frame(clips["direct-a"], second)
            zoom = 1.52 + 0.08 * smooth(local_t / HOOK_DIRECT_CLIP_END)
            return camera(raw, zoom, 620, 665)
        if local_t < HOOK_DIRECT_DOC_END:
            image = camera(source(DOC_DIRECT), 1.45, 950, 380)
            draw = panel(image, 1450)
            label(draw, 1490, 276, "r4-16 / EXECUTED", RED, 24)
            text(draw, 1485, 345, "0", 166, RED, FRAUNCES)
            text(draw, 1491, 548, "provider", 49)
            text(draw, 1491, 608, "payout", 49)
            label(draw, 1491, 730, "NETWORK GAS STILL APPLIES", MUTED, 19)
            return image
        if local_t < HOOK_MODEL_B_END:
            return model_b_view(min(7.45, 2.5 + local_t - HOOK_DIRECT_DOC_END),
                                clips["model-b"])
        return report_slide(duration, duration)

    if index == 1:
        return site_walkthrough(local_t, duration, clips["hero"])

    if index == 2:
        stage = 0 if u < 0.03 else 1 if u < 0.60 else 2 if u < 0.78 else 3
        boundary = (0, 0.03, 0.60, 0.78)[stage]
        frame = round(max(0.0, u - boundary) * duration * FPS)
        return render_owner_rule(stage, min(frame, 6))

    if index == 3:
        if u < 0.68:
            image = camera(source(DOC_MODEL), 1.25 + 0.11 * smooth(u / 0.68), 930, 620)
            draw = panel(image, 1370)
            label(draw, 1415, 220, "SAVED MODEL TOOL TRACE", VIOLET, 20)
            text(draw, 1410, 264, "5", 120, VIOLET, FRAUNCES)
            label(draw, 1510, 333, "REQUESTS", MUTED, 24)
            for step, name in enumerate(("get_policy", "list_services", "get_service(A)",
                                         "pay_service(A)", "pay_service(B)"), start=1):
                y = 480 + (step - 1) * 77
                label(draw, 1415, y, f"{step:02d}", VIOLET, 25)
                color = RED if step == 4 and u > 0.45 else MUTED if step == 5 else INK
                text(draw, 1470, y, name, 30, color, GEIST)
            return image
        image = camera(source(DOC_MODEL), 1.35, 930, 690)
        draw = panel(image, 1370)
        draw.line((465, 686, 1350, 686), fill=RED, width=4)
        label(draw, 1415, 264, "STEP 04 / A PREVIEW", RED, 22)
        text(draw, 1411, 328, "MISSING", 63, RED, GEIST)
        text(draw, 1415, 471, "No", 80, INK, FRAUNCES)
        text(draw, 1415, 562, "transaction", 47)
        return image

    if index == 4:
        if u < 6.5 / 14:
            image = camera(source(DOC_RESULT), 1.33, 920, 380)
            draw = panel(image, 1450)
            label(draw, 1490, 260, "STEP 05 / MODEL B")
            text(draw, 1488, 338, "pay_service(B)", 30, INK, GEIST)
            label(draw, 1490, 460, "HOST BINDS", MUTED, 20)
            text(draw, 1484, 515, "CSV", 75, INK, FRAUNCES)
            text(draw, 1490, 625, "+ payment ID", 39)
            return image
        q = (u - 6.5 / 14) / (1 - 6.5 / 14)
        return model_b_view(min(7.45, 2.5 + q * 4.8), clips["model-b"],
                            1.37 + 0.08 * smooth(q))

    if index == 5:
        return receipt_slide(local_t, duration)

    if index == 6:
        return report_slide(local_t, duration)

    if index == 7:
        if u < 0.14:
            return camera(source(DOC_DIRECT), 1.11, 950, 410)
        image, draw = slide_base("CROPPED PUBLIC r4 DOCS")
        text(draw, 100, 171, "Same ID. One payout.", 105, INK, FRAUNCES)
        draw.line((100, 359, 1820, 359), fill=RULE, width=2)
        excerpt = source(DOC_DIRECT).crop((580, 282, 1300, 496)).resize(
            (1310, 389), Image.Resampling.BICUBIC
        )
        image.paste(excerpt, (80, 410))
        draw = ImageDraw.Draw(image)
        draw.rectangle((80, 410, 1390, 799), outline=RULE, width=2)
        selected_y = 420 if u < 0.56 else 610
        draw.rectangle((82, selected_y, 89, selected_y + 174), fill=VIOLET)
        label(draw, 1460, 445, "DIRECT r4-17 → r4-18", VIOLET, 21)
        text(draw, 1454, 500, "duplicate:", 38, INK, GEIST)
        text(draw, 1454, 554, "true", 68, VIOLET, GEIST)
        text(draw, 1458, 684, "0 additional", 35)
        text(draw, 1458, 738, "provider payouts", 35)
        text(draw, 85, 831, "payment ID  vhPJ…BCniU=  ·  exact saved quote + credential", 28, MUTED, GEIST)
        return image

    if index == 8:
        if u < 9 / 15:
            image = camera(source(DOC_TOP), 1.12 + 0.08 * smooth(u / (9 / 15)), 930, 355)
            draw = panel(image, 1450)
            label(draw, 1490, 256, "CONTROLLED SCOPE")
            text(draw, 1486, 319, "Local model", 48)
            text(draw, 1486, 382, "+ MCP", 48)
            draw.line((1491, 470, 1830, 470), fill=RULE, width=2)
            text(draw, 1486, 507, "Project-run", 43)
            text(draw, 1486, 565, "providers", 43)
            text(draw, 1486, 623, "+ issuer", 43)
            label(draw, 1491, 768, "REFUND-ORDER CASE OPEN", RED, 20)
            return image
        image = hero_site(local_t, clips["hero"])
        draw = ImageDraw.Draw(image, "RGBA")
        draw.rectangle((50, 660, 1880, 935), fill=(251, 250, 249, 235))
        draw = ImageDraw.Draw(image)
        text(draw, 80, 694, "agenttrust.tech", 93, VIOLET, FRAUNCES)
        text(draw, 83, 819, "docs.agenttrust.tech/verification/testnet-r4", 42, INK, GEIST)
        return image

    raise ValueError(f"unknown scene {index}")


def scene_at(t: float, timing: dict) -> tuple[int, float, float]:
    scenes = timing["scenes"]
    index = 0
    for i, scene in enumerate(scenes):
        if t >= scene["start"]:
            index = i
    scene = scenes[index]
    return index, max(0.0, min(scene["duration"], t - scene["start"])), scene["duration"]


def captions_at(t: float, captions: list[dict]) -> str | None:
    for caption in captions:
        if caption["start"] <= t < caption["end"]:
            return caption["text"]
    return None


@lru_cache(maxsize=64)
def caption_crop(value: str) -> tuple[Image.Image, tuple[int, int]]:
    layer = render_caption(value)
    bounds = layer.getbbox()
    if bounds is None:
        raise ValueError("empty caption layer")
    return layer.crop(bounds), (bounds[0], bounds[1])


def scene_source_label(scene_index: int, local_t: float, scene_duration: float) -> str:
    u = local_t / max(scene_duration, 0.01)
    if scene_index == 0:
        if local_t < HOOK_DIRECT_CLIP_END:
            return SOURCE_LABELS[0]
        if local_t < HOOK_DIRECT_DOC_END:
            return "DATED PUBLIC r4 DOCS  /  SEPARATE DIRECT r4-16"
        if local_t < HOOK_MODEL_B_END:
            return "READ-ONLY DECISIONS CAPTURE  /  SAVED MODEL B"
        return "CONTROLLED SYNTHETIC FIXTURE  /  CHECKED MODEL B REPORT"
    if scene_index == 4 and u < 6.5 / 14:
        return "DATED PUBLIC r4 DOCS  /  SAVED MODEL B"
    if scene_index == 8 and u >= 9 / 15:
        return "DATED PUBLIC SITE CAPTURE  /  AGENTTRUST ON NEAR"
    return SOURCE_LABELS[scene_index]


def decorate(image: Image.Image, t: float, duration: float, scene_index: int,
             local_t: float, scene_duration: float, caption: str | None) -> Image.Image:
    footer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(footer).rectangle((0, 936, W, 988), fill=(251, 250, 249, 235))
    image.paste(footer, (0, 0), footer)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, round(W * min(1.0, t / duration)), 4), fill=VIOLET)
    draw.line((80, 940, 1840, 940), fill=RULE, width=1)
    label(draw, 84, 944, scene_source_label(scene_index, local_t, scene_duration), MUTED, 19)
    label(draw, 1730, 944, f"{scene_index + 1:02d} / 09", MUTED, 19)
    if caption:
        layer, xy = caption_crop(caption)
        image.paste(layer, xy, layer)
    return image


def fallback_captions(timing: dict) -> list[dict]:
    """Early review timing only; final render uses Whisper-aligned captions."""
    sections: dict[str, list[str]] = {}
    for raw in (ROOT / "script.txt").read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        key, content = raw.split("] ", 1)
        sections.setdefault(key[1:], []).extend(content.split(" | "))
    keys = ("direct", "site", "owner", "preview", "model-b", "receipt", "report", "retry", "close")
    result = []
    for scene, key in zip(timing["scenes"], keys, strict=True):
        phrases = sections[key]
        weights = [max(1, len(value.split())) for value in phrases]
        total = sum(weights)
        start = scene["start"]
        for phrase, weight in zip(phrases, weights, strict=True):
            end = start + scene["duration"] * weight / total
            result.append({"start": round(start, 3), "end": round(end, 3), "text": phrase})
            start = end
    return result


def render_stills(timing: dict, captions: list[dict], clips: dict[str, list[Path]]) -> None:
    folder = WORK / "editorial-stills"
    folder.mkdir(parents=True, exist_ok=True)
    for i, scene in enumerate(timing["scenes"]):
        for fraction in (0.15, 0.56, 0.88):
            t = scene["start"] + scene["duration"] * fraction
            frame = scene_image(i, scene["duration"] * fraction, scene["duration"], clips)
            decorate(frame, t, timing["duration"], i, scene["duration"] * fraction,
                     scene["duration"], captions_at(t, captions)).save(
                folder / f"scene-{i + 1:02d}-{round(fraction * 100):02d}.png", optimize=True
            )
    print(folder)


def write_caption_sidecars(output: Path, captions: list[dict]) -> None:
    """Keep the burned-in caption positions and upload transcript inspectable."""
    def stamp(seconds: float) -> str:
        milliseconds = round(seconds * 1000)
        hours, remainder = divmod(milliseconds, 3_600_000)
        minutes, remainder = divmod(remainder, 60_000)
        whole, fraction = divmod(remainder, 1000)
        return f"{hours:02d}:{minutes:02d}:{whole:02d},{fraction:03d}"

    manifest = []
    srt = []
    for number, caption in enumerate(captions, start=1):
        box = render_caption(caption["text"]).getbbox()
        manifest.append({**caption, "box": list(box), "overlaps_face": False})
        srt.append(f"{number}\n{stamp(caption['start'])} --> {stamp(caption['end'])}\n{caption['text']}\n")
    output.with_name(output.stem + "-captions.json").write_text(
        json.dumps({"frame": [W, H], "face": None, "captions": manifest}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    output.with_suffix(".srt").write_text("\n".join(srt), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stills-only", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "final/agenttrust-near-product-demo.mp4")
    args = parser.parse_args()
    timing = json.loads((ROOT / "voice/editorial-timing.json").read_text(encoding="utf-8"))
    if timing["duration"] >= 140:
        raise ValueError("duration exceeds the X video margin")
    captions_file = WORK / "editorial-captions.json"
    captions = json.loads(captions_file.read_text(encoding="utf-8")) if captions_file.is_file() else fallback_captions(timing)
    for caption in captions:
        caption_crop(caption["text"])
    clips = {
        "direct-a": prepare_frames(CLIP_A, WORK / "editorial-clip-direct-a"),
        "model-b": prepare_frames(CLIP_B, WORK / "editorial-clip-model-b"),
        "hero": prepare_frames(HERO, WORK / "editorial-hero-frames"),
    }
    render_stills(timing, captions, clips)
    if args.stills_only:
        return

    args.output.parent.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
               "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-i", str(ROOT / "voice/editorial-narration.wav"),
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
               "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
               "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
               "-movflags", "+faststart", "-shortest", str(args.output)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    if process.stdin is None:
        raise RuntimeError("ffmpeg input unavailable")
    count = math.ceil(timing["duration"] * FPS)
    try:
        for number in range(count):
            t = number / FPS
            i, local_t, scene_duration = scene_at(t, timing)
            frame = scene_image(i, local_t, scene_duration, clips)
            frame = decorate(frame, t, timing["duration"], i, local_t, scene_duration,
                             captions_at(t, captions))
            process.stdin.write(frame.tobytes())
            if number % (FPS * 10) == 0:
                print(f"rendering {number / FPS:.0f}s / {timing['duration']:.1f}s", flush=True)
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg encode failed")
    write_caption_sidecars(args.output, captions)
    print(args.output)


if __name__ == "__main__":
    main()
