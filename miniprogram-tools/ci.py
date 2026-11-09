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
    9. 页面冒烟            smoke_pages.js     （19 页）
    10. 条目数一致         sync_book_count.js --check
    11. 体积上限           主包 ≤ 2MB / 各分包 ≤ 2MB / 总计 ≤ 20MB
    12. 云端新增合并       eval_extras.js    （extra_items 合并到搜索/分类/详情）
    13. 投稿页数据链路     eval_admin.js      （定位→灌字段→增量 diff，含模板修复）
    14. 云函数/投稿结构     cloudfunctions x4 + 投稿页 + 制作人页 + contrib.js 齐备
    15. 重复 id 检查       scan_dup_ids.js    （百科/模板 id 唯一，有重复返回非 0）
    16. 入口路径/集合容错  贡献内容在「我的」页 + 内容审核仅作者可见 + 集合缺失容错
    17. 部署结构          project.config.json 在根 + cloudfunctionRoot + 云函数 x4 齐备
    18. 暗黑图标          check_dark_icons.py   （theme.json 双主题对称 + 图标真实存在）
    19. 离线缓存          check_offline.py      （离线层接线 + 分包隔离铁律 + 云端真相源）
    20. 主题变量          check_theme_tokens.py （CSS 令牌闭合 + 深浅覆盖 + 三处色值一致）
    21. 代码质量          check_code_quality.py（复刻开发者工具三条包体规则：
                                                  每包编译后 < 1.5M / 图片音频合计 < 200K /
                                                  主包无「仅分包在用」的 JS）
    22. 主包布局          check_pkg_layout.py（已迁往分包的文件不得残留在主包 +
                                                  无跨包反向引用 + 立绘只在分包）
    23. 工具缓存          check_devtools_cache.py（编译缓存里的幽灵模块检查：
                                                  缓存有、磁盘无 = 开发者工具会按旧代码
                                                  统计包体，「代码质量」结果不可信）
    24. 平铺预览版        build_preview.py --ci（WorkBuddy 预览只认 app.json.pages，
                                                 不认 subPackages —— 预览必须用平铺版。
                                                 这项防「改了源码忘了重新生成平铺版
                                                 就部署」，预览会悄悄显示旧代码）
    25. 性能不变量        check_perf_idempotency.js（离线层注入幂等 / 整库缓存只读一次 /
                                                 搜索缓存复用且换数据失效 / 波纹与抽屉
                                                 走路径式 setData —— 性能退化是静默的，
                                                 功能评测全绿也看不出来，只能靠断言锁住）
    26. 视觉层叠回归      css_snapshot.py --check（展开 @import 后按真实层叠顺序
                                                 算出每页最终生效声明，与基线逐条比对；
                                                 抽共享 wxss / 调覆盖顺序才敢做）
    27. 发布通道          check_release_channel.py（miniprogram 仍是分包版 /
                                                 preview-dist 仍是平铺版 / 页面全集一致 /
                                                 sync-state 目录没漂移 —— 发布错目录
                                                 在预览里看不出来，发布才会炸）
    28. 全局类覆盖        check_global_overrides.py（页面 wxss 里同名全局类分两种：
                                                 声明不同 = 有意覆盖，35 处必须保留；
                                                 逐字相同 = 复制粘贴冗余，硬失败。
                                                 防止以后把「有意覆盖」误当成重复样式
                                                 批量删掉造成视觉事故）

    注：以上编号是检查分组，实际输出项数略多（含「热更新覆盖层」等未编号项）。
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


# ---- 跨包模块查找 -------------------------------------------------------
# 2026-11-06 起，为过开发者工具「主包 < 1.5M」检查，大量 util 被物理迁进分包。
# 守卫项如果写死某个包路径，以后再挪一次文件就会误报「缺少 xxx」。
# 这两个辅助函数在主包 + 两个分包里按文件名找，找不到返回空串。
UTIL_DIRS = [
    os.path.join(MP, 'utils'),
    os.path.join(MP, 'subpkg-tool', 'utils'),
    os.path.join(MP, 'subpkg-mine', 'utils'),
]


def find_module(name):
    """在主包 / 两个分包的 utils 目录里找同名文件，返回绝对路径；找不到返回 None。"""
    for d in UTIL_DIRS:
        p = os.path.join(d, name)
        if os.path.isfile(p):
            return p
    return None


