"""修复 character_02.png 的黑色背景块。

其他立绘是透明背景（全透明占 65%~76%），只有 02 是一整块不透明纯黑（71%）。
做法：从四边向内做连通域（BFS）扩散，只把「与画面边缘连通的近黑不透明像素」置透明，
人物内部的黑色（头发、裤脚、手里那根 Console 线）因不与边缘连通，保持原样。
"""
from PIL import Image
import numpy as np
from collections import deque
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'images', 'preset', 'char')
SRC = os.path.join(BASE, 'character_02.png')

im = Image.open(SRC).convert('RGBA')
a = np.array(im)
h, w = a.shape[:2]

alpha = a[:, :, 3]
dark = a[:, :, :3].max(axis=2) < 48          # 近黑（含轻微压缩噪声）
cand = dark & (alpha > 0)                     # 黑且不透明

# 四边作种子
seen = np.zeros((h, w), dtype=bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if cand[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if cand[y, x] and not seen[y, x]:
            seen[y, x] = True
            q.append((y, x))

# BFS 四邻域
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not seen[ny, nx]:
            seen[ny, nx] = True
            q.append((ny, nx))

removed = int(seen.sum())
a[:, :, 3] = np.where(seen, 0, a[:, :, 3])

# 清掉背景区域里的残留 RGB（避免放大时出现黑色描边）
a[seen] = [0, 0, 0, 0]

out = Image.fromarray(a, 'RGBA')
out.save(SRC, optimize=True)

al = a[:, :, 3].astype(int)
opq = al == 255
dk = a[:, :, :3].max(axis=2) < 30
print('清除背景像素: %d (%.1f%%)' % (removed, removed / (h * w) * 100))
print('修复后: 全透明 %.3f | 不透明 %.3f | 不透明纯黑 %.3f' % ((al == 0).mean(), opq.mean(), (opq & dk).mean()))
