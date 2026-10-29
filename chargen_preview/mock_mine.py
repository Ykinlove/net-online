# -*- coding: utf-8 -*-
"""按 750rpx 1:1 模拟「我的」页：等级条 → 人物卡 → 关键词 → 菜单。"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
MP = os.path.join(BASE, '..', 'miniprogram')
S = 2

UI = ['C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc']
REG = ['C:/Windows/Fonts/msyh.ttc']
SYM = 'C:/Windows/Fonts/seguisym.ttf'

PAGE_BG = (238, 247, 253)
CARD = (255, 253, 246)
TX = (44, 62, 80)
SOFT = (138, 153, 170)

W = 750 * S
c = Image.new('RGB', (W, 1500 * S), PAGE_BG)
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
        d.rectangle(b, fill=fill, outline=outline, width=max(0, width * S))


def txt(x, y, s, sz, fill, bold=True, anchor='la'):
    d.text((x * S, y * S), s, font=f(sz, bold), fill=fill, anchor=anchor)


def icon(x, y, s, sz, fill):
    d.text((x * S, y * S), s, font=ImageFont.truetype(SYM, sz * S), fill=fill)


CW = 702
PAD = 24

# ================= 1. 等级条（最上面）=================
LV_Y, LV_B = PAD, 4
LV_PAD_V, LV_PAD_H = 16, 22
cap_h = int(round(30 * 1.35)) + 3 * 2 + 3 * 2   # Lv 胶囊高
LV_H = LV_B * 2 + LV_PAD_V * 2 + cap_h
box(PAD, LV_Y, CW, LV_H, fill=CARD, outline=TX, width=LV_B, radius=8)

cap_txt = 'Lv.8'
cap_w = d.textlength(cap_txt, font=f(30)) / S + 32 + 6
cx0 = PAD + LV_B + LV_PAD_H
cy0 = LV_Y + LV_B + LV_PAD_V
box(cx0, cy0, cap_w, cap_h, fill=(255, 243, 214), outline=TX, width=3, radius=6)
txt(cx0 + cap_w / 2, cy0 + cap_h / 2, cap_txt, 30, (201, 122, 20), anchor='mm')

bx = cx0 + cap_w + 16
bw = PAD + CW - LV_B - LV_PAD_H - bx
box(bx, cy0 + (cap_h - 20) / 2, bw, 20, fill=(253, 244, 216), outline=TX, width=4)
box(bx, cy0 + (cap_h - 20) / 2, bw * 0.57, 20, fill=(245, 166, 35))
box(bx, cy0 + (cap_h - 20) / 2, bw, 20, outline=TX, width=4)

# ================= 2. 人物卡 =================
CH, CB = 420, 5
cx, cy = PAD, int(LV_Y + LV_H + 16)
inner_w, inner_h = CW - CB * 2, CH - CB * 2

card = Image.new('RGB', (inner_w * S, inner_h * S), (220, 234, 246))
bg = Image.open(os.path.join(MP, 'images/preset/bg/background_01.jpg')).convert('RGB')
r = max(inner_w * S / bg.width, inner_h * S / bg.height)
bg = bg.resize((int(bg.width * r) + 1, int(bg.height * r) + 1), Image.LANCZOS)
bg = bg.crop(((bg.width - inner_w * S) // 2, (bg.height - inner_h * S) // 2,
              (bg.width + inner_w * S) // 2, (bg.height + inner_h * S) // 2))
card.paste(bg, (0, 0))

shade = Image.new('RGBA', (inner_w * S, int(inner_h * 0.62 * S)), (0, 0, 0, 0))
sd = ImageDraw.Draw(shade)
for i in range(shade.height):
    sd.line([(0, i), (shade.width, i)], fill=(20, 35, 50, int(199 * (i / shade.height) ** 1.2)))
card.paste(shade, (0, inner_h * S - shade.height), shade)

IM_H, IM_B = 413, 11
chr_ = Image.open(os.path.join(MP, 'images/preset/char/character_02.png')).convert('RGBA')
sc = min(inner_w / 360.0, IM_H / 360.0)
chr_ = chr_.resize((int(360 * sc * S), int(360 * sc * S)), Image.LANCZOS)
card.paste(chr_, ((inner_w * S - chr_.width) // 2,
                  inner_h * S - chr_.height + IM_B * S), chr_)
c.paste(card, ((cx + CB) * S, (cy + CB) * S))
box(cx, cy, CW, CH, outline=TX, width=CB, radius=10)

txt(cx + 24, cy + CH - 118, '杨雷鹏', 34, (255, 255, 255))
txt(cx + 24, cy + CH - 74, '在学 HCIE，想把排障这件事做扎实', 22, (232, 242, 251), False)
xx, chy = cx + 24, cy + CH - 44
for t in ['大三', '某大学', '网络工程']:
    tw = d.textlength(t, font=f(19)) / S + 24
    box(xx, chy, tw, 32, fill=(255, 253, 246), radius=4)
    txt(xx + 12, chy + 16, t, 19, TX, anchor='lm')
    xx += tw + 8

# ================= 3. 关键词卡 =================
KY = cy + CH + 20
KH = 14 + 56 + 62 + 16
box(PAD, KY, CW, KH, fill=CARD, outline=TX, width=4, radius=8)
rows = [('兴趣', ['网络工程', 'HCIE', '云原生', '自动化运维'], False),
        ('职业', ['网络工程师'], True)]
ry = KY + 14 + 9
for i, (label, items, gold) in enumerate(rows):
    if i == 1:
        d.line([(44 * S, (ry - 6) * S), (726 * S, (ry - 6) * S)], fill=(226, 236, 244), width=2 * S)
        ry += 15
    txt(44, ry + 6, label, 22, (122, 138, 155))
    xx = 44 + 52 + 14
    for t in items:
        tw = d.textlength(t, font=f(21)) / S + 28
        if xx + tw > 706:
            xx = 44 + 52 + 14
            ry += 48
        box(xx, ry, tw, 38, fill=(255, 243, 214) if gold else (238, 246, 255),
            outline=(201, 164, 85) if gold else (157, 182, 204), width=3, radius=6)
        txt(xx + 14, ry + 19, t, 21, (201, 122, 20) if gold else TX, anchor='lm')
        xx += tw + 10
    ry += 38 + 9

# ================= 4. 最近记录 =================
RY = KY + KH + 20
# 示例数据（真实页面读的是用户自己的最近三条命令）
recs = [('VLAN 端口划入与 Trunk', 'Switch'),
        ('OSPF 邻居起不来怎么查', 'Router'),
        ('光模块收光过低怎么办', 'Switch')]
ROW = 14 * 2 + 25 + 4 + 21
HDR = 28 + 12 + 1.5 + 16
RCH = 22 * 2 + HDR + ROW * len(recs) + 8
box(PAD, RY, CW, RCH, fill=CARD, outline=TX, width=4, radius=8)

ix = PAD + 4 + 22
iy = RY + 4 + 22
txt(ix, iy, '最近记录', 28, TX)          # 真机标题前有小图标，这里省略避免 emoji 渲染异常
txt(PAD + CW - 4 - 22, iy + 4, '全部 ›', 22, (201, 122, 20), False, anchor='ra')
d.line([(ix * S, (iy + 34) * S), ((PAD + CW - 26) * S, (iy + 34) * S)], fill=(217, 228, 238), width=3 * S)

ry = iy + 40
for i, (name, dev) in enumerate(recs):
    txt(ix, ry + 12, name, 25, TX)
    txt(ix, ry + 12 + 29, dev, 21, (159, 176, 192), False)
    txt(PAD + CW - 4 - 22, ry + 12, '›', 30, (185, 207, 224), False, anchor='ra')
    ry += ROW
    if i < len(recs) - 1:
        d.line([(ix * S, ry * S), ((PAD + CW - 26) * S, ry * S)], fill=(226, 236, 244), width=2 * S)

# ================= 5. 设置入口 =================
MY = RY + RCH + 22
box(PAD, MY, CW, 80, fill=CARD, outline=TX, width=4, radius=8)
txt(PAD + 4 + 22, MY + 26, '设置', 27, TX)
txt(PAD + CW - 4 - 22, MY + 24, '›', 30, (185, 207, 224), False, anchor='ra')

txt(PAD, MY + 106, '技能树 / 存档库已移进设置页；最近记录从首页搬到这里', 18, SOFT, False)

out = os.path.join(BASE, 'mock_mine.png')
c.crop((0, 0, W, int((MY + 150) * S))).save(out)
print('ok', out)
