#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""WXSS 层叠快照 —— 不依赖真机的视觉回归手段

为什么需要它：
   小程序没有「跑起来截图对比」的自动化通道，而 wxss 是**层叠**的：
   app.wxss 在前、页面 wxss 在后，同选择器同优先级后者覆盖前者。
   所以「把几页重复的样式抽到共享文件、改成 @import」这类重构，
   光看 diff 看不出有没有把覆盖顺序弄反 —— 真机上可能某个 padding
   悄悄变了，而所有功能评测、所有静态守卫都是全绿的。

   本脚本把「某页面最终生效的每一条声明」算成一份 JSON 基线：
     · 展开 @import（按出现位置内联），所以抽样式前后可直接对比；
     · 按 app.wxss → 页面 wxss 的真实顺序，以 (优先级, 出现序) 做属性级覆盖；
     · @media / @keyframes 单独成键，按原文比对；
     · 注释、空白差异不影响结果。
   只要快照完全一致，重构就是零视觉差异；不一致会精确指出
   「哪个页面的哪个选择器、哪个属性、从什么值变成了什么值」。

用法：
    python css_snapshot.py --write     # 生成/刷新基线 visual-baseline.json
    python css_snapshot.py --check     # 与基线比对（CI 用，不一致返回非 0）
    python css_snapshot.py --page subpkg-tool/pages/search/search  # 调试单页
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')
APP_WXSS = os.path.join(MP, 'app.wxss')
BASELINE = os.path.join(HERE, 'visual-baseline.json')

IMPORT_RE = re.compile(r'\s*@import\s+["\']([^"\']+)["\']\s*;\s*')
DECL_RE = re.compile(r'([^:;{}]+)\s*:\s*([^;{}]+)\s*;')


def read(p):
    return io.open(p, encoding='utf-8', errors='replace').read()


def inline_imports(path, stack=None):
    """把 @import "x.wxss"; 按出现位置替换成目标文件内容（递归）。"""
    stack = stack or []
    if path in stack:
        raise RuntimeError('@import 循环引用：' + ' -> '.join(stack + [path]))
    out = []
    for line in read(path).splitlines(True):
        m = IMPORT_RE.match(line)
        if not m:
            out.append(line)
            continue
        target = os.path.normpath(os.path.join(os.path.dirname(path), m.group(1)))
        if not os.path.isfile(target):
            raise RuntimeError('@import 目标不存在：%s（在 %s 里）'
                               % (m.group(1), os.path.relpath(path, MP)))
        out.append(inline_imports(target, stack + [path]))
        out.append('\n')
    return ''.join(out)


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def norm_ws(s):
    return re.sub(r'\s+', ' ', s).strip()


def scan_blocks(css):
    """产出 (选择器文本, 块内容)。花括号配平，支持 @media 里的嵌套块。"""
    i, n, buf = 0, len(css), []
    while i < n:
        c = css[i]
        if c == '{':
            sel = ''.join(buf).strip()
            depth, j = 1, i + 1
            while j < n and depth:
                if css[j] == '{':
                    depth += 1
                elif css[j] == '}':
                    depth -= 1
                j += 1
            yield (sel, css[i + 1:j - 1])
            buf = []
            i = j
        elif c == ';':
            stmt = ''.join(buf).strip()
            if stmt:
                yield ('@STMT', stmt)
            buf = []
            i += 1
        else:
            buf.append(c)
            i += 1


def collect(css, prefix=''):
    """展开成 [(selector, {prop: val})]，@media / @keyframes 单独成键。"""
    rules = []
    for sel, body in scan_blocks(strip_comments(css)):
        if sel == '@STMT':
            continue  # @charset / 剩余 @import 之类，不参与层叠
        if sel.startswith('@media'):
            rules.extend(collect(body, prefix='@media(' + norm_ws(sel[6:]) + ')|'))
        elif sel.startswith('@keyframes') or sel.startswith('@-webkit-keyframes'):
            rules.append(('@keyframes|' + norm_ws(sel), {'__raw__': norm_ws(body)}))
        elif sel.startswith('@'):
            rules.append(('@at|' + norm_ws(sel), {'__raw__': norm_ws(body)}))
        else:
            decls = {}
            for k, v in DECL_RE.findall(body):
                decls[norm_ws(k)] = norm_ws(v)
            for one in sel.split(','):
                one = norm_ws(one)
                if one and decls:
                    rules.append((prefix + one, decls))
    return rules


