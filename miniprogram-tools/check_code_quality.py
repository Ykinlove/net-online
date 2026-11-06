# -*- coding: utf-8 -*-
"""复刻微信开发者工具「代码质量」里跟包体相关的三条规则。

为什么要有这个脚本：
    开发者工具的代码质量面板是 GUI，点一次才知道结果，CI 里没法用；
    而且判定口径（尤其「编译后体积」到底算什么）不看源码根本猜不出来。
    这里把三条规则固化成可离线跑的守卫，改坏了当场红。

三条规则的权威口径（均已从开发者工具源码 + 官方扫描报告双向确认）：

1. PACKAGE_SIZE_LIMIT ——「主包尺寸（不包含插件）应小于 1.5 M」
   · 统计对象是**编译产物**，不是磁盘上 minify 后的文件。
   · 判定式：对 app.json 声明的**每一个包**（主包 + 各分包）取 max，
     任何一个 > 1.5 MB 整项失败 —— 分包超标一样挂。
   · 经验模型（用开发者工具的编译缓存实测标定）：
       编译后 ≈ 源文件大小 × 系数
       · data-src 里的数据源文件     × 1.35（AST 重新打印，缩进从 2 空格拉到 4）
       · 手写逻辑 / 页面             × 1.76（ES6 转 ES5，模板串/展开/箭头都膨胀）
       · 纯 ASCII 字符串字面量文件   × 1.00（base64 数据包不会被 AST 展开）
     实测样本 126 个模块，中位系数 1.35 / 1.76，max 2.53。

2. IMAGE_AND_AUDIO_LIMIT ——「图片和音频资源大小应不超过 200 K」
   · 统计范围是**主包 + 分包合并**的代码包，不是单个包。
   · 判定式：总字节 / 1024 < 200，即必须 < 204,800 B。
   · 扩展名：jpg jpeg png svg webp gif flac m4a ogg ape amr wma wav mp3 mp4 aac aiff caf

3. CONTAINS_OTHER_PKG_JS ——「主包内不应存在主包未使用的JS文件」
   · 判定：主包里的 JS，如果只被分包引用、主包内没人用，就算多余。
   · 离线等价算法：从 app.js 出发沿主包内的 require 关系做可达性分析，
     主包里不可达的 JS 即为冗余。

用法：python check_code_quality.py
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MP = os.path.join(ROOT, 'miniprogram')
SRC_DIR = os.path.join(HERE, 'data-src')

LIMIT_PKG = int(1.5 * 1024 * 1024)      # 1,572,864
LIMIT_IMG = 200 * 1024                   # 204,800

IMG_EXT = {'.jpg', '.jpeg', '.png', '.svg', '.webp', '.gif', '.flac', '.m4a',
           '.ogg', '.ape', '.amr', '.wma', '.wav', '.mp3', '.mp4', '.aac',
           '.aiff', '.caf'}

# 编译膨胀系数（用开发者工具编译缓存实测标定，见文件头说明）
K_DATA = 1.35      # data-src 数据源文件
K_HAND = 1.76      # 手写逻辑 / 页面
K_LITERAL = 1.00   # 纯 ASCII 字符串字面量（base64 数据包）
SAFETY = 1.03      # 安全边际：系数是实测中位，给 3% 余量

REQUIRE_RE = re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)""")


def load_app_json():
    with io.open(os.path.join(MP, 'app.json'), encoding='utf-8') as f:
        return json.load(f)


def pkg_roots(app):
    """主包名 + 各分包根目录，按官方 getPackagesInfo 的前缀归包规则。"""
    roots = ['__APP__']
    for sp in app.get('subpackages', []) or app.get('subPackages', []):
        roots.append(sp['root'].rstrip('/') + '/')
    return roots


def pkg_of(rel, roots):
    for r in roots:
        if r == '__APP__':
            continue
        if rel.startswith(r):
            return r
    return '__APP__'


def walk(miniprogram):
    """[(相对路径, 绝对路径, 字节数)]"""
    out = []
    for root, dirs, files in os.walk(miniprogram):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fn in files:
            if fn.startswith('.'):
                continue
            p = os.path.join(root, fn)
            if not os.path.isfile(p):
                continue
            rel = os.path.relpath(p, miniprogram).replace('\\', '/')
            out.append((rel, p, os.path.getsize(p)))
    return out


def compiled_size(rel, size):
    """估算一个文件编译后的大小。"""
    base = os.path.basename(rel)
    if base == 'cmdbook-data.js':
        return int(size * K_LITERAL)
    if os.path.exists(os.path.join(SRC_DIR, base)):
        return int(size * K_DATA)
    return int(size * K_HAND)


def check_pkg_size(app, files, problems, notes):
    roots = pkg_roots(app)
    agg = {r: 0 for r in roots}
    for rel, p, size in files:
        r = pkg_of(rel, roots)
        if rel.endswith('.js'):
            agg[r] += compiled_size(rel, size)
        else:
            agg[r] += size
    print('\n[1] 包体积（编译后估算，限 %d B / 1.5 M）' % LIMIT_PKG)
    for r in roots:
        v = int(agg[r] * SAFETY)
        flag = 'OK' if v < LIMIT_PKG else '超 %d B' % (v - LIMIT_PKG)
        print('    %-16s %9d B  余量 %8d   %s' %
              (r, v, LIMIT_PKG - v, flag))
        if v >= LIMIT_PKG:
            problems.append('包 %s 编译后估算 %d B，超出 1.5 M（超 %d B）'
                            % (r, v, v - LIMIT_PKG))
    notes.append('包体积：' + '、'.join('%s %d B' % (r, int(agg[r] * SAFETY)) for r in roots))
    return agg


