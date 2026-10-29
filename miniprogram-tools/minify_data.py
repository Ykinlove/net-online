# -*- coding: utf-8 -*-
"""数据文件压缩：去掉注释与多余空白，只在字符串外操作，改前备份可读源码

用法：
  python minify_data.py            # 压缩全部纯数据文件
  python minify_data.py --restore  # 从备份还原可读源码
"""
import os, io, sys, shutil, json

HERE = os.path.dirname(os.path.abspath(__file__))
MP = os.path.abspath(os.path.join(HERE, '..', 'miniprogram'))
# cmdbook 数据已搬到分包，两处都要扫
DIRS = [os.path.join(MP, 'utils'), os.path.join(MP, 'subpkg-tool', 'utils')]
SRC = os.path.join(HERE, 'data-src')

# 只压缩「纯数据」文件：逻辑文件（store/skill/xlsx/lunar/level/cmdbook）不碰
SKIP = {'cmdbook.js', 'store.js', 'skill.js', 'xlsx.js', 'lunar.js', 'level.js', 'seed.js', 'config.js'}


TIGHT = set('[]{}(),;:=')


def minify_js(src):
    """单趟状态机：字符串内原样保留，字符串外压缩空白"""
    out = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        # 字符串 / 模板字面量：原样保留（含转义）
        if c in ("'", '"', '`'):
            q = c
            out.append(c)
            i += 1
            while i < n:
                ch = src[i]
                if ch == '\\':
                    out.append(src[i:i + 2])
                    i += 2
                    continue
                out.append(ch)
                i += 1
                if ch == q:
                    break
            continue
        # 行注释
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            while i < n and src[i] != '\n':
                i += 1
            continue
        # 块注释
        if c == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        # 空白：判断是否可省
        if c.isspace():
            j = i
            while j < n and src[j].isspace():
                j += 1
            prev = out[-1] if out else ''
            nxt = src[j] if j < n else ''
            if prev in TIGHT or nxt in TIGHT:
                pass  # 紧邻标点，空格可省
            else:
                out.append(' ')
            i = j
            continue
        out.append(c)
        i += 1

    return ''.join(out).strip()


def collect():
    files = []
    for d in DIRS:
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith('.js') and f not in SKIP:
                files.append((d, f))
    return files


def do_restore():
    if not os.path.isdir(SRC):
        print('没有找到备份目录 %s' % SRC)
        return
    n = 0
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.js'):
            continue
        for d in DIRS:                       # 还原到它当前所在的目录
            if os.path.exists(os.path.join(d, f)):
                shutil.copy(os.path.join(SRC, f), os.path.join(d, f))
                n += 1
                break
    print('已还原 %d 个文件' % n)


def main():
    if '--restore' in sys.argv:
        do_restore()
        return

    if not os.path.isdir(SRC):
        os.makedirs(SRC)
    files = collect()
    before = after = 0
    changed = []
    for d, f in files:
        p = os.path.join(d, f)
        s = io.open(p, encoding='utf-8').read()
        bk = os.path.join(SRC, f)
        # 只在第一次备份（避免二次压缩时把压缩版当源码存下来）
        if not os.path.exists(bk):
            io.open(bk, 'w', encoding='utf-8').write(s)
        m = minify_js(s)
        b, a = len(s.encode('utf-8')), len(m.encode('utf-8'))
        before += b
        after += a
        if a < b:
            changed.append((f, b, a))
            io.open(p, 'w', encoding='utf-8').write(m)

    print('压缩 %d 个文件' % len(changed))
    for f, b, a in sorted(changed, key=lambda x: x[1] - x[2], reverse=True)[:12]:
        print('  %-28s %6.1fKB -> %6.1fKB  省 %5.1fKB' % (f, b / 1024.0, a / 1024.0, (b - a) / 1024.0))
    print('----')
    print('合计 %.1fKB -> %.1fKB，节省 %.1fKB (%.0f%%)'
          % (before / 1024.0, after / 1024.0, (before - after) / 1024.0, (before - after) * 100.0 / before))


if __name__ == '__main__':
    main()
