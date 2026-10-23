# Перерисовка брендовых ассетов форка из symbol.svg / logo.svg.
# Запуск после каждого мержа апстрима: python3 -I tnp/brand/build-assets.py (из корня форка).
# Файлы пишутся поверх апстримных с теми же именами и размерами — код UI не трогаем.
import os, subprocess, io, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BRAND = os.path.join(ROOT, 'tnp', 'brand')
IMG = os.path.join(ROOT, 'assets', 'images')
BG = (0, 0, 0, 255)

def svg(name, w, h):
    png = subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), os.path.join(BRAND, name)],
                         check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(png)).convert('RGBA')

def on_canvas(size, frac, bg=None, alpha=255):
    w, h = size
    s = int(min(w, h) * frac)
    sym = svg('symbol.svg', s, s)
    if alpha < 255:
        sym.putalpha(sym.getchannel('A').point(lambda a: a * alpha // 255))
    out = Image.new('RGBA', size, bg or (0, 0, 0, 0))
    out.alpha_composite(sym, ((w - s) // 2, (h - s) // 2))
    return out

def save(img, rel):
    path = os.path.join(IMG, rel)
    if path.endswith('.jpg'):
        img.convert('RGB').save(path, quality=88)
    else:
        img.save(path)

# знак без фона
for rel, n in [('stremio_symbol.png', 256), ('icon.png', 512), ('icon_196x196.png', 196), ('icon_512x512.png', 512)]:
    save(svg('symbol.svg', n, n), rel)
# maskable: знак в безопасной зоне 80% на фоне
for rel, n in [('maskable_icon.png', 512), ('maskable_icon_196x196.png', 196), ('maskable_icon_512x512.png', 512)]:
    save(on_canvas((n, n), 0.6, BG), rel)
# monochrome: белый силуэт по альфе знака
m = svg('symbol.svg', 512, 512)
save(Image.merge('RGBA', (*[Image.new('L', m.size, 255)] * 3, m.getchannel('A'))), 'monochrome_icon_512x512.png')
save(svg('logo.svg', 670, 195), 'logo.png')
# аватар без аккаунта и заглушки пустых экранов (у апстрима — маскот Stremio)
for rel in ['anonymous.png', 'default_avatar.png']:
    w, h = Image.open(os.path.join(IMG, rel)).size
    av = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(av)
    d.ellipse((0, 0, w - 1, h - 1), fill=(42, 42, 58, 255))
    d.ellipse((w * .34, h * .2, w * .66, h * .52), fill=(99, 102, 241, 255))
    d.chord((w * .18, h * .58, w * .82, h * 1.18), 180, 360, fill=(99, 102, 241, 255))
    save(av, rel)
for rel in ['empty.png', 'library_placeholder.png', 'calendar_placeholder.png']:
    save(on_canvas(Image.open(os.path.join(IMG, rel)).size, 0.5, alpha=110), rel)
# экраны запуска PWA: знак по центру на чёрном
for f in sorted(os.listdir(os.path.join(IMG, 'splash'))):
    rel = os.path.join('splash', f)
    save(on_canvas(Image.open(os.path.join(IMG, rel)).size, 0.32, BG), rel)
# favicon
svg('symbol.svg', 256, 256).save(os.path.join(ROOT, 'assets', 'favicons', 'favicon.ico'),
                                  sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
print('ok')
