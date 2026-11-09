#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成「平铺版」小程序 —— 让 WorkBuddy 预览器认全部页面。

为什么需要这个脚本（2026-11-06 实锤）：
    WorkBuddy 的云端预览打包器**只读 app.json 的 pages 数组，完全不认 subPackages**。
    三重独立证据：
      A. 扫了 %LOCALAPPDATA% 缓存里 18 个历史预览包（10-31 → 11-06），
         每一个的 pageSources 都恰好 5 条路由 = 主包页数，分包路由 0 条；
      B. 历史上把 subpackages（小写）改成 subPackages（规范写法）两次，
         两次预览包仍然全是 5 条路由 —— 拼写不是原因；
      C. 整个 WorkBuddy 安装目录（含两个 asar）搜 "subPackages" = 0 处，
         打包器在云端，本地没有任何开关。
    后果：真机 / 开发者工具里分包完全正常，但在预览卡里
    navigateTo 必然报「未找到页面：subpkg-mine/pages/onboard/onboard」。

    微信官方又堵死了「pages 和 subPackages 同时声明同一页面」这条路：
    报 ["pages"]: "xxx" 不应该在 ["subPackages"][0] 中。

怎么做：
    平铺版 = 真机版目录原样 + 一个「平铺 app.json」。
    · pages 数组 = 主包页 + 各分包的 root/page 全量
    · 去掉 subPackages / preloadRule（没有分包，也就没有预下载）
    · **文件物理路径、路由字符串、require 路径、资源路径全部不变**
      —— 微信的打包原则是「声明 subPackages 后，配置路径外的目录打进主包」，
         反过来「不声明 subPackages 时，全部目录都进主包」，
         所以页面路径写成 subpkg-tool/pages/search/search 完全合法。
    · 因此这个变换是**零代码改动**的：只换一份 app.json。

用法：
    python build_preview.py           # 生成 preview-dist/
    python build_preview.py --check   # 校验 preview-dist/ 与源是否一致（CI 用）
    python build_preview.py --out X   # 指定输出目录
