# -*- coding: utf-8 -*-
"""按 750rpx 1:1 模拟命令卡片与详情弹层的终端配色（深蓝底 + 薄荷绿字）。"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
S = 2

MONO = ['C:/Windows/Fonts/consola.ttf', 'C:/Windows/Fonts/cour.ttf']
UI = ['C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc']


def f(sz, mono=False):
    for p in (MONO if mono else UI):
        try:
            return ImageFont.truetype(p, sz * S)
        except Exception:
            pass
    return ImageFont.load_default()


BG = (234, 244, 251)
CARD = (255, 253, 246)
DARK = (34, 48, 61)       # #22303d
BAR = (26, 37, 48)        # #1a2530
MINT = (168, 230, 191)    # #a8e6bf
ACCENT = (127, 214, 160)  # #7fd6a0
TX = (44, 62, 80)
SOFT = (138, 153, 170)

W = 750 * S
H = 980 * S
c = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(c)


def box(x, y, w, h, fill=None, outline=None, width=0, radius=0):
    b = [x * S, y * S, (x + w) * S, (y + h) * S]
    if radius:
        d.rounded_rectangle(b, radius=radius * S, fill=fill, outline=outline, width=width * S)
    else:
        d.rectangle(b, fill=fill, outline=outline, width=width * S)


# ---------- 1. 列表卡片 ----------
x, y, w = 24, 24, 702
box(x, y, w, 262, fill=CARD, outline=TX, width=4)
d.text(((x + 24) * S, (y + 24) * S), 'Switch', font=f(19), fill=TX)
d.text(((x + 98) * S, (y + 20) * S), '查看 VLAN 配置', font=f(26), fill=TX)

bx, by, bw, bh = x + 24, y + 76, w - 48, 128
d.rectangle([bx * S, by * S, (bx + bw) * S, (by + bh) * S], fill=DARK)
d.rectangle([bx * S, by * S, (bx + 6) * S, (by + bh) * S], fill=ACCENT)
for i, ln in enumerate(['display current-configuration | include vlan',
                        'interface Vlanif10',
                        ' ip address 192.168.10.1 255.255.255.0']):
    d.text(((bx + 20) * S, (by + 14 + i * 34) * S), ln, font=f(21, True), fill=MINT)

d.text((24 * S, (y + 280) * S), '① 列表卡片：深蓝终端底 + 薄荷绿等宽字，预览固定 3 行', font=f(19), fill=SOFT)

# ---------- 2. 详情弹层 ----------
sy, sh = 356, 590
box(24, sy, 702, sh, fill=CARD, outline=TX, width=4)
d.text((52 * S, (sy + 26) * S), '查看 VLAN 配置', font=f(28), fill=TX)
d.text((694 * S, (sy + 18) * S), '×', font=f(36), fill=SOFT, anchor='ra')

box(52, sy + 76, 112, 38, fill=(214, 245, 223), outline=TX, width=2, radius=4)
d.text((68 * S, (sy + 82) * S), 'Switch', font=f(19), fill=TX)

tx0, ty0, tw, barh = 52, sy + 128, 646, 44
# 先铺底，再画圆点（顺序反了会被盖掉）
d.rectangle([tx0 * S, ty0 * S, (tx0 + tw) * S, (ty0 + barh) * S], fill=BAR)
d.line([tx0 * S, (ty0 + barh) * S, (tx0 + tw) * S, (ty0 + barh) * S], fill=(47, 63, 79), width=2 * S)
for i, col in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
    cx = tx0 + 16 + i * 28
    d.ellipse([cx * S, (ty0 + 16) * S, (cx + 12) * S, (ty0 + 28) * S], fill=col)
d.text(((tx0 + 112) * S, (ty0 + 13) * S), 'console', font=f(18, True), fill=(100, 119, 138))

body_h = 320
d.rectangle([tx0 * S, (ty0 + barh) * S, (tx0 + tw) * S, (ty0 + barh + body_h) * S], fill=DARK)
body = ['interface Vlanif10',
        ' ip address 192.168.10.1 255.255.255.0',
        ' quit',
        'vlan batch 10 20 30',
        'port link-type trunk',
        'port trunk allow-pass vlan 10 20 30']
for i, ln in enumerate(body):
    d.text(((tx0 + 20) * S, (ty0 + barh + 18 + i * 42) * S), ln, font=f(23, True), fill=MINT)

byy = ty0 + barh + body_h + 22
for i, (t, style) in enumerate([('复制命令', 'p'), ('编辑', 'g'), ('删除', 'd')]):
    bxx = 52 + i * 214
    is_p = style == 'p'
    box(bxx, byy, 200, 64, fill=TX if is_p else (255, 255, 255), outline=TX, width=3, radius=6)
    d.text(((bxx + 100) * S, (byy + 32) * S), t, font=f(23),
           fill=(255, 255, 255) if is_p else ((163, 46, 42) if style == 'd' else TX), anchor='mm')

d.text((24 * S, (sy + sh + 18) * S), '② 详情弹层：带终端窗口条，长命令在块内滚动', font=f(19), fill=SOFT)

out = os.path.join(BASE, 'mock_cmd.png')
c.save(out)
print('ok', out, c.size)
