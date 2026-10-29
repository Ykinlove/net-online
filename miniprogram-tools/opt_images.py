# -*- coding: utf-8 -*-
"""图片无损感压缩：只动编码参数，不改尺寸，逐张报告 PSNR"""
import os, io
from PIL import Image, ImageChops
import math

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'images'))


def psnr(a, b):
    diff = ImageChops.difference(a.convert('RGB'), b.convert('RGB'))
    h = diff.histogram()
    sq = 0
    for i in range(256):
        sq += (i ** 2) * h[i]
    total = a.size[0] * a.size[1] * 3
    mse = sq / float(total)
    if mse == 0:
        return 99.0
    return 10 * math.log10((255.0 ** 2) / mse)


def compress_jpg(p, quality, label):
    before = os.path.getsize(p)
    im = Image.open(p).convert('RGB')
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=quality, optimize=True, progressive=True, subsampling=1)
    buf.seek(0)
    new = Image.open(buf)
    score = psnr(im, new)
    after = buf.tell()
    if after < before:
        with open(p, 'wb') as f:
            f.write(buf.getvalue())
        print('%-34s %5dKB -> %4dKB  PSNR=%.1fdB' % (label, before // 1024, after // 1024, score))
        return before - after
    print('%-34s 跳过（无法变小）' % label)
    return 0


def compress_png(p, label, colors=128):
    before = os.path.getsize(p)
    im = Image.open(p)
    alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
    if alpha:
        im2 = im.convert('RGBA')
        q = im2.quantize(colors=colors, method=Image.FASTOCTREE, dither=Image.NONE)
        buf = io.BytesIO()
        q.save(buf, 'PNG', optimize=True)
    else:
        im2 = im.convert('RGB')
        q = im2.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
        buf = io.BytesIO()
        q.save(buf, 'PNG', optimize=True)
    after = buf.tell()
    if after < before:
        with open(p, 'wb') as f:
            f.write(buf.getvalue())
        print('%-34s %5dKB -> %4dKB  (palette %d)' % (label, before // 1024, after // 1024, colors))
        return before - after
    print('%-34s 跳过（无法变小）' % label)
    return 0


total = 0

# 单张底图：q=80 已经很接近原图，肉眼不可辨
p = os.path.join(BASE, 'ui', 'splash-bg.jpg')
if os.path.exists(p):
    total += compress_jpg(p, 80, 'ui/splash-bg.jpg')

# 角色背景图：q=78，展示尺寸 < 屏宽，压缩后不可辨
bgdir = os.path.join(BASE, 'preset', 'bg')
for f in sorted(os.listdir(bgdir)):
    if f.lower().endswith('.jpg'):
        total += compress_jpg(os.path.join(bgdir, f), 78, 'preset/bg/' + f)

# logo：透明 PNG，调色板量化
p = os.path.join(BASE, 'ui', 'logo.png')
if os.path.exists(p):
    total += compress_png(p, 'ui/logo.png', colors=96)

print('----')
print('共节省 %.1f KB' % (total / 1024.0))
