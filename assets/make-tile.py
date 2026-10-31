"""Compose the 180x180 market tile from the plugin's own icon language.

Same blue plate and twin chevrons as icon.svg, drawn at 4x and downsampled so
the strokes are anti-aliased. Kept in-repo so the storefront can point at a
GitHub-hosted raster instead of falling back to the owner avatar.
"""
from PIL import Image, ImageDraw

S = 4
SIZE = 180
BLUE = (43, 108, 176, 255)
WHITE = (255, 255, 255, 255)

canvas = Image.new("RGBA", (SIZE * S, SIZE * S), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle([0, 0, SIZE * S - 1, SIZE * S - 1], radius=40 * S, fill=BLUE)


def chevron(points, width):
    """Thick polyline with hand-rounded caps (PIL has no round line caps)."""
    px = [(x * S, y * S) for x, y in points]
    w = width * S
    draw.line(px, fill=WHITE, width=w, joint="curve")
    for x, y in (px[0], px[-1]):
        draw.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=WHITE)


chevron([(58, 78), (90, 46), (122, 78)], 14)   # up
chevron([(58, 102), (90, 134), (122, 102)], 14)  # down

canvas.resize((SIZE, SIZE), Image.LANCZOS).save(
    r"E:\code\plugin\dsh-answer-jump\assets\icon-180.png"
)
print("written")
