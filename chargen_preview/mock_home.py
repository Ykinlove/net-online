# -*- coding: utf-8 -*-
"""按 750rpx 1:1 模拟首页：答案之书 → 日历（农历/节气/周数）→ 两个主操作。
   日历数据由 utils/lunar.js 实际输出（home_cells.json），非手填。"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
S = 2

UI = ['C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc']
REG = ['C:/Windows/Fonts/msyh.ttc']
SYM = 'C:/Windows/Fonts/seguisym.ttf'

PAGE_BG = (238, 247, 253)
CARD = (255, 253, 246)
TX = (44, 62, 80)
SOFT = (138, 153, 170)
AMBER = (201, 122, 20)
TERM_C = (47, 143, 107)
FEST_C = (199, 74, 58)
LUNAR_C = (169, 188, 205)

W = 750
c = Image.new("RGB", (W * S, 1420 * S), PAGE_BG)
d = ImageDraw.Draw(c)


def f(sz, bold=True):
    for p in (UI if bold else REG):
        try:
            return ImageFont.truetype(p, sz * S)
        except Exception:
            pass
    return ImageFont.load_default()


def box(x, y, w, h, fill=None, outline=None, width=0, radius=0):
    b = [x * S, y * S, (x + w) * S, (y + h) * S]
    if radius:
        d.rounded_rectangle(b, radius=radius * S, fill=fill, outline=outline, width=max(1, width * S))
    else:
        d.rectangle(b, fill=fill, outline=outline, width=max(1, width * S) if width else 0)


def txt(x, y, s, sz, fill, bold=True, anchor='la'):
    d.text((x * S, y * S), s, font=f(sz, bold), fill=fill, anchor=anchor)


def icon(x, y, s, sz, fill):
    d.text((x * S, y * S), s, font=ImageFont.truetype(SYM, sz * S), fill=fill)


def tw(s, sz, bold=True):
    return d.textlength(s, font=f(sz, bold)) / S


CW = 702          # 卡片宽（750 - 页面左右 24）
PAD = 24          # 左边距
CP = 24           # 卡片内 padding
B = 4             # 卡片描边


def glass(cx, cy, r=9, col=TX):
    """手绘放大镜（emoji 在 PIL 里渲染不出来）"""
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S],
              outline=col, width=int(2.4 * S))
    d.line([((cx + r * 0.72) * S, (cy + r * 0.72) * S), ((cx + r * 1.75) * S, (cy + r * 1.75) * S)],
           fill=col, width=int(2.6 * S))


# ================= 1. 答案之书 =================
AX, AY = PAD, 24
AH = B * 2 + 22 * 2 + 24 * 1.2 + 14 + 30 * 1.7
box(AX, AY, CW, AH, fill=(255, 250, 237), outline=(201, 164, 85), width=B, radius=8)
ix = AX + B + CP
iy = AY + B + 22
icon(ix, iy - 2, '📖', 20, AMBER)
txt(ix + 28, iy, '每日答案之书', 23, AMBER)
txt(AX + CW - B - CP, iy, '换一句 ↻', 21, (160, 138, 94), False, anchor='ra')
txt(ix, iy + 24 * 1.2 + 14, '「先把它跑通，再谈优雅」', 30, (60, 74, 88))

# ================= 2. 日历 =================
data = json.load(open(os.path.join(BASE, 'home_cells.json'), encoding='utf-8'))
CY = AY + AH + 22
CELL_W = (CW - B * 2 - CP * 2) / 7.0
CELL_H = 84
head_h = 28 + 12 + 1.5 + 16          # title row
week_h = 20 * 1.4 + 8
rows = (len(data['cells']) + 6) // 7
grid_h = rows * CELL_H
foot_h = 14 + 1.5 + 14 + 28
CH_ = B * 2 + 22 * 2 + head_h + week_h + grid_h + foot_h
box(PAD, CY, CW, CH_, fill=CARD, outline=TX, width=B, radius=8)

ix = PAD + B + CP
iy = CY + B + 22
icon(ix, iy - 1, '📅', 21, TX)
txt(ix + 30, iy, '2026 年 8 月', 28, TX)
for k, gl in enumerate(['‹', '›']):
    bx = PAD + CW - B - CP - 46 - (46 + 10) * (1 - k)
    box(bx, iy - 6, 46, 46, fill=(238, 246, 255), outline=(194, 212, 227), width=2, radius=6)
    txt(bx + 23, iy - 6 + 23, gl, 32, (90, 107, 125), False, anchor='mm')

# 星期行
wy = iy + head_h
for i, wd in enumerate(data['weekDays']):
    txt(PAD + B + CP + CELL_W * (i + 0.5), wy, wd, 20, (159, 176, 192), anchor='ma')

# 格子
gy = wy + week_h
TODAY = 13
for i, cell in enumerate(data['cells']):
    r, col = divmod(i, 7)
    if not cell['day']:
        continue
    ccx = PAD + B + CP + CELL_W * (col + 0.5)
    ccy = gy + r * CELL_H + CELL_H / 2
    is_today = cell['day'] == TODAY
    # 数字
    if is_today:
        box(ccx - 20, ccy - CELL_H / 2 + 6, 40, 40, fill=TX, radius=20)
        txt(ccx, ccy - CELL_H / 2 + 26, str(cell['day']), 23, (255, 255, 255), anchor='mm')
    else:
        txt(ccx, ccy - CELL_H / 2 + 6, str(cell['day']), 23, (60, 74, 88), anchor='ma')
    # 副标题
    kind = cell['kind']
    col_c = FEST_C if kind == 'fest' else (TERM_C if kind == 'term' else LUNAR_C)
    if is_today and kind == 'lunar':
        col_c = (111, 128, 146)
    txt(ccx, ccy + 4, cell['sub'], 15, col_c, kind in ('fest', 'term'), anchor='ma')

# 有记录的日期圆点（示意：5 号、12 号、13 号、20 号记过命令）
for mk in (5, 12, 13, 20):
    idx = next(i for i, x in enumerate(data['cells']) if x['day'] == mk)
    r, col = divmod(idx, 7)
    box(PAD + B + CP + CELL_W * (col + 1) - 14 - 8,
        gy + r * CELL_H + 6, 8, 8, fill=(245, 166, 35), radius=4)

# 底部周数
fy = gy + grid_h + 6
d.line([((PAD + B + CP) * S, fy * S), ((PAD + CW - B - CP) * S, fy * S)], fill=(217, 228, 238), width=2 * S)
pill = data['foot']
pw = tw(pill, 20) + 40
box(PAD + (CW - pw) / 2, fy + 14, pw, 28, fill=(255, 243, 214), outline=(232, 201, 138), width=2, radius=14)
txt(PAD + CW / 2, fy + 14 + 14, pill, 20, AMBER, anchor='mm')

# ================= 3. 搜索入口（在日历之后、两个主操作之前）=================
SE_Y = CY + CH_ + 22
box(PAD, SE_Y, CW, 92, fill=CARD, outline=TX, width=B, radius=10)
glass(46, SE_Y + 46, 9)
txt(68, SE_Y + 46, '搜命令，比如「划分端口」', 26, (159, 176, 192), False, anchor='lm')
_tg = '四厂商'
_tw = tw(_tg, 18) + 24
box(PAD + CW - B - 22 - _tw, SE_Y + 46 - 15, _tw, 30,
    fill=(255, 243, 214), outline=(232, 201, 138), width=2, radius=4)
txt(PAD + CW - B - 22 - _tw / 2, SE_Y + 46, _tg, 18, AMBER, anchor='mm')

# ================= 4. 两个主操作 =================
HY = SE_Y + 92 + 22
BTN_H = 26 * 2 + 40 + 8 + 26 * 1.2 + 8
for k, (ico, name, bg) in enumerate([('⌨', '记一条命令', (255, 216, 107)),
                                    ('📁', '记一个项目', (191, 227, 255))]):
    bx = PAD + (CW / 2 + 9) * k
    bw = CW / 2 - 9
    box(bx, HY + 8, bw, BTN_H, fill=(0, 0, 0), outline=None, radius=10)
    box(bx, HY, bw, BTN_H, fill=bg, outline=TX, width=4, radius=10)
    icon(bx + bw / 2 - 12, HY + 26, ico, 34, TX)
    txt(bx + bw / 2, HY + 26 + 40 + 8 + 8, name, 26, TX, anchor='ma')

out = os.path.join(BASE, 'mock_home.png')
c.crop((0, 0, W * S, int((HY + BTN_H + 60) * S))).save(out)
print('ok', out)
