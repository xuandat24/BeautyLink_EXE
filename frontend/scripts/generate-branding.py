"""Extract original logo pixels through a hand-traced alpha mask; requires Pillow.
Run: python frontend/scripts/generate-branding.py
Paths are masks in source coordinates, NOT replacement vector artwork.
"""
from pathlib import Path
import re
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PATHS = [
    """M596 140 L856 140 C951 137 1008 179 1007 256 C1008 320 966 344 918 357
    C985 365 1032 409 1032 481 C1031 558 978 607 876 607 L588 607 L588 592
    C615 594 636 582 636 555 L636 510 C634 454 668 418 727 374
    C775 340 812 296 815 255 C818 234 804 212 798 207
    C824 233 839 265 830 298 C824 316 838 317 847 305
    C847 321 838 322 830 318 C831 329 848 349 857 357
    C865 363 867 371 852 378 C840 382 837 385 841 393
    C847 401 848 408 838 412 L826 413 C836 416 841 421 838 428
    C836 435 828 432 824 436 C816 442 828 461 819 471
    C811 485 796 481 779 477 L749 468 C714 457 689 470 690 506
    C690 557 732 586 796 588 C874 596 941 550 946 487
    C950 428 926 394 881 376 L878 350 C914 336 933 302 934 267
    C937 201 895 161 821 162 L737 162 C731 164 737 187 736 205
    C736 258 695 301 642 328 L642 189 C642 167 632 155 596 155 Z""",
    """M752 184 C796 221 776 265 742 302 C710 338 656 368 621 410
    C598 438 605 481 623 528 C596 515 581 495 579 467
    C568 421 616 376 660 347 C710 311 742 270 752 227
    C759 209 756 194 752 184 Z""",
    """M785 194 C818 224 811 263 790 297 C764 338 703 376 664 415
    C626 453 626 491 623 528 C611 505 614 477 622 451
    C634 410 680 376 726 341 C776 301 805 247 785 194 Z""",
    """M731 159 C724 171 732 193 726 217 C720 253 695 283 651 314
    C609 345 571 375 564 409 C556 440 566 467 577 484
    C569 457 570 435 579 414 C592 380 631 354 673 322
    C716 290 743 252 743 215 C743 192 734 175 731 159 Z""",
]

def polygon(path):
    tokens = re.findall(r"[MLCZ]|-?\d+(?:\.\d+)?", path)
    points, position, i = [], (0.0, 0.0), 0
    while i < len(tokens):
        command = tokens[i]; i += 1
        if command == "Z": break
        count = 6 if command == "C" else 2
        values = list(map(float, tokens[i:i + count])); i += count
        if command in ("M", "L"):
            position = tuple(values); points.append(position)
        else:
            x0, y0 = position
            x1, y1, x2, y2, x3, y3 = values
            for step in range(1, 81):
                t = step / 80; u = 1 - t
                points.append((u**3*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t**3*x3,
                               u**3*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t**3*y3))
            position = (x3, y3)
    return points

def main():
    image = Image.open(ROOT / "branding/logo-source.png").convert("RGBA")
    if image.size != (1586, 992): raise ValueError("Mask requires original 1586x992 source")
    mask = Image.new("L", (image.width * 4, image.height * 4))
    draw = ImageDraw.Draw(mask)
    for path in PATHS:
        draw.polygon([(round(x * 4), round(y * 4)) for x, y in polygon(path)], fill=255)
    image.putalpha(mask.resize(image.size, Image.Resampling.LANCZOS))
    symbol = image.crop((550, 130, 1042, 617))
    canvas = Image.new("RGBA", (544, 544))
    canvas.alpha_composite(symbol, ((544 - symbol.width) // 2, (544 - symbol.height) // 2))
    assets = {"beautylink-icon.png": 544, "favicon-16x16.png": 16, "favicon-32x32.png": 32,
              "apple-touch-icon.png": 180, "android-chrome-192x192.png": 192, "android-chrome-512x512.png": 512}
    out = ROOT / "public"
    for filename, size in assets.items():
        canvas.resize((size, size), Image.Resampling.LANCZOS).save(out / filename)
    canvas.save(out / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    sheet = Image.new("RGB", (650, 260), "#ffffff")
    for index, bg in enumerate(("#ffffff", "#142033")):
        preview = Image.new("RGBA", (240, 240), bg)
        preview.alpha_composite(canvas.resize((220, 220), Image.Resampling.LANCZOS), (10, 10))
        sheet.paste(preview.convert("RGB"), (index * 250, 0))
    for i, size in enumerate((16, 32, 48)):
        small = canvas.resize((size, size), Image.Resampling.LANCZOS)
        sheet.paste(small, (510, i * 70 + 10), small)
    sheet.save(ROOT / "branding/icon-review.png")
    print("Generated source-derived PNGs and ICO 16/32/48")

if __name__ == "__main__": main()
