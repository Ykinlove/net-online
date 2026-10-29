"""角色卡后处理：白底 → 透明 → 裁切 → 360×360 居中。

模型输出的图是纯白背景 RGB（无 alpha），直接塞进小程序会在浅色卡片上留下白框，
所以按三步处理：
  1. 从四边对「近白像素」做 BFS 连通域，判为背景置全透明（人物内部的白衬衫不会被误吃，
     因为它和边缘不连通）
  2. 对紧邻背景的边缘像素按亮度反推 alpha，把抗锯齿产生的白边羽化掉（否则在照片背景上会有一圈白毛边）
  3. 按 alpha 包围盒裁掉多余留白，等比缩放并居中放进 360×360（与现有立绘同规格）

用法：python process_chars.py            # 处理 chargen_new/ 下全部 png
     python process_chars.py --dry      # 只统计不写盘
"""
import io, os, sys, glob
import numpy as np
from PIL import Image
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'chargen_new')
OUT_SIZE = 360
MARGIN = 0.045          # 四周留白比例

WHITE_MIN = 236         # 三通道都 >= 这个值视为「近白」
FRINGE_LUMA = 200       # 亮度高于此值的邻边像素做羽化


def remove_white_bg(im):
    a = np.array(im.convert('RGBA')).astype(np.uint8)
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)
    luma = rgb.max(axis=2)

    cand = (rgb.min(axis=2) >= WHITE_MIN)
    seen = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))

    # 背景置透明
    a[:, :, 3] = np.where(seen, 0, 255)

    # 羽化：紧邻背景的亮像素按亮度给 alpha
    bg = seen
    near = np.zeros((h, w), dtype=bool)
    near[1:, :] |= bg[:-1, :]
    near[:-1, :] |= bg[1:, :]
    near[:, 1:] |= bg[:, :-1]
    near[:, :-1] |= bg[:, 1:]
    fringe = near & (~bg) & (luma > FRINGE_LUMA)
    alpha_f = np.clip((255 - luma) / max(1, 255 - FRINGE_LUMA) * 255, 0, 255)
    a[..., 3] = np.where(fringe, alpha_f.astype(np.uint8), a[..., 3])

    return Image.fromarray(a, 'RGBA')


def fit_square(im, size=OUT_SIZE, margin=MARGIN):
    bbox = im.split()[3].getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    side = int(max(w, h) * (1 + margin * 2))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    dry = '--dry' in sys.argv
    files = sorted(glob.glob(os.path.join(SRC, '*.png')))
    if not files:
        print('chargen_new/ 下没有 png'); return
    for f in files:
        im = Image.open(f)
        out = fit_square(remove_white_bg(im))
        a = np.array(out)
        al = a[:, :, 3]
        print('%-46s %s → 透明 %.1f%% / 尺寸 %s' % (
            os.path.basename(f)[:44], im.size, (al == 0).mean() * 100, out.size))
        if not dry:
            dst = os.path.join(SRC, os.path.splitext(os.path.basename(f))[0] + '_cut.png')
            out.save(dst, optimize=True)
    print('完成')


if __name__ == '__main__':
    main()
