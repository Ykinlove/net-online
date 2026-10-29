"""方案 B 单位改造：把全站 rpx 换成 calc(N * var(--u))。

规则：
  1. 只处理 wxss 与 wxml 的行内样式，跳过 /* */ 注释块
  2. `24rpx` → `calc(24 * var(--u))`，负值 / 小数同样处理
  3. 已带 calc 的不管（本工程原本没有）
打印每个文件的替换数，便于核对总量。
"""
import io, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..', 'miniprogram')
NUM = r'(-?\d+(?:\.\d+)?)rpx'
PAT = re.compile(NUM)

total = 0
files = []
for base, _, names in os.walk(ROOT):
    if 'node_modules' in base:
        continue
    for n in names:
        if n.endswith('.wxss') or n.endswith('.wxml'):
            files.append(os.path.join(base, n))

def convert(text):
    """按注释块切开，只改注释外的内容"""
    out = []
    pos = 0
    global total
    for m in re.finditer(r'/\*.*?\*/', text, re.S):
        seg = text[pos:m.start()]
        new, k = PAT.subn(lambda x: 'calc(%s * var(--u))' % x.group(1), seg)
        total += k
        out.append(new)
        out.append(m.group(0))
        pos = m.end()
    seg = text[pos:]
    new, k = PAT.subn(lambda x: 'calc(%s * var(--u))' % x.group(1), seg)
    total += k
    out.append(new)
    return ''.join(out)

for p in sorted(files):
    s = io.open(p, encoding='utf-8').read()
    if 'rpx' not in s:
        continue
    before = total
    new = convert(s)
    if new != s:
        io.open(p, 'w', encoding='utf-8').write(new)
    print('%-64s %3d 处' % (os.path.relpath(p, ROOT), total - before))

print('----')
print('合计替换 %d 处' % total)
