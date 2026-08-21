#!/usr/bin/env python3
"""Generate cinematic grainy organic mesh-gradient chapter covers.

Produces 16:9 WebP stills that match the approved Mentorship look:
dark bases, silk-like folds, glass highlights, film grain — not CSS blobs.

Re-run:
  python3 scripts/generate-chapter-covers.py

Keep the written slugs in sync with MESH_COVER_SLUGS in lib/chapter-covers.ts.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "covers" / "chapters"

WIDTH = 960
HEIGHT = 540

# Approved palettes: teal/dusk/ice/forest/violet/champagne/crimson/cobalt
# Each stop is (t, r, g, b) in 0-1, darkest → luminous highlight.
PALETTES: list[dict] = [
    {
        "id": "teal",
        "stops": [
            (0.00, 0.012, 0.016, 0.035),
            (0.22, 0.035, 0.055, 0.14),
            (0.42, 0.05, 0.12, 0.32),
            (0.58, 0.04, 0.32, 0.48),
            (0.74, 0.08, 0.72, 0.78),
            (0.90, 0.55, 0.92, 0.95),
            (1.00, 0.82, 0.97, 0.99),
        ],
        "accent": (0.28, 0.12, 0.42),
        "accent_pos": (0.18, 0.82),
    },
    {
        "id": "dusk",
        "stops": [
            (0.00, 0.02, 0.012, 0.04),
            (0.22, 0.10, 0.04, 0.16),
            (0.42, 0.32, 0.06, 0.22),
            (0.60, 0.62, 0.14, 0.28),
            (0.76, 0.90, 0.38, 0.16),
            (0.90, 0.98, 0.58, 0.22),
            (1.00, 1.00, 0.78, 0.42),
        ],
        "accent": (0.42, 0.08, 0.38),
        "accent_pos": (0.78, 0.72),
    },
    {
        "id": "ice",
        "stops": [
            (0.00, 0.04, 0.055, 0.12),
            (0.24, 0.10, 0.14, 0.32),
            (0.44, 0.32, 0.30, 0.58),
            (0.60, 0.55, 0.52, 0.78),
            (0.76, 0.62, 0.78, 0.95),
            (0.90, 0.86, 0.92, 0.99),
            (1.00, 0.97, 0.98, 1.00),
        ],
        "accent": (0.22, 0.18, 0.48),
        "accent_pos": (0.82, 0.78),
    },
    {
        "id": "forest",
        "stops": [
            (0.00, 0.012, 0.025, 0.012),
            (0.22, 0.04, 0.12, 0.05),
            (0.40, 0.10, 0.28, 0.08),
            (0.56, 0.38, 0.55, 0.08),
            (0.70, 0.72, 0.82, 0.16),
            (0.84, 0.92, 0.55, 0.12),
            (1.00, 0.82, 0.18, 0.10),
        ],
        "accent": (0.72, 0.16, 0.08),
        "accent_pos": (0.86, 0.78),
    },
    {
        "id": "violet",
        "stops": [
            (0.00, 0.015, 0.008, 0.03),
            (0.22, 0.10, 0.04, 0.22),
            (0.42, 0.32, 0.08, 0.52),
            (0.58, 0.58, 0.12, 0.72),
            (0.74, 0.86, 0.22, 0.62),
            (0.88, 0.95, 0.38, 0.72),
            (1.00, 0.98, 0.72, 0.88),
        ],
        "accent": (0.12, 0.22, 0.62),
        "accent_pos": (0.48, 0.55),
    },
    {
        "id": "champagne",
        "stops": [
            (0.00, 0.03, 0.025, 0.022),
            (0.24, 0.10, 0.07, 0.06),
            (0.44, 0.32, 0.18, 0.16),
            (0.60, 0.55, 0.32, 0.28),
            (0.74, 0.72, 0.48, 0.40),
            (0.88, 0.90, 0.78, 0.64),
            (1.00, 0.97, 0.92, 0.82),
        ],
        "accent": (0.42, 0.22, 0.20),
        "accent_pos": (0.70, 0.80),
    },
    {
        "id": "crimson",
        "stops": [
            (0.00, 0.03, 0.01, 0.01),
            (0.22, 0.14, 0.03, 0.04),
            (0.42, 0.42, 0.06, 0.08),
            (0.58, 0.68, 0.10, 0.10),
            (0.74, 0.90, 0.28, 0.10),
            (0.88, 0.98, 0.55, 0.16),
            (1.00, 1.00, 0.82, 0.32),
        ],
        "accent": (0.22, 0.04, 0.04),
        "accent_pos": (0.16, 0.78),
    },
    {
        "id": "cobalt",
        "stops": [
            (0.00, 0.012, 0.02, 0.05),
            (0.24, 0.03, 0.08, 0.18),
            (0.44, 0.06, 0.22, 0.48),
            (0.60, 0.10, 0.42, 0.72),
            (0.76, 0.42, 0.72, 0.92),
            (0.90, 0.78, 0.90, 0.98),
            (1.00, 0.94, 0.97, 1.00),
        ],
        "accent": (0.04, 0.08, 0.22),
        "accent_pos": (0.82, 0.72),
    },
]

# Six compositions per palette so future chapters stay visually distinct.
# Large silk folds (low freq) — not microscopic marble cells.
VARIANTS = [
    {"angle": 0.08, "freq": 0.72, "warp": 0.28, "glow": (0.22, 0.28), "phase": 0.35, "amp": 1.02, "mound": (0.68, 0.42)},
    {"angle": -0.42, "freq": 0.58, "warp": 0.34, "glow": (0.78, 0.22), "phase": 1.55, "amp": 0.96, "mound": (0.32, 0.62)},
    {"angle": 0.55, "freq": 0.85, "warp": 0.24, "glow": (0.50, 0.58), "phase": 2.70, "amp": 1.08, "mound": (0.18, 0.30)},
    {"angle": -0.88, "freq": 0.64, "warp": 0.32, "glow": (0.16, 0.70), "phase": 4.05, "amp": 0.92, "mound": (0.82, 0.38)},
    {"angle": 1.12, "freq": 0.78, "warp": 0.38, "glow": (0.86, 0.52), "phase": 0.90, "amp": 1.05, "mound": (0.42, 0.78)},
    {"angle": 0.22, "freq": 0.50, "warp": 0.30, "glow": (0.62, 0.16), "phase": 3.40, "amp": 0.98, "mound": (0.28, 0.48)},
]


def _hash_seed(text: str) -> int:
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _smooth_field(shape: tuple[int, int], scale: int, rng: np.random.Generator) -> np.ndarray:
    h, w = shape
    sh = max(2, h // scale)
    sw = max(2, w // scale)
    small = rng.standard_normal((sh, sw)).astype(np.float32)
    img = Image.fromarray(small, mode="F")
    return np.asarray(img.resize((w, h), Image.Resampling.BICUBIC), dtype=np.float32)


def _fbm(shape: tuple[int, int], rng: np.random.Generator, octaves: int = 4, base: int = 14) -> np.ndarray:
    field = np.zeros(shape, dtype=np.float32)
    amp = 1.0
    total = 0.0
    scale = base
    for _ in range(octaves):
        field += amp * _smooth_field(shape, scale, rng)
        total += amp
        amp *= 0.52
        scale = max(3, int(scale * 0.52))
    field /= total
    # normalize to ~[-1, 1]
    field -= field.mean()
    std = float(field.std()) or 1.0
    return field / (std * 1.6)


def _lerp_palette(t: np.ndarray, stops: list[tuple[float, float, float, float]]) -> np.ndarray:
    t = np.clip(t, 0.0, 1.0)
    rgb = np.zeros(t.shape + (3,), dtype=np.float32)
    for i in range(len(stops) - 1):
        t0, r0, g0, b0 = stops[i]
        t1, r1, g1, b1 = stops[i + 1]
        mask = (t >= t0) & (t <= t1 if i == len(stops) - 2 else t < t1)
        u = np.zeros_like(t)
        span = max(t1 - t0, 1e-6)
        u[mask] = (t[mask] - t0) / span
        # smoothstep for silkier blends
        u = u * u * (3.0 - 2.0 * u)
        rgb[..., 0] += mask * (r0 + (r1 - r0) * u)
        rgb[..., 1] += mask * (g0 + (g1 - g0) * u)
        rgb[..., 2] += mask * (b0 + (b1 - b0) * u)
    return rgb


def render_cover(palette: dict, variant: dict, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    h, w = HEIGHT, WIDTH
    yy, xx = np.mgrid[0:h, 0:w]
    x = xx.astype(np.float32) / (w - 1)
    y = yy.astype(np.float32) / (h - 1)

    # Low-frequency warp only — large silk, not cellular marble.
    n1 = _fbm((h, w), rng, octaves=3, base=96)
    n2 = _fbm((h, w), rng, octaves=3, base=110)
    n3 = _fbm((h, w), rng, octaves=2, base=140)
    n4 = _fbm((h, w), rng, octaves=2, base=120)

    warp = variant["warp"]
    x2 = x + warp * n1
    y2 = y + warp * n2
    x3 = x2 + warp * 0.35 * n3
    y3 = y2 + warp * 0.35 * n4

    angle = variant["angle"]
    ca, sa = math.cos(angle), math.sin(angle)
    u = x3 * ca + y3 * sa
    v = -x3 * sa + y3 * ca

    freq = variant["freq"]
    phase = variant["phase"]
    # Two broad luminous ridges with a dark valley — liquid-silk S-curve.
    wave_a = np.sin((u * freq + v * 0.18) * math.tau + phase)
    wave_b = np.sin((u * (freq * 0.45) - v * 0.22) * math.tau + phase + 1.3)
    folds = 0.55 * wave_a + 0.45 * wave_b
    folds = folds * 0.5 + 0.5

    mx, my = variant["mound"]
    mound = np.exp(-((x3 - mx) ** 2 * 3.2 + (y3 - my) ** 2 * 4.6))
    envelope = 0.5 + 0.5 * np.tanh(n3 * 0.9)
    height = np.clip(folds * 0.62 + mound * 0.28 + envelope * 0.18, 0.0, 1.0)
    height = np.clip(height * variant["amp"], 0.0, 1.0)

    # Smooth the height so color bands read as silk, not contour lines.
    height = np.asarray(
        Image.fromarray(height, mode="F").resize(
            (max(2, w // 2), max(2, h // 2)), Image.Resampling.BICUBIC
        ).resize((w, h), Image.Resampling.BICUBIC),
        dtype=np.float32,
    )

    valley = np.clip(height * 1.12 - 0.04, 0.0, 1.0)
    rgb = _lerp_palette(valley, palette["stops"])

    ax, ay = palette["accent_pos"]
    accent_dist = np.sqrt((x3 - ax) ** 2 + (y3 - ay) ** 2 * 0.75)
    accent_mask = np.clip(1.0 - accent_dist / 0.62, 0.0, 1.0) ** 1.8
    accent = np.array(palette["accent"], dtype=np.float32)
    rgb = rgb * (1.0 - accent_mask[..., None] * 0.32) + accent * (accent_mask[..., None] * 0.32)

    gx, gy = variant["glow"]
    glow_dist = np.sqrt((x3 - gx) ** 2 * 0.7 + (y3 - gy) ** 2 * 1.05)
    glow = np.clip(1.0 - glow_dist / 0.72, 0.0, 1.0) ** 1.35
    highlight = _lerp_palette(np.clip(valley + 0.18, 0.0, 1.0), palette["stops"])
    rgb = rgb + highlight * (glow[..., None] * 0.38)

    # Broad glass caustics along the silk crests — not high-frequency rims.
    gy_grad, gx_grad = np.gradient(height)
    slope = np.sqrt(gx_grad ** 2 + gy_grad ** 2)
    crest = np.clip((height - 0.52) / 0.48, 0.0, 1.0)
    crest = crest * crest
    rim = np.clip(slope * 9.0, 0.0, 1.0)
    rim = np.asarray(
        Image.fromarray(rim, mode="F").resize(
            (max(2, w // 6), max(2, h // 6)), Image.Resampling.BICUBIC
        ).resize((w, h), Image.Resampling.BICUBIC),
        dtype=np.float32,
    )
    glass = np.clip(crest * 0.7 + rim * 0.45, 0.0, 1.0) * (0.4 + 0.6 * glow)
    rgb = rgb + glass[..., None] * 0.28
    rgb = rgb + (crest * glow)[..., None] * np.array([0.16, 0.18, 0.22], dtype=np.float32)

    luma = rgb[..., 0] * 0.3 + rgb[..., 1] * 0.5 + rgb[..., 2] * 0.2
    hot = np.clip((luma - 0.48) / 0.52, 0.0, 1.0)
    bloom = np.asarray(
        Image.fromarray((hot * 255).astype(np.uint8), mode="L").resize(
            (max(2, w // 10), max(2, h // 10)), Image.Resampling.BILINEAR
        ).resize((w, h), Image.Resampling.BICUBIC),
        dtype=np.float32,
    ) / 255.0
    rgb = rgb + bloom[..., None] * 0.18

    vx = (x - 0.5) * 1.55
    vy = (y - 0.5) * 1.75
    vignette = np.clip(1.0 - (vx * vx + vy * vy) * 0.38, 0.16, 1.0)
    rgb *= vignette[..., None]

    rgb = np.clip((rgb - 0.02) * 1.05, 0.0, 1.0)

    # Fine photographic grain on top of smooth silk — not structural noise.
    grain = rng.standard_normal((h, w)).astype(np.float32) * (0.028 + 0.02 * luma)
    rgb = rgb + grain[..., None]
    sparkle = ((rng.random((h, w)) > 0.9985) & (hot > 0.35)).astype(np.float32) * 0.22
    rgb = rgb + sparkle[..., None]

    rgb = np.clip(rgb, 0.0, 1.0)
    return Image.fromarray((rgb * 255.0 + 0.5).astype(np.uint8), mode="RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog: list[str] = []
    for p_index, palette in enumerate(PALETTES):
        for v_index, variant in enumerate(VARIANTS, start=1):
            slug = f"{palette['id']}-{v_index:02d}"
            seed = _hash_seed(f"mentorship-cover:{slug}")
            img = render_cover(palette, variant, seed)
            path = OUT_DIR / f"{slug}.webp"
            img.save(path, format="WEBP", quality=86, method=6)
            catalog.append(slug)
            print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")

    print(f"generated {len(catalog)} covers")


if __name__ == "__main__":
    main()
