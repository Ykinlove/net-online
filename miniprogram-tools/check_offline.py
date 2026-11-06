# -*- coding: utf-8 -*-
"""Offline First 离线层守卫 —— 端侧离线能力 + 云端真相源的接线完整性

为什么要有这个守卫：
   离线能力横跨三块，任何一块断了都表现为「用户断网时搜不到命令」，而线上
   完全静默、只在真机断网时才暴露：
     ① 端侧调度 utils/cmd-offline.js（主包）
     ② 端侧缓存读写 utils/cmd-sync.js（主包）+ 数据注入出口 cmdbook.setDataset
     ③ 云端真相源 云函数 getCmdLib（整库 1.58MB，走 manifest + 云存储下载）

   特别要守的是**微信分包隔离铁律**：主包不能 require 分包模块。
   违反时真机直接报 "module 'subpkg-tool/utils/cmdbook.js' is not defined"
   而崩溃 —— 2026-11-05 真实踩过这个坑，排查花了不少时间。
   所以离线层用「注入式解耦」：分包页面把 setDataset 注入给主包的离线层，
   而不是主包反过来 require 分包。这个守卫把该铁律变成可自动检查的规则。

本守卫检查：
   - 离线层文件齐全，导出接口完整
   - cmdbook 确实提供 setDataset 出口
   - **主包零 require 分包**（分包隔离铁律）
   - 缓存写入是原子写（临时文件 + renameSync），不落 setStorageSync
   - 四个接入页的 offline-bar 双向对称：wxml 用了标签、json 就必须注册组件
   - 组件路径能真实解析到磁盘文件
   - 云函数 getCmdLib 源码在仓库里，且客户端请求的 mode 云端都支持
   - cmdlib.json 能由 cmdbook 复现（版本号与云端一致）

跑法：python check_offline.py
"""
import io, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')

# 接入离线提示条的页面：主包 commands + 分包 search/browse/fav
OFFLINE_PAGES = [
    'pages/commands/commands',
    'subpkg-tool/pages/search/search',
    'subpkg-tool/pages/browse/browse',
    'subpkg-tool/pages/fav/fav',
]

# 分包根目录名（主包出现这些路径的 require 即违反隔离铁律）
SUBPKG_ROOTS = ['subpkg-tool', 'subpkg-mine']

# 主包目录（相对 miniprogram/）—— 这些位置不允许 require 分包
MAIN_PKG_DIRS = ['', 'utils', 'pages', 'components']


def read(rel):
    p = os.path.join(MP, rel)
    if not os.path.isfile(p):
        return ''
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def read_deployed_version():
    """读 cloudfunctions/getCmdLib/DEPLOYED_VERSION —— 记录云端已部署的命令库版本号。

    该文件只在重新部署 getCmdLib 之后更新。守卫拿它和本地生成的版本号比对，
    不一致就说明「命令库改了但云端还没重新部署」，端侧会一直拿旧数据。
    """
    p = os.path.join(ROOT, 'cloudfunctions', 'getCmdLib', 'DEPLOYED_VERSION')
    if not os.path.isfile(p):
        return None
    with io.open(p, encoding='utf-8') as f:
        v = f.read().strip()
    return v or None


