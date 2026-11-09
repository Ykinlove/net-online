#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""发布通道守卫 —— 别把「平铺预览版」当成发布源，也别忘切回去

背景（2026-11-06 实锤）：
   WorkBuddy 的云端预览打包器只认 app.json.pages、不认 subPackages。
   所以同一个小程序有两份目录形态：
     miniprogram/    分包版 —— 微信开发者工具 / 真机 / **发布**的真相源
     preview-dist/   平铺版 —— 只给 WorkBuddy 预览卡用（19 页全进 pages）
   预览与发布共用同一条通道：预览卡 Share → 更新，发布的是**最后部署的那个目录**。
   于是有一条必须靠机制守住的约定：
     日常预览部署 preview-dist/；**发布到微信前，先把 miniprogram/ 部署回去**。

为什么现在不能直接切：
   当前没有发布动作。现在把 miniprogram/ 部署上去，预览卡会立刻回到
   「navigateTo:fail 未找到页面：subpkg-mine/pages/onboard/onboard」——
   正是上一轮修好的故障。所以这条约定只能固化成「检查 + 明确指引」，
   由真正要发布的那一刻执行，而不是提前执行。

本脚本检查：
   · miniprogram/app.json 仍是分包版（有 subPackages，pages 只含主包页）
   · preview-dist/app.json 仍是平铺版（无 subPackages，pages 是全集）
   · 平铺版 pages 恰好等于「主包页 + 各分包 root/page」，无遗漏无多余
   · sync-state.json 的 directory / publishDirectory 与磁盘形态一致
   · .genie 的 localDir 指向当前部署目录（存在时），据此报出当前通道
   任何一项漂移都返回非 0 —— 这类错误在预览里看不出来，发布才会炸。

用法：
    python check_release_channel.py            # CI 用：一致性检查 + 常驻提醒
    python check_release_channel.py --release  # 发布前：额外打印部署清单
"""
import io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
WORKSPACE = os.path.dirname(ROOT)
MP = os.path.join(ROOT, 'miniprogram')
FLAT = os.path.join(ROOT, 'preview-dist')
STATE = os.path.join(WORKSPACE, '.workbuddy', 'sync-state.json')
GENIE = os.path.join(WORKSPACE, '.wbapp_EgaGqlLIzR4vlVAlHOIw74.genie')


def read_json(p):
    return json.loads(io.open(p, encoding='utf-8').read())


def expand_pages(app):
    """分包版的页面全集 = 主包 pages + 各分包 root/page。"""
    pages = list(app.get('pages') or [])
    for sp in (app.get('subPackages') or app.get('subpackages') or []):
        root = (sp.get('root') or '').strip('/')
        for p in sp.get('pages') or []:
            pages.append(root + '/' + p if root else p)
    return pages


def genie_local_dir():
    if not os.path.isfile(GENIE):
        return None
    for line in io.open(GENIE, encoding='utf-8', errors='replace'):
        if line.strip().startswith('localDir:'):
            return line.split(':', 1)[1].strip()
    return None


def main():
    problems = []

    if not os.path.isfile(os.path.join(MP, 'app.json')):
        print('发布通道：缺少 miniprogram/app.json')
        return 1
    if not os.path.isfile(os.path.join(FLAT, 'app.json')):
        problems.append('缺少 preview-dist/app.json —— 先跑 python build_preview.py')

    pkg = read_json(os.path.join(MP, 'app.json'))
    flat = read_json(os.path.join(FLAT, 'app.json')) if not problems else {}

    sp = pkg.get('subPackages') or pkg.get('subpackages') or []
    if not sp:
        problems.append('miniprogram/app.json 没有 subPackages —— 发布真相源被摊平了！'
                        '（真机首启分包收益与代码质量 1.5M 都会丢）')
    if flat and (flat.get('subPackages') or flat.get('subpackages')):
        problems.append('preview-dist/app.json 里还有 subPackages —— 预览会退回「未找到页面」')

    main_pages = list(pkg.get('pages') or [])
    sub_pages = sum(len(x.get('pages') or []) for x in sp)
    all_pages = expand_pages(pkg)
    if flat:
        got = list(flat.get('pages') or [])
        if got != all_pages:
            missing = sorted(set(all_pages) - set(got))
            extra = sorted(set(got) - set(all_pages))
            problems.append('平铺版 pages 与分包版页面全集不一致'
                            '（缺 %s / 多 %s）' % (missing, extra))

    # sync-state.json 是本机部署状态、不入库：干净克隆里没有它不算错误，
    # 跳过目录核对即可（否则 CI 在别人机器上会假红）。
    state = {}
    has_state = os.path.isfile(STATE)
    if has_state:
        state = read_json(STATE)
        d = os.path.normpath(state.get('directory') or '')
        pub = os.path.normpath(state.get('publishDirectory') or '')
        if os.path.normcase(d) != os.path.normcase(FLAT):
            problems.append('sync-state.directory 应指向 preview-dist，当前 %s' % d)
        if os.path.normcase(pub) != os.path.normcase(MP):
            problems.append('sync-state.publishDirectory 应指向 miniprogram，当前 %s' % pub)

    local = genie_local_dir()
    channel = '未知'
    if local:
        if os.path.normcase(os.path.normpath(local)) == os.path.normcase(FLAT):
            channel = '预览通道（平铺版 preview-dist）'
        elif os.path.normcase(os.path.normpath(local)) == os.path.normcase(MP):
            channel = '发布通道（分包版 miniprogram）'
        else:
            problems.append('.genie 的 localDir 既不是 preview-dist 也不是 miniprogram：%s'
                            % local)

    print('发布通道检查：')
    print('  发布真相源   miniprogram/     分包版：主包 %d 页 + 分包 %d 页'
          % (len(main_pages), sub_pages))
    print('  预览专用     preview-dist/   平铺版：%d 页全进 pages'
          % (len(flat.get('pages') or []) if flat else 0))
    print('  当前部署     %s' % channel)
    print('  sync-state   %s' % ('已读取 ✓' if has_state else '本机未初始化（干净克隆，跳过目录核对）'))

    print('')
    print('  ⚠ 发布到微信前必须执行：把 miniprogram/ 部署回去')
    print('    directory  = %s' % MP)
    print('    appId      = %s（复用，勿新建）'
          % (state.get('appId') or '<本机 sync-state.json 里的 appId>'))
    print('    appName / domainPrefix / miniProgramRequested 沿用 sync-state.json')
    print('    这一步只是「注册/预览复用」，不传 userAskedToPublish；')
    print('    真正发布在预览面板的 Share 里完成。')
    print('    部署后预览会暂时报「未找到页面」，属预期；发布完记得部署回 preview-dist。')

    if '--release' in sys.argv:
        print('')
        print('  发布前清单：')
        print('    1. python miniprogram-tools/ci.py 全绿')
        print('    2. 部署 miniprogram/（上面参数，复用同一个 appId）')
        print('    3. 预览面板右上角「分享 / Share」→ 继续试用或绑定 → 发布')
        print('    4. 发布完成后部署回 preview-dist/，恢复 19 页预览')

    if problems:
        print('')
        print('发布通道：%d 项问题' % len(problems))
        for p in problems:
            print('  ✗ ' + p)
        return 1
    print('')
    print('发布通道：全部一致 ✓（当前为预览通道，符合日常开发状态）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
