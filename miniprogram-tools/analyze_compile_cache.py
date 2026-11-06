# -*- coding: utf-8 -*-
"""解析微信开发者工具的编译产物缓存，反推编译后的包体积构成。

目的：
1. 确认编译产物里每个模块的 define 路径（包内相对路径）。
2. 实证「跨包依赖的主包模块是否会被复制进分包」—— 这决定分包瘦身方案。
3. 得到一个可以离线估算「编译后每包体积」的模型。

缓存结构：WeappCompileCache/<projectHash>/<md5>  （blob）
         WeappCompileCache/<projectHash>/<md5>.json（infoKey / mtimeMs）
"""
import json
import os
import re
import sys
from collections import defaultdict

CACHE = r"C:\Users\27904\AppData\Local\微信开发者工具\User Data\bf938c1203f9e0460b7dd4d58f95dcc0\WeappCache\WeappCompileCache"
PROJECT_HASH = "cafe1b6e124345eb3f925c453718a814"

# define("subpkg-tool/utils/cmdbook.js", (function(require, module, exports, ...
DEFINE_RE = re.compile(rb'define\(\s*"([^"]+)"')


def load():
    """读出所有 blob 的 (路径, 字节数, 定义的模块名列表)。"""
    root = os.path.join(CACHE, PROJECT_HASH)
    out = []
    for name in sorted(os.listdir(root)):
        if name.endswith('.json'):
            continue
        p = os.path.join(root, name)
        if not os.path.isfile(p):
            continue
        with open(p, 'rb') as f:
            data = f.read()
        mods = []
        for m in DEFINE_RE.finditer(data):
            try:
                mods.append(m.group(1).decode('utf-8'))
            except UnicodeDecodeError:
                pass
        out.append((name, len(data), mods, data))
    return out


def pkg_of(path):
    """按官方 getPackagesInfo 的纯前缀算法给模块路径归包。"""
    if path.startswith('subpkg-tool/'):
        return 'subpkg-tool/'
    if path.startswith('subpkg-mine/'):
        return 'subpkg-mine/'
    return '__APP__'


def main():
    blobs = load()
    print("blob 数: %d  总字节: %d" % (len(blobs), sum(b[1] for b in blobs)))

    # 1) 每个 blob 定义的模块
    define_count = 0
    by_pkg = defaultdict(lambda: {'size': 0, 'files': []})
    module_owner = {}          # 模块名 -> blob 字节数
    no_define = []
    multi_define = []

    for name, size, mods, data in blobs:
        if not mods:
            no_define.append((name, size, data[:120]))
            continue
        define_count += 1
        if len(mods) > 1:
            multi_define.append((name, size, mods))
        for m in mods:
            module_owner[m] = size
            p = pkg_of(m)
            by_pkg[p]['size'] += size
            by_pkg[p]['files'].append((m, size))

    print("识别出 define 的 blob: %d ；无 define 的 blob: %d ；多 define 的 blob: %d"
          % (define_count, len(no_define), len(multi_define)))

    print("\n=== 按包统计（编译产物实际字节） ===")
    for pkg in sorted(by_pkg, key=lambda k: -by_pkg[k]['size']):
        d = by_pkg[pkg]
        print("  %-14s %10d B  (%8.1f KB)  文件 %d" %
              (pkg, d['size'], d['size'] / 1024.0, len(d['files'])))

    print("\n=== 关键问题：主包模块是否被复制进分包？ ===")
    # 一个模块路径只有一个 define（即只有一份）。
    # 若编译时把主包模块复制进了分包，分包 blob 里会出现以分包前缀开头、
    # 但内容其实是主包那个文件的模块 —— 即 <pkg>/utils/xxx.js 与主包 utils/xxx.js 同尾。
    main_mods = [m for m in module_owner if pkg_of(m) == '__APP__']
    base = set(main_mods)          # 主包模块的完整路径
    base_tail = {}
    for m in main_mods:
        base_tail[m] = m           # 完整路径 -> 自身
    for p in ('subpkg-tool/', 'subpkg-mine/'):
        dup = []
        for m in module_owner:
            if not m.startswith(p):
                continue
            tail = m[len(p):]       # 去掉分包前缀 -> utils/xxx.js
            if tail in base:        # 与主包完整路径相同 => 复制
                dup.append((m, tail))
        print("  %s 包内与主包「同路径」模块(判定为复制): %d" % (p, len(dup)))
        for m, src in dup[:12]:
            print("      %-48s <- 主包 %s" % (m, src))

    print("\n=== subpkg-tool/utils 的模块清单（按字节降序） ===")
    st = sorted(((module_owner[m], m) for m in module_owner
                  if m.startswith('subpkg-tool/utils/')), reverse=True)
    for size, m in st:
        print("   %9d  %s" % (size, m))
    print("   小计 %d B / %d 个" % (sum(s for s, _ in st), len(st)))

    print("\n=== __APP__ 的模块清单（按字节降序，前 30） ===")
    am = sorted(((module_owner[m], m) for m in module_owner
                 if pkg_of(m) == '__APP__'), reverse=True)
    for size, m in am[:30]:
        print("   %9d  %s" % (size, m))
    print("   小计 %d B / %d 个" % (sum(s for s, _ in am), len(am)))

    print("\n=== 分包 blob 里的模块路径前缀分布 ===")
    pref = defaultdict(int)
    for m in module_owner:
        pref['/'.join(m.split('/')[:2]) if '/' in m else m] += 1
    for k, v in sorted(pref.items(), key=lambda kv: -kv[1])[:25]:
        print("   %-34s %d" % (k, v))

    if no_define:
        print("\n=== 无 define 的 blob（前 5）===")
        for name, size, head in no_define[:5]:
            print("   %s  %d B  head=%r" % (name, size, head))

    if multi_define:
        print("\n=== 多 define 的 blob（前 5）===")
        for name, size, mods in multi_define[:5]:
            print("   %s  %d B  %s" % (name, size, mods[:6]))


if __name__ == '__main__':
    main()
