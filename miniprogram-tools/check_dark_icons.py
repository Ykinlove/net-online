# -*- coding: utf-8 -*-
"""暗黑模式图标守卫 —— theme.json / app.json / images/tab 三者的接线一致性

为什么要有这个守卫：
   暗黑模式的 tabBar 图标是**三处协同**才能正确渲染的：
     ① app.json   声明 darkmode + themeLocation，并用 @token 引用图标
     ② theme.json light/dark 两套，各自给出图标路径
     ③ images/tab  真实文件（dark 图标在 images/tab/dark/ 子目录）
   任何一环漏了，编译期不报错、运行期表现为「深色下图标看不见 / 变成空白 /
   沿用浅色图标」—— 真机上一眼能看出来，但 CI 完全静默。
   2026-11-06 这套主题系统从隔离副本合回主仓库时，正是最需要这种守卫的时刻。

本守卫只抓「结构性缺失」，不评价视觉风格：
   - theme.json 必须同时有 light 与 dark，且两套键集完全对称
   - theme.json 里每个图标路径都必须真实存在于磁盘
   - app.json 的 darkmode / themeLocation 接线正确
   - app.json 里每个 @token 引用都必须在 light 与 dark 中都有定义
   - 暗黑图标不能与浅色图标是同一个文件（复制粘贴忘改的典型事故）
   - tabBar 条目数与图标对数量一致

跑法：python check_dark_icons.py
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')


def read_json(rel):
    p = os.path.join(MP, rel)
    with io.open(p, encoding='utf-8') as f:
        return json.load(f)


def main():
    problems = []
    notes = []

    # ---------- 1. app.json 的暗黑接线 ----------
    try:
        app = read_json('app.json')
    except Exception as e:
        print('✗ app.json 读取失败：%s' % e)
        return 1

    if app.get('darkmode') is not True:
        problems.append('app.json 缺少 "darkmode": true（系统深色下不会跟随）')

    theme_loc = app.get('themeLocation')
    if not theme_loc:
        problems.append('app.json 缺少 themeLocation（指向深色主题配置文件）')
    elif not os.path.isfile(os.path.join(MP, theme_loc)):
        problems.append('app.json 的 themeLocation 指向的文件不存在：%s' % theme_loc)

    # ---------- 2. theme.json 双主题对称 ----------
    theme_path = os.path.join(MP, theme_loc or 'theme.json')
    if not os.path.isfile(theme_path):
        print('✗ theme.json 不存在：%s' % theme_path)
        return 1

    with io.open(theme_path, encoding='utf-8') as f:
        theme = json.load(f)

    for mode in ('light', 'dark'):
        if mode not in theme:
            problems.append('theme.json 缺少 "%s" 主题段' % mode)
    if 'light' not in theme or 'dark' not in theme:
        print('  %d 项问题' % len(problems))
        for p in problems:
            print('  ✗ ' + p)
        return 1

    light, dark = theme['light'], theme['dark']

    # 键集对称：dark 少一个键 → 该键在深色下无定义，@token 引用会取不到值
    only_light = sorted(set(light) - set(dark))
    only_dark = sorted(set(dark) - set(light))
    if only_light:
        problems.append('theme.json 的 dark 段缺少键：%s' % ' '.join(only_light))
    if only_dark:
        problems.append('theme.json 的 light 段缺少键：%s' % ' '.join(only_dark))

    # ---------- 3. 图标路径必须真实存在 ----------
    icon_keys = [k for k in light if re.search(r'[iI]con', k)]

    def resolve(path_val):
        """把 theme.json 里的图标路径解析成磁盘绝对路径"""
        # theme.json 里写的是 "/images/tab/home.png"（小程序根相对）
        rel = path_val.lstrip('/')
        return os.path.join(MP, rel.replace('/', os.sep))

    for mode in ('light', 'dark'):
        for k in icon_keys:
            v = light.get(k) if mode == 'light' else dark.get(k)
            if not isinstance(v, str) or not v:
                continue
            abs_p = resolve(v)
            if not os.path.isfile(abs_p):
                problems.append('theme.json %s 段的 %s 指向的文件不存在：%s'
                                % (mode, k, v))

    # ---------- 4. app.json 的 @token 引用必须双主题都有 ----------
    # app.json 里 "@tabIconHome" 这种写法，值来自 theme.json
    raw_app = io.open(os.path.join(MP, 'app.json'), encoding='utf-8').read()
    tokens = set(re.findall(r'"@([A-Za-z0-9_]+)"', raw_app))
    for t in sorted(tokens):
        if t not in light:
            problems.append('app.json 引用了 @%s，但 theme.json 的 light 段没有这个键' % t)
        if t not in dark:
            problems.append('app.json 引用了 @%s，但 theme.json 的 dark 段没有这个键' % t)

    # ---------- 5. 暗黑图标不能与浅色同文件 ----------
    # 典型事故：把浅色图标复制进 dark/ 目录忘了改图，深色下几乎看不见
    for k in icon_keys:
        lv, dv = light.get(k), dark.get(k)
        if not isinstance(lv, str) or not isinstance(dv, str) or not lv or not dv:
            continue
        lp, dp = resolve(lv), resolve(dv)
        if os.path.isfile(lp) and os.path.isfile(dp):
            try:
                with io.open(lp, 'rb') as f1, io.open(dp, 'rb') as f2:
                    if f1.read() == f2.read():
                        problems.append('%s 的 dark 图标与 light 图标内容完全相同'
                                        '（多半是复制后忘改图）：%s' % (k, dv))
            except OSError:
                pass

    # ---------- 6. tabBar 条目数与图标对数量一致 ----------
    tabbar = app.get('tabBar') or {}
    items = tabbar.get('list') or []
    if not items:
        problems.append('app.json 的 tabBar.list 为空')
    else:
        for idx, it in enumerate(items):
            for field in ('iconPath', 'selectedIconPath'):
                v = it.get(field)
                if not v:
                    problems.append('tabBar.list[%d] 缺少 %s' % (idx, field))
                elif v.startswith('@'):
                    tok = v[1:]
                    if tok not in light or tok not in dark:
                        problems.append('tabBar.list[%d].%s = %s 在 theme.json 中不完整'
                                        % (idx, field, v))

    # ---------- 汇总 ----------
    print('主题图标检查：%d 个图标键 / %d 个 tabBar 条目' % (len(icon_keys), len(items)))
    if notes:
        for n in notes:
            print('  · ' + n)
    if problems:
        print('暗黑图标：%d 项问题' % len(problems))
        for p in problems:
            print('  ✗ ' + p)
        return 1
    print('暗黑图标：全部通过 ✓')
    return 0


if __name__ == '__main__':
    sys.exit(main())
