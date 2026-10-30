#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一键回归：改完数据跑这一个命令，全绿再提交

用法：
    python miniprogram-tools/ci.py            # 全量检查
    python miniprogram-tools/ci.py --fast     # 跳过宽评测（省时）

检查项（任一失败即返回非 0）：
    1. 源与产物一致性      build_data.py check
    2. 源文件格式体检      check_src_style.py
    3. 语法检查            源 + 产物全部 node --check
    4. 宽评测              eval_search.js     （690 用例）
    5. 排序评测            eval_rank.js       （56 用例）
    6. 模板评测            eval_tpl.js        （29 用例）
    7. 收藏/分享闭环       eval_fav_share.js  （31 用例）
    8. 基础清单            basics_check.js    （107 条说法）
    9. 页面冒烟            smoke_pages.js     （16 页）
    10. 条目数一致         sync_book_count.js --check
    11. 体积上限           主包 ≤ 2MB / 各分包 ≤ 2MB / 总计 ≤ 20MB
    12. 云端新增合并       eval_extras.js    （extra_items 合并到搜索/分类/详情）
    13. 投稿页数据链路     eval_admin.js      （定位→灌字段→增量 diff，含模板修复）
    14. 云函数/投稿结构     cloudfunctions x4 + 投稿页 + contrib.js 齐备
