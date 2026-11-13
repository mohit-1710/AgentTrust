#!/usr/bin/env python3
"""Render the evidence-led AgentTrust NEAR video from public visuals and local voice.

All source facts below are in video/brief.md and the public r4 proof. The dated
public-page captures are tracked source assets; generated output stays ignored.
The video does not display private operator bundles.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
W, H, FPS = 1920, 1080, 30
INK = "#14131B"
CREAM = "#F8F7F4"
WHITE = "#FFFFFF"
PURPLE = "#7157FF"
PURPLE_LIGHT = "#EEEAFE"
MUTED = "#62616A"
LINE = "#E4E1DE"
GREEN = "#147A4F"
GREEN_LIGHT = "#E4F3E8"
RED = "#C83D36"
RED_LIGHT = "#FAE9E6"
FONT_SERIF = REPO / "web/public/fonts/Fraunces-SemiBold.ttf"
FONT_MONO = REPO / "web/public/fonts/GeistMono-Medium.ttf"
FONT_SANS = Path("/System/Library/Fonts/SFNS.ttf")
CUE_ENDS = json.loads((ROOT / "cues.json").read_text(encoding="utf-8"))["caption_ends_seconds"]


def f(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def label(draw: ImageDraw.ImageDraw, x: int, y: int, value: str, *, fill: str = MUTED, size: int = 24) -> None:
    draw.text((x, y), value.upper(), font=f(FONT_MONO, size), fill=fill)


def lines(draw: ImageDraw.ImageDraw, x: int, y: int, value: str, *, face: Path = FONT_SANS,
          size: int = 48, fill: str = INK, max_width: int | None = None,
          line_height: int | None = None) -> int:
    font = f(face, size)
    height = line_height or round(size * 1.18)
    for paragraph in value.split("\n"):
        if max_width is None:
            wrapped = [paragraph]
        else:
            wrapped, current = [], ""
            for word in paragraph.split():
                candidate = (current + " " + word).strip()
                if current and draw.textlength(candidate, font=font) > max_width:
                    wrapped.append(current)
                    current = word
                else:
                    current = candidate
            wrapped.append(current)
        for segment in wrapped:
            draw.text((x, y), segment, font=font, fill=fill)
            y += height
    return y


def box(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], *, fill: str = WHITE,
        outline: str = LINE, radius: int = 22, width: int = 2) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def chip(draw: ImageDraw.ImageDraw, x: int, y: int, value: str, *, bg: str, fg: str,
         size: int = 25, pad_x: int = 18, height: int = 52) -> int:
    font = f(FONT_MONO, size)
    width = round(draw.textlength(value, font=font)) + pad_x * 2
    draw.rounded_rectangle((x, y, x + width, y + height), radius=10, fill=bg)
    draw.text((x + pad_x, y + (height - size) // 2 - 3), value, font=font, fill=fg)
    return width


def logo(draw: ImageDraw.ImageDraw, x: int, y: int, dark: bool = False) -> None:
    stroke = "#A897FF" if dark else PURPLE
    pts = [(x + 13, y + 3), (x + 2, y + 27), (x + 27, y + 27)]
    draw.line([pts[0], pts[1], pts[2], pts[0]], fill=stroke, width=4, joint="curve")
    for p in pts:
        draw.ellipse((p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3), fill=stroke)


def base(scene: int, *, dark: bool = False, eyebrow: str = "") -> tuple[Image.Image, ImageDraw.ImageDraw]:
    bg = "#11101A" if dark else CREAM
    image = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(image)
    if not dark:
        for x in range(50, W, 120):
            draw.line((x, 98, x, 857), fill="#EEECE9", width=1)
        for y in range(150, 850, 120):
            draw.line((0, y, W, y), fill="#EEECE9", width=1)
        draw.rectangle((0, 0, W, 95), fill=WHITE)
    else:
        draw.ellipse((1280, -300, 2300, 690), fill="#1A1630")
        draw.ellipse((1500, 300, 2200, 1000), fill="#201A3A")
    draw.line((0, 95, W, 95), fill="#302B45" if dark else LINE, width=2)
    logo(draw, 64, 31, dark)
    draw.text((105, 28), "AgentTrust", font=f(FONT_SERIF, 33), fill=WHITE if dark else INK)
    label(draw, 1430, 34, "NEAR / HACKATHON 2026", fill="#B7ACF9" if dark else PURPLE, size=23)
    if eyebrow:
        label(draw, 86, 130, eyebrow, fill="#B7ACF9" if dark else PURPLE, size=23)
    draw.line((80, 850, 1840, 850), fill="#514B66" if dark else LINE, width=2)
    label(draw, 83, 818, f"{scene:02d} / 08", fill="#AEA6CC" if dark else MUTED, size=21)
    return image, draw


def photo(image: Image.Image, path: Path, xy: tuple[int, int, int, int],
          crop: tuple[int, int, int, int] | None = None, radius: int = 20) -> None:
    source = Image.open(path).convert("RGB")
    if crop:
        source = source.crop(crop)
    width, height = xy[2] - xy[0], xy[3] - xy[1]
    source = ImageOps.fit(source, (width, height), Image.Resampling.LANCZOS)
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width, height), radius=radius, fill=255)
    image.paste(source, (xy[0], xy[1]), mask)
    ImageDraw.Draw(image).rounded_rectangle(xy, radius=radius, outline=LINE, width=2)


def opening(stage: int) -> Image.Image:
    im, d = base(1, dark=True, eyebrow="SAVED R4 MODEL RUN · 12 NOV 2026 · LOCAL MODEL/MCP/PROVIDERS")
    lines(d, 90, 184, "A bad payment\nstops here.", face=FONT_SERIF, size=112, fill=WHITE, line_height=126)
    lines(d, 96, 468, "The audit still gets done.", size=48, fill="#C8C3D4")
    cards = [
        (90, 590, 610, 780, RED_LIGHT, RED, "A / MISSING", "READ-ONLY PREVIEW: NO TX\nSEPARATE CORE R4-16: NO PAYOUT"),
        (660, 590, 1180, 780, GREEN_LIGHT, GREEN, "B / 0.002 NEAR", "FINAL TRANSFER RECEIPT\nSETTLED CALLBACK"),
        (1230, 590, 1830, 780, PURPLE_LIGHT, PURPLE, "15 ROWS CHECKED", "8 ACCEPTED · 7 REJECTED\nSYNTHETIC INVOICE AUDIT"),
    ]
    for i, (x0, y0, x1, y1, bg, fg, title, sub) in enumerate(cards):
        visible = i == 0 or stage >= 1
        box(d, (x0, y0, x1, y1), fill=bg if visible else "#272333", outline=bg if visible else "#393347", radius=18)
        lines(d, x0 + 28, y0 + 24, title, face=FONT_SERIF, size=45 if i != 2 else 40,
              fill=fg if visible else "#716B7F")
        lines(d, x0 + 30, y0 + 99, sub, face=FONT_MONO, size=21,
              fill=INK if visible else "#625B71", line_height=31)
    label(d, 255, 818, "Preview A + paid B are one saved run; direct r4-16 is a separate test", fill="#B7B2C4", size=19)
    return im


def owner(stage: int) -> Image.Image:
    im, d = base(2, eyebrow="OWNER POLICY / NATIVE NEAR BOUNDARY")
    lines(d, 88, 177, "The owner defines the lane.", face=FONT_SERIF, size=79)
    box(d, (83, 294, 1223, 785), fill=WHITE, radius=19)
    photo(im, ROOT / "assets/site-2026-11-13.png", (103, 314, 1203, 765), crop=(0, 0, 1920, 785), radius=12)
    box(d, (1270, 294, 1835, 785), fill=WHITE, radius=19)
    label(d, 1302, 324, "R4 OWNER RULES", fill=PURPLE)
    lines(d, 1300, 376, "2 exact suppliers", face=FONT_SERIF, size=45)
    lines(d, 1300, 434, "invoice.audit.v1", face=FONT_MONO, size=29, fill=MUTED)
    d.line((1300, 486, 1808, 486), fill=LINE, width=2)
    lines(d, 1300, 511, "0.01 NEAR", face=FONT_SERIF, size=48)
    label(d, 1300, 571, "SESSION PURCHASE CAP", size=20)
    lines(d, 1300, 615, "0.05 NEAR / day", face=FONT_SERIF, size=42)
    label(d, 1300, 666, "OWNER-WIDE DAILY CAP", size=20)
    if stage:
        box(d, (1288, 710, 1813, 766), fill=PURPLE_LIGHT, outline=PURPLE_LIGHT, radius=10)
        label(d, 1303, 722, "WORKER KEY → EXECUTE_PAYMENT ONLY", fill=PURPLE, size=20)
    else:
        label(d, 1303, 722, "WORKER KEY → EXECUTE_PAYMENT ONLY", fill="#A6A3AE", size=20)
    label(d, 250, 818, "Actual public site capture · policy values from r4 proof", size=21)
    return im


def preview(stage: int) -> Image.Image:
    im, d = base(3, eyebrow="R4 / SELF-RECORDED MODEL + MCP TRACE")
    lines(d, 88, 177, "A's payment never becomes a transaction.", face=FONT_SERIF, size=72)
    box(d, (86, 296, 1125, 781), fill=WHITE, radius=20)
    label(d, 119, 326, "RECORDED TOOL ORDER · 23:45 UTC", fill=PURPLE)
    rows = [(1, "get_policy", "read"), (2, "list_services", "read"), (3, "get_service(A)", "read"), (4, "pay_service(A)", "MISSING")]
    for i, (num, call, result) in enumerate(rows):
        y = 382 + i * 86
        active = i < 3 or stage >= 1
        bg = RED_LIGHT if i == 3 and stage else "#F4F3F0" if active else "#F7F6F5"
        box(d, (111, y, 1100, y + 72), fill=bg, outline=bg, radius=9)
        label(d, 130, y + 20, f"0{num}", fill=RED if i == 3 and stage else MUTED, size=22)
        lines(d, 220, y + 12, call, face=FONT_MONO, size=30, fill=INK if active else "#A8A5AD")
        label(d, 895, y + 20, result, fill=RED if i == 3 and stage else MUTED, size=21)
    box(d, (1172, 296, 1834, 781), fill=RED_LIGHT if stage else WHITE,
        outline=RED_LIGHT if stage else LINE, radius=20)
    label(d, 1210, 330, "SUPPLIER A", fill=RED if stage else MUTED)
    lines(d, 1205, 393, "MISSING" if stage else "CAPABILITY", face=FONT_SERIF, size=88,
          fill=RED if stage else "#AAA5AD")
    lines(d, 1210, 535, "Required credential absent", size=38, fill=INK if stage else MUTED)
    chip(d, 1210, 680, "READ-ONLY PREVIEW", bg=WHITE, fg=RED if stage else MUTED, size=23)
    chip(d, 1535, 680, "NO TX", bg=WHITE, fg=RED if stage else MUTED, size=23)
    label(d, 255, 818, "Public proof: docs.agenttrust.tech/verification/testnet-r4", size=21)
    return im


def purchase(stage: int) -> Image.Image:
    im, d = base(4, eyebrow="R4 MODEL PURCHASE / HOST-ALLOWED B / NATIVE NEAR")
    lines(d, 88, 177, "B is paid. The contract decides.", face=FONT_SERIF, size=79)
    if stage >= 2:
        box(d, (90, 309, 1830, 781), fill=GREEN_LIGHT, outline=GREEN_LIGHT, radius=20)
        label(d, 126, 340, "FINAL MODEL PAYMENT · PROVIDER B", fill=GREEN, size=26)
        lines(d, 120, 397, "0.002 NEAR", face=FONT_SERIF, size=112, fill=GREEN)
        label(d, 128, 554, "PAYMENT ID", fill=GREEN, size=23)
        lines(d, 124, 592, "ZIu51g…JJaHo=", face=FONT_MONO, size=40)
        chip(d, 128, 689, "CALLBACK: SETTLED", bg=WHITE, fg=GREEN, size=25)
        d.line((960, 340, 960, 744), fill="#A5D7B7", width=3)
        label(d, 1005, 350, "FINAL TRANSACTION", fill=GREEN, size=24)
        lines(d, 1000, 395, "EAmDNch3…GfSF", face=FONT_MONO, size=45)
        label(d, 1005, 488, "TRANSFER RECEIPT", fill=GREEN, size=24)
        lines(d, 1000, 533, "HS3fQWFt…7QSaX5j", face=FONT_MONO, size=42)
        lines(d, 1005, 611, "Core to provider B", face=FONT_SERIF, size=46)
        lines(d, 1005, 694, "Dispatch first. Callback later.", size=31, fill=MUTED)
        label(d, 255, 818, "Public r4 proof · exact final receipts and settled contract callback", size=21)
        return im
    blocks = [
        (90, "MODEL", "requests B", PURPLE),
        (540, "HOST", "binds CSV + ID", PURPLE),
        (990, "CONTRACT", "checks owner rules", PURPLE),
        (1440, "RECEIPT", "0.002 NEAR", GREEN),
    ]
    for i, (x, top, sub, accent) in enumerate(blocks):
        active = i < 2 or stage >= (1 if i == 2 else 2)
        bg = WHITE if active else "#EEECE9"
        box(d, (x, 306, x + 392, 555), fill=bg, outline=accent if active else LINE, radius=19, width=3)
        label(d, x + 24, 335, top, fill=accent if active else "#A09CA5", size=24)
        lines(d, x + 24, 408, sub, face=FONT_SERIF, size=39,
              fill=INK if active else "#A09CA5", max_width=340)
        if i == 3:
            label(d, x + 24, 492, "TO PROVIDER B", fill=GREEN if active else "#A09CA5", size=19)
        if i < 3:
            lines(d, x + 404, 397, "→", face=FONT_SANS, size=45, fill=PURPLE)
    box(d, (90, 605, 1125, 779), fill=WHITE, radius=16)
    photo(im, ROOT / "assets/decisions-r4-2026-11-13.png", (107, 624, 1108, 761), crop=(340, 430, 1110, 560), radius=9)
    box(d, (1163, 605, 1830, 779), fill=GREEN_LIGHT if stage >= 2 else WHITE,
        outline=GREEN_LIGHT if stage >= 2 else LINE, radius=16)
    label(d, 1190, 620, "FINAL TX EAmDN…GfSF", fill=GREEN if stage >= 2 else MUTED, size=20)
    lines(d, 1190, 655, "0.002 NEAR", face=FONT_SERIF, size=65,
          fill=GREEN if stage >= 2 else "#A09CA5")
    label(d, 1190, 735, "RECEIPT HS3f… → B · CALLBACK SETTLED", fill=GREEN if stage >= 2 else MUTED, size=19)
    label(d, 255, 818, "Public page capture of payment view + separate r4 final receipts", size=21)
    return im


def report(stage: int) -> Image.Image:
    im, d = base(5, eyebrow="R4 MODEL PURCHASE / CHECKED SYNTHETIC AUDIT OUTPUT")
    lines(d, 88, 177, "The payment buys a useful answer.", face=FONT_SERIF, size=79)
    box(d, (88, 300, 1060, 781), fill=WHITE, radius=19)
    label(d, 119, 331, "COMMITTED SYNTHETIC CSV FIXTURE", fill=PURPLE)
    label(d, 126, 400, "ROW", size=21)
    label(d, 261, 400, "VENDOR", size=21)
    label(d, 510, 400, "INVOICE", size=21)
    label(d, 760, 400, "AMOUNT", size=21)
    csv_rows = [("01", "acme", "A-100", "10.10 USD", PURPLE_LIGHT),
                ("02", "acme", "A-100", "+2.05 USD", PURPLE_LIGHT),
                ("09", "bad", "B-1", "-0.01 USD", RED_LIGHT)]
    for i, (num, vendor, invoice, amount, bg) in enumerate(csv_rows):
        y = 452 + i * 95
        box(d, (115, y, 1027, y + 78), fill=bg if stage or i < 2 else "#F4F3F1", outline=bg, radius=8)
        for x, value in [(130, num), (260, vendor), (510, invoice), (760, amount)]:
            lines(d, x, y + 21, value, face=FONT_MONO, size=27,
                  fill=RED if i == 2 and stage else INK)
    box(d, (1103, 300, 1834, 781), fill=WHITE, radius=19)
    label(d, 1134, 331, "CHECKED REPORT", fill=PURPLE)
    lines(d, 1130, 380, "15", face=FONT_SERIF, size=99, fill=INK)
    label(d, 1300, 458, "ROWS", size=23)
    chip(d, 1132, 500, "8 ACCEPTED", bg=GREEN_LIGHT, fg=GREEN, size=34, height=62)
    chip(d, 1454, 500, "7 REJECTED", bg=RED_LIGHT, fg=RED, size=34, height=62)
    if stage:
        lines(d, 1133, 591, "A-100 · duplicate rows 1+2", face=FONT_MONO, size=31)
        lines(d, 1133, 638, "Row 9 · NEGATIVE_AMOUNT", face=FONT_MONO, size=30, fill=RED)
        chip(d, 1132, 704, "OUTPUT CHECK PASSED", bg=PURPLE_LIGHT, fg=PURPLE, size=25)
    else:
        lines(d, 1133, 591, "Findings appear after settlement", size=27, fill=MUTED)
    label(d, 255, 818, "Synthetic input · public fixture and r4 checked outcome · not a general accuracy claim", size=20)
    return im


def direct_refusal(stage: int) -> Image.Image:
    im, d = base(6, dark=True, eyebrow="SEPARATE DIRECT TEST / R4-16 / SKIPS SDK PREVIEW")
    lines(d, 88, 182, "Skipping preview still fails.", face=FONT_SERIF, size=86, fill=WHITE)
    box(d, (86, 320, 1225, 751), fill=WHITE, outline=WHITE, radius=19)
    photo(im, ROOT / "assets/decisions-r4-2026-11-13.png", (105, 339, 1206, 561), crop=(310, 680, 1080, 820), radius=10)
    label(d, 120, 590, "PUBLIC DECISIONS PAGE CAPTURE", fill=PURPLE, size=22)
    lines(d, 120, 638, "A direct worker call reached the core.", size=35, fill=INK)
    box(d, (1270, 320, 1835, 751), fill=RED_LIGHT if stage else "#272333",
        outline=RED_LIGHT if stage else "#474052", radius=19)
    label(d, 1300, 354, "CORE RESULT", fill=RED if stage else "#A8A0B0", size=23)
    lines(d, 1295, 421, "MISSING", face=FONT_SERIF, size=75,
          fill=RED if stage else "#777183")
    lines(d, 1300, 548, "Payment: absent\nProvider payout: 0", face=FONT_MONO, size=34,
          fill=INK if stage else "#7A7484", line_height=49)
    chip(d, 1300, 679, "GAS STILL APPLIES", bg=WHITE if stage else "#332E3C", fg=RED if stage else "#867D91", size=19)
    label(d, 255, 818, "Executed FINAL transaction 9HXL…1GQWD · distinct from model A preview", fill="#C2BDCA", size=20)
    return im


def retry(stage: int) -> Image.Image:
    im, d = base(7, eyebrow="SEPARATE DIRECT TEST / NOT THE MODEL PURCHASE")
    lines(d, 88, 177, "One ID. One provider payout.", face=FONT_SERIF, size=82)
    box(d, (92, 304, 883, 767), fill=GREEN_LIGHT, outline=GREEN_LIGHT, radius=20)
    label(d, 126, 344, "R4-17 / DIRECT PURCHASE", fill=GREEN, size=26)
    lines(d, 122, 412, "0.002 NEAR", face=FONT_SERIF, size=60)
    label(d, 126, 490, "TO PROVIDER B", fill=GREEN, size=22)
    lines(d, 126, 535, "Payment ID\nvhPJ…BCniU=", face=FONT_MONO, size=29, line_height=53)
    chip(d, 126, 678, "SETTLED", bg=WHITE, fg=GREEN, size=25)
    lines(d, 921, 480, "→", face=FONT_SANS, size=76, fill=PURPLE)
    box(d, (1037, 304, 1828, 767), fill=PURPLE_LIGHT if stage else WHITE,
        outline=PURPLE_LIGHT if stage else LINE, radius=20)
    label(d, 1071, 344, "R4-18 / EXACT RETRY", fill=PURPLE if stage else MUTED, size=26)
    lines(d, 1067, 412, "duplicate: true", face=FONT_SERIF, size=57,
          fill=INK if stage else "#A09CA5")
    lines(d, 1071, 531, "Same ID + quote + credential", face=FONT_MONO, size=27,
          fill=INK if stage else "#A09CA5")
    chip(d, 1071, 678, "0 NEW PROVIDER TRANSFERS", bg=WHITE, fg=PURPLE if stage else MUTED, size=22)
    label(d, 255, 818, "Public r4 direct-call proof · retry payment ID vhPJ…, not model ID ZIu51…", size=20)
    return im


def close(stage: int) -> Image.Image:
    im, d = base(8, dark=True, eyebrow="NATIVE NEAR TESTNET / PROOF AND QUICKSTART")
    source = Image.open(REPO / "web/public/media/agenttrust-hero-poster.png").convert("RGB")
    source = ImageOps.fit(source, (W, 680), Image.Resampling.LANCZOS)
    wash = Image.new("RGB", (W, 680), "#11101A")
    im.paste(Image.blend(source, wash, 0.84), (0, 165))
    d = ImageDraw.Draw(im)
    lines(d, 90, 190, "Trust has to survive\nthe transaction.", face=FONT_SERIF, size=89,
          fill=WHITE, line_height=110)
    lines(d, 95, 438, "Owner rules. Contract enforcement. Checked output.", size=44, fill="#E6E0F8")
    if stage >= 1:
        chip(d, 95, 531, "LOCAL MODEL + MCP", bg="#302748", fg=WHITE, size=22)
        chip(d, 455, 531, "PROJECT-OPERATED PROVIDERS + ISSUER", bg="#302748", fg=WHITE, size=22)
        chip(d, 1250, 531, "REUSED UI / NEW NEAR FLOW", bg="#302748", fg=WHITE, size=22)
        box(d, (92, 622, 1832, 781), fill=WHITE, outline=WHITE, radius=20)
        label(d, 122, 644, "DATED EVIDENCE + QUICKSTART", fill=PURPLE, size=22)
        lines(d, 118, 675, "docs.agenttrust.tech/verification/testnet-r4", face=FONT_MONO, size=50, fill=INK)
        if stage >= 2:
            lines(d, 118, 730, "docs.agenttrust.tech/quickstart", face=FONT_MONO, size=34, fill=MUTED)
    label(d, 255, 818, "Open limit: one refund-order runtime case · website/docs live read-only", fill="#C8C3D4", size=20)
    return im


def scene_images() -> list[list[Image.Image]]:
    return [
        [opening(0), opening(1)],
        [owner(0), owner(1)],
        [preview(0), preview(1)],
        [purchase(0), purchase(1), purchase(2)],
        [report(0), report(1)],
        [direct_refusal(0), direct_refusal(1)],
        [retry(0), retry(1)],
        [close(0), close(1), close(2)],
    ]


def clip_frames(name: str) -> list[Path]:
    source = ROOT / f"assets/decisions-{name}-2026-11-13.webm"
    destination = ROOT / f"work/clip-{name}"
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(source),
                    "-vf", f"fps={FPS}", "-q:v", "3", str(destination / "frame-%04d.jpg")], check=True)
    frames = sorted(destination.glob("frame-*.jpg"))
    if len(frames) < FPS * 6:
        raise ValueError(f"short public Decisions capture: {source}")
    return frames


def browser_frame(base_image: Image.Image, frame_path: Path, scene_index: int) -> Image.Image:
    image = base_image.copy()
    source = Image.open(frame_path).convert("RGB")
    crop = (0, 260, 1920, 790) if scene_index == 3 else (0, 280, 1920, 770)
    target = (90, 307, 1830, 780) if scene_index == 3 else (88, 320, 1832, 751)
    source = ImageOps.fit(source.crop(crop), (target[2] - target[0], target[3] - target[1]),
                          Image.Resampling.LANCZOS)
    image.paste(source, (target[0], target[1]))
    ImageDraw.Draw(image).rounded_rectangle(target, radius=12, outline=PURPLE, width=3)
    return image


def captions(scene: dict) -> list[tuple[float, float, str]]:
    text = scene["text"].replace("`", "")
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    ends = CUE_ENDS[str(scene["scene"])]
    if len(ends) != len(sentences) or abs(ends[-1] - scene["end"]) > 0.25:
        raise ValueError(f"caption cues are stale for scene {scene['scene']}")
    starts = [scene["start"], *ends[:-1]]
    return list(zip(starts, ends, sentences))


def caption_image(text: str) -> Image.Image:
    image = Image.new("RGBA", (W, 210), (18, 17, 29, 255))
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, W, 5), fill=PURPLE)
    d.rectangle((70, 34, 78, 166), fill=PURPLE)
    end = lines(d, 105, 34, text, size=49, fill=WHITE, max_width=1695, line_height=63)
    if end > 184:
        raise ValueError(f"caption too long: {text}")
    return image


def frame_at(t: float, timing: dict, stages: list[list[Image.Image]],
             clips: dict[int, list[Path]], caption_cache: dict[str, Image.Image]) -> Image.Image:
    scenes = timing["scenes"]
    index = 0
    for i, scene in enumerate(scenes):
        if t >= scene["start"]:
            index = i
    scene = scenes[index]
    relative = max(0.0, min(scene["duration"], t - scene["start"]))
    variants = stages[index]
    thresholds = {0: [0.0, 0.48], 1: [0.0, 0.58], 2: [0.0, 0.59],
                  3: [0.0, 0.34, 0.54], 4: [0.0, 0.37], 5: [0.0, 0.49],
                  6: [0.0, 0.48], 7: [0.0, 0.35, 0.70]}[index]
    current = 0
    for i, threshold in enumerate(thresholds):
        if relative / max(scene["duration"], 0.001) >= threshold:
            current = i
    base_image = variants[current]
    if current > 0:
        transition_time = thresholds[current] * scene["duration"]
        blend = min(1.0, max(0.0, (relative - transition_time) / 0.28))
        if blend < 1.0:
            base_image = Image.blend(variants[current - 1], variants[current], blend)
    if index > 0 and relative < 0.35:
        blend = max(0.0, min(1.0, relative / 0.35))
        base_image = Image.blend(stages[index - 1][-1], base_image, blend)
    if index in clips:
        window = (0.31, 0.54) if index == 3 else (0.27, 0.59)
        start, end = (fraction * scene["duration"] for fraction in window)
        if start <= relative < end:
            clip_time = 0.85 + relative - start
            frames = clips[index]
            frame_number = min(len(frames) - 1, int(clip_time * FPS))
            live = browser_frame(base_image, frames[frame_number], index)
            if index == 3 and end - relative < 0.28:
                base_image = Image.blend(live, stages[index][-1], 1 - (end - relative) / 0.28)
            else:
                blend = min(1.0, (relative - start) / 0.24, (end - relative) / 0.24)
                base_image = Image.blend(base_image, live, max(0.0, blend))
        elif index == 3 and relative >= end:
            base_image = stages[index][-1]
    frame = base_image.copy()
    phrase = captions(scene)[-1][2]
    for start, end, sentence in captions(scene):
        if t < end:
            phrase = sentence
            break
    if phrase not in caption_cache:
        caption_cache[phrase] = caption_image(phrase)
    frame.paste(caption_cache[phrase].convert("RGB"), (0, 870))
    d = ImageDraw.Draw(frame)
    d.rectangle((0, 1072, round(W * min(1.0, t / timing["duration"])), 1080), fill=PURPLE)
    return frame


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stills-only", action="store_true", help="write scene cards without encoding video")
    parser.add_argument("--output", type=Path, default=ROOT / "final/agenttrust-near-demo.mp4")
    args = parser.parse_args()
    timing = json.loads((ROOT / "voice/timing.json").read_text(encoding="utf-8"))
    if timing["duration"] >= 140:
        raise ValueError("video duration would exceed X's non-Premium limit")
    stages = scene_images()
    still_dir = ROOT / "work/scenes"
    still_dir.mkdir(parents=True, exist_ok=True)
    for index, variants in enumerate(stages, start=1):
        for stage, image in enumerate(variants):
            image.save(still_dir / f"scene-{index:02d}-stage-{stage}.png", optimize=True)
    if args.stills_only:
        print(f"wrote {sum(map(len, stages))} scene cards")
        return
    clips = {3: clip_frames("model-b"), 5: clip_frames("direct-a")}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
           "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
           "-i", str(ROOT / "voice/narration.wav"), "-c:v", "libx264", "-preset", "medium",
           "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac",
           "-b:a", "192k", "-ar", "48000", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
           "-movflags", "+faststart", "-shortest", str(args.output)]
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    if process.stdin is None:
        raise RuntimeError("ffmpeg stdin unavailable")
    caption_cache: dict[str, Image.Image] = {}
    count = math.ceil(timing["duration"] * FPS)
    try:
        for number in range(count):
            frame = frame_at(number / FPS, timing, stages, clips, caption_cache)
            process.stdin.write(frame.tobytes())
            if number % (FPS * 10) == 0:
                print(f"rendering {number / FPS:.0f}s / {timing['duration']:.1f}s", flush=True)
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg encode failed")
    print(args.output)


if __name__ == "__main__":
    main()
