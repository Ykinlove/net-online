# -*- coding: utf-8 -*-
"""把 cmdbook-batchNN.js 注册进 cmdbook.js，并维持主包 / 分包体积均衡（幂等）

背景：命令数据会一直增长，而单个分包上限 2MB、主包上限 2MB。
      微信官方规则：主包不能引用分包私有资源，但「分包可以引用主包内的公共资源」。
      所以数据可以在两个目录之间分摊，require 前缀不同：
        - miniprogram/utils/               → 主包，前缀 '../../utils/'
        - miniprogram/subpkg-tool/utils/   → 分包，前缀 './'
      搬动文件后不用手改 cmdbook.js，本脚本按批次号重新生成 require 与展开数组。

用法：
  python reg_batches.py              # 重新注册（扫两个目录，自愈路径）
  python reg_batches.py --rebalance  # 先把体积搬均衡，再注册
  python reg_batches.py --check      # 只看体积，不改文件
"""
import io, os, re, glob, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MP = os.path.abspath(os.path.join(HERE, '..', 'miniprogram'))
TOOL_UTILS = os.path.join(MP, 'subpkg-tool', 'utils')
MAIN_UTILS = os.path.join(MP, 'utils')
TOOL_PAGES = os.path.join(MP, 'subpkg-tool', 'pages')
ENTRY = os.path.join(TOOL_UTILS, 'cmdbook.js')

# 单包上限 2MB，留 400KB 安全余量 → 超过 1.6MB 就该往另一边搬
SOFT_LIMIT = 1.6 * 1024 * 1024

# (目录, 相对 cmdbook.js 的 require 前缀)
DIRS = [(TOOL_UTILS, './'), (MAIN_UTILS, '../../utils/')]


def dir_bytes(d):
    tot = 0
    for root, _, fs in os.walk(d):
        for f in fs:
            tot += os.path.getsize(os.path.join(root, f))
    return tot


def pkg_size(d):
    """分包体积：utils + pages；主包体积：整个 miniprogram 减去所有 subpkg-* 目录"""
    if d == TOOL_UTILS:
        return dir_bytes(TOOL_UTILS) + dir_bytes(TOOL_PAGES)
    tot = 0
    for root, dirs, fs in os.walk(MP):
        # 跳过所有分包的根目录
        rel = os.path.relpath(root, MP)
        if rel.split(os.sep)[0].startswith('subpkg-'):
            continue
        for f in fs:
            tot += os.path.getsize(os.path.join(root, f))
    return tot


def batches(d):
    out = []
    for p in glob.glob(os.path.join(d, 'cmdbook-batch*.js')):
        m = re.search(r'batch(\d+)\.js$', p)
        if m:
            out.append((int(m.group(1)), p))
    return sorted(out)


def report():
    for name, d in (('主包', MAIN_UTILS), ('分包 subpkg-tool', TOOL_UTILS)):
        sz = pkg_size(d)
        print('  %-18s %6.0f KB  批次文件 %2d 个  %s' % (
            name, sz / 1024.0, len(batches(d)),
            '⚠ 超过 1.6MB，建议 --rebalance' if sz > SOFT_LIMIT else '余 %.0f KB'
            % ((2 * 1024 * 1024 - sz) / 1024.0)))


def rebalance():
    """体积大的一侧，把批号最大的批次文件搬到另一侧，直到两边接近"""
    moved = []
    for _ in range(200):
        tool_sz, main_sz = pkg_size(TOOL_UTILS), pkg_size(MAIN_UTILS)
        if abs(tool_sz - main_sz) < 80 * 1024:
            break
        # 每次都从「更大且仍有批次文件」的一侧搬
        big, small = (TOOL_UTILS, MAIN_UTILS) if tool_sz > main_sz else (MAIN_UTILS, TOOL_UTILS)
        src = batches(big)
        if not src:
            break
        n, p = src[-1]                      # 批号最大的先搬
        dst = os.path.join(small, os.path.basename(p))
        if os.path.exists(dst):
            break
        os.rename(p, dst)
        moved.append(n)
    return moved


def register():
    found = {}
    for d, prefix in DIRS:
        for n, p in batches(d):
            found[n] = prefix + os.path.basename(p)

    if not found:
        raise SystemExit('没有找到任何 cmdbook-batch*.js')

    nums = sorted(found)
    s = io.open(ENTRY, encoding='utf-8').read()
    before = s

    req_block = ''.join(
        "const { BATCH%d_EXTRA } = require('%s');\n" % (n, found[n]) for n in nums)

    span_re = re.compile(r"(?:^const \{ BATCH\d+_EXTRA \} = require\('[^']+'\);\n)+", re.M)
    if not span_re.search(s):
        raise SystemExit('找不到已有的 require 行，请检查 cmdbook.js 结构')
    s = span_re.sub(req_block, s, count=1)

    arr_re = re.compile(r"(?:^[ \t]+BATCH\d+_EXTRA,?\n)+", re.M)
    ms = [m for m in arr_re.finditer(s)]
    if not ms:
        raise SystemExit('找不到 BATCHxx_EXTRA 展开块，请检查 cmdbook.js 结构')
    blk = max(ms, key=lambda m: len(m.group(0)))
    new_arr = ''.join('  BATCH%d_EXTRA%s\n' % (n, ',' if i < len(nums) - 1 else '')
                      for i, n in enumerate(nums))
    s = s[:blk.start()] + new_arr + s[blk.end():]

    if s != before:
        io.open(ENTRY, 'w', encoding='utf-8').write(s)
        return nums, True
    return nums, False


def main():
    if '--check' in sys.argv:
        print('当前体积：')
        report()
        return

    moved = []
    if '--rebalance' in sys.argv:
        moved = rebalance()

    nums, changed = register()
    print('批次 %d 个（%d~%d）' % (len(nums), nums[0], nums[-1]))
    if moved:
        print('均衡搬移：%s（批号 → 另一侧）' % ', '.join(str(x) for x in moved))
    print('cmdbook.js %s' % ('已更新' if changed else '无变化'))
    print('当前体积：')
    report()


if __name__ == '__main__':
    main()