"""
import io, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')

FAST = '--fast' in sys.argv

GREEN = '\033[32m'
RED = '\033[31m'
YELLOW = '\033[33m'
DIM = '\033[2m'
RESET = '\033[0m'

results = []


def run(label, cmd, cwd=None, optional=False):
    """跑一条命令，返回 (通过, 输出)"""
    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=cwd or ROOT, capture_output=True, text=True,
                           encoding='utf-8', errors='replace')
        out = (p.stdout or '') + (p.stderr or '')
        code = p.returncode
    except Exception as e:
        out = str(e)
        code = -1
    dt = time.time() - t0
    ok = (code == 0)
    if optional and code != 0:
        ok = True
    results.append((label, ok, code, out, dt))
    return ok, out


def head(text, n=8):
    lines = [l for l in text.strip().split('\n') if l.strip()]
    return '\n'.join(lines[-n:])


def check_syntax():
    """源 + 产物全部 node --check"""
    files = []
    src_dir = os.path.join(HERE, 'data-src')
    for d in [src_dir, os.path.join(MP, 'utils'), os.path.join(MP, 'subpkg-tool', 'utils')]:
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.endswith('.js'):
                files.append(os.path.join(d, f))
    bad = []
    for p in files:
        r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
        if r.returncode != 0:
            bad.append((os.path.relpath(p, ROOT), (r.stderr or '').strip().split('\n')[0]))
    if bad:
        out = '\n'.join('  %s  %s' % b for b in bad[:10])
        results.append(('语法检查', False, 1, out, 0))
    else:
        results.append(('语法检查', True, 0, '  %d 个文件全部通过' % len(files), 0))
    return not bad


def check_size():
    """包体积上限 —— 以 app.json 声明的分包为准，不靠目录名猜"""
    LIMIT_PKG = 2 * 1024 * 1024
    LIMIT_TOTAL = 20 * 1024 * 1024

    def dir_size(d):
        t = 0
        for root, dirs, files in os.walk(d):
            for f in files:
                try:
                    t += os.path.getsize(os.path.join(root, f))
                except OSError:
                    pass
        return t

    # 从 app.json 读真实分包声明
    import json
    app_json = os.path.join(MP, 'app.json')
    with io.open(app_json, encoding='utf-8') as f:
        app = json.load(f)
    roots = [sp.get('root') for sp in (app.get('subpackages') or app.get('subPackages') or [])]

    lines = []
    ok = True
    total = 0

    for root in roots:
        p = os.path.join(MP, root)
        s = dir_size(p)
        total += s
        flag = '✗ 超限！' if s > LIMIT_PKG else '✓'
        if s > LIMIT_PKG:
            ok = False
        lines.append('  分包 %-16s %7.1f KB / 2048 KB  %s' % (root, s / 1024.0, flag))

    # 主包 = miniprogram 减去所有分包目录
    main = 0
    for root, dirs, files in os.walk(MP):
        rel = os.path.relpath(root, MP).replace('\\', '/')
        # 位于某个分包目录内 → 归分包，不算主包
        if any(rel == r or rel.startswith(r + '/') for r in roots):
            continue
        for f in files:
            try:
                main += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    total += main
    flag = '✗ 超限！' if main > LIMIT_PKG else '✓'
    if main > LIMIT_PKG:
        ok = False
    lines.append('  主包 %-16s %7.1f KB / 2048 KB  %s' % ('(miniprogram 整体)', main / 1024.0, flag))
    flag = '✗ 超限！' if total > LIMIT_TOTAL else '✓'
    if total > LIMIT_TOTAL:
        ok = False
    lines.append('  合计（主包+分包）      %7.1f KB / 20480 KB  %s' % (total / 1024.0, flag))

    results.append(('体积上限', ok, 0 if ok else 1, '\n'.join(lines), 0))
    return ok


def check_structure():
    """云函数 / 投稿页 / 客户端投稿模块 结构完整性检查。"""
    import json
    problems = []

    # app.json 必须声明投稿页与管理页
    app_json = os.path.join(MP, 'app.json')
    with io.open(app_json, encoding='utf-8') as f:
        app = json.load(f)
    all_pages = list(app.get('pages', []))
    for sp in (app.get('subpackages') or app.get('subPackages') or []):
        root = (sp.get('root') or '').rstrip('/')
        for p in sp.get('pages', []):
            all_pages.append((root + '/' + p) if root else p)

    def is_registered(need):
        for p in all_pages:
            if p == need or p.endswith('/' + need):
                return True
        return False

    for need in ['pages/contribute/contribute', 'pages/admin/admin']:
        if not is_registered(need):
            problems.append('app.json 未注册页面：' + need)

    # 客户端投稿模块
    if not os.path.isfile(os.path.join(MP, 'utils', 'contrib.js')):
        problems.append('缺少客户端模块：miniprogram/utils/contrib.js')

    # 四个云函数：每个都要有 index.js + package.json
    cf_root = os.path.join(ROOT, 'cloudfunctions')
    for fn in ['publishContent', 'submitContribution', 'listContent', 'reviewContribution']:
        d = os.path.join(cf_root, fn)
        if not os.path.isfile(os.path.join(d, 'index.js')):
            problems.append('云函数缺失 index.js：cloudfunctions/%s' % fn)
        if not os.path.isfile(os.path.join(d, 'package.json')):
            problems.append('云函数缺失 package.json：cloudfunctions/%s' % fn)

    if problems:
        results.append(('云函数/投稿结构', False, 1, '\n'.join('  ' + p for p in problems), 0))
    else:
        results.append(('云函数/投稿结构', True, 0, '  cloudfunctions x4 + 投稿页 + contrib.js 均齐备', 0))
    return not problems


def main():
    print('=' * 62)
    print('  Net 操作命令速记 —— 一键回归')
    print('=' * 62)
    print('')

    # 1 源与产物一致性
    run('源产物一致', ['python', os.path.join(HERE, 'build_data.py'), 'check'])

    # 2 源格式体检
    run('源格式体检', ['python', os.path.join(HERE, 'check_src_style.py')])

    # 3 语法
    check_syntax()

    # 4 宽评测
    if not FAST:
        run('宽评测', ['node', os.path.join(HERE, 'eval_search.js')])
    else:
        results.append(('宽评测', True, 0, '  已跳过（--fast）', 0))

    # 5-9 其余评测
    run('排序评测', ['node', os.path.join(HERE, 'eval_rank.js')])
    run('模板评测', ['node', os.path.join(HERE, 'eval_tpl.js')])
    run('收藏分享', ['node', os.path.join(HERE, 'eval_fav_share.js')])
    run('基础清单', ['node', os.path.join(HERE, 'basics_check.js')])
    run('页面冒烟', ['node', os.path.join(HERE, 'smoke_pages.js')])
    run('热更新覆盖层', ['node', os.path.join(HERE, 'eval_hotfix.js')])
    run('投稿页数据链路', ['node', os.path.join(HERE, 'eval_admin.js')])
    run('云端新增合并', ['node', os.path.join(HERE, 'eval_extras.js')])
    run('条目数一致', ['node', os.path.join(HERE, 'sync_book_count.js'), '--check'])

    # 12 云函数 / 投稿页结构
    check_structure()

    # 11 体积
    check_size()

    # 汇总
    print('')
    print('-' * 62)
    print('  检查结果')
    print('-' * 62)
    failed = 0
    for label, ok, code, out, dt in results:
        if ok:
            mark = GREEN + '✓' + RESET
            print('  %s  %-14s %s' % (mark, label, DIM + '%.1fs' % dt + RESET))
        else:
            failed += 1
            mark = RED + '✗' + RESET
            print('  %s  %-14s %s' % (mark, label, RED + '退出码 %d' % code + RESET))

    # 失败项展开
    if failed:
        print('')
        print('  失败详情：')
        for label, ok, code, out, dt in results:
            if ok:
                continue
            print('')
            print('  [%s]' % label)
            for l in head(out, 14).split('\n'):
                print('    ' + l)

    print('')
    print('=' * 62)
    if failed:
        print('  ' + RED + '有 %d 项未通过' % failed + RESET)
        print('=' * 62)
        return 1
    print('  ' + GREEN + '全部 %d 项通过 ✓' % len(results) + RESET)
    print('=' * 62)
    return 0


if __name__ == '__main__':
    sys.exit(main())