def read_module(name):
    """跨包读一个 util 的内容；找不到返回空串。"""
    p = find_module(name)
    if not p:
        return ''
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def check_syntax():
    """源 + 产物全部 node --check"""
    files = []
    src_dir = os.path.join(HERE, 'data-src')
    for d in [src_dir] + UTIL_DIRS:
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

    for need in ['pages/contribute/contribute', 'pages/admin/admin', 'pages/maker/maker']:
        if not is_registered(need):
            problems.append('app.json 未注册页面：' + need)

    # 客户端投稿模块（2026-11-06 起随分包迁到 subpkg-tool/utils/）
    if not find_module('contrib.js'):
        problems.append('缺少客户端模块：contrib.js（应在 subpkg-tool/utils/）')

    # 五个云函数：每个都要有 index.js + package.json
    cf_root = os.path.join(ROOT, 'cloudfunctions')
    for fn in ['publishContent', 'submitContribution', 'listContent',
               'reviewContribution', 'getCmdLib']:
        d = os.path.join(cf_root, fn)
        if not os.path.isfile(os.path.join(d, 'index.js')):
            problems.append('云函数缺失 index.js：cloudfunctions/%s' % fn)
        if not os.path.isfile(os.path.join(d, 'package.json')):
            problems.append('云函数缺失 package.json：cloudfunctions/%s' % fn)

    if problems:
        results.append(('云函数/投稿结构', False, 1, '\n'.join('  ' + p for p in problems), 0))
    else:
        results.append(('云函数/投稿结构', True, 0, '  cloudfunctions x4 + 投稿页 + 制作人页 + contrib.js 均齐备', 0))
    return not problems


