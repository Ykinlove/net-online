# -*- coding: utf-8 -*-
"""按 750rpx 1:1 模拟搜索页：
   图1 列表态（左设备栏 + 命令百科结果）
   图2 详情浮层（同一功能，四家厂商命令对照）
   数据全部来自 utils/cmdbook.js 的实际输出（search_data.json），非手填。"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
S = 2

UI = 'C:/Windows/Fonts/msyhbd.ttc'
REG = 'C:/Windows/Fonts/msyh.ttc'
MONO = 'C:/Windows/Fonts/consola.ttf'
SYM = 'C:/Windows/Fonts/seguisym.ttf'

CARD = (255, 253, 246)
TX = (44, 62, 80)
SOFT = (138, 153, 170)
AMBER = (201, 122, 20)
GREEN = (47, 143, 107)
TERM_BG = (34, 48, 61)
TERM_FG = (168, 230, 191)

W = 750
H = 1320
DATA = json.load(open(os.path.join(BASE, 'search_data.json'), encoding='utf-8'))


def f(sz, bold=True):
    try:
        return ImageFont.truetype(UI if bold else REG, sz * S)
    except Exception:
        return ImageFont.load_default()


def fm(sz):
    return ImageFont.truetype(MONO, sz * S)


def box(d, x, y, w, h, fill=None, outline=None, width=0, radius=0):
    b = [x * S, y * S, (x + w) * S, (y + h) * S]
    if radius:
        d.rounded_rectangle(b, radius=radius * S, fill=fill, outline=outline,
                            width=max(1, width * S) if width else 0)
    else:
        d.rectangle(b, fill=fill, outline=outline, width=max(1, width * S) if width else 0)


def txt(d, x, y, s, sz, fill, bold=True, anchor='la'):
    d.text((x * S, y * S), s, font=f(sz, bold), fill=fill, anchor=anchor)


def mono(d, x, y, s, sz, fill, anchor='la'):
    d.text((x * S, y * S), s, font=fm(sz), fill=fill, anchor=anchor)


def tw(d, s, sz, bold=True):
    return d.textlength(s, font=f(sz, bold)) / S


def newpage():
    img = Image.new('RGB', (W * S, H * S), (240, 247, 253))
    d = ImageDraw.Draw(img)
    # 页面渐变（取 wxss 的三段，粗略线性插值）
    stops = [(0, (234, 244, 251)), (0.4, (247, 251, 254)), (1, (238, 247, 253))]
    for yy in range(H):
        r = yy / H
        for i in range(len(stops) - 1):
            a, b = stops[i], stops[i + 1]
            if a[0] <= r <= b[0]:
                t = (r - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0
                col = tuple(int(a[1][k] + (b[1][k] - a[1][k]) * t) for k in range(3))
                d.line([(0, yy * S), (W * S, yy * S)], fill=col)
                break
    return img, d


def glass(d, cx, cy, r=9, col=TX):
    """手绘放大镜（emoji 在 PIL 里渲染不出来）"""
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S],
              outline=col, width=int(2.4 * S))
    d.line([((cx + r * 0.72) * S, (cy + r * 0.72) * S), ((cx + r * 1.75) * S, (cy + r * 1.75) * S)],
           fill=col, width=int(2.6 * S))


def cross(d, cx, cy, r=6, col=(124, 143, 163)):
    d.line([((cx - r) * S, (cy - r) * S), ((cx + r) * S, (cy + r) * S)], fill=col, width=int(2.2 * S))
    d.line([((cx - r) * S, (cy + r) * S), ((cx + r) * S, (cy - r) * S)], fill=col, width=int(2.2 * S))


def draw_searchbox(d, kw):
    box(d, 24, 20, 702, 88, fill=CARD, outline=TX, width=4, radius=10)
    glass(d, 46, 64, 9)
    if kw:
        txt(d, 68, 64, kw, 27, TX, False, anchor='lm')
        # 清空按钮
        box(d, 682, 43, 42, 42, fill=(238, 242, 246), radius=21)
        cross(d, 703, 64, 6)
    else:
        txt(d, 68, 64, '搜功能，比如「划分端口」', 26, (159, 176, 192), False, anchor='lm')


def draw_side(d, cur='全部'):
    top = 20 + 88 + 14
    d.rectangle([0, top * S, 152 * S, H * S], fill=(253, 250, 242))
    d.line([(152 * S, top * S), (152 * S, H * S)], fill=(213, 227, 238), width=3 * S)
    y = top
    for it in DATA['side']:
        on = it['v'] == cur
        if on:
            d.rectangle([0, y * S, 152 * S, (y + 86) * S], fill=CARD)
            d.rectangle([0, y * S, 8 * S, (y + 86) * S], fill=AMBER)
        txt(d, 84, y + 43, it['t'], 23, AMBER if on else (90, 107, 125), True, anchor='mm')
        y += 86


def draw_list(img, d):
    draw_searchbox(d, DATA.get('query', ''))
    draw_side(d, '全部')

    x0 = 152 + 20
    y = 20 + 88 + 14
    # 分组标题（徽标位置按“命令百科”实测宽度算，别硬编码，否则会贴着字）
    txt(d, x0 + 4, y + 22, '命令百科', 22, TX)
    n = '%d 条' % DATA.get('stats', {}).get('total', len(DATA['list']))
    bx = x0 + 4 + tw(d, '命令百科', 22) + 12
    nw = tw(d, n, 18) + 22
    box(d, bx, y + 19, nw, 26, fill=(255, 243, 214), outline=(232, 201, 138), width=2, radius=13)
    txt(d, bx + nw / 2, y + 32, n, 18, AMBER, anchor='mm')
    y += 56

    for it in DATA['list']:
        # 卡片高度 = padding 16*2 + 标题 26*1.35 + 10 + tag 32
        h = 16 * 2 + int(26 * 1.35) + 10 + 30
        if y + h > H - 10:
            break
        box(d, x0, y, 750 - x0 - 20, h, fill=CARD, outline=TX, width=3, radius=8)
        txt(d, x0 + 18, y + 16, it['name'], 26, TX)
        txt(d, x0 + (750 - x0 - 20) - 30, y + 16 + 6, '›', 30, (185, 207, 224), False)
        tx, ty = x0 + 18, y + 16 + int(26 * 1.35) + 10
        for v in it['vendors']:
            vw = tw(d, v, 18) + 20
            box(d, tx, ty, vw, 30, fill=(232, 247, 240), outline=(168, 219, 198), width=2, radius=4)
            txt(d, tx + 10, ty + 15, v, 18, GREEN, anchor='lm')
            tx += vw + 8
        y += h + 14

    # 图注
    st = DATA.get('stats', {})
    foot = '内置命令百科：%s 个功能点 · %s 条命令（四厂商对照）' % (st.get('points', 298), st.get('cmds', 1125))
    txt(d, 24, H - 34, foot, 18, (160, 178, 194), False)


def draw_sheet():
    """浮层态：先画列表当背景，再压遮罩 + 抽屉"""
    img, d = newpage()
    draw_searchbox(d, DATA.get('sheetQuery', '划分端口'))
    draw_side(d, 'Switch')

    x0 = 152 + 20
    y = 20 + 88 + 14
    txt(d, x0 + 4, y + 22, '命令百科', 22, TX)
    bx = x0 + 4 + tw(d, '命令百科', 22) + 12
    bw = tw(d, '1 条', 18) + 22
    box(d, bx, y + 19, bw, 26, fill=(255, 243, 214), outline=(232, 201, 138), width=2, radius=13)
    txt(d, bx + bw / 2, y + 32, '1 条', 18, AMBER, anchor='mm')
    y += 56
    h = 16 * 2 + int(26 * 1.35) + 10 + 30
    box(d, x0, y, 750 - x0 - 20, h, fill=CARD, outline=TX, width=3, radius=8)
    txt(d, x0 + 18, y + 16, DATA['one']['name'], 26, TX)
    tx, ty = x0 + 18, y + 16 + int(26 * 1.35) + 10
    for c in DATA['one']['cmds']:
        v = c['vendor']
        vw = tw(d, v, 18) + 20
        box(d, tx, ty, vw, 30, fill=(232, 247, 240), outline=(168, 219, 198), width=2, radius=4)
        txt(d, tx + 10, ty + 15, v, 18, GREEN, anchor='lm')
        tx += vw + 8

    # 遮罩
    ov = Image.new('RGBA', (W * S, H * S), (20, 32, 44, 140))
    img.paste(ov, (0, 0), ov)

    # ---- 抽屉 ----
    tip = DATA['one']['tip']
    blocks = DATA['one']['cmds']
    # 计算高度（与 search.wxss 的 .sheet-head 对齐）
    title_h = int(30 * 1.35)
    sub_h = int(20 * 1.5)
    head_h = 22 + title_h + 4 + sub_h + 16
    tip_h = 14 * 2 + 2 * 21 * 1.62 + 20 if tip else 0
    vd_h = []
    for b in blocks:
        lines = b.get('lines') or [{'t': x} for x in b['code'].split('\n')]
        hh = 8 + 30 + 14 * 2 + len(lines) * int(21 * 1.62)
        vd_h.append(hh + 20)
    body_h = 18 * 2 + tip_h + sum(vd_h)
    foot_h = 14 + 82 + 24
    sheet_h = head_h + body_h + foot_h + 5

    sx, sy = 0, H - sheet_h
    d.rounded_rectangle([sx * S, sy * S, W * S, (H + 40) * S], radius=18 * S,
                        fill=CARD, outline=TX, width=5 * S)

    # 标题
    txt(d, 28, sy + 22, DATA['one']['name'], 30, TX)
    txt(d, 28, sy + 22 + title_h + 4, '交换机', 20, (159, 176, 192), False)
    box(d, 674, sy + 22, 52, 52, fill=(238, 242, 246), radius=26)
    cross(d, 700, sy + 48, 7)
    d.line([(0, (sy + head_h - 1) * S), (W * S, (sy + head_h - 1) * S)], fill=(217, 228, 238), width=3 * S)

    yy = sy + head_h + 18

    # 提示条
    if tip:
        lines = []
        cur = ''
        for ch in tip:
            if tw(d, cur + ch, 21, False) > 640:
                lines.append(cur)
                cur = ch
            else:
                cur += ch
        lines.append(cur)
        th = 14 * 2 + len(lines) * int(21 * 1.62)
        box(d, 24, yy, 702, th, fill=(255, 248, 230), outline=(232, 201, 138), width=3, radius=8)
        # 小灯泡：手绘（emoji 在 PIL 里渲染不出来）
        bx, by = 44, yy + 14 + int(21 * 1.62 / 2)
        d.ellipse([(bx - 7) * S, (by - 7) * S, (bx + 7) * S, (by + 7) * S], fill=(232, 201, 138))
        txt(d, bx, by, '!', 13, (255, 248, 230), anchor='mm')
        ly = yy + 14
        for ln in lines:
            txt(d, 60, ly, ln, 21, (138, 109, 59), False)
            ly += int(21 * 1.62)
        yy += th + 20

    # 厂商块
    for i, b in enumerate(blocks):
        nm = b['vendor']
        nw = tw(d, nm, 21) + 32
        box(d, 24, yy, nw, 32, fill=TX, radius=4)
        txt(d, 24 + nw / 2, yy + 16, nm, 21, (255, 253, 246), anchor='mm')
        cy = yy + 3
        cw = tw(d, '复制', 19) + 32
        box(d, 726 - cw, cy, cw, 26, fill=(255, 243, 214), outline=(232, 201, 138), width=2, radius=4)
        txt(d, 726 - cw / 2, cy + 13, '复制', 19, AMBER, anchor='mm')

        lines = b.get('lines') or [{'t': x} for x in b['code'].split('\n')]
        ch = 14 * 2 + len(lines) * int(21 * 1.62)
        cy2 = yy + 8 + 30
        d.rectangle([24 * S, cy2 * S, 726 * S, (cy2 + ch) * S], fill=TERM_BG)
        d.rectangle([24 * S, cy2 * S, 30 * S, (cy2 + ch) * S], fill=(127, 214, 160))
        ly = cy2 + 14
        for ln in lines:
            if ln.get('note'):
                # 注释行用中文字体，否则等宽字体渲染成方块
                txt(d, 44, ly, ln['t'], 20, (124, 147, 166), False)
            else:
                mono(d, 44, ly, ln['t'], 21, TERM_FG)
            ly += int(21 * 1.62)
        yy = cy2 + ch + 20

    # 底部按钮
    fy = H - foot_h + 14
    d.line([(0, (fy - 14) * S), (W * S, (fy - 14) * S)], fill=(217, 228, 238), width=3 * S)
    box(d, 24, fy + 4, 702, 82, fill=(255, 216, 107), outline=TX, width=4, radius=10)
    txt(d, 375, fy + 4 + 41, '复制四家全部', 27, TX, anchor='mm')

    out = os.path.join(BASE, 'mock_search_sheet.png')
    img.save(out)
    return out


img1, d1 = None, None
H = 1100
img1, d1 = newpage()
draw_list(img1, d1)
out1 = os.path.join(BASE, 'mock_search_list.png')
img1.save(out1)

H = 1330
out2 = draw_sheet()
print('ok', out1, out2)
