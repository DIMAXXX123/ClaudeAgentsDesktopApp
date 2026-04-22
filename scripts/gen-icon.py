"""Generate ULTRONOS cyberpunk icon (.ico + .png) from scratch."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).parent.parent / "resources"
OUT.mkdir(parents=True, exist_ok=True)

def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background: dark navy gradient-ish square with rounded corners
    bg_dark = (5, 7, 13, 255)
    bg_mid = (12, 8, 40, 255)
    radius = max(2, size // 8)

    # Rounded rect bg
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg_mid)

    # Cyan outer glow ring
    ring_w = max(1, size // 48)
    d.rounded_rectangle(
        [ring_w, ring_w, size - 1 - ring_w, size - 1 - ring_w],
        radius=radius - 1,
        outline=(6, 182, 212, 255),
        width=ring_w,
    )

    # Inner triangle (▲ ULTRONOS emblem) — neon cyan
    cx = size / 2
    cy = size / 2
    tri_h = size * 0.5
    tri_w = size * 0.55
    pts = [
        (cx, cy - tri_h / 2),
        (cx - tri_w / 2, cy + tri_h / 2),
        (cx + tri_w / 2, cy + tri_h / 2),
    ]
    # Glow layers
    for offset, alpha in [(4, 40), (2, 80), (0, 255)]:
        col = (6, 182, 212, alpha)
        if offset:
            scaled = [(p[0], p[1]) for p in pts]
            d.polygon(scaled, outline=col)
        else:
            d.polygon(pts, outline=col, width=max(1, size // 40))

    # Inner dot (core)
    dot_r = max(2, size // 16)
    d.ellipse(
        [cx - dot_r, cy + tri_h / 6 - dot_r, cx + dot_r, cy + tri_h / 6 + dot_r],
        fill=(245, 66, 200, 255),
    )

    # Scanlines on bottom — subtle horizontal lines
    for y in range(int(cy + tri_h / 2) + size // 20, size - ring_w * 2, max(2, size // 32)):
        d.line([(ring_w * 2, y), (size - ring_w * 2, y)], fill=(6, 182, 212, 50), width=1)

    return img

# Generate PNG (256) and ICO (multi-size)
sizes = [16, 32, 48, 64, 128, 256]
images = {s: draw_icon(s) for s in sizes}

images[256].save(OUT / "icon.png", format="PNG")
images[256].save(
    OUT / "icon.ico",
    format="ICO",
    sizes=[(s, s) for s in sizes],
    append_images=[images[s] for s in sizes if s != 256],
)

# Tray icon (32x32)
images[32].save(OUT / "tray-icon.png", format="PNG")

print(f"wrote: {OUT / 'icon.ico'}")
print(f"wrote: {OUT / 'icon.png'}")
print(f"wrote: {OUT / 'tray-icon.png'}")