def check_entry_paths():
    """入口路径与集合容错守卫。

    守住四件事（与 2026-11-02 的入口重构对齐）：
      ① 「贡献内容」在「我的」页，且位置在「我的收藏」之下、「设置」之上
      ② 「内容审核」入口**只保留在「设置 → 制作人」一处** —— 「我的」页不得再出现
         第二个入口（同一个功能两个入口，用户会以为搞错了）；
         保留的那一处必须带 isAdmin 条件，且判定走服务端（utils/admin.js），
         白名单不得写进包体
      ③ 「我的」页不得再出现（作者）/（投稿）这类后缀文案
      ④ 读集合的云函数必须有集合缺失容错（否则 -502005 会把页面炸掉）
    """
    problems = []

    def read(rel):
        p = os.path.join(MP, rel)
        if not os.path.isfile(p):
            return ''
        with io.open(p, encoding='utf-8') as f:
            return f.read()

    mine_wxml = read(os.path.join('pages', 'mine', 'mine.wxml'))
    mine_js = read(os.path.join('pages', 'mine', 'mine.js'))

    # ① 贡献内容入口在「我的」页，且顺序为 我的收藏 → 贡献内容 → 设置
    if 'goContribute' not in mine_wxml:
        problems.append('mine.wxml 缺少「贡献内容」入口（应从设置页移到「我的」页）')
    if 'goContribute' not in mine_js:
        problems.append('mine.js 缺少 goContribute')
    order = []
    for key in ['goFav', 'goContribute', 'goSettings']:
        i = mine_wxml.find(key)
        if i >= 0:
            order.append((i, key))
    order.sort()
    seq = [k for _, k in order]
    if seq != ['goFav', 'goContribute', 'goSettings']:
        problems.append('mine.wxml 入口顺序应为 我的收藏→贡献内容→设置，实际：%s'
                        % ('→'.join(seq) if seq else '（未找到）'))

    # ②「内容审核」入口唯一，且只对作者/管理员可见
    #   唯一入口在「设置 → 制作人」；「我的」页不得再出现第二份。
    if 'goAdmin' in mine_wxml or 'goAdmin' in mine_js:
        problems.append('mine 页仍带「内容审核」入口（已收敛到 设置→制作人 一处，'
                        '不要两个入口）')
    # 「我的」页已经没有管理入口，就不该再为此去问服务端「是不是作者」——
    # 白白多一次云函数往返。
    if 'isAdmin' in mine_js:
        problems.append('mine.js 仍带 isAdmin 判定（该页已无管理入口，应删掉这次云函数请求）')

    # 白名单不得写进包体（admin.js 随分包迁走，两个分包各有一份）
    admin_util = read_module('admin.js')
    if 'oVfs1' in admin_util:
        problems.append('admin.js 里出现了 openid 白名单（包体人人可下载，等于公开）')
    if not admin_util:
        problems.append('缺少 admin.js（作者判定工具，应在 subpkg-tool/utils/ 或 subpkg-mine/utils/）')

    for word in ['（作者）', '（投稿）', '(作者)', '(投稿)']:
        if word in mine_wxml:
            problems.append('mine.wxml 仍带后缀文案：%s' % word)

    settings_wxml = read(os.path.join('subpkg-mine', 'pages', 'mine-settings', 'mine-settings.wxml'))
    settings_js = read(os.path.join('subpkg-mine', 'pages', 'mine-settings', 'mine-settings.js'))
    if 'goMaker' not in settings_wxml:
        problems.append('mine-settings.wxml 的「制作人」行未绑定 goMaker')
    if 'goMaker' not in settings_js:
        problems.append('mine-settings.js 缺少 goMaker')
    # 贡献内容已移出设置页
    if 'goContribute' in settings_wxml or 'goContribute' in settings_js:
        problems.append('mine-settings 仍保留「贡献内容」入口（已移到「我的」页）')

    maker_wxml = read(os.path.join('subpkg-mine', 'pages', 'maker', 'maker.wxml'))
    maker_js = read(os.path.join('subpkg-mine', 'pages', 'maker', 'maker.js'))
    if 'goAdmin' not in maker_wxml or 'goAdmin' not in maker_js:
        problems.append('maker 页缺少「内容审核」入口')
    if 'isAdmin' not in maker_wxml:
        problems.append('maker.wxml 的管理入口没有 isAdmin 条件（普通用户会看到）')
    if 'isAdmin' not in maker_js:
        problems.append('maker.js 缺少 isAdmin 判定')
    for word in ['（作者）', '（投稿）', '(作者)', '(投稿)']:
        if word in maker_wxml:
            problems.append('maker.wxml 仍带后缀文案：%s' % word)

    # admin 页自身也要有服务端权限校验（直接跳 URL 也进不去）
    admin_page = read(os.path.join('subpkg-tool', 'pages', 'admin', 'admin.js'))
    if 'admin.refresh' not in admin_page:
        problems.append('admin.js 未做服务端权限校验（直接跳 URL 可绕过入口隐藏）')

    # 读集合的云函数：集合缺失时必须容错
    cf_root = os.path.join(ROOT, 'cloudfunctions')
    for fn in ['listContent', 'reviewContribution']:
        src = ''
        p = os.path.join(cf_root, fn, 'index.js')
        if os.path.isfile(p):
            with io.open(p, encoding='utf-8') as f:
                src = f.read()
        if 'try' not in src:
            problems.append('cloudfunctions/%s 缺少集合缺失容错（会抛 -502005）' % fn)

    # listContent 需要支持 action=isadmin（客户端据此决定入口可见性）
    lc = read(os.path.join(cf_root, 'listContent', 'index.js'))
    if 'isadmin' not in lc:
        problems.append('listContent 缺少 action=isadmin（客户端无法判定作者身份）')

    # 写集合的云函数：应自动建表
    for fn in ['submitContribution', 'publishContent']:
        src = ''
        p = os.path.join(cf_root, fn, 'index.js')
        if os.path.isfile(p):
            with io.open(p, encoding='utf-8') as f:
                src = f.read()
        if 'createCollection' not in src:
            problems.append('cloudfunctions/%s 未自动创建集合（首次调用会报集合不存在）' % fn)

    if problems:
        results.append(('入口路径/集合容错', False, 1, '\n'.join('  ' + p for p in problems), 0))
    else:
        results.append(('入口路径/集合容错', True, 0,
                        '  贡献内容在「我的」页 + 内容审核仅作者可见 + 云函数集合容错齐备', 0))
    return not problems


