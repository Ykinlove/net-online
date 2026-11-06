#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""校验主包布局：已迁往分包的文件不得在主包残留。

背景（2026-11-06 实锤）：
    为了压包体，命令数据（cmdbook-*）与若干工具模块（admin / categories /
    contrib / tplbook / config / skill / xlsx）从主包 `utils/` 迁到了分包：
        utils/admin.js        -> subpkg-tool/utils/admin.js
        utils/categories.js   -> subpkg-tool/utils/categories.js
        utils/contrib.js      -> subpkg-tool/utils/contrib.js
        utils/tplbook.js      -> subpkg-tool/utils/tplbook.js
        utils/cmdbook-*.js    -> subpkg-tool/utils/cmdbook-*.js
        utils/config.js       -> subpkg-mine/utils/config.js
        utils/skill.js        -> subpkg-mine/utils/skill.js
        utils/xlsx.js         -> subpkg-mine/utils/xlsx.js

    迁移是「移动」而非「复制」，主包里不该再出现同名文件。
    万一以后有人从旧分支合并 / 从备份恢复，把文件又带回主包，
    开发者工具会立刻报「主包内不应存在主包未使用的JS文件」+ 主包体积超标。

    本守卫直接对比磁盘现状，不依赖开发者工具（那个会被编译缓存干扰）。

同时校验：
    · 主包不得出现任何 cmdbook-* 数据文件（数据只应存在于分包）
    · 分包内不得反向 require 主包以外路径（跨包引用是编译期静默、真机才崩）
    · 存档/立绘类资源必须在 subpkg-mine（主包不能引用分包资源）

用法：
    python check_pkg_layout.py
"""

import os
import io
import re
import sys
import json

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.join(PROJ, 'miniprogram')

GREEN = '\033[32m'
RED = '\033[31m'
YELLOW = '\033[33m'
DIM = '\033[2m'
RESET = '\033[0m'


def norm(p):
    return p.replace('\\', '/')


def read(path):
    with io.open(path, encoding='utf-8') as f:
        return f.read()


def main():
    problems = []
    notes = []

    app = json.loads(read(os.path.join(ROOT, 'app.json')))
    sub_roots = [sp['root'] for sp in app.get('subPackages', [])]

    # ---- 1. 已迁移文件不得残留在主包 -------------------------------------
    # 这些文件在历史版本里位于主包 utils/，现已迁入分包
    migrated = {
        'utils/admin.js': 'subpkg-tool/utils/admin.js',
        'utils/categories.js': 'subpkg-tool/utils/categories.js',
        'utils/contrib.js': 'subpkg-tool/utils/contrib.js',
        'utils/tplbook.js': 'subpkg-tool/utils/tplbook.js',
        'utils/config.js': 'subpkg-mine/utils/config.js',
        'utils/skill.js': 'subpkg-mine/utils/skill.js',
        'utils/xlsx.js': 'subpkg-mine/utils/xlsx.js',
    }
    for old, new in sorted(migrated.items()):
        if os.path.exists(os.path.join(ROOT, old)):
            problems.append('主包残留已迁移文件：%s（已迁至 %s，删除主包这份）'
                            % (old, new))

    # ---- 2. 主包不得出现任何 cmdbook-* 数据文件 --------------------------
    for dp, _ds, fs in os.walk(ROOT):
        rel_dir = norm(os.path.relpath(dp, ROOT))
        if any(rel_dir == sr or rel_dir.startswith(sr + '/') for sr in sub_roots):
            continue  # 分包内允许
        for f in fs:
            if f.startswith('cmdbook-') and f.endswith('.js'):
                problems.append('主包出现命令数据文件：%s/%s（数据只应存在于分包）'
                                % (rel_dir, f))

    # ---- 3. 迁移后的文件必须在分包里确实存在 -----------------------------
    for old, new in sorted(migrated.items()):
        if not os.path.exists(os.path.join(ROOT, new)):
            problems.append('分包缺失应有文件：%s（迁移不完整）' % new)

    # ---- 4. 跨包引用：主包 -> 分包 是非法方向 -----------------------------
    #    微信分包铁律：主包不可 require 分包模块（真机崩 module is not defined）
    req_re = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")
    for dp, _ds, fs in os.walk(ROOT):
        rel_dir = norm(os.path.relpath(dp, ROOT))
        in_sub = any(rel_dir == sr or rel_dir.startswith(sr + '/')
                     for sr in sub_roots)
        for f in fs:
            if not f.endswith('.js'):
                continue
            full = os.path.join(dp, f)
            try:
                src = read(full)
            except (OSError, UnicodeDecodeError):
                continue
            for spec in req_re.findall(src):
                if not spec.startswith('.'):
                    continue
                # 解析到相对磁盘路径
                target = norm(os.path.normpath(
                    os.path.join(rel_dir, spec)))
                if not target.endswith('.js'):
                    target += '.js'
                # 目标落在某个分包里？
                hit = None
                for sr in sub_roots:
                    if target == sr or target.startswith(sr + '/'):
                        hit = sr
                        break
                if hit and not in_sub:
                    problems.append(
                        '主包引用了分包模块：%s/%s -> %s（真机会崩）'
                        % (rel_dir, f, spec))

    # ---- 5. 立绘资源必须在 subpkg-mine（主包不能引用分包资源）--------------
    if 'subpkg-mine' in sub_roots:
        char_dir = os.path.join(ROOT, 'subpkg-mine', 'images', 'preset', 'char')
        if not os.path.isdir(char_dir):
            problems.append('分包立绘目录缺失：subpkg-mine/images/preset/char')
        stale = os.path.join(ROOT, 'images', 'preset', 'char')
        if os.path.isdir(stale):
            n = len([f for f in os.listdir(stale) if f.endswith('.png')])
            if n:
                problems.append(
                    '主包残留立绘资源：images/preset/char（%d 张，'
                    '应只存在于 subpkg-mine）' % n)

    # ---- 6. 数据分包机制完整性 -------------------------------------------
    data_js = os.path.join(ROOT, 'subpkg-tool', 'utils', 'cmdbook-data.js')
    decomp = os.path.join(ROOT, 'subpkg-tool', 'utils', 'decompress.js')
    if os.path.exists(data_js):
        if not os.path.exists(decomp):
            problems.append('缺少解压模块：subpkg-tool/utils/decompress.js')
        else:
            body = read(data_js)
            if "require('./decompress.js')" not in body:
                problems.append('cmdbook-data.js 未引用 decompress.js')
            if 'unpack(' not in body:
                problems.append('cmdbook-data.js 未调用 unpack()')
            notes.append('cmdbook-data.js 大小 %d B（合并压缩包）'
                         % os.path.getsize(data_js))
    else:
        notes.append('cmdbook-data.js 不存在（未启用合并压缩）')

    # ---- 报告 -------------------------------------------------------------
    if notes:
        print('  ' + DIM + '；'.join(notes) + RESET)
    if problems:
        print('')
        print('  ' + RED + '主包布局有 %d 处问题：' % len(problems) + RESET)
        for p in problems:
            print('    ' + RED + '✗' + RESET + ' ' + p)
        print('')
        return 1

    print('  主包布局正确：已迁移文件无残留、无跨包反向引用、立绘在分包 ✓')
    return 0


if __name__ == '__main__':
    sys.exit(main())
