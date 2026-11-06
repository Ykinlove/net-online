# -*- coding: utf-8 -*-
"""用编译缓存建立「磁盘文件 -> 编译后字节」的精确映射，预测任意布局下的官方 compiledPkg。

背景（已由官方报告 + 编译缓存双向验证）：
    官方 PACKAGE_SIZE_LIMIT 统计的 compiledPkg
        ≈ 磁盘非 JS 资源字节 + 编译后（未压缩 ES5 转译）JS 字节

也就是说 minified 压缩后的磁盘大小对这条检查没有贡献，
真正计入的是「编译后未压缩」的 JS —— 所以要减的是源码信息量，不是压缩率。

本脚本：
1. 从 WeappCompileCache 读出每个模块的 define 路径与去 sourcemap 后的字节数。
2. 建立 HEAD 布局下每个磁盘文件 -> 编译字节 的映射。
3. 按当前工作区的真实布局重新归包，给出迁移后的官方 compiledPkg 预测。
"""
import os
import re
import sys
from collections import defaultdict

REPO = r"E:\Work buddy\命令\net-online"
MP = os.path.join(REPO, "miniprogram")
CACHE = (r"C:\Users\27904\AppData\Local\微信开发者工具\User Data"
         r"\bf938c1203f9e0460b7dd4d58f95dcc0\WeappCache\WeappCompileCache"
         r"\cafe1b6e124345eb3f925c453718a814")

DEFINE_RE = re.compile(rb'define\(\s*"([^"]+)"')
SRC_RE = re.compile(rb'sourceMappingURL=data:application/json;charset=utf-8;base64,')

LIMIT = 1.5 * 1024 * 1024   # 1572864
IMG_LIMIT = 200 * 1024       # 204800
IMG_EXT = {'.jpg', '.jpeg', '.png', '.svg', '.webp', '.gif', '.flac', '.m4a',
           '.ogg', '.ape', '.amr', '.wma', '.wav', '.mp3', '.mp4', '.aac',
           '.aiff', '.caf'}


def pkg_of(rel):
    """官方 getPackagesInfo 的纯前缀归包算法。"""
    if rel.startswith('subpkg-tool/'):
        return 'subpkg-tool/'
    if rel.startswith('subpkg-mine/'):
        return 'subpkg-mine/'
    return '__APP__'


def load_compile_map():
    """{编译产物里的路径: 去 sourcemap 后的字节数}"""
    out = {}
    for name in os.listdir(CACHE):
        if name.endswith('.json'):
            continue
        with open(os.path.join(CACHE, name), 'rb') as f:
            b = f.read()
        m = DEFINE_RE.search(b)
        if not m:
            continue
        mod = m.group(1).decode('utf-8')
        sm = SRC_RE.search(b)
        cut = sm.start() if sm else len(b)
        # define 包裹的固定开销：把尾部 '}));' 之前的内容去掉，只算源码部分
        out[mod] = cut
    return out


def walk_disk():
    """[(相对路径, 字节数)]，跳过 .DS_Store / .git 等"""
    res = []
    for root, dirs, files in os.walk(MP):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fn in files:
            if fn.startswith('.'):
                continue
            p = os.path.join(root, fn)
            if not os.path.isfile(p):
                continue
            rel = os.path.relpath(p, MP).replace('\\', '/')
            res.append((rel, os.path.getsize(p)))
    return res


def main():
    cmap = load_compile_map()
    print("编译缓存模块数: %d" % len(cmap))

    # 建立 编译产物路径 -> 编译字节；同一路径在缓存里唯一
    disk = walk_disk()

    # 建立「相对路径 -> 编译字节」的查找：编译产物路径就是磁盘相对路径
    # （主包：utils/xxx.js；分包：subpkg-tool/utils/xxx.js）
    compile_by_path = dict(cmap)

    # 未压缩源码 -> 编译产物的膨胀系数（用于内容有变动的文件）
    ratios = []
    for rel, size in disk:
        c = compile_by_path.get(rel)
        if c and size:
            ratios.append(c / size)
    if ratios:
        ratios.sort()
        med = ratios[len(ratios) // 2]
    else:
        med = 1.4
    print("编译膨胀系数: n=%d  min=%.2f  中位=%.2f  max=%.2f"
          % (len(ratios), ratios[0] if ratios else 0, med,
             ratios[-1] if ratios else 0))

    # 按包统计预测值
    pkg_js = defaultdict(int)
    pkg_other = defaultdict(int)
    missing = []
    for rel, size in disk:
        p = pkg_of(rel)
        if rel.endswith('.js'):
            c = compile_by_path.get(rel)
            if c is None:
                # 内容变过或新文件：用同目录其它文件的系数估算
                c = int(size * med)
                missing.append((rel, size, c))
            pkg_js[p] += c
        else:
            pkg_other[p] += size

    print("\n=== 迁移后（当前工作区）官方 compiledPkg 预测 ===")
    print("%-14s %10s %10s %10s   %s" % ("包", "非JS资源", "编译JS", "合计", "判定(限 1,572,864)"))
    for p in ('__APP__', 'subpkg-mine/', 'subpkg-tool/'):
        tot = pkg_js[p] + pkg_other[p]
        flag = "OK" if tot < LIMIT else "超 %d B" % (tot - LIMIT)
        print("%-14s %10d %10d %10d   %s" % (p, pkg_other[p], pkg_js[p], tot, flag))

    print("\n=== 图片/音频总量（全代码包合计，限 204,800 B） ===")
    img = [(rel, size) for rel, size in disk
           if os.path.splitext(rel)[1].lower() in IMG_EXT]
    tot_img = sum(s for _, s in img)
    by_dir = defaultdict(int)
    cnt = defaultdict(int)
    for rel, s in img:
        d = '/'.join(rel.split('/')[:-1]) if '/' in rel else '(根)'
        by_dir[d] += s
        cnt[d] += 1
    for d, s in sorted(by_dir.items(), key=lambda kv: -kv[1]):
        print("   %-42s %8d B  %3d 项" % (d, s, cnt[d]))
    print("   %-42s %8d B  %3d 项   -> %s" %
          ("合计", tot_img, len(img),
           "OK" if tot_img < IMG_LIMIT else "超 %d B (需减 %.1f%%)" %
           (tot_img - IMG_LIMIT, (tot_img - IMG_LIMIT) * 100.0 / tot_img)))

    if missing:
        print("\n=== 用系数估算的文件（内容有变动 / 新增） ===")
        for rel, size, c in sorted(missing, key=lambda x: -x[1])[:20]:
            print("   %-50s 磁盘 %7d -> 估算编译 %7d" % (rel, size, c))


if __name__ == '__main__':
    main()
