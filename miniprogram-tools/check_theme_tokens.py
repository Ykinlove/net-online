# -*- coding: utf-8 -*-
"""主题令牌守卫 —— CSS 变量体系的闭合性与双主题覆盖完整性

为什么要有这个守卫：
   主题系统把全站颜色收敛成 CSS 变量（app.wxss 的 :root / .theme-dark / [data-theme]），
   好处是换肤只改一处；代价是**新增一个颜色令牌时，如果忘了在深色块里覆盖，
   浅色下完全正常，深色下这个颜色就「漏」了** —— 表现为深色模式下某处
   文字看不清 / 边框突兀。这类问题 CI 完全看不出来，只能真机切主题才发现。

   所以本守卫把「令牌闭合」变成硬规则：
   - 所有 wxss 里 var(--x) 引用的令牌，必须在 app.wxss 有定义（漏定义 = 静默失效）
   - app.wxss 里定义的颜色类令牌，必须在系统深色块有覆盖（漏覆盖 = 深色漏色）
   - 手动深色 / 手动浅色两个类的令牌集合必须对称
   - 质感层（glass/glow/ring 等）的颜色令牌，两套手动主题都必须覆盖
   - theme.json 与 theme-colors.js 里的主题色，必须与 app.wxss 一致
     （三处各写一份颜色是本项目的既有结构，必须靠守卫锁住它们不漂移）

   注意区分「颜色类」与「非颜色类」令牌：
     颜色类（需深浅两套都写）：bg-* / text-* / border* / primary / danger / ...
     非颜色类（两套同值，只需写一处）：radius-* / font-code / dur / ease / u / W
   把非颜色类也要求深浅各写一份，会逼出无意义的重复声明 —— 那是假红。

跑法：python check_theme_tokens.py
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')
APP_WXSS = os.path.join(MP, 'app.wxss')

# 值里含色值的即「颜色类」令牌（需在深浅两套主题下分别定义）
COLOR_VALUE = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|gradient', re.I)


def strip_comments(s):
    return re.sub(r'/\*.*?\*/', '', s, flags=re.S)


def read(rel):
    p = os.path.join(MP, rel)
    if not os.path.isfile(p):
        return ''
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def blocks_of(css, selector):
    """取某选择器的所有块并集（同一选择器在 app.wxss 里可能出现多次，如 .theme-dark）"""
    out = {}
    for m in re.finditer(re.escape(selector) + r'\s*\{', css):
        start = m.end() - 1
        depth, i = 0, start
        while i < len(css):
            if css[i] == '{':
                depth += 1
            elif css[i] == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        for k, v in re.findall(r'--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);', css[start + 1:i]):
            out[k] = v.strip()
    return out


def top_level_css(css):
    """剥掉所有 @media 块，只留顶层 CSS。

    app.wxss 里 ':root' 出现两次 —— 一次是顶层浅色基准，一次在
    @media(prefers-color-scheme: dark) 内。浅色基准必须只从顶层取，
    否则会把深色值当成浅色值，比对全部错位。
    比「判断选择器是否嵌套」可靠：直接按块结构剥离。
    """
    out = []
    i = 0
    while i < len(css):
        m = re.compile(r'@media[^\{]*\{').search(css, i)
        if not m:
            out.append(css[i:])
            break
        out.append(css[i:m.start()])
        # 找到匹配的 }（按花括号配平）
        start = m.end() - 1
        depth, j = 0, start
        while j < len(css):
            if css[j] == '{':
                depth += 1
            elif css[j] == '}':
                depth -= 1
                if depth == 0:
                    break
            j += 1
        i = j + 1
    return ''.join(out)


def media_blocks(css, media_kw, selector):
    """取 @media 块内某选择器的令牌并集"""
    out = {}
    for m in re.finditer(re.escape(media_kw) + r'\s*\{', css):
        start = m.end() - 1
        depth, i = 0, start
        while i < len(css):
            if css[i] == '{':
                depth += 1
            elif css[i] == '}':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        inner = css[start + 1:i]
        for m2 in re.finditer(re.escape(selector) + r'\s*\{', inner):
            s2 = m2.end() - 1
            d2, j = 0, s2
            while j < len(inner):
                if inner[j] == '{':
                    d2 += 1
                elif inner[j] == '}':
                    d2 -= 1
                    if d2 == 0:
                        break
                j += 1
            for k, v in re.findall(r'--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);', inner[s2 + 1:j]):
                out[k] = v.strip()
    return out


def main():
    problems = []

    if not os.path.isfile(APP_WXSS):
        print('✗ 找不到 app.wxss')
        return 1

    raw = io.open(APP_WXSS, encoding='utf-8').read()
    css = strip_comments(raw)

    base_root = blocks_of(top_level_css(css), ':root')
    sys_dark = media_blocks(css, '@media (prefers-color-scheme: dark)', ':root')
    class_dark = blocks_of(css, '.theme-dark')
    class_light = blocks_of(css, '.theme-light')
    v3_light = blocks_of(top_level_css(css), ':root, page')

    if not base_root:
        problems.append('app.wxss 的 :root 里没有任何令牌定义')
        print('主题令牌：%d 项问题' % len(problems))
        for p in problems:
            print('  ✗ ' + p)
        return 1

    # ---------- 1. 变量引用闭合 ----------
    # 所有 wxss 里 var(--x) 引用的令牌，必须在 app.wxss 里有定义
    defined = set(re.findall(r'--([a-zA-Z0-9_-]+)\s*:', css))
    used = {}
    for root, dirs, files in os.walk(MP):
        for fn in files:
            if not fn.endswith('.wxss'):
                continue
            p = os.path.join(root, fn)
            txt = strip_comments(io.open(p, encoding='utf-8', errors='replace').read())
            for v in re.findall(r'var\(\s*--([a-zA-Z0-9_-]+)', txt):
                used.setdefault(v, set()).add(
                    os.path.relpath(p, MP).replace('\\', '/'))

    for v in sorted(set(used) - defined):
        where = sorted(used[v])[:3]
        problems.append('令牌 --%s 被引用但 app.wxss 未定义（该样式会静默失效）：%s'
                        % (v, '、'.join(where)))

    # ---------- 2. 颜色类令牌在系统深色块必须有覆盖 ----------
    base_colors = {k for k, v in base_root.items() if COLOR_VALUE.search(v)}
    for k in sorted(base_colors - set(sys_dark)):
        problems.append('颜色令牌 --%s 在 app.wxss 的 :root 有定义，'
                        '但系统深色块没覆盖（深色模式下会漏色）' % k)

    # ---------- 3. 手动深浅两套类的令牌集合必须对称 ----------
    only_dark = sorted(set(class_dark) - set(class_light))
    only_light = sorted(set(class_light) - set(class_dark))
    if only_dark:
        problems.append('.theme-dark 有而 .theme-light 没有的令牌：%s'
                        % ' '.join(only_dark))
    if only_light:
        problems.append('.theme-light 有而 .theme-dark 没有的令牌：%s'
                        % ' '.join(only_light))

    # ---------- 4. 质感层颜色令牌两套手动主题都要覆盖 ----------
    v3_colors = {k for k, v in v3_light.items() if COLOR_VALUE.search(v)}
    for k in sorted(v3_colors - set(class_dark)):
        problems.append('质感令牌 --%s 未在 .theme-dark 覆盖（手动深色会漏）' % k)
    for k in sorted(v3_colors - set(class_light)):
        problems.append('质感令牌 --%s 未在 .theme-light 覆盖（手动浅色会漏）' % k)

    # ---------- 5. 手动深色必须覆盖系统深色的全部颜色令牌 ----------
    sys_colors = {k for k, v in sys_dark.items() if COLOR_VALUE.search(v)}
    for k in sorted(sys_colors - set(class_dark)):
        problems.append('系统深色块的颜色令牌 --%s 未在 .theme-dark 覆盖'
                        '（手动深色比系统深色更浅/更暗，视觉不一致）' % k)

    # ---------- 6. 三处主题色必须一致 ----------
    #    app.wxss 的令牌 / theme.json（原生 tabBar 用）/ theme-colors.js（原生 API 用）
    theme = {}
    tp = os.path.join(MP, 'theme.json')
    if os.path.isfile(tp):
        with io.open(tp, encoding='utf-8') as f:
            theme = json.load(f)
    else:
        problems.append('缺少 theme.json')

    tc_src = read('utils/theme-colors.js')
    if not tc_src:
        problems.append('缺少 utils/theme-colors.js')
    else:
        m_light = re.search(r'const LIGHT\s*=\s*\{(.*?)\}', tc_src, re.S)
        m_dark = re.search(r'const DARK\s*=\s*\{(.*?)\}', tc_src, re.S)
        js_light = dict(re.findall(r"(\w+)\s*:\s*'([^']+)'", m_light.group(1))) if m_light else {}
        js_dark = dict(re.findall(r"(\w+)\s*:\s*'([^']+)'", m_dark.group(1))) if m_dark else {}

        # theme-colors.js 的语义键 → app.wxss 的令牌名
        TOKEN_OF = {'primary': 'primary', 'danger': 'danger',
                    'success': 'success', 'warning': 'warning'}
        for js_key, tok in TOKEN_OF.items():
            lv, dv = js_light.get(js_key), js_dark.get(js_key)
            if not lv or not dv:
                problems.append('theme-colors.js 缺少 %s 的浅/深两套色值' % js_key)
                continue
            if lv != base_root.get(tok):
                problems.append('theme-colors.js LIGHT.%s = %s，与 app.wxss --%s = %s 不一致'
                                % (js_key, lv, tok, base_root.get(tok)))
            if dv != sys_dark.get(tok):
                problems.append('theme-colors.js DARK.%s = %s，与 app.wxss 深色 --%s = %s 不一致'
                                % (js_key, dv, tok, sys_dark.get(tok)))

    # theme.json 的 tabBar 颜色 ↔ app.wxss 令牌
    if theme:
        JSON_TO_TOKEN = {
            'tabSelectedColor': 'primary',
            'tabFontColor': 'text-tertiary',
            'tabBgColor': 'bg-card',
            'bgColor': 'bg-page',
            'navBgColor': 'bg-card',
        }
        for jk, tok in JSON_TO_TOKEN.items():
            for mode, ref in (('light', base_root), ('dark', sys_dark)):
                v = (theme.get(mode) or {}).get(jk)
                if v is None:
                    problems.append('theme.json 的 %s 段缺少 %s' % (mode, jk))
                    continue
                if v != ref.get(tok):
                    problems.append('theme.json %s.%s = %s，与 app.wxss --%s = %s 不一致'
                                    % (mode, jk, v, tok, ref.get(tok)))

    # ---------- 7. 动效默认值：--dur 与 app.js 的 motionDur 必须一致 ----------
    app_js = read('app.js')
    m_dur = re.search(r"--dur:\s*([0-9.]+)s", css)
    m_motion = re.search(r'motionDur:\s*([0-9.]+)', app_js)
    if m_dur and m_motion:
        d_wxss = float(m_dur.group(1))
        d_js = float(m_motion.group(1))
        if abs(d_wxss - d_js) > 0.001:
            problems.append('动效默认值不一致：app.wxss --dur = %ss，'
                            'app.js motionDur = %s（切主题时过渡时长会跳变）'
                            % (m_dur.group(1), m_motion.group(1)))

    # ---------- 汇总 ----------
    print('主题令牌检查：定义 %d 个 / 引用 %d 个 / 颜色类 %d 个'
          % (len(defined), len(used), len(base_colors)))
    if problems:
        print('主题变量：%d 项问题' % len(problems))
        for p in problems:
            print('  ✗ ' + p)
        return 1
    print('主题变量：全部通过 ✓')
    return 0


if __name__ == '__main__':
    sys.exit(main())
