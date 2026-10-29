import os, glob
from PIL import Image
from collections import deque

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, 'raw')
DST = os.path.join(BASE, '..', 'miniprogram', 'images', 'preset', 'char')

MAP = [
    ('r01', 'character_01.png'),
    ('r02', 'character_02.png'),
    ('r03', 'character_03.png'),
    ('r04', 'character_04.png'),
    ('r05', 'character_05.png'),
    ('r08', 'character_08.png'),
    ('r09', 'character_09.png'),
    ('r10', 'character_10.png'),
    ('r12', 'character_12.png'),
    ('r14b', 'character_14.png'),
]


def pale(p):
    r, g, b = p
    return min(r, g, b) > 180 and (max(r, g, b) - min(r, g, b)) < 26


def process(src, dst):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    px = im.load()

    bg = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if pale(px[x, y]) and not bg[y * w + x]:
                bg[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if pale(px[x, y]) and not bg[y * w + x]:
                bg[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not bg[i] and pale(px[nx, ny]):
                    bg[i] = 1; q.append((nx, ny))

    label = [-1] * (w * h)
    areas = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if bg[i] or label[i] != -1:
                continue
            cid = len(areas); cnt = 0
            label[i] = cid
            dq = deque([(x, y)])
            while dq:
                cx, cy = dq.popleft(); cnt += 1
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not bg[j] and label[j] == -1:
                            label[j] = cid; dq.append((nx, ny))
            areas.append(cnt)

    keep = set()
    if areas:
        keep.add(areas.index(max(areas)))
        for cid, a in enumerate(areas):
            if a >= 500:
                keep.add(cid)

    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if not bg[i] and label[i] in keep:
                r, g, b = px[x, y]
                op[x, y] = (r, g, b, 255)

    bbox = out.getbbox()
    if not bbox:
        print('!! empty', src)
        return None
    canvas = Image.new('RGBA', (360, 360), (0, 0, 0, 0))
    cw, ch = bbox[2] - bbox[0], bbox[3] - bbox[1]
    s = min(340.0 / cw, 340.0 / ch)
    nw, nh = max(1, int(cw * s)), max(1, int(ch * s))
    crop = out.crop(bbox).resize((nw, nh), Image.LANCZOS)
    canvas.paste(crop, ((360 - nw) // 2, (360 - nh) // 2), crop)
    canvas.quantize(colors=96, method=Image.FASTOCTREE).save(dst)
    tag = os.path.basename(os.path.dirname(src))
    print('%-6s -> %-18s %dx%d  %dKB' % (tag, os.path.basename(dst), nw, nh, os.path.getsize(dst) // 1024))
    return dst


for key, name in MAP:
    files = sorted(glob.glob(os.path.join(RAW, key, '*.png')), key=os.path.getmtime)
    if not files:
        print('!! 缺图', key)
        continue
    process(files[-1], os.path.join(DST, name))
