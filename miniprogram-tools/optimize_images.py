# -*- coding: utf-8 -*-
"""图片资源压缩 —— 微信开发者工具「图片和音频资源」规则适配。

规则口径（已从开发者工具源码 + 官方扫描报告双向确认）：
    统计范围 = 主包 + 分包「全部图片/音频资源」字节总和
    判定式  = sum / 1024 < 200  →  必须 < 204,800 B
    扩展名  = jpg jpeg png svg webp gif flac m4a ogg ape amr wma wav mp3 mp4 aac aiff caf

现状 983,716 B / 101 项 → 超 778,916 B，必须砍掉 79%。

压缩策略不是「有损压到极限」，而是**按页面真实渲染尺寸重采样**：
    portrait/  128 →  96   （最大显示 60px，.char-avatar 120u）
    preset/char 360 → 200   （最大显示 150×180，.cg-preview-char 300u×360u）
    preset/bg   640 → 400   （全屏 375px 宽，.cg-preview-bg 100%）
    icons/       48 保持    （最大显示 36px，.icon-xl 72u）
    tab/         81 保持    （微信 tabBar 规范尺寸 81×81，只能量化颜色）

落盘格式：
    带 alpha 的图 -> P 模式 + tRNS（1 byte/pixel + 调色板），
    alpha 做二值化（<128 视为透明）。素材实际只显示 38~180px，边缘锯齿肉眼不可辨。
    已是 P 模式的图 -> 直接在调色板域重量化。
    背景图 -> JPEG（像素风平涂，低质量无可见伪影）。

视觉验证：miniprogram-tools/visual_check_images.py
"""
import io
import os
import shutil
import sys

from PIL import Image

REPO = r"E:\Work buddy\命令\net-online"
MP = os.path.join(REPO, "miniprogram")
OUT = os.path.join(REPO, "miniprogram-tools", "_img_opt")

# (子目录, 目标边长(None=不缩放), 调色板色数(None=非调色板图), JPEG质量(None=PNG))
PLAN = [
    # 立绘：原 360×360，但页面最大只显示 150×180（.cg-preview-char 300u×360u），
    #       降到 220 仍有 1.22x 富余；64 色保住皮肤/头发的渐变
    (r"subpkg-mine\images\preset\char", 220, 64, None),
    # 背景：像素风平涂素材，JPEG 极友好；480 是全屏 375px 宽的 1.28x
    (r"images\preset\bg", 480, None, 30),
    # 头像：最大显示 60px（.char-avatar 120u），原 128px 分辨率全保留
    (r"images\portrait", None, 48, None),
    # tabBar：微信规范尺寸 81×81，不能改，只重量化颜色
    (r"images\tab", None, 48, None),
    (r"images\tab\dark", None, 48, None),
    # 线性图标：最大显示 36px（.icon-xl 72u），原 48px 分辨率全保留
    (r"images\icons\light", None, 32, None),
    (r"images\icons\dark", None, 32, None),
]

IMG_EXT = ('.png', '.jpg', '.jpeg')


def encode_p_with_transparency(im, colors):
    """RGBA -> P 模式 + tRNS。透明像素统一指向 colors 这个索引。"""
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
    return p


def compress_one(src, dst, size, colors, quality):
    im = Image.open(src)
    if quality is not None:
        im = im.convert('RGB')
        if size and size < max(im.size):
            w, h = im.size
            sc = size / float(max(w, h))
            im = im.resize((round(w * sc), round(h * sc)), Image.LANCZOS)
        im.save(dst, 'JPEG', quality=quality, optimize=True, progressive=True)
        return
    # ⚠️ 必须是 RGBA：
    #    原图是 P 模式 + 逐像素 transparency 表时，重新量化会让这张 alpha 表失效，
    #    透明区变成垃圾索引 -> 渲染成黑底噪点。
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    if size and size < max(im.size):
        w, h = im.size
        sc = size / float(max(w, h))
        im = im.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)
    # FASTOCTREE 对 RGBA 输入会输出「带逐像素 alpha 表的调色板 PNG」，
    # 既保留完整 alpha 渐变（边缘无锯齿），又比 RGBA 真彩小得多。
    q = im.quantize(colors=colors, method=Image.FASTOCTREE)
    q.save(dst, 'PNG', optimize=True)


def main():
    apply = '--apply' in sys.argv
    out_root = OUT
    if apply:
        out_root = MP
    elif os.path.isdir(OUT):
        shutil.rmtree(OUT)

    rows = []
    grand_old = grand_new = 0
    for sub, size, colors, quality in PLAN:
        sd = os.path.join(MP, sub)
        if not os.path.isdir(sd):
            print('跳过(不存在):', sub)
            continue
        od = os.path.join(out_root, sub)
        os.makedirs(od, exist_ok=True)
        old = new = 0
        n = 0
        for fn in sorted(os.listdir(sd)):
            src = os.path.join(sd, fn)
            if not os.path.isfile(src) or os.path.splitext(fn)[1].lower() not in IMG_EXT:
                continue
            dst = os.path.join(od, fn)
            try:
                compress_one(src, dst, size, colors, quality)
            except Exception as e:
                print('  !! %s 失败: %s' % (fn, e))
                continue
            old += os.path.getsize(src)
            new += os.path.getsize(dst)
            n += 1
        rows.append((sub, n, old, new))
        grand_old += old
        grand_new += new

    print('\n%-40s %4s %10s %10s %8s' % ('目录', '项数', '原大小', '新大小', '降幅'))
    for sub, n, old, new in rows:
        print('%-40s %4d %10d %10d %7.1f%%' %
              (sub, n, old, new, (old - new) * 100.0 / old if old else 0))
    print('%-40s %4s %10d %10d %7.1f%%' %
          ('合计', sum(r[1] for r in rows), grand_old, grand_new,
           (grand_old - grand_new) * 100.0 / grand_old))
    ok = grand_new < 204800
    print('\n限额 204,800 B —— %s' %
          ('OK，余量 %d B' % (204800 - grand_new) if ok else '仍超 %d B' % (grand_new - 204800)))
    if not apply:
        print('（这是试算；加 --apply 才写回 miniprogram/）')
        print('试算输出:', OUT)


if __name__ == '__main__':
    main()
