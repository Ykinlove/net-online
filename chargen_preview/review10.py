import os, glob
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, 'raw')

def font(sz):
    for p in ['C:/Windows/Fonts/msyh.ttc']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()

ids = ['r01', 'r02', 'r03', 'r04', 'r05', 'r08', 'r09', 'r10', 'r12', 'r14']
labels = ['01 男 蹲着测线', '02 男 举线大笑', '03 女 回眸坏笑', '04 女 抱本偷看', '05 男 端详水晶头',
          '08 男 插兜抬下巴', '09 男 理领带', '10 女 耳麦通话', '12 男 翻光模块', '14 女 撩发挑眉']

CELL, GAP = 250, 14
COLS = 5
W = 50 + COLS * (CELL + GAP) + 30
H = 70 + 2 * (CELL + GAP + 34) + 40
canvas = Image.new('RGBA', (W, H), (234, 244, 251, 255))
d = ImageDraw.Draw(canvas)
d.text((50, 20), '10 个立绘重做版 · 姿势 / 表情逐个区分（前 5 免费，后 5 付费）', font=font(30), fill=(44, 62, 80, 255))

for i, key in enumerate(ids):
    files = glob.glob(os.path.join(RAW, key, '*.png'))
    files.sort(key=os.path.getmtime)
    if not files:
        continue
    im = Image.open(files[-1]).convert('RGBA')
    # 裁掉四周纯灰
    bg = im.getpixel((2, 2))
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            p = px[x, y]
            if abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) > 40:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if maxx > minx and maxy > miny:
        pad = 12
        im = im.crop((max(0, minx - pad), max(0, miny - pad), min(w, maxx + pad), min(h, maxy + pad)))

    r, c = divmod(i, COLS)
    x = 50 + c * (CELL + GAP)
    y = 70 + r * (CELL + GAP + 34)
    d.rectangle([x, y, x + CELL, y + CELL], fill=(242, 248, 253, 255),
                outline=(194, 212, 227, 255) if i < 5 else (201, 164, 85, 255), width=3)
    im.thumbnail((CELL - 8, CELL - 8), Image.LANCZOS)
    canvas.alpha_composite(im, (x + (CELL - im.width) // 2, y + (CELL - im.height) // 2))
    d.text((x + 4, y + CELL + 7), labels[i], font=font(21), fill=(110, 130, 150, 255))

out = os.path.join(BASE, 'review10.png')
canvas.convert('RGB').save(out)
print('ok', out, canvas.size)