def specificity(sel):
    ids = len(re.findall(r'#[\w-]+', sel))
    cls = len(re.findall(r'\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+', sel))
    tags = len(re.findall(r'(?:^|[\s>+~,])([a-zA-Z][\w-]*)', sel))
    return (ids, cls, tags)


def cascade(*rule_lists):
    """属性级层叠：(specificity, 出现序) 大者胜。"""
    meta = {}
    order = 0
    for rules in rule_lists:
        for sel, decls in rules:
            order += 1
            sp = specificity(sel) if not sel.startswith('@') else (0, 0, 0)
            for prop, val in decls.items():
                key = (sel, prop)
                cand = (sp, order, val)
                old = meta.get(key)
                if old is None or (cand[0], cand[1]) >= (old[0], old[1]):
                    meta[key] = cand
    out = {}
    for (sel, prop), (_sp, _ord, val) in meta.items():
        out.setdefault(sel, {})[prop] = val
    return out


def page_list():
    app = json.loads(read(os.path.join(MP, 'app.json')))
    pages = list(app.get('pages') or [])
    for sp in (app.get('subPackages') or app.get('subpackages') or []):
        root = (sp.get('root') or '').strip('/')
        for p in sp.get('pages') or []:
            pages.append(root + '/' + p if root else p)
    return pages


def snapshot():
    global_rules = collect(inline_imports(APP_WXSS))
    result = {}
    for rel in page_list():
        p = os.path.join(MP, rel + '.wxss')
        if not os.path.isfile(p):
            continue
        result[rel] = cascade(global_rules, collect(inline_imports(p)))
    return result


def diff(a, b):
    """返回可读的差异列表。"""
    out = []
    for page in sorted(set(a) | set(b)):
        da, db = a.get(page, {}), b.get(page, {})
        for sel in sorted(set(da) | set(db)):
            sa, sb = da.get(sel, {}), db.get(sel, {})
            for prop in sorted(set(sa) | set(sb)):
                va, vb = sa.get(prop), sb.get(prop)
                if va != vb:
                    out.append('%s  %s  %s: %s -> %s'
                               % (page, sel, prop,
                                  '<缺失>' if va is None else va,
                                  '<缺失>' if vb is None else vb))
    return out


def main():
    args = sys.argv[1:]
    try:
        cur = snapshot()
    except Exception as e:
        print('视觉层叠快照生成失败：%s' % e)
        return 1

    if '--page' in args:
        key = args[args.index('--page') + 1]
        print(json.dumps(cur.get(key, {}), ensure_ascii=False, indent=2,
                         sort_keys=True))
        return 0

    if '--write' in args:
        # 紧凑格式：25,030 条声明若带缩进要 1.2MB，压到 ~0.7MB 更省仓库体积；
        # 基线只在变化时才需要人读，届时 --check 会精确打印差异位置。
        with io.open(BASELINE, 'w', encoding='utf-8', newline='\n') as f:
            f.write(json.dumps(cur, ensure_ascii=False, sort_keys=True,
                               separators=(',', ':')) + '\n')
        total = sum(len(v) for page in cur.values() for v in page.values())
        print('视觉层叠基线已写入：%s' % os.path.relpath(BASELINE, ROOT))
        print('  %d 页 / %d 条最终生效声明' % (len(cur), total))
        return 0

    if not os.path.isfile(BASELINE):
        print('缺少视觉层叠基线 —— 先跑 python css_snapshot.py --write')
        return 1
    base = json.loads(read(BASELINE))
    ds = diff(base, cur)
    if ds:
        print('视觉层叠回归：%d 处最终生效声明发生变化' % len(ds))
        for d in ds[:40]:
            print('  ✗ ' + d)
        if len(ds) > 40:
            print('  ... 另有 %d 处' % (len(ds) - 40))
        return 1
    total = sum(len(v) for page in cur.values() for v in page.values())
    print('视觉层叠回归：%d 页 / %d 条声明与基线完全一致 ✓' % (len(cur), total))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except BrokenPipeError:
        # --page 输出被 head 之类管道截断，属正常调试用法，不算失败
        try:
            sys.stdout.close()
        except Exception:
            pass
        sys.exit(0)
