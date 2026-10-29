# -*- coding: utf-8 -*-
"""校验地基：data-src 压缩后能否字节级复现 miniprogram 里的产物

跑法：python verify_pipeline.py
输出：每个文件的 OK / DIFF / MISSING，并给出首个差异位置
"""
import os, io, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MP = os.path.abspath(os.path.join(HERE, '..', 'miniprogram'))
SRC = os.path.join(HERE, 'data-src')

sys.path.insert(0, HERE)
from minify_data import minify_js

# 目标目录：主包 utils 与分包 subpkg-tool/utils
TARGET_DIRS = [os.path.join(MP, 'utils'), os.path.join(MP, 'subpkg-tool', 'utils')]


def find_targets(name):
    """同名文件可能出现在多处，返回所有存在的位置"""
    out = []
    for d in TARGET_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            out.append(p)
    return out


def rel(p):
    return os.path.relpath(p, MP).replace('\\', '/')


def main():
    names = sorted([f for f in os.listdir(SRC) if f.endswith('.js')])
    ok = diff = missing = multi = 0
    problems = []

    for name in names:
        sp = os.path.join(SRC, name)
        src = io.open(sp, encoding='utf-8').read()
        want = minify_js(src)
        targets = find_targets(name)
        if not targets:
            missing += 1
            problems.append('MISSING  %s  产物里找不到' % name)
            continue
        if len(targets) > 1:
            multi += 1
            print('MULTI    %s  -> %s' % (name, ', '.join(rel(t) for t in targets)))

        hit = None
        for t in targets:
            cur = io.open(t, encoding='utf-8').read()
            if cur == want:
                hit = t
                break
        if hit:
            ok += 1
        else:
            diff += 1
            t = targets[0]
            cur = io.open(t, encoding='utf-8').read()
            n = min(len(cur), len(want))
            at = -1
            for i in range(n):
                if cur[i] != want[i]:
                    at = i
                    break
            if at < 0:
                at = n
            problems.append('DIFF     %s  长度 %d vs %d，首差位置 %d\n         现有: ...%s...\n         期望: ...%s...'
                            % (name, len(cur), len(want), at,
                               cur[max(0, at - 30):at + 30].replace('\n', '\\n'),
                               want[max(0, at - 30):at + 30].replace('\n', '\\n')))

    print('')
    print('源文件 %d 个：字节级一致 %d，差异 %d，产物缺失 %d，多处存放 %d'
          % (len(names), ok, diff, missing, multi))
    if problems:
        print('')
        print('--- 问题 ---')
        for p in problems[:40]:
            print(p)
    return 1 if (diff or missing) else 0


if __name__ == '__main__':
    sys.exit(main())
