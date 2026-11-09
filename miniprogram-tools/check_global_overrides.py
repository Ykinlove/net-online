#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""全局类覆盖守卫 —— 区分「有意覆盖」与「复制粘贴冗余」

为什么需要它：
    app.wxss 定义了一批全局类，页面 wxss 里也能看到同名选择器，
    但它们其实是两种性质完全相反的东西：

      · 有意覆盖（当前 35 处 / 27 个唯一选择器）
        页面按自己的布局改了声明，例如 .empty、.cmd-card、
        .search-entry-hover、.browse-page。这些**必须保留**，
        删掉就是视觉事故。

      · 纯冗余（曾 3 处，已于 2026-11-09 删除）
        把 app.wxss 的规则逐字复制到页面里，没有覆盖任何东西，
        只是让 wxss 变长，且以后改全局样式时容易漏改页面副本。

    曾经把两者混在一起当成「29 个重复全局类」列为待清理项，
    实测后才发现只有 3 处是冗余、其余 35 处动不得。
    本守卫把这个结论固化下来：

      ✗ 页面 wxss 出现与 app.wxss 逐字相同的规则 → 硬失败
      ✓ 页面对全局类的有意覆盖 → 列出来，声明属于设计意图

    「有意覆盖被误删」不需要这里再锁一份基线：视觉层叠回归
    （css_snapshot.py --check）会精确报出是哪一页、哪个选择器、
    哪个属性从什么值变成了什么值。

口径说明：
    页面侧只读**页面 wxss 自身**，不展开 @import —— 已抽到
    styles/ 目录的共享文件是受控资产，不算「页面复制」。
    app.wxss 侧展开 @import（目前无 import，保持一致即可）。

用法：
    python check_global_overrides.py          # CI 用，发现冗余返回非 0
    python check_global_overrides.py --list  # 只打印有意覆盖清单
"""
import collections
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')
APP_WXSS = os.path.join(MP, 'app.wxss')

sys.path.insert(0, HERE)
import css_snapshot as cs  # noqa: E402  复用同一套 CSS 解析 / 页面清单


def decls_key(decls):
    return tuple(sorted(decls.items()))


def page_rules(path):
    """页面 wxss 自身的规则；@import 行跳过（共享文件不算页面复制）。"""
    txt = '\n'.join(l for l in cs.read(path).splitlines()
                    if not l.strip().startswith('@import'))
    out = []
    for sel, decls in cs.collect(txt):
        if sel.startswith('@'):
            continue  # @media / @keyframes 不参与「同名全局类」判断
        out.append((sel, decls_key(decls)))
    return out


def main():
    args = sys.argv[1:]
    app_sel = collections.defaultdict(set)
    for sel, decls in cs.collect(cs.inline_imports(APP_WXSS)):
        if not sel.startswith('@'):
            app_sel[sel].add(decls_key(decls))

    redundant, overrides = [], []
    for rel in cs.page_list():
        p = os.path.join(MP, rel + '.wxss')
        if not os.path.isfile(p):
            continue
        for sel, key in page_rules(p):
            if sel not in app_sel:
                continue
            (redundant if key in app_sel[sel] else overrides).append((rel, sel))

    print('全局类覆盖检查：%d 页 / 全局类 %d 个' %
          (len(cs.page_list()), len(app_sel)))
    print('  有意覆盖 %d 处 / %d 个唯一选择器（属设计意图，勿清理）'
          % (len(overrides), len(set(s for _, s in overrides))))

    if '--list' in args:
        by_page = collections.defaultdict(list)
        for rel, sel in overrides:
            by_page[rel].append(sel)
        for rel in sorted(by_page):
            print('    %-45s %s'
                  % (rel, ', '.join(sorted(set(by_page[rel])))))

    if redundant:
        print('  ✗ 发现 %d 处与 app.wxss 逐字相同的纯冗余定义：'
              % len(redundant))
        for rel, sel in redundant:
            print('      %s  %s' % (rel, sel))
        print('    这些规则已由 app.wxss 提供，删掉即可（视觉零差异）；')
        print('    若确实要覆盖全局类，请改声明值，而不是复制原文。')
        return 1

    print('  ✓ 无纯冗余副本')
    print('全局类覆盖：全部通过 ✓')
    return 0


if __name__ == '__main__':
    sys.exit(main())
