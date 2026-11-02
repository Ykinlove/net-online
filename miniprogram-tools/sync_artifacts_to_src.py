#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把已改到产物上的数据修正回灌到 data-src 源文件。

背景：
    data-src/<文件>.js 是唯一真源，产物由 build_data.py build 压缩生成。
    正常改数据必须改源、再 build；直接改产物会让源与产物漂移，
    CI 的「源产物一致」检查会失败。

用法：
    python miniprogram-tools/sync_artifacts_to_src.py            # 检查差异
    python miniprogram-tools/sync_artifacts_to_src.py --apply    # 应用修正

实现：
    minify_js 是幂等的（压缩后再压缩结果不变），所以：
        源 --minify--> 产物
    只要让 minify(源) == 产物即可。具体做法是把「产物里改动的字符片段」
    在源里做同样的替换 —— 因为压缩只去空白与注释，不改字符串字面量内部，
    所以字符串内容在源与产物中完全一致，可以直接定位替换。
"""
import io
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
SRC = os.path.join(HERE, 'data-src')

# 逻辑文件名 -> (产物相对路径, [(旧片段, 新片段), ...])
# 片段必须是「压缩前后完全一致」的字符串字面量内容。
PATCHES = {
    'cmdbook-batch34.js': (
        'miniprogram/subpkg-tool/utils/cmdbook-batch34.js',
        [
            # 标题措辞：内容是「诊断视图」，不是 shell
            ('芯片级排障（表项 / 硬件转发 / 诊断shell）',
             '芯片级排障（表项 / 硬件转发 / 诊断视图）'),
        ],
    ),
    'cmdbook-batch49.js': (
        'miniprogram/subpkg-tool/utils/cmdbook-batch49.js',
        [
            # 与另一条「案例：IP 冲突定位到具体端口」重名，改成更准确的描述
            ('案例：IP 冲突定位到具体端口',
             '案例：ARP 攻击与 MAC 漂移的处置与攻击识别'),
        ],
    ),
    'cmdbook-route.js': (
        'miniprogram/subpkg-tool/utils/cmdbook-route.js',
        [
            # 补 SSID 维度别名，便于搜「ssid限速」
            ("kw: ['限速', 'wifi限速', '带宽限制', 'per-sta', '单个终端限速']",
             "kw: ['限速', 'wifi限速', '带宽限制', 'per-sta', '单个终端限速', 'ssid限速']"),
        ],
    ),
    'cmdbook-l3.js': (
        'miniprogram/subpkg-tool/utils/cmdbook-l3.js',
        [
            # 标题承诺 OSPF / BGP / RIP 三协议，原正文只有 OSPF 与 BGP → 补 RIP 汇总
            ("kw: ['路由汇总', 'summary', '聚合路由', 'area range', 'aggregate-address']",
             "kw: ['路由汇总', 'summary', '聚合路由', 'area range', 'aggregate-address', 'rip summary']"),
            # 华为：bgp aggregate → 追加 rip summary
            ("bgp 65001\\n aggregate 10.1.0.0 255.255.0.0 detail-suppressed']",
             "bgp 65001\\n aggregate 10.1.0.0 255.255.0.0 detail-suppressed\\nrip 1\\n summary 10.1.0.0 255.255.0.0']"),
            # H3C：bgp aggregate 16 → 追加 rip summary
            ("bgp 65001\\n aggregate 10.1.0.0 16 detail-suppressed']",
             "bgp 65001\\n aggregate 10.1.0.0 16 detail-suppressed\\nrip 1\\n summary 10.1.0.0 255.255.0.0']"),
            # 思科与锐捷两行内容相同，用行尾的 '], 区分不开，
            # 所以改成「整行替换」：一次替换两处（它们本来就该一样）
            ("router bgp 65001\\n aggregate-address 10.1.0.0 255.255.0.0 summary-only']",
             "router bgp 65001\\n aggregate-address 10.1.0.0 255.255.0.0 summary-only\\nrouter rip\\n network 10.1.0.0\\n no auto-summary']"),
        ],
    ),
    'cmdbook-batch93.js': (
        'miniprogram/utils/cmdbook-batch93.js',
        [
            # 与另一条「虚拟化网络」重名 → 改成更精确的组网视角
            ('虚拟化网络（vSwitch / 端口组 / VLAN）',
             '虚拟化组网（vSS / vDS 与三网分离）'),
        ],
    ),
}


def read(p):
    return io.open(p, encoding='utf-8').read()


def write(p, s):
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)


def main():
    apply = '--apply' in sys.argv
    sys.path.insert(0, HERE)
    from minify_data import minify_js

    changed = 0
    for name, (art_rel, patches) in sorted(PATCHES.items()):
        sp = os.path.join(SRC, name)
        ap = os.path.join(ROOT, art_rel)
        if not os.path.exists(sp):
            print('  ! 源不存在，跳过: %s' % name)
            continue

        src = read(sp)
        for old, new in patches:
            if old not in src:
                print('  ! %s: 源里找不到片段，跳过 → %r' % (name, old[:40]))
                continue
            n = src.count(old)
            # 片段出现多次时全部替换（如思科与锐捷两行内容本就相同，应一起改）
            src = src.replace(old, new)
            if n > 1:
                print('    · %s: 片段出现 %d 次，已全部替换' % (name, n))

        want = minify_js(src)
        cur = read(ap) if os.path.exists(ap) else None
        if want == cur:
            print('  = %-24s 已一致' % name)
            continue

        if not apply:
            print('  ~ %-24s 需更新（产物 %d 字节 → 期望 %d 字节）'
                  % (name, len(cur.encode('utf-8')) if cur else 0, len(want.encode('utf-8'))))
            changed += 1
            continue

        write(sp, src)
        print('  ✓ %-24s 源已更新' % name)
        changed += 1

    if not apply and changed:
        print('')
        print('有 %d 个文件需要回灌，加 --apply 执行。' % changed)
    return 0


if __name__ == '__main__':
    sys.exit(main())