def check_images(files, problems):
    tot = 0
    n = 0
    per = {}
    for rel, p, size in files:
        if os.path.splitext(rel)[1].lower() in IMG_EXT:
            tot += size
            n += 1
            d = os.path.dirname(rel) or '(根)'
            per[d] = per.get(d, 0) + size
    print('\n[2] 图片/音频总量（主包+分包合计，限 %d B / 200 K）' % LIMIT_IMG)
    for d, s in sorted(per.items(), key=lambda kv: -kv[1]):
        print('    %-40s %7d B' % (d, s))
    print('    %-40s %7d B  %d 项   余量 %d   %s' %
          ('合计', tot, n, LIMIT_IMG - tot, 'OK' if tot < LIMIT_IMG else '超限'))
    if tot >= LIMIT_IMG:
        problems.append('图片/音频合计 %d B，超出 200 K（超 %d B）' % (tot, tot - LIMIT_IMG))
    return tot


def check_main_pkg_js(app, files, problems):
    """主包里有没有「主包用不到、只有分包在用」的 JS。

    可达性入口不止 app.js：
      · app.json 的 pages 数组注册的页面 —— 页面不是被 require 的
      · 页面 .json 的 usingComponents 声明的组件 —— 组件是被 json 引入的
    只算主包内的边；分包里的 require 不算主包可达。
    """
    by_rel = {rel: (p, size) for rel, p, size in files}
    js = {rel: p for rel, p, size in files if rel.endswith('.js')}

    def resolve(from_rel, spec):
        """相对引用解析到包内绝对路径；解析不了返回 None。"""
        if not spec.startswith('.'):
            return None
        base = os.path.dirname(from_rel)
        target = os.path.normpath(os.path.join(base, spec)).replace('\\', '/')
        for cand in (target, target + '.js', target + '/index.js'):
            if cand in js:
                return cand
        return None

    def read_text(rel):
        try:
            with io.open(by_rel[rel][0], encoding='utf-8') as f:
                return f.read()
        except (IOError, OSError, KeyError):
            return ''

    seen = set()
    stack = ['app.js'] if 'app.js' in js else []
    # app.json 注册的主包页面也是入口
    for page in app.get('pages', []):
        cand = page + '.js'
        if cand in js:
            stack.append(cand)
    edges = 0

    while stack:
        cur = stack.pop()
        if cur in seen:
            continue
        seen.add(cur)
        text = read_text(cur)
        # 1) require 依赖
        for spec in REQUIRE_RE.findall(text):
            tgt = resolve(cur, spec)
            if tgt is None:
                continue
            if tgt.startswith('subpkg-tool/') or tgt.startswith('subpkg-mine/'):
                continue          # 分包里的引用不算主包可达
            edges += 1
            if tgt not in seen:
                stack.append(tgt)
        # 2) 页面 json 里 usingComponents 声明的组件
        jpath = os.path.splitext(cur)[0] + '.json'
        if jpath in by_rel:
            try:
                with io.open(by_rel[jpath][0], encoding='utf-8') as f:
                    pjson = json.load(f)
            except (IOError, OSError, ValueError):
                pjson = {}
            for comp in (pjson.get('usingComponents') or {}).values():
                if not isinstance(comp, str) or not comp.startswith('.'):
                    continue
                tgt = resolve(cur, comp)
                if tgt is None or tgt in seen:
                    continue
                if tgt.startswith('subpkg-tool/') or tgt.startswith('subpkg-mine/'):
                    continue
                edges += 1
                stack.append(tgt)

    main_js = [r for r in js
                if not r.startswith('subpkg-tool/') and not r.startswith('subpkg-mine/')]
    unreachable = sorted(r for r in main_js if r not in seen)
    print('\n[3] 主包未使用的 JS（官方规则 CONTAINS_OTHER_PKG_JS）')
    print('    主包 JS %d 个，从 app.js + app.json 注册的页面出发，'
          '沿 require/usingComponents 可达 %d 个（边 %d 条）'
          % (len(main_js), len([r for r in main_js if r in seen]), edges))
    if unreachable:
        print('    冗余：')
        for r in unreachable:
            print('      %s' % r)
        problems.append('主包有 %d 个 JS 主包内不可达（%s）'
                        % (len(unreachable), ', '.join(unreachable)))
    else:
        print('    无冗余 ✓')
    return unreachable


def main():
    app = load_app_json()
    files = walk(MP)
    problems = []
    notes = []
    check_pkg_size(app, files, problems, notes)
    check_images(files, problems)
    check_main_pkg_js(app, files, problems)

    print('\n' + '=' * 60)
    if problems:
        print('代码质量守卫未通过：')
        for p in problems:
            print('  ✗ %s' % p)
        return 1
    print('代码质量守卫全部通过 ✓')
    return 0


if __name__ == '__main__':
    sys.exit(main())
