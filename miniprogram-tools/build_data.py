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
import os, io, sys, json, shutil, subprocess, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')
SRC = os.path.join(HERE, 'data-src')
MANIFEST = os.path.join(HERE, 'data-manifest.json')
# 压缩产物的缓存目录：<sha1>.js 是压缩形态，<sha1>.min.js 是 minify 后的原文。
# sha1 取自 minify 后内容，源没变就命中缓存，重复构建不必再调 node。
PACK_CACHE = os.path.join(HERE, '_pack_cache')
PACK_STAGE = os.path.join(HERE, '_pack_stage')

# 逻辑文件：手写代码，不是数据产物，不在 manifest 里，也不需要有对应源。
# 孤儿扫描要跳过它们，否则真正的残留产物会被噪音淹没。
LOGIC_FILES = {
    'admin.js', 'categories.js', 'cmdbook.js', 'config.js', 'contrib.js',
    'hotfix.js', 'lunar.js', 'practice.js', 'seed.js', 'skill.js',
    'store.js', 'xlsx.js',
}

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
    """源文件应该产出什么内容

    两步：minify（去注释/空白）-> 压缩（base64 + raw deflate）。
    压缩这步的存在理由是微信开发者工具「代码质量」要求每个包编译后 < 1.5 MB，
    命令库原样打包会让 subpkg-tool 顶到 2.5 MB；运行时由 utils/decompress.js 解回来。
    """
    sp = os.path.join(SRC, name)
    if not os.path.exists(sp):
        return None
    return minify_js(read(sp))


def _sha1(text):
    return hashlib.sha1(text.encode('utf-8')).hexdigest()[:16]


def pack_outputs(files):
    """{name: 产物内容}。

    按分包分组，每组合并成一个 cmdbook-data.js（整体 deflate 一次），
    各数据文件变成薄壳从数据包里取自己那一份。
    合并的理由：deflate 的窗口只有 32 KB，95 个文件各压各的匹配不到跨文件重复，
    合并后压缩率从 58% 回到 71%，直接省出约 176 KB —— 决定分包能否过 1.5 MB。

    缓存：整组内容的 sha1 作为键，源没变就复用，不必反复调 node。
    """
    by_pkg = {}
    for name, pkg in files.items():
        sp = os.path.join(SRC, name)
        if not os.path.exists(sp):
            by_pkg.setdefault(pkg, {})[name] = None
            continue
        by_pkg.setdefault(pkg, {})[name] = minify_js(read(sp))

    out = {}
    data_out = {}
    for pkg, group in by_pkg.items():
        valid = {n: m for n, m in group.items() if m is not None}
        for n, m in group.items():
            if m is None:
                out[n] = None
        if not valid:
            continue

        joined = '\n'.join(valid[n] for n in sorted(valid))
        key = _sha1(joined)
        cache_dir = os.path.join(PACK_CACHE, pkg, key)
        shell_of = lambda n: os.path.join(cache_dir, 'shell-' + n)
        data_file = os.path.join(cache_dir, 'cmdbook-data.js')

        if not (os.path.exists(data_file) and all(os.path.exists(shell_of(n)) for n in valid)):
            shutil.rmtree(cache_dir, ignore_errors=True)
            os.makedirs(cache_dir, exist_ok=True)
            stage = os.path.join(PACK_STAGE, pkg, key)
            shutil.rmtree(stage, ignore_errors=True)
            os.makedirs(stage, exist_ok=True)
            for n, m in valid.items():
                write(os.path.join(stage, n), m)
            r = subprocess.run(
                ['node', os.path.join(HERE, 'pack_data.js'), '--merge', stage, cache_dir],
                capture_output=True, text=True)
            if r.returncode != 0:
                sys.stderr.write(r.stdout + r.stderr)
                raise SystemExit('合并打包失败：node pack_data.js 返回 %d' % r.returncode)
            shutil.rmtree(stage, ignore_errors=True)

        for n in valid:
            p = shell_of(n)
            if not os.path.exists(p):
                raise SystemExit('薄壳产物缺失：%s' % p)
            out[n] = read(p)
        data_out[pkg] = read(data_file)
    return out, data_out


def build_expected_map(files):
    """({name: 期望产物内容}, {pkg: cmdbook-data.js 内容})；源缺失的名字对应 None。"""
    names = sorted(files)
    packed, data_map = pack_outputs(files)
    result = {}
    for name in names:
        sp = os.path.join(SRC, name)
        if not os.path.exists(sp):
            result[name] = None
        else:
            result[name] = packed[name]
    return result, data_map


def target_path(name, pkg):
    return os.path.join(PKG_DIR[pkg], name)


def do_build(files):
    """从源生成产物。只写变化的文件。"""
    changed, missing, orphan = [], [], []
    want_map, data_map = build_expected_map(files)

    # 先写数据包（薄壳依赖它）
    for pkg, content in sorted(data_map.items()):
        tp = os.path.join(PKG_DIR[pkg], 'cmdbook-data.js')
        cur = read(tp) if os.path.exists(tp) else None
        if cur == content:
            continue
        os.makedirs(os.path.dirname(tp), exist_ok=True)
        write(tp, content)
        changed.append(('cmdbook-data.js', pkg,
                        len(cur.encode('utf-8')) if cur else 0,
                        len(content.encode('utf-8'))))

    for name in sorted(files):
        pkg = files[name]
        want = want_map[name]
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
    # 逻辑文件（store/hotfix/cmdbook 等）本来就不在 manifest 里，
    # 混进「孤儿」列表会把真正的残留淹没 —— 之前每次构建报 13 条噪音。
    for pkg, d in PKG_DIR.items():
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('.js'):
                continue
            if f in files or f in LOGIC_FILES:
                continue
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
    want_map, data_map = build_expected_map(files)
    for pkg, content in sorted(data_map.items()):
        tp = os.path.join(PKG_DIR[pkg], 'cmdbook-data.js')
        if not os.path.exists(tp):
            bad.append(('cmdbook-data.js', pkg, '数据包产物不存在'))
        elif read(tp) != content:
            bad.append(('cmdbook-data.js', pkg, '数据包内容不一致'))
    for name in sorted(files):
        pkg = files[name]
        want = want_map[name]
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
    """救急：把产物（压缩形态）解回 data-src 的可读源码。

    产物现在是 base64(deflate(JSON))，解回来是 JSON 形态的数组字面量。
    注意引号风格会从单引号变成双引号（minify_js 不改字符串内部的引号），
    所以回灌后产物字节会变 —— 但数据本身一致，再跑一次 build 即可自洽。
    """
    n = 0
    for name in sorted(files):
        pkg = files[name]
        tp = target_path(name, pkg)
        if not os.path.exists(tp):
            continue
        r = subprocess.run(
            ['node', os.path.join(HERE, 'unpack_data.js'), tp],
            capture_output=True, text=True)
        if r.returncode != 0:
            print('  !! %s 解包失败：%s' % (name, (r.stderr or r.stdout).strip()))
            continue
        sp = os.path.join(SRC, name)
        write(sp, r.stdout)
        n += 1
        print('  已回灌: %s' % name)
    print('回灌 %d 个文件' % n)
    print('提示：引号风格会变（单引号 -> 双引号），再跑一次 '
          'python build_data.py build 让产物与源重新对齐。')
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
    want_map, data_map = build_expected_map(files)
    for name in sorted(files):
        want = want_map[name]
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