def main():
    problems = []

    # ---------- 1. 离线层文件齐全 ----------
    required = [
        'utils/cmd-offline.js',
        'utils/cmd-sync.js',
        'components/offline-bar/offline-bar.js',
        'components/offline-bar/offline-bar.wxml',
        'components/offline-bar/offline-bar.json',
        'components/offline-bar/offline-bar.wxss',
    ]
    for rel in required:
        if not os.path.isfile(os.path.join(MP, rel)):
            problems.append('缺少离线层文件：miniprogram/%s' % rel)

    if problems:
        print('离线层检查：%d 项问题' % len(problems))
        for p in problems:
            print('  ✗ ' + p)
        return 1

    offline_js = read('utils/cmd-offline.js')
    sync_js = read('utils/cmd-sync.js')

    # ---------- 2. 导出接口完整 ----------
    for fn in ['ensureReady', 'doSync', 'reload', 'getStatus', 'onStatus',
               'isOnline', 'needReload', 'initNetwork', 'loadCacheIntoBook',
               'registerBookSetter']:
        if not re.search(r'\b%s\s*:' % re.escape(fn), offline_js):
            problems.append('cmd-offline.js 未导出 %s' % fn)

    for fn in ['readCache', 'writeCacheAtomic', 'clearCache',
               'pullManifest', 'pullFull', 'downloadBook']:
        if not re.search(r'\b%s\s*:' % re.escape(fn), sync_js):
            problems.append('cmd-sync.js 未导出 %s' % fn)

    # ---------- 3. 分包隔离铁律：主包不得 require 分包 ----------
    scanned = 0
    for d in MAIN_PKG_DIRS:
        base = os.path.join(MP, d) if d else MP
        if not os.path.isdir(base):
            continue
        if d in ('pages', 'components'):
            for root, dirs, files in os.walk(base):
                for fn in files:
                    if fn.endswith('.js'):
                        scanned += 1
                        src = io.open(os.path.join(root, fn), encoding='utf-8',
                                      errors='replace').read()
                        for m in re.finditer(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)", src):
                            req = m.group(1)
                            if any(req.startswith(s) or ('/' + s) in req
                                   for s in SUBPKG_ROOTS):
                                rel = os.path.relpath(os.path.join(root, fn), MP)
                                problems.append(
                                    '主包文件 %s require 了分包模块 "%s"'
                                    '（微信分包隔离铁律：主包不得依赖分包，真机会崩）'
                                    % (rel.replace('\\', '/'), req))
        else:
            for fn in sorted(os.listdir(base)):
                if not fn.endswith('.js'):
                    continue
                scanned += 1
                src = io.open(os.path.join(base, fn), encoding='utf-8',
                              errors='replace').read()
                for m in re.finditer(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)", src):
                    req = m.group(1)
                    if any(req.startswith(s) or ('/' + s) in req
                           for s in SUBPKG_ROOTS):
                        problems.append(
                            '主包文件 %s require 了分包模块 "%s"'
                            '（微信分包隔离铁律：主包不得依赖分包，真机会崩）'
                            % (fn, req))

    # ---------- 4. 缓存写入必须是原子写，不能落 setStorageSync ----------
    if 'renameSync' not in sync_js:
        problems.append('cmd-sync.js 缺少 renameSync（缓存写入不是原子写，'
                        '写到一半被打断会留下半截 JSON）')
    if 'USER_DATA_PATH' not in sync_js:
        problems.append('cmd-sync.js 缺少 USER_DATA_PATH（整库 1.58MB 不该走 '
                        'setStorageSync 的 10MB 单键上限）')
    # 剥注释再查：文件头有「为什么不用 setStorageSync」的说明文字，
    # 直接全文匹配会把注释当成真调用（假红）。
    sync_code = re.sub(r'//[^\n]*', '', re.sub(r'/\*.*?\*/', '', sync_js, flags=re.S))
    if re.search(r'\bsetStorageSync\s*\(', sync_code):
        problems.append('cmd-sync.js 用了 setStorageSync（整库不该走 storage，'
                        '会挤占小程序存储配额）')

    # ---------- 5. cmdbook 的 setDataset 出口 ----------
    cmdbook = read('subpkg-tool/utils/cmdbook.js')
    if 'function setDataset' not in cmdbook:
        problems.append('cmdbook.js 缺少 setDataset 函数（离线层无法注入数据集）')
    if not re.search(r'setDataset\s*[,}]', cmdbook):
        problems.append('cmdbook.js 未导出 setDataset')

    # ---------- 6. 页面接入双向对称 ----------
    for page in OFFLINE_PAGES:
        wxml = read(page + '.wxml')
        wjson = read(page + '.json')
        wjs = read(page + '.js')
        if not wxml:
            problems.append('页面不存在：%s' % page)
            continue

        uses_tag = 'offline-bar' in wxml
        has_comp = 'offline-bar' in wjson

        if uses_tag and not has_comp:
            problems.append('%s.wxml 用了 <offline-bar> 但 .json 未注册该组件'
                            '（真机报 Component not found）' % page)
        if has_comp and not uses_tag:
            problems.append('%s.json 注册了 offline-bar 但 .xml 没用（空注册）' % page)

        # 组件路径必须能解析到磁盘
        m = re.search(r'"offline-bar"\s*:\s*"([^"]+)"', wjson)
        if m:
            rel = m.group(1)
            abs_p = os.path.normpath(os.path.join(os.path.dirname(
                os.path.join(MP, page + '.json')), rel))
            if not os.path.isfile(abs_p + '.js'):
                problems.append('%s.json 的 offline-bar 路径解析不到文件：%s'
                                % (page, rel))

        # 页面必须调 ensureReady / registerBookSetter
        if 'cmd-offline' not in wjs:
            problems.append('%s.js 未引用 cmd-offline.js（离线层没接进该页）' % page)
        else:
            if 'ensureReady' not in wjs:
                problems.append('%s.js 未调 offline.ensureReady()'
                                '（本地缓存不会预热，断网搜不到）' % page)
            # commands 页只读内置数据，不持 cmdbook，故不需 registerBookSetter
            if 'cmdbook' in wjs and 'registerBookSetter' not in wjs:
                problems.append('%s.js 持有 cmdbook 但未调 registerBookSetter'
                                '（云端更新的数据注入不进内存 BOOK）' % page)

    # ---------- 7. 云端真相源：getCmdLib ----------
    cf_dir = os.path.join(ROOT, 'cloudfunctions', 'getCmdLib')
    cf_index = os.path.join(cf_dir, 'index.js')
    if not os.path.isfile(cf_index):
        problems.append('缺少云函数 cloudfunctions/getCmdLib/index.js'
                        '（从主仓库重跑部署会丢离线云端）')
    else:
        with io.open(cf_index, encoding='utf-8') as f:
            cf_src = f.read()
        if not os.path.isfile(os.path.join(cf_dir, 'package.json')):
            problems.append('云函数 getCmdLib 缺 package.json（装不了 wx-server-sdk）')

        # 客户端请求的 mode，云端必须都支持
        modes = set(re.findall(r"mode:\s*'([a-z]+)'", sync_js))
        for m in sorted(modes):
            if ("'%s'" % m) not in cf_src and ('"%s"' % m) not in cf_src:
                problems.append('客户端请求 mode:"%s"，但 getCmdLib 云函数不支持该模式' % m)
        if not modes:
            problems.append('cmd-sync.js 未发现任何 mode 请求（离线同步链路可能是断的）')

    # ---------- 8. cmdlib.json 可由 cmdbook 复现 ----------
    gen = os.path.join(HERE, 'build_cmdlib.js')
    if os.path.isfile(gen):
        try:
            p = subprocess.run(['node', gen, '--check'], capture_output=True,
                               text=True, encoding='utf-8', errors='replace',
                               cwd=ROOT, timeout=120)
            if p.returncode != 0:
                problems.append('build_cmdlib.js 执行失败：%s'
                                % (p.stderr or p.stdout or '').strip().split('\n')[-1])
            else:
                out = p.stdout or ''
                m = re.search(r'版本号：(\S+)', out)
                if m:
                    local_ver = m.group(1)
                    # 云端已部署的版本号记在 DEPLOYED_VERSION 文件里 ——
                    # 不写死在脚本里，否则每改一次命令库都要动脚本（容易忘、也容易改错）。
                    # 该文件只在**重新部署 getCmdLib 之后**才更新。
                    deployed_ver = read_deployed_version()
                    if deployed_ver is None:
                        problems.append('缺少 cloudfunctions/getCmdLib/DEPLOYED_VERSION'
                                        '（记录云端已部署的命令库版本号）')
                    elif local_ver != deployed_ver:
                        problems.append(
                            '命令库版本与云端不一致：本地生成 %s，云端部署的是 %s'
                            '（需重新部署 getCmdLib，并把 DEPLOYED_VERSION 更新为 %s，'
                            '端侧下次启动会自动重拉）'
                            % (local_ver, deployed_ver, local_ver))
        except Exception as e:
            problems.append('build_cmdlib.js 执行异常：%s' % e)

    # ---------- 汇总 ----------
    print('离线层检查：%d 个文件 / %d 个页面 / 主包扫描 %d 个 js'
          % (len(required), len(OFFLINE_PAGES), scanned))
    if problems:
        print('离线缓存：%d 项问题' % len(problems))
        for p in problems:
            print('  ✗ ' + p)
        return 1
    print('离线缓存：全部通过 ✓')
    return 0


if __name__ == '__main__':
    sys.exit(main())
