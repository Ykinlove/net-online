# -*- coding: utf-8 -*-
"""图片压缩参数扫描 v3 —— 统一用 FASTOCTREE 量化（保留完整 alpha 渐变）。

为什么是 FASTOCTREE：
  Pillow 对 RGBA 输入做 FASTOCTREE 量化时，会输出「带逐像素 alpha 表的调色板 PNG」
  （tRNS 数组），而不是 RGBA 真彩。这样：
    · 体积更小 —— 1 byte/pixel + 调色板，而不是 4 byte/pixel
    · 画质更好 —— alpha 渐变完整保留，边缘无锯齿、无色带
  对比 MEDIANCUT + 手动二值 alpha：体积更大，且边缘出现锯齿。

踩过的坑（别再犯）：
  1. 原图是 P 模式 + 逐像素 transparency 表时，重新量化会让这张 alpha 表失效，
     透明区变成垃圾索引 -> 渲染成黑底噪点。必须先 convert('RGBA') 再量化。
  2. 手动 tRNS 时透明索引不能超出调色板长度，否则 Pillow 丢弃 tRNS -> 透明变黑。
  3. BytesIO 测体积要在 seek(0) 之前用 getbuffer().nbytes，seek 之后 tell() 返回位置。
"""
import io
import os

from PIL import Image

REPO = r"E:\Work buddy\命令\net-online"
MP = os.path.join(REPO, "miniprogram")

GROUPS = [
    ('char', r'subpkg-mine\images\preset\char', 'png'),
    ('portrait', r'images\portrait', 'png'),
    ('bg', r'images\preset\bg', 'jpg'),
    ('tab', r'images\tab', 'png'),
    ('tabdark', r'images\tab\dark', 'png'),
    ('iconsL', r'images\icons\light', 'png'),
    ('iconsD', r'images\icons\dark', 'png'),
]

# 各组候选边长（None = 不缩放）
SIZES = {
    'char': (240, 220, 200, 180, 160),
    'portrait': (128, 112, 96, 88, 80),
    'bg': (480, 440, 400, 360, 320),
    'tab': (None,),
    'tabdark': (None,),
    'iconsL': (48, 44, 40, 36),
    'iconsD': (48, 44, 40, 36),
}
COLORS = (64, 48, 32, 24, 16)


def files_of(sub):
    d = os.path.join(MP, sub)
    return [os.path.join(d, f) for f in sorted(os.listdir(d))
            if os.path.splitext(f)[1].lower() in ('.png', '.jpg', '.jpeg')]


def png_size(src, size, colors):
    im = Image.open(src)
    if im.mode != 'RGBA':
        im = im.convert('RGBA')          # P 模式带逐像素 alpha 表，必须先转 RGBA
    if size and size < max(im.size):
        w, h = im.size
        sc = size / float(max(w, h))
        im = im.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)
    q = im.quantize(colors=colors, method=Image.FASTOCTREE)
    b = io.BytesIO()
    q.save(b, 'PNG', optimize=True)
    return b.getbuffer().nbytes


def jpg_size(src, size, q):
    im = Image.open(src).convert('RGB')
    if size and size < max(im.size):
        w, h = im.size
        sc = size / float(max(w, h))
        im = im.resize((round(w * sc), round(h * sc)), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'JPEG', quality=q, optimize=True, progressive=True)
    return b.getbuffer().nbytes


def main():
    summary = {}
    for group, sub, kind in GROUPS:
        files = files_of(sub)
        if not files:
            continue
        old = sum(os.path.getsize(f) for f in files)
        first = Image.open(files[0])
        print('\n=== %s (%d 项, 原始 %d B, 首图 %s %s) ===' %
              (group, len(files), old, first.mode, first.size))
        rows = []
        if kind == 'jpg':
            for size in SIZES[group]:
                for q in (42, 34, 30, 26, 22):
                    tot = sum(jpg_size(f, size, q) for f in files)
                    rows.append((tot, size, q))
                    print('   %3dpx q%-3d -> %7d B  (单张 %5d)' % (size, q, tot, tot // len(files)))
        else:
            for size in SIZES[group]:
                for c in COLORS:
                    tot = sum(png_size(f, size, c) for f in files)
                    rows.append((tot, size, c))
                    print('   %3s %2d色 -> %7d B  (单张 %5d)' %
                          (size or '原', c, tot, tot // len(files)))
        rows.sort()
        summary[group] = (rows, old)

    print('\n\n===== 每组最优 =====')
    tot_best = 0
    for g, (rows, old) in summary.items():
        b, a, c = rows[0]
        tot_best += b
        print('  %-10s %7d B  @ %s%s   (原 %d B, 降 %.1f%%)' %
              (g, b, a, ('q%d' % c) if isinstance(c, int) and g == 'bg' else
               (('%d色' % c) if c else ''), old, (old - b) * 100.0 / old))
    print('  %-10s %7d B   限额 204800  %s' %
          ('合计', tot_best, 'OK 余量 %d' % (204800 - tot_best) if tot_best < 204800
           else '超 %d' % (tot_best - 204800)))


if __name__ == '__main__':
    main()
