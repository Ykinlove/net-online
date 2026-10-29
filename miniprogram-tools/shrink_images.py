# -*- coding: utf-8 -*-
"""压缩小程序图片素材（像素风近无损），给主包 2MB 腾空间。
规则：
- logo.png 不压（用户刚调过尺寸，保持现状）
- PNG（调色板模式）→ 重存为更精简的调色板（colors=64）
- JPG → quality 72 重存（像素风/渐变损失极小）
用法：python shrink_images.py [--apply]  不带参数只预演
"""
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'miniprogram', 'images')
SKIP = {'ui/logo.png'}  # 用户刚投诉过尺寸的图，不碰
PNG_COLORS = 64
JPG_Q = 72

def human(n):
    return '%dKB' % (n // 1024)

def main():
    apply = '--apply' in sys.argv
    total_before = total_after = 0
    for dirpath, _dirs, files in os.walk(ROOT):
        for f in files:
            p = os.path.join(dirpath, f)
            rel = os.path.relpath(p, ROOT).replace('\\', '/')
            if rel in SKIP:
                continue
            sz = os.path.getsize(p)
            if sz < 15000:
                continue
            try:
                im = Image.open(p)
            except Exception as e:
                print('跳过(打不开):', rel, e)
                continue
            before = im.copy()
            fmt = im.format
            if fmt == 'PNG':
                # P 模式直接减色；RGBA 先量化保留透明
                if im.mode in ('RGBA', 'LA'):
                    im = im.quantize(PNG_COLORS, Image.FASTOCTREE)
                elif im.mode == 'P':
                    im = im.quantize(PNG_COLORS, Image.FASTOCTREE)
                else:
                    im = im.convert('P', palette=Image.ADAPTIVE, colors=PNG_COLORS)
                im.save(p, 'PNG', optimize=True)
            elif fmt == 'JPEG':
                im = im.convert('RGB')
                im.save(p, 'JPEG', quality=JPG_Q, optimize=True)
            else:
                continue
            after = os.path.getsize(p)
            total_before += sz
            total_after += after
            mark = '省' if after < sz else '涨'
            diff = human(abs(after - sz))
            print('%-40s %8s -> %8s  (%s %s)' % (rel, human(sz), human(after), mark, diff))
    print('----')
    print('合计: %s -> %s, 净省 %s' % (
        human(total_before), human(total_after),
        human(total_before - total_after)))
    if not apply:
        print('（预演模式，未写文件）')

if __name__ == '__main__':
    main()
