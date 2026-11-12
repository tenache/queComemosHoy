"""Draws the app icons (plate, fork and knife on the app's gradient).

Run from the repo root:  python tools/make_icons.py   (needs Pillow)
"""
from PIL import Image, ImageDraw

A, B = (255, 170, 60), (235, 70, 70)
WHITE, RIM = (255, 250, 244), (240, 222, 205)


def make(size, pad, path):
    s = size * 4  # draw big, then shrink for smooth edges
    img = Image.new("RGB", (s, s))
    px = img.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s - 2)
            px[x, y] = tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))
    d = ImageDraw.Draw(img)
    u = s * (1 - 2 * pad) / 100  # 100 units across the safe area
    ox = oy = s * pad

    def box(x0, y0, x1, y1):
        return [ox + x0 * u, oy + y0 * u, ox + x1 * u, oy + y1 * u]

    # plate
    d.ellipse(box(24, 24, 76, 76), fill=WHITE)
    d.ellipse(box(32, 32, 68, 68), outline=RIM, width=round(2 * u))
    # fork: three tines, a neck and a handle
    for x in (6, 11, 16):
        d.rounded_rectangle(box(x, 22, x + 3, 44), radius=1.5 * u, fill=WHITE)
    d.rounded_rectangle(box(6, 38, 19, 48), radius=4 * u, fill=WHITE)
    d.rounded_rectangle(box(10.5, 44, 14.5, 80), radius=2 * u, fill=WHITE)
    # knife: blade and handle
    d.rounded_rectangle(box(82, 22, 90, 54), radius=4 * u, fill=WHITE)
    d.rounded_rectangle(box(84, 50, 88, 80), radius=2 * u, fill=WHITE)
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)


make(192, 0.10, "icons/icon-192.png")
make(512, 0.10, "icons/icon-512.png")
make(512, 0.20, "icons/icon-maskable-512.png")  # maskable: keep inside the safe zone
