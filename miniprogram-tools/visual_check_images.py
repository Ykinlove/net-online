# -*- coding: utf-8 -*-
"""视觉验证：把不同压缩参数的素材，在「实际显示尺寸」下放大并排对比。

判断标准是「用户真能看出差别吗」，不是体积数字。
"""
import os

from PIL import Image

REPO = r"E:\Work buddy\命令\net-online"
MP = os.path.join(REPO, "miniprogram")
OUT = os.path.join(REPO, "miniprogram-tools", "_vis_check.png")


def encode_p_with_transparency(im, colors):
    im = im.convert('RGBA')
    alpha = im.getchannel('A').point(lambda a: 0 if a < 128 else 255)
    tmask = alpha.point(lambda a: 255 if a == 0 else 0)
    p = im.convert('RGB').quantize(colors=colors, method=Image.MEDIANCUT)
    p.paste(colors, mask=tmask)
    pal = p.getpalette() or [0] * 768
    while len(pal) < 768:
        pal.append(0)
    pal[colors * 3:colors * 3 + 3] = [0, 0, 0]
    p.putpalette(pal[:768])
    p.info['transparency'] = colors
    # 转回 RGBA：Pillow 合成到 RGB 画布时 transparency 会被忽略，
    # 必须先转成带 alpha 的 RGBA 才能正确叠加
    return p.convert('RGBA')


def variant(src, size, colors):
    im = Image.open(src)
    if size < max(im.size):
        w, h = im.size
        sc = size / float(max(w, h))
        im = im.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)
    return encode_p_with_transparency(im, colors)


def panel(files, variants, display_w, display_h, label_h=22):
    """variants: [(tag, callable->Image)]"""
    cols = len(variants) + 1
    cell_w = display_w + 16
    row_h = display_h + label_h + 16
    canvas = Image.new('RGB', (cols * cell_w + 20, row_h * len(files) + 40), (250, 250, 250))
    from PIL import ImageDraw
    d = ImageDraw.Draw(canvas)
    d.text((10, 8), '显示尺寸 %dx%d (2x 放大便于观察)   左起：原图 | ' +
           ' | '.join(t for t, _ in variants), fill=(20, 20, 20))
    y = 34
    for src in files:
        orig = Image.open(src).convert('RGBA').resize((display_w, display_h), Image.LANCZOS)
        canvas.paste(orig, (10, y), orig)
        d.text((12, y + display_h + 4), 'ORIGINAL', fill=(120, 120, 120))
        x = 10 + cell_w
        for tag, fn in variants:
            v = fn(src).resize((display_w, display_h), Image.LANCZOS)
            canvas.paste(v, (x, y), v)
            d.text((x + 2, y + display_h + 4), tag, fill=(20, 20, 20))
            x += cell_w
        y += row_h
    return canvas


def main():
    chars = sorted(os.listdir(os.path.join(MP, r'subpkg-mine\images\preset\char')))
    srcs = [os.path.join(MP, r'subpkg-mine\images\preset\char', chars[0])]
    v = panel(srcs, [('176px/48色', lambda s: variant(s, 176, 48)),
                     ('200px/64色', lambda s: variant(s, 200, 64)),
                     ('240px/64色', lambda s: variant(s, 240, 64))],
              150, 180)
    v.save(OUT)
    print('立绘对比 ->', OUT)

    ports = sorted(os.listdir(os.path.join(MP, r'images\portrait')))
    srcs = [os.path.join(MP, r'images\portrait', ports[0])]
    OUT2 = OUT.replace('.png', '_portrait.png')
    v = panel(srcs, [('96px/64色', lambda s: variant(s, 96, 64)),
                     ('112px/64色', lambda s: variant(s, 112, 64)),
                     ('128px/64色', lambda s: variant(s, 128, 64))],
              60, 60)
    v = v.resize((v.width * 3, v.height * 3), Image.NEAREST)
    v.save(OUT2)
    print('头像对比 ->', OUT2)


if __name__ == '__main__':
    main()
