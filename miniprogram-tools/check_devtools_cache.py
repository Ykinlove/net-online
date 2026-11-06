#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""检查微信开发者工具的编译缓存里是否残留「旧布局」的编译产物。

背景（2026-11-06 实锤）：
    开发者工具的「代码质量」面板扫的是**编译缓存**，不是磁盘。
    编译缓存按 mtime 判定有效性，而**文件被删除或改名（移动到分包）不会触发
    旧 blob 失效** —— 于是磁盘上早已搬走的文件仍留在缓存里，继续被计入
    包体、并被判成「主包未使用的 JS」。

    现场数据：主仓库磁盘上主包 cmdbook-batch 已经是 0 个，
    缓存里却还有 35 个（utils/cmdbook-batch66..100.js，编译于 10-31/11-03），
    导致开发者工具报出 45 个根本不存在的「冗余 JS」+ 主包体积超标。

    缓存目录：
        %LOCALAPPDATA%/微信开发者工具/User Data/<hash>/WeappCache/
            WeappCompileCache/<projectHash>/   编译产物 blob
            dirCache/<projectHash>/             目录快照
            skeletonCache/<projectHash>/        页面骨架

    本守卫做两件事：
        1. 找出缓存里属于本项目（projectHash 由项目路径推导）的模块清单；
        2. 比对磁盘现状，报告「缓存里还有、磁盘上已无」的幽灵模块。

    幽灵模块存在 => 开发者工具看到的是旧代码，必须清缓存后重扫。

用法：
    python check_devtools_cache.py            # 检查并报告
    python check_devtools_cache.py --clean    # 顺手清掉本项目的缓存目录
    python check_devtools_cache.py --quiet    # 只在有幽灵模块时输出
"""

import os
import re
import sys
import json
import shutil
import hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..'))
MINIPROGRAM = os.path.join(PROJ, 'miniprogram')

GREEN = '\033[32m'
RED = '\033[31m'
YELLOW = '\033[33m'
DIM = '\033[2m'
RESET = '\033[0m'

DEFINE_RE = re.compile(rb'define\(\s*"([^"]+)"')


def tool_roots():
    """返回所有候选的 WeappCache 根目录。

    目录形态（实测）：
        %LOCALAPPDATA%/微信开发者工具/User Data/<profileHash>/WeappCache/
    同一台机器上可能有多个 profile（不同微信账号），所以要全部扫一遍。
    """
    local = os.environ.get('LOCALAPPDATA')
    if not local:
        return []
    base = os.path.join(local, '微信开发者工具', 'User Data')
    if not os.path.isdir(base):
        return []
    roots = []
    for profile in os.listdir(base):
        wc = os.path.join(base, profile, 'WeappCache')
        if os.path.isdir(wc):
            roots.append(wc)
    return roots


def project_hash(project_path):
    """开发者工具用项目绝对路径的 md5 作为项目哈希。

    注意路径形态：实测必须是 **反斜杠** 的绝对路径
    （'E:\\Work buddy\\命令\\net-online' -> 2b32ffc8a952d22f47ed0f426221c746），
    用正斜杠算出来的哈希对不上，守卫会找不到缓存目录。
    """
    p = os.path.abspath(project_path)
    return hashlib.md5(p.encode('utf-8')).hexdigest()


def cache_dirs(weapp_cache, phash):
    """返回本项目在某个 WeappCache 下的三个目录（可能不存在）。"""
    return {
        'compile': os.path.join(weapp_cache, 'WeappCompileCache', phash),
        'dir': os.path.join(weapp_cache, 'dirCache', phash),
        'skeleton': os.path.join(weapp_cache, 'skeletonCache', phash),
    }


def scan_compiled_modules(compile_dir):
    """扫描编译缓存 blob，抽出 (模块名, 文件大小) 列表。"""
    mods = {}
    if not os.path.isdir(compile_dir):
        return mods
    for fn in os.listdir(compile_dir):
        if fn.endswith('.json'):
            continue
        path = os.path.join(compile_dir, fn)
        try:
            with open(path, 'rb') as f:
                blob = f.read()
        except OSError:
            continue
        m = DEFINE_RE.search(blob)
        if m:
            name = m.group(1).decode('utf-8', 'replace').replace('\\', '/')
            mods[name] = len(blob)
    return mods


def disk_js_set():
    """磁盘上真实存在的 JS（相对 miniprogram/ 根，正斜杠）。"""
    out = set()
    for dp, _ds, fs in os.walk(MINIPROGRAM):
        for f in fs:
            if f.endswith('.js'):
                rel = os.path.relpath(os.path.join(dp, f), MINIPROGRAM)
                out.add(rel.replace('\\', '/'))
    return out


def main():
    quiet = '--quiet' in sys.argv
    clean = '--clean' in sys.argv

    roots = tool_roots()
    if not roots:
        msg = '未找到开发者工具缓存目录（%LOCALAPPDATA%/微信开发者工具/User Data）'
        if not quiet:
            print('  [跳过] ' + DIM + msg + RESET)
        return 0

    phash = project_hash(PROJ)

    # 收集所有 profile 下本项目的编译模块
    mods = {}
    found_dirs = []
    for root in roots:
        dirs = cache_dirs(root, phash)
        if os.path.isdir(dirs['compile']):
            found_dirs.append(dirs)
            mods.update(scan_compiled_modules(dirs['compile']))

    if not found_dirs:
        if not quiet:
            print('  编译缓存不存在（首次编译或已清理）→ 无幽灵模块 ✓')
        return 0

    if not mods:
        if not quiet:
            print('  编译缓存为空 ✓')
        return 0

    disk = disk_js_set()
    # 幽灵 = 缓存里有、磁盘上已经没有
    ghosts = sorted(set(mods) - disk)

    # 主包里的幽灵（分包的幽灵不影响主包体积，但同样说明缓存陈旧）
    main_ghosts = [g for g in ghosts if not g.startswith(('subpkg-tool/', 'subpkg-mine/'))]

    if not ghosts:
        if not quiet:
            print('  编译缓存 %d 个模块，与磁盘一致，无幽灵模块 ✓' % len(mods))
        return 0

    print('')
    print('  [警告] 编译缓存残留 %d 个幽灵模块（磁盘上已不存在）' % len(ghosts))
    print('  ' + DIM + '开发者工具会按缓存里的旧代码统计包体，'
                      '「代码质量」面板的结果因此不可信。' + RESET)
    if main_ghosts:
        print('  ' + YELLOW + '其中 %d 个在主包 —— 直接导致「主包未使用的 JS」误报。'
              % len(main_ghosts) + RESET)
        for g in main_ghosts[:12]:
            print('    ' + DIM + g + RESET)
        if len(main_ghosts) > 12:
            print('    ' + DIM + '... 另有 %d 个' % (len(main_ghosts) - 12) + RESET)
    print('')
    print('  修复：')
    print('    1. 微信开发者工具 → 工具 → 清除缓存 → 清除文件缓存（或「全部清除」）')
    print('    2. 或运行本脚本加 --clean 参数')
    print('    3. 重新编译后再次「代码质量」扫描')
    print('')

    if clean:
        for dirs in found_dirs:
            for label, d in dirs.items():
                if os.path.isdir(d):
                    shutil.rmtree(d, ignore_errors=True)
                    print('  ' + GREEN + '已清理' + RESET + ' %s 缓存' % label)
        print('')

    return 1


if __name__ == '__main__':
    sys.exit(main())
