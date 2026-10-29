from PIL import Image
import sys

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
print('src:', im.size)
# 像素风 logo：96 色 FASTOCTREE 量化，平坦色块无损、文件骤减
q = im.quantize(96, Image.FASTOCTREE).convert('P')
q.save(dst, optimize=True)
import os
print('dst:', q.size, os.path.getsize(dst) // 1024, 'KB')