"""
import io, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')
DEFAULT_OUT = os.path.join(ROOT, 'preview-dist')

SKIP_NAMES = {'.DS_Store', 'Thumbs.db'}


def read_json(p):
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def write_json(p, obj):
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def flat_app_json(app):
    """把分包版 app.json 摊平成单包版。"""
    out = {}
    for k, v in app.items():
        if k in ('subPackages', 'subpackages', 'preloadRule'):
            continue
        out[k] = v

    pages = list(app.get('pages') or [])
    sps = app.get('subPackages') or app.get('subpackages') or []
    for sp in sps:
        root = (sp.get('root') or '').strip('/')
        for p in sp.get('pages') or []:
            pages.append(root + '/' + p if root else p)

    # 去重但保序（同一页面理论上不会重复，这里只是兜底）
    seen = set()
    uniq = []
    for p in pages:
        if p in seen:
            continue
        seen.add(p)
        uniq.append(p)
    out['pages'] = uniq
    return out


def copy_tree(src, dst):
    """增量同步，不再「整目录 rmtree 再全量复制」。

    以前每次构建都要一次性删掉 301 个文件再写一遍：既触发环境的批量删除
    保护，也没有必要 —— 两次构建之间绝大多数文件内容没变。现在只覆盖
    需要的文件，并单独摘掉目标里源已删除的孤儿文件（正常为 0 个）。
    app.json / project.config.json 会先被原样复制，随后由 build() 用
    平铺版内容覆盖，所以它们始终留在 wanted 集合里，不会被误删。
    """
    if not os.path.isdir(dst):
        os.makedirs(dst)

    wanted = set()
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        rel_root = os.path.relpath(root, src)
        target = dst if rel_root == '.' else os.path.join(dst, rel_root)
        if not os.path.isdir(target):
            os.makedirs(target)
        for fn in files:
            if fn.startswith('.') or fn in SKIP_NAMES:
                continue
            wanted.add(os.path.normpath(os.path.join(rel_root, fn)).replace('\\', '/'))
            shutil.copy2(os.path.join(root, fn), os.path.join(target, fn))

    # 源里已经不存在的文件才删（逐个删，不是整目录清空）
    for root, dirs, files in os.walk(dst):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fn in files:
            if fn.startswith('.') or fn in SKIP_NAMES:
                continue
            p = os.path.join(root, fn)
            rel = os.path.normpath(os.path.relpath(p, dst)).replace('\\', '/')
            if rel not in wanted:
                os.remove(p)


def build(out_dir, verbose=True):
    app = read_json(os.path.join(MP, 'app.json'))
    flat = flat_app_json(app)
    copy_tree(MP, out_dir)
    write_json(os.path.join(out_dir, 'app.json'), flat)

    # 预览目录自带的 project.config.json：miniprogramRoot 指向自己，appid 随包走。
    # 直接复用 miniprogram/project.config.json，只把 cloudfunctionRoot 摘掉
    # （预览目录里没有 cloudfunctions/，留着会让工具去找一个不存在的目录）。
    cfg = read_json(os.path.join(MP, 'project.config.json'))
    cfg.pop('cloudfunctionRoot', None)
    cfg['miniprogramRoot'] = './'
    cfg['projectname'] = 'net-online-miniprogram-preview'
    write_json(os.path.join(out_dir, 'project.config.json'), cfg)

    if verbose:
        main_pages = len(app.get('pages') or [])
        sub_pages = sum(len(sp.get('pages') or []) for sp in
                        (app.get('subPackages') or app.get('subpackages') or []))
        print('平铺版已生成：%s' % out_dir)
        print('  页面：主包 %d + 分包 %d = %d 条全部进 app.json.pages'
              % (main_pages, sub_pages, len(flat['pages'])))
        print('  分包声明：已移除（subPackages / preloadRule）')
        print('  路由与 require 路径：未改动')
    return flat


def dir_size(d):
    t = 0
    for root, dirs, files in os.walk(d):
        for f in files:
            try:
                t += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return t


def _manifest(base, skip=()):
    """{相对路径: sha1} —— 内容级指纹，用来判断平铺版是否与源码脱节。"""
    import hashlib
    out = {}
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fn in files:
            if fn.startswith('.') or fn in SKIP_NAMES:
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, base).replace('\\', '/')
            if rel in skip:
                continue
            h = hashlib.sha1()
            with open(p, 'rb') as f:
                for chunk in iter(lambda: f.read(65536), b''):
                    h.update(chunk)
            out[rel] = h.hexdigest()
    return out


def check(out_dir):
    """CI 守卫：preview-dist 必须与当前源码同步（app.json + 逐文件内容哈希）。"""
    if not os.path.isdir(out_dir):
        print('  平铺版目录不存在：%s（跑 python build_preview.py 生成）' % out_dir)
        return 1
    app = read_json(os.path.join(MP, 'app.json'))
    flat = flat_app_json(app)
    cur = read_json(os.path.join(out_dir, 'app.json'))
    if cur != flat:
        print('  平铺版 app.json 与源码不同步 —— 跑 python build_preview.py 重新生成')
        return 1

    src = _manifest(MP, skip=('app.json', 'project.config.json'))
    dst = _manifest(out_dir, skip=('app.json', 'project.config.json'))
    missing = sorted(set(src) - set(dst))
    extra = sorted(set(dst) - set(src))
    changed = sorted(r for r in set(src) & set(dst) if src[r] != dst[r])
    if missing or extra or changed:
        for m in missing:
            print('  平铺版缺少文件：%s' % m)
        for e in extra:
            print('  平铺版多出文件：%s' % e)
        for c in changed:
            print('  平铺版内容已过期：%s' % c)
        print('  跑 python build_preview.py 重新生成')
        return 1
    print('  平铺版与源码同步 ✓（%d 个文件逐一比对 sha1）' % len(src))
    return 0


def flat_size_check(out_dir):
    """平铺版的包体必须留在微信「上传硬限 2 MiB」之内。

    平铺版通常不是发布产物（发布前要把 miniprogram/ 部署回去），
    但万一直接发布了，它就是主包 —— 这时 2 MiB 是微信的硬上限，超了直接传不上去。
    顺便报一下与开发者工具 1.5 M 建议线的差距，让代价显式可见。
    """
    sys.path.insert(0, HERE)
    import check_code_quality as ccq

    app = read_json(os.path.join(out_dir, 'app.json'))
    files = ccq.walk(out_dir)
    roots = ccq.pkg_roots(app)          # 平铺版没有 subPackages -> 只有一个 __APP__
    agg = {r: 0 for r in roots}
    for rel, p, size in files:
        r = ccq.pkg_of(rel, roots)
        agg[r] += ccq.compiled_size(rel, size) if rel.endswith('.js') else size

    HARD = 2 * 1024 * 1024               # 微信官方上传上限 2 MiB
    ADVICE = int(1.5 * 1024 * 1024)      # 开发者工具「代码质量」建议线
    bad = []
    for r in roots:
        v = int(agg[r] * ccq.SAFETY)
        flag = 'OK' if v < HARD else '✗ 超 %d B' % (v - HARD)
        print('    %-14s 编译后估算 %9d B  硬限 %d %s  距 1.5M 建议线 %+d'
              % (r, v, HARD, flag, v - ADVICE))
        if v >= HARD:
            bad.append('平铺版 %s 编译后估算 %d B，超出微信 2 MiB 上传硬限 %d B'
                       % (r, v, v - HARD))
    if bad:
        for b in bad:
            print('  ' + b)
        return 1
    return 0


def ci(out_dir):
    """CI 模式：目录不存在就生成，存在就严格校验（防止「改了代码忘了重新生成」）。"""
    if not os.path.isdir(out_dir):
        build(out_dir, verbose=False)
        print('  preview-dist 原本不存在 —— 已自动生成'
              '（手动刷新跑 python build_preview.py）')
        return 0
    rc = check(out_dir)
    if rc != 0:
        return rc
    print('  平铺版包体：')
    return flat_size_check(out_dir)


def main():
    args = sys.argv[1:]
    out = DEFAULT_OUT
    if '--out' in args:
        out = os.path.abspath(args[args.index('--out') + 1])
    if '--check' in args:
        return check(out)
    if '--ci' in args:
        return ci(out)
    flat = build(out)
    size = dir_size(out)
    print('  目录体积：%d B (%.1f KB)' % (size, size / 1024.0))
    print('')
    print('  页面清单（预览器只看得到这些）：')
    for i, p in enumerate(flat['pages']):
        print('    %2d. %s' % (i + 1, p))
    return 0


if __name__ == '__main__':
    sys.exit(main())
