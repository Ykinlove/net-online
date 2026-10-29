# -*- coding: utf-8 -*-
"""命令百科数据构建器 —— 单一数据源的唯一入口

架构（改完请记住）：
    data-src/<文件>.js        唯一真源，可读、带注释，人工只改这里
        │  build_data.py build
        ▼
    miniprogram/<包>/utils/<文件>.js   构建产物（压缩版），由脚本生成，禁止手改

命令：
    python build_data.py build    # 从源生成全部产物（幂等，可重复跑）
    python build_data.py check    # 校验产物与源字节级一致，不一致返回非 0（挂 CI 用）
    python build_data.py status   # 看当前一致情况 + 体积
    python build_data.py restore  # 把产物内容回灌成可读源（仅当源被误改时救急）

为什么需要它：
    以前 minify_data.py 是「压缩产物 + 首次备份到 data-src」，
    方向是「产物 → 源」，导致源永远是产物的滞后快照。
    改数据要同时改两处，一旦只改一处就会漂移（本项目已实测漂移 4 个文件）。
    现在改成「源 → 产物」单向，源是唯一真源，从根上消除漂移。
"""
import os, io, sys, json, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')
SRC = os.path.join(HERE, 'data-src')
MANIFEST = os.path.join(HERE, 'data-manifest.json')

# pkg -> 产物目录
PKG_DIR = {
    'main': os.path.join(MP, 'utils'),
    'tool': os.path.join(MP, 'subpkg-tool', 'utils'),
}

sys.path.insert(0, HERE)
from minify_data import minify_js


def load_manifest():
    with io.open(MANIFEST, encoding='utf-8') as f:
        data = json.load(f)
    files = data.get('files', {})
    if not files:
        raise SystemExit('manifest 里没有 files')
    return files


def read(p):
    return io.open(p, encoding='utf-8').read()


def write(p, s):
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)


def expected_output(name):
    """源文件应该产出什么内容"""
    sp = os.path.join(SRC, name)
    if not os.path.exists(sp):
        return None
    return minify_js(read(sp))


def target_path(name, pkg):
    return os.path.join(PKG_DIR[pkg], name)


def do_build(files):
    """从源生成产物。只写变化的文件。"""
    changed, missing, orphan = [], [], []

    for name in sorted(files):
        pkg = files[name]
        want = expected_output(name)
        if want is None:
            missing.append(name)
            continue
        tp = target_path(name, pkg)
        cur = read(tp) if os.path.exists(tp) else None
        if cur == want:
            continue
        os.makedirs(os.path.dirname(tp), exist_ok=True)
        write(tp, want)
        changed.append((name, pkg, len(cur.encode('utf-8')) if cur else 0,
                        len(want.encode('utf-8'))))

    # 找出没有对应源文件的产物（历史遗留的多余产物）
    for pkg, d in PKG_DIR.items():
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('.js'):
                continue
            if f in files:
                continue
            # 逻辑文件不在 manifest 里，跳过
            orphan.append('%s/%s' % (os.path.relpath(d, MP).replace('\\', '/'), f))

    print('生成完成：更新 %d 个文件' % len(changed))
    for name, pkg, a, b in changed:
        delta = ''
        if a and b:
            delta = '（%d → %d 字节）' % (a, b)
        print('  %-28s -> %s%s' % (name, pkg, delta))
    if missing:
        print('源缺失（manifest 里有但 data-src 里没有）：' + ', '.join(missing))
    if orphan:
        print('产物无对应源（逻辑文件或历史残留，不影响构建）：')
        for o in orphan:
            print('  ' + o)
    return 0 if not missing else 1


def do_check(files):
    """校验产物与源字节级一致。不一致返回非 0。"""
    bad = []
    for name in sorted(files):
        pkg = files[name]
        want = expected_output(name)
        if want is None:
            bad.append((name, pkg, '源文件不存在'))
            continue
        tp = target_path(name, pkg)
        if not os.path.exists(tp):
            bad.append((name, pkg, '产物不存在'))
            continue
        cur = read(tp)
        if cur == want:
            continue
        # 定位首个差异
        n = min(len(cur), len(want))
        at = -1
        for i in range(n):
            if cur[i] != want[i]:
                at = i
                break
        if at < 0:
            at = n
        bad.append((name, pkg, '内容不一致，首差位置 %d，产物 %d 字节 / 期望 %d 字节'
                    % (at, len(cur), len(want))))

    print('一致性检查：%d 个数据文件' % len(files))
    if not bad:
        print('  全部一致 ✓')
        return 0
    print('  %d 个不一致 ✗' % len(bad))
    for name, pkg, why in bad:
        print('  %-28s [%s] %s' % (name, pkg, why))
    print('')
    print('修复方式：python build_data.py build（会按源重新生成产物）')
    print('若源本身被误改：python build_data.py restore（用产物回灌源，再 build）')
    return 1


def do_restore(files):
    """救急：把产物（压缩版）反压缩回 data-src 的可读格式。

    只在源被误改、且产物是正确版本时使用。
    """
    n = 0
    for name in sorted(files):
        pkg = files[name]
        tp = target_path(name, pkg)
        if not os.path.exists(tp):
            continue
        cur = read(tp)
        sp = os.path.join(SRC, name)
        old = read(sp) if os.path.exists(sp) else ''
        if old == cur:
            continue
        write(sp, cur)
        n += 1
        print('  已回灌: %s' % name)
    print('回灌 %d 个文件' % n)
    return 0


def pkg_size(d):
    total = 0
    if not os.path.isdir(d):
        return 0
    for root, dirs, files in os.walk(d):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def do_status(files):
    same = 0
    diff = []
    for name in sorted(files):
        want = expected_output(name)
        tp = target_path(name, files[name])
        if want is None or not os.path.exists(tp):
            diff.append(name)
            continue
        if read(tp) == want:
            same += 1
        else:
            diff.append(name)
    print('数据文件 %d，一致 %d，不一致 %d' % (len(files), same, len(diff)))
    if diff:
        print('不一致：' + ', '.join(diff))

    print('')
    print('体积：')
    for pkg, d in PKG_DIR.items():
        size = pkg_size(d)
        label = '主包 miniprogram/utils' if pkg == 'main' else '分包 subpkg-tool/utils'
        print('  %-28s %7.1f KB' % (label, size / 1024.0))
    main_all = pkg_size(MP)
    print('  %-28s %7.1f KB' % ('主包合计（含全部目录）', main_all / 1024.0))
    return 0


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    files = load_manifest()
    if cmd == 'build':
        return do_build(files)
    if cmd == 'check':
        return do_check(files)
    if cmd == 'restore':
        return do_restore(files)
    if cmd == 'status':
        return do_status(files)
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
