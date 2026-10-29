#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 H5 的图片资源压缩成小程序可用尺寸，输出到 miniprogram/images/
规则：按用途限制最大边 + PNG 调色板量化 / JPEG 质量控制，目标主包 < 2MB。
"""
import os
import shutil
from PIL import Image

SRC = r"E:/Work buddy/命令/net-online/clone_work/src/assets/img"
DST = r"E:/Work buddy/命令/net-online/miniprogram/images"

# (路径匹配关键字, 最大边, 是否强制JPEG, 质量/色数)
RULES = [
    ("preset/char", 360, False, 96),
    ("preset/bg", 900, True, 72),
    ("decor/skill/icons", 96, False, 64),
    ("icons/", 96, False, 48),
    ("ui/splash-bg", 1000, True, 74),
    ("ui/logo", 320, False, 128),
    ("ui/cta-button", 480, False, 96),
    ("ui/form-frame", 750, False, 96),
    ("ui/panel", 750, False, 96),
    ("decor", 400, False, 96),
]


def rule_for(rel):
    r = rel.replace(os.sep, "/")
    for key, size, force_jpg, q in RULES:
        if key in r:
            return size, force_jpg, q
    return 500, False, 96


def main():
    if os.path.exists(DST):
        shutil.rmtree(DST)
    total_in = total_out = 0
    rows = []
    for dp, dn, fn in os.walk(SRC):
        for f in fn:
            if not f.lower().endswith((".png", ".jpg", ".jpeg")):
                continue
            full = os.path.join(dp, f)
            rel = os.path.relpath(full, SRC)
            maxside, force_jpg, q = rule_for(rel)
            im = Image.open(full)
            if im.mode in ("RGBA", "LA", "P") and force_jpg:
                bg = Image.new("RGB", im.size, (255, 255, 255))
                im = im.convert("RGBA")
                bg.paste(im, mask=im.split()[-1])
                im = bg
            elif im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA")
            w, h = im.size
            if max(w, h) > maxside:
                k = maxside / float(max(w, h))
                im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
            out_dir = os.path.join(DST, os.path.dirname(rel))
            os.makedirs(out_dir, exist_ok=True)
            if force_jpg:
                out = os.path.join(DST, os.path.splitext(rel)[0] + ".jpg")
                im.convert("RGB").save(out, "JPEG", quality=q, optimize=True, progressive=True)
            else:
                out = os.path.join(DST, os.path.splitext(rel)[0] + ".png")
                im2 = im.convert("RGBA")
                alpha = im2.split()[-1]
                if alpha.getextrema()[0] == 255:  # 无透明，用调色板
                    im2 = im2.convert("RGB").quantize(colors=q, method=Image.MEDIANCUT)
                else:
                    im2 = im2.quantize(colors=q, method=Image.FASTOCTREE)
                im2.save(out, "PNG", optimize=True)
            s_in, s_out = os.path.getsize(full), os.path.getsize(out)
            total_in += s_in
            total_out += s_out
            rows.append((s_out, rel))
    rows.sort(reverse=True)
    print("原图总计 %.2f MB -> 压缩后 %.2f MB，文件 %d 个" % (total_in / 1048576, total_out / 1048576, len(rows)))
    print("--- 最大的 10 个 ---")
    for s, r in rows[:10]:
        print("  %6.1f KB  %s" % (s / 1024.0, r))


if __name__ == "__main__":
    main()