def check_deploy_layout():
    """部署结构守卫。

    微信开发者工具要求 project.config.json 在项目根，且同时声明
    miniprogramRoot / cloudfunctionRoot —— 否则左侧文件树看不到云函数目录，
    右键没有「上传并部署」，用户会卡在部署第一步。

    另外 miniprogram/ 下也要有一份：发布通道上传的是 miniprogram/ 目录，
    appid 必须随包走（这是 2026-11-02 发布失败排查出来的硬要求）。
    两份配置路径声明各自自洽，appid 必须一致。
    """
    import json
    problems = []

    cfg_path = os.path.join(ROOT, 'project.config.json')
    if not os.path.isfile(cfg_path):
        problems.append('缺少根目录 project.config.json（开发者工具无法识别项目 / 看不到云函数）')
    else:
        with io.open(cfg_path, encoding='utf-8') as f:
            try:
                cfg = json.load(f)
            except Exception as e:
                cfg = {}
                problems.append('project.config.json 不是合法 JSON：%s' % e)

        mroot = (cfg.get('miniprogramRoot') or '').rstrip('/')
        croot = (cfg.get('cloudfunctionRoot') or '').rstrip('/')

        if mroot != 'miniprogram':
            problems.append('project.config.json 的 miniprogramRoot 应为 "miniprogram/"，当前是 "%s"' % mroot)
        if croot != 'cloudfunctions':
            problems.append('project.config.json 的 cloudfunctionRoot 应为 "cloudfunctions/"，当前是 "%s"' % croot)

        # 声明的路径必须真实存在
        for label, rel in [('miniprogramRoot', mroot), ('cloudfunctionRoot', croot)]:
            if rel and not os.path.isdir(os.path.join(ROOT, rel)):
                problems.append('%s 指向的目录不存在：%s' % (label, rel))

        # appid 必须有，否则无法上传部署
        if not cfg.get('appid'):
            problems.append('project.config.json 缺少 appid')

    # miniprogram/ 下也要有一份 project.config.json —— 发布通道上传的是
    # miniprogram/ 目录，appid 必须随包走，否则微信侧拿不到 appid 直接发布失败。
    # 两份配置各服务一个场景（IDE 打开根目录看得到云函数 / 发布通道带着 appid），
    # 所以路径声明必须自洽：
    #   根目录那份：miniprogramRoot=miniprogram/、cloudfunctionRoot=cloudfunctions/
    #   miniprogram/ 那份：miniprogramRoot=.（自己就是小程序根）
    pkg_cfg_path = os.path.join(MP, 'project.config.json')
    if not os.path.isfile(pkg_cfg_path):
        problems.append('缺少 miniprogram/project.config.json'
                        '（发布通道上传的是 miniprogram/ 目录，appid 必须随包走）')
    else:
        with io.open(pkg_cfg_path, encoding='utf-8') as f:
            try:
                pkg_cfg = json.load(f)
            except Exception as e:
                pkg_cfg = {}
                problems.append('miniprogram/project.config.json 不是合法 JSON：%s' % e)

        pmroot = (pkg_cfg.get('miniprogramRoot') or '').rstrip('/')
        if pmroot not in ('', '.'):
            problems.append('miniprogram/project.config.json 的 miniprogramRoot 应为 "."'
                            '（miniprogram/ 自己就是小程序根），当前是 "%s"' % pmroot)
        if not pkg_cfg.get('appid'):
            problems.append('miniprogram/project.config.json 缺少 appid')

        # 两份配置的 appid 必须一致，否则 IDE 与发布通道会指向不同的小程序
        root_cfg_path = os.path.join(ROOT, 'project.config.json')
        if os.path.isfile(root_cfg_path):
            with io.open(root_cfg_path, encoding='utf-8') as f:
                try:
                    root_cfg = json.load(f)
                except Exception:
                    root_cfg = {}
            if root_cfg.get('appid') and pkg_cfg.get('appid') \
                    and root_cfg['appid'] != pkg_cfg['appid']:
                problems.append('两份 project.config.json 的 appid 不一致'
                                '（%s vs %s），开发者工具与发布通道会指向不同的小程序'
                                % (root_cfg['appid'], pkg_cfg['appid']))

    # 五个云函数目录必须齐备，且带 package.json（否则「云端安装依赖」装不了 wx-server-sdk）
    # getCmdLib 是 Offline First 的云端真相源，2026-11-06 起也在部署名单里
    # （deploy_cloud.sh 的 ALL_FUNCS 已含它），缺目录会导致重跑部署时离线云端被跳过。
    cf_root = os.path.join(ROOT, 'cloudfunctions')
    for fn in ['publishContent', 'submitContribution', 'listContent',
               'reviewContribution', 'getCmdLib']:
        d = os.path.join(cf_root, fn)
        if not os.path.isdir(d):
            problems.append('缺少云函数目录：cloudfunctions/%s' % fn)
        elif not os.path.isfile(os.path.join(d, 'package.json')):
            problems.append('cloudfunctions/%s 缺 package.json（装不了 wx-server-sdk）' % fn)

    if problems:
        results.append(('部署结构', False, 1, '\n'.join('  ' + p for p in problems), 0))
    else:
        results.append(('部署结构', True, 0, '  project.config.json 在根 + cloudfunctionRoot 正确 + 云函数 x4 齐备', 0))
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

    # 13 重复 id 检查
    run('重复 id 检查', ['node', os.path.join(HERE, 'scan_dup_ids.js')])

    # 14 入口路径 / 集合容错
    check_entry_paths()

    # 15 部署结构（开发者工具能否看到并上传云函数）
    check_deploy_layout()

    # 16-18 主题 / 离线 三项守卫（2026-11-06 新增）
    #   这三项守的是「编译期静默、真机才炸」的接线问题：
    #   暗黑图标缺失、离线层断裂、主题令牌漏覆盖 —— CI 全绿但真机表现错误。
    run('暗黑图标', ['python', os.path.join(HERE, 'check_dark_icons.py')])
    run('离线缓存', ['python', os.path.join(HERE, 'check_offline.py')])
    run('主题变量', ['python', os.path.join(HERE, 'check_theme_tokens.py')])

    # 22 代码质量（2026-11-06 新增）
    #   复刻微信开发者工具「代码质量」面板里跟包体相关的三条规则：
    #   · 每个包编译后 < 1.5 M（含分包，不只是主包）
    #   · 主包+分包图片音频合计 < 200 K
    #   · 主包里没有「只有分包在用」的 JS
    #   这三条在开发者工具里是 GUI 点出来的，CI 里没法用，只能自己复刻。
    run('代码质量', ['python', os.path.join(HERE, 'check_code_quality.py')])

    # 23-24 主包布局 / 开发者工具缓存（2026-11-06 新增）
    #   这两项守的是「明明改对了，开发者工具却还报旧问题」这类假红：
    #   · 主包布局：已迁往分包的文件不得残留在主包（迁移不完整 = 冗余 JS）
    #   · 工具缓存：编译缓存里若有磁盘上已不存在的幽灵模块，
    #     开发者工具会按旧代码统计包体，「代码质量」面板结果不可信。
    run('主包布局', ['python', os.path.join(HERE, 'check_pkg_layout.py')])
    run('工具缓存', ['python', os.path.join(HERE, 'check_devtools_cache.py')])

    # 25 平铺预览版（2026-11-06 新增）
    #   WorkBuddy 的云端预览打包器只认 app.json 的 pages 数组、不认 subPackages，
    #   所以预览必须用一份「平铺版」小程序（19 页全进 pages，无 subPackages）。
    #   这项守卫防的是「改了 miniprogram/ 却忘了重新生成平铺版就部署」——
    #   那样预览会悄悄显示旧代码，比报错更难查。
    run('平铺预览版', ['python', os.path.join(HERE, 'build_preview.py'), '--ci'])

    # 26 性能不变量（2026-11-09 新增）
    #   守的是「功能全对但真机掉帧」的静默退化：整库缓存被重复解析、
    #   同一份数据集被反复注入导致索引全失效、波纹改回整数组 setData。
    #   这些都不会让任何搜索评测变红，只能靠最小运行时桩做行为断言。
    run('性能不变量', ['node', os.path.join(HERE, 'check_perf_idempotency.js')])

    # 27 视觉层叠回归（2026-11-09 新增）
    #   基线 visual-baseline.json 记录的是「重构前」每页最终生效的 25030 条声明。
    #   抽共享 wxss / 改 @import / 调覆盖顺序后会展开 import 重新算一遍，
    #   逐条不一致就报错并指出页面、选择器、属性、前后值 —— 零视觉差异才放行。
    run('视觉层叠回归', ['python', os.path.join(HERE, 'css_snapshot.py'), '--check'])

    # 28 发布通道（2026-11-09 新增）
    #   守的是「发布到微信前必须把 miniprogram/ 部署回去」这条约定。
    #   日常状态就该是预览通道（preview-dist），所以这项检查的是两份目录
    #   形态与 sync-state 是否漂移，而不是强迫现在切换 —— 提前切会立刻把
    #   预览打回「未找到页面」。每次 CI 都会把发布动作参数打印出来当提醒。
    run('发布通道', ['python', os.path.join(HERE, 'check_release_channel.py')])

    # 29 全局类覆盖（2026-11-09 新增）
    #   页面 wxss 里与 app.wxss 同名的选择器，绝大多数是「有意覆盖」，
    #   只有逐字复制的那几处才是真冗余。这项防的是把两者混为一谈：
    #   要么误删覆盖出视觉事故（由视觉层叠回归兜底），要么留着副本，
    #   以后改全局样式时页面副本不跟着变。
    run('全局类覆盖', ['python', os.path.join(HERE, 'check_global_overrides.py')])

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
