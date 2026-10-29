"""角色卡后处理全流程：白底 → 透明 → 裁切 → 360×360 → 调色板压缩 → 按映射改名入库。

模型出图是纯白底 RGB（无 alpha），直接塞进小程序会在浅色卡片上留白框，所以：
  1. 四边 BFS 连通域判背景 → 全透明（人物内部的白衬衫与边缘不连通，不会被误吃）
  2. 邻边亮像素按亮度反推 alpha，羽化掉抗锯齿白边
  3. 按 alpha 包围盒裁掉留白，等比缩放居中进 360×360（与旧立绘同规格）
  4. 量化到 160 色调色板：15KB 左右/张，10 张不会把主包顶爆；平涂画风几乎看不出损失

用法：python build_chars.py [--dry]
"""
import io, os, sys, glob, shutil
import numpy as np
from PIL import Image
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'chargen_new')
CUT = os.path.join(SRC, 'cut')
DST = os.path.join(HERE, '..', 'miniprogram', 'images', 'preset', 'char')
BAK = os.path.join(HERE, 'char_backup_old')

OUT_SIZE = 360
MARGIN = 0.045
WHITE_MIN = 236
FRINGE_LUMA = 200
COLORS = 160

# 图片 → 工程内文件名（PRESET_CHARS 只有这 10 个 id，编号不连续）
MAP = {
    'char01': 'character_01', 'char02': 'character_02', 'char03': 'character_03',
    'char04': 'character_04', 'char05': 'character_05', 'char06': 'character_08',
    'char07': 'character_09', 'char08': 'character_10', 'char09': 'character_12',
    'char10': 'character_14',
}
# 第一张没有 char01 前缀（首个提示词没带编号）
FIRST_FALLBACK = 'character_01'


def remove_white_bg(im):
    a = np.array(im.convert('RGBA')).astype(np.uint8)
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)
    luma = rgb.max(axis=2)

    cand = rgb.min(axis=2) >= WHITE_MIN
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

    a[:, :, 3] = np.where(seen, 0, 255)

    near = np.zeros((h, w), dtype=bool)
    near[1:, :] |= seen[:-1, :]
    near[:-1, :] |= seen[1:, :]
    near[:, 1:] |= seen[:, :-1]
    near[:, :-1] |= seen[:, 1:]
    fringe = near & (~seen) & (luma > FRINGE_LUMA)
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
    os.makedirs(CUT, exist_ok=True)
    files = [f for f in sorted(glob.glob(os.path.join(SRC, '*.png'))) if '_cut' not in f]
    if not files:
        print('没有待处理图片'); return
    if not dry:
        os.makedirs(BAK, exist_ok=True)

    used_first = False
    for f in files:
        name = os.path.basename(f)
        tag = next((k for k in MAP if ('_%s_' % k) in ('_' + name)), None)
        if tag is None:
            if used_first:
                print('! 无法识别，跳过:', name); continue
            tag = 'char01'; used_first = True
        if tag == 'char01' and ('_char01_' in name):
            pass

        im = Image.open(f)
        out = fit_square(remove_white_bg(im))
        q = out.quantize(colors=COLORS, method=Image.FASTOCTREE)
        dst_name = MAP[tag] + '.png'
        cut_path = os.path.join(CUT, dst_name)

        if not dry:
            q.save(cut_path, optimize=True)
            if os.path.exists(os.path.join(DST, dst_name)):
                shutil.copy2(os.path.join(DST, dst_name), os.path.join(BAK, dst_name))
            shutil.copy2(cut_path, os.path.join(DST, dst_name))

        kb = os.path.getsize(cut_path) / 1024 if not dry else 0
        print('%-16s → %-14s %5.1fKB  源 %s' % (tag, dst_name, kb, im.size))

    total = sum(os.path.getsize(os.path.join(DST, n)) for n in os.listdir(DST) if n.endswith('.png'))
    print('----')
    print('立绘目录合计 %.1fKB（10 张）' % (total / 1024))


if __name__ == '__main__':
    main()
