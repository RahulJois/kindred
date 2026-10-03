"""Draws Kindred's app icon set into assets/. Re-run after tweaking: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw

S = 4  # supersample, then downscale for smooth edges
N = 1024
C = N // 2

TERRACOTTA_LIGHT = (226, 140, 108)
TERRACOTTA_DARK = (196, 92, 62)
FACE = (190, 86, 58)
CREAM = (255, 246, 236)
GOLD = (242, 193, 78)
K = 0.88  # overall artwork scale inside the adaptive-icon safe zone


def canvas(color=(0, 0, 0, 0)):
    return Image.new("RGBA", (N * S, N * S), color)


def finish(img, size=N):
    return img.resize((size, size), Image.LANCZOS)


def rounded(d, cx, cy, half, radius, fill):
    d.rounded_rectangle(
        [(cx - half) * S, (cy - half) * S, (cx + half) * S, (cy + half) * S], radius=round(radius * S), fill=fill
    )


def face(d, cx, cy, fill):
    eye_r, eye_dx, eye_y = 34 * K, 82 * K, cy - 52 * K
    for ex in (cx - eye_dx, cx + eye_dx):
        d.ellipse([(ex - eye_r) * S, (eye_y - eye_r) * S, (ex + eye_r) * S, (eye_y + eye_r) * S], fill=fill)
    # Smile: a thick arc with round caps.
    r, w, scy = 118 * K, round(42 * K), cy + 2 * K
    box = [(cx - r) * S, (scy - r) * S, (cx + r) * S, (scy + r) * S]
    d.arc(box, start=28, end=152, fill=fill, width=w * S)
    import math
    for ang in (28, 152):
        a = math.radians(ang)
        px, py = cx + (r - w / 2) * math.cos(a), scy + (r - w / 2) * math.sin(a)
        d.ellipse([(px - w / 2) * S, (py - w / 2) * S, (px + w / 2) * S, (py + w / 2) * S], fill=fill)


def foreground(mono=False):
    img = canvas()
    d = ImageDraw.Draw(img)
    # Back tile: the next day, peeking out. Front tile: today, smiling.
    back = (255, 255, 255, 110) if mono else GOLD + (255,)
    rounded(d, C + 58 * K, C - 58 * K, 210 * K, 120 * K, back)
    front = (255, 255, 255, 255) if mono else CREAM + (255,)
    rounded(d, C - 26 * K, C + 26 * K, 228 * K, 128 * K, front)
    if mono:
        # Cut the face out of the tile so themed icons read as a silhouette.
        cut = canvas()
        face(ImageDraw.Draw(cut), C - 26 * K, C + 26 * K, (0, 0, 0, 255))
        alpha = img.getchannel("A")
        alpha.paste(0, mask=cut.getchannel("A"))
        img.putalpha(alpha)
    else:
        face(d, C - 26 * K, C + 26 * K, FACE + (255,))
    return img


def background():
    img = Image.new("RGBA", (N, N))
    px = img.load()
    for y in range(N):
        for x in range(N):
            t = (x + y) / (2 * (N - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(TERRACOTTA_LIGHT, TERRACOTTA_DARK)) + (255,)
    return img


bg = background()
fg = finish(foreground())
bg.save("assets/android-icon-background.png")
fg.save("assets/android-icon-foreground.png")
finish(foreground(mono=True)).save("assets/android-icon-monochrome.png")

legacy = bg.copy()
legacy.alpha_composite(fg)
legacy.convert("RGB").save("assets/icon.png")
fg.save("assets/splash-icon.png")
legacy.resize((48, 48), Image.LANCZOS).save("assets/favicon.png")
print("wrote icon set")
