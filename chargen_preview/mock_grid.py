# -*- coding: utf-8 -*-
"""按 750rpx 设计稿 1:1 模拟 chargen 页「选择形象」区块，用于改版前后视觉确认。"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
CH = os.path.join(BASE, '..', 'miniprogram', 'images', 'preset', 'char')

S = 2  # 2 倍渲染，看得清
IDS = ['character_01', 'character_02', 'character_03', 'character_04', 'character_05',
       'character_08', 'character_09', 'character_10', 'character_12', 'character_14']

PAGE_PAD = 24
CARD_PAD = 24
CARD_BORDER = 4
GAP = 12
CELL_H = 128
IMG_W, IMG_H = 106, 114


def font(sz, emoji=False):
    paths = ['C:/Windows/Fonts/seguiemj.ttf'] if emoji else ['C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc']
    for p in paths:
        try:
            return ImageFont.truetype(p, sz * S)
        except Exception:
            pass
    return ImageFont.load_default()


content_w = 750 - PAGE_PAD * 2 - CARD_PAD * 2 - CARD_BORDER * 2
cell_w = int((content_w - GAP * 4) / 5)

W = 750 * S
H = 520 * S
canvas = Image.new('RGB', (W, H), (234, 244, 251))
d = ImageDraw.Draw(canvas)


def draw_lock(cx_, cy_, k=1.0, color=(255, 255, 255)):
    """画一个白色挂锁图标，k 为缩放倍数，坐标单位 rpx"""
    bw, bh = 26 * k, 21 * k
    l, t = cx_ - bw / 2, cy_ - bh / 2 + 5 * k
    d.rounded_rectangle([l * S, t * S, (l + bw) * S, (t + bh) * S],
                        radius=4 * k * S, fill=color)
    sw = 15 * k
    d.arc([(cx_ - sw / 2) * S, (t - 13 * k) * S, (cx_ + sw / 2) * S, (t + 7 * k) * S],
          180, 360, fill=color, width=int(4 * k * S))
    d.ellipse([(cx_ - 3 * k) * S, (t + 7 * k) * S, (cx_ + 3 * k) * S, (t + 13 * k) * S],
              fill=(44, 62, 80, 255))


def rc(x, y, w, h, **kw):
    d.rectangle([x * S, y * S, (x + w) * S, (y + h) * S], **kw)


# 卡片外框
cx, cy = PAGE_PAD, 20
cw = 750 - PAGE_PAD * 2
ch = 40 + 56 + CELL_H * 2 + GAP + CARD_PAD * 2 + CARD_BORDER * 2
rc(cx + 4, cy + 8, cw, ch, fill=(215, 226, 236))          # 投影
rc(cx, cy, cw, ch, fill=(255, 253, 246), outline=(44, 62, 80), width=4 * S)

# 标题
d.text(((cx + CARD_BORDER + CARD_PAD) * S, (cy + CARD_PAD + 4) * S), '选择形象',
       font=font(28), fill=(44, 62, 80))
d.line([(cx + CARD_BORDER + CARD_PAD) * S, (cy + 62) * S,
        (cx + cw - CARD_BORDER - CARD_PAD) * S, (cy + 62) * S],
       fill=(217, 228, 238), width=3 * S)

gx = cx + CARD_BORDER + CARD_PAD
gy = cy + 76

for i, name in enumerate(IDS):
    r, c = divmod(i, 5)
    x = gx + c * (cell_w + GAP)
    y = gy + r * (CELL_H + GAP)
    locked = i >= 5
    on = i == 0

    rc(x, y, cell_w, CELL_H, fill=(255, 243, 214) if on else (242, 248, 253),
       outline=(44, 62, 80) if on else (194, 212, 227), width=3 * S)

    im = Image.open(os.path.join(CH, name + '.png')).convert('RGBA')
    im.thumbnail((IMG_W * S, IMG_H * S), Image.LANCZOS)
    canvas.paste(im, ((x * S) + (cell_w * S - im.width) // 2,
                      (y * S) + (CELL_H * S - im.height) // 2), im)

    if locked:
        ov = Image.new('RGBA', (cell_w * S, CELL_H * S), (44, 62, 80, 128))
        canvas.paste(ov, (x * S, y * S), ov)
        draw_lock(x + cell_w / 2, y + CELL_H / 2, 0.78)

d.text((PAGE_PAD * S, (cy + ch + 18) * S),
       '5 个/行 · 后 5 个只显示锁图标，点击才弹提示', font=font(20), fill=(120, 140, 160))

out = os.path.join(BASE, 'mock_grid.png')
canvas.save(out)
print('ok', out, canvas.size)
