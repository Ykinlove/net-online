import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
CH = os.path.join(BASE, '..', 'miniprogram', 'images', 'preset', 'char')
ids = ['01', '02', '03', '04', '05', '08', '09', '10', '12', '14']

def font(sz):
    for p in ['C:/Windows/Fonts/msyh.ttc']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()

# 上面一行：大图 (200px)；下面一行：真实格子尺寸 (92px)
BIG, SMALL, GAP = 200, 92, 14
W = 60 + 5 * (BIG + GAP) + 40
H = 60 + BIG + 170 + SMALL + 60
canvas = Image.new('RGB', (W, H), (220, 234, 246))
d = ImageDraw.Draw(canvas)
d.text((60, 18), '抠图后效果 · 上为大图，下为小程序里 92rpx 真实显示大小', font=font(26), fill=(44, 62, 80))

for i, k in enumerate(ids):
    im = Image.open(os.path.join(CH, 'character_%s.png' % k)).convert('RGBA')
    r, c = divmod(i, 5)
    x = 60 + c * (BIG + GAP)
    y = 60 + r * (BIG + GAP + 60)
    box = BIG if r == 0 else SMALL
    d.rectangle([x, y, x + box, y + box], fill=(242, 248, 253),
                outline=(194, 212, 227) if i < 5 else (201, 164, 85), width=3)
    t = im.copy()
    t.thumbnail((box - 6, box - 6), Image.LANCZOS)
    canvas.paste(t, (x + (box - t.width) // 2, y + (box - t.height) // 2), t)
    d.text((x + 2, y + box + 6), '%s %s' % (k, '免费' if i < 5 else '付费'),
           font=font(19), fill=(110, 130, 150))

out = os.path.join(BASE, 'verify10.png')
canvas.save(out)
print('ok', out, canvas.size)
