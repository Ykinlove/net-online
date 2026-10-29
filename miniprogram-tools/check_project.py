#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小程序工程静态自检：
1) app.json 主包页面 + 分包页面文件是否齐全
2) WXML 里绑定的事件处理函数是否都在同名 JS 里定义
3) WXML/WXSS 里引用的 /images 资源是否存在（含分包内相对路径）
4) WXML 文本里的裸 <（发布校验报 unexpected character）
5) 分包结构：tabBar 页必须在主包；分包页 require 的主包 JS 存在；
   navigateTo/redirectTo 的 url 必须能对应到 pages 或 subpackages 里的页面
6) 包体统计：主包（排除 subpkg-*）≤2MB，各分包 ≤2MB
"""
import json
import os
import re

ROOT = r"E:/Work buddy/命令/net-online/miniprogram"
EVT = re.compile(r'(?:bind|catch|capture-bind|capture-catch)[\w:-]*="([A-Za-z_$][\w$]*)"')
IMG_ATTR = re.compile(r'(?:src|url)="(/images/[^"{]+)"')
IMG_CSS = re.compile(r'url\(["\']?(/images/[^"\')]+)["\']?\)')
NAV = re.compile(r"wx\.(?:navigateTo|redirectTo|reLaunch)\(\s*\{\s*url:\s*'([^']+)'")

problems = []


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def rel(p):
    return os.path.relpath(p, ROOT).replace(os.sep, "/")


# ---- 0) app.json 与分包结构 ----
app = json.loads(read(os.path.join(ROOT, "app.json")))
subpkgs = app.get("subpackages") or []
subpkg_roots = [sp["root"] for sp in subpkgs]
# 分包页 → 完整路径映射（root + 页面相对路径）
sub_page_map = {}
for sp in subpkgs:
    for pg in sp.get("pages", []):
        sub_page_map[sp["root"] + "/" + pg] = sp["root"]

main_pages = app["pages"]
tabbar_pages = [t["pagePath"] for t in (app.get("tabBar") or {}).get("list", [])]

# tabBar 必须在主包
for tp in tabbar_pages:
    if tp not in main_pages:
        problems.append("tabBar 页面 %s 必须在主包 pages 里" % tp)
# 主包页与分包页不能重叠
for pg in main_pages:
    if pg in sub_page_map:
        problems.append("页面 %s 同时出现在主包和分包" % pg)

# 1) 页面齐全（主包 + 分包）
all_pages = list(main_pages) + list(sub_page_map.keys())
for page in all_pages:
    for ext in (".wxml", ".js", ".json", ".wxss"):
        fp = os.path.join(ROOT, page + ext)
        if not os.path.exists(fp):
            problems.append("缺文件: " + page + ext)

# 2) 事件处理函数
for page in all_pages:
    wxml_p = os.path.join(ROOT, page + ".wxml")
    js_p = os.path.join(ROOT, page + ".js")
    if not (os.path.exists(wxml_p) and os.path.exists(js_p)):
        continue
    wxml = read(wxml_p)
    js = read(js_p)
    for fn in set(EVT.findall(wxml)):
        if not re.search(r'(?:^|\n)\s*(?:async\s+)?' + re.escape(fn) + r'\s*[:(]', js) and \
           not re.search(r'\b' + re.escape(fn) + r'\s*[:=]\s*(?:async\s*)?(?:function|\()', js):
            problems.append("%s 里绑定了 %s，但 JS 中没有定义" % (page, fn))

# 3) 图片资源（绝对 /images 按主包根查；分包内相对路径按页面目录查）
for dp, dn, fn in os.walk(ROOT):
    for f in fn:
        if not f.endswith((".wxml", ".wxss")):
            continue
        p = os.path.join(dp, f)
        txt = read(p)
        for m in IMG_ATTR.findall(txt) + IMG_CSS.findall(txt):
            target = os.path.join(ROOT, m.lstrip("/").replace("/", os.sep))
            if not os.path.exists(target):
                problems.append("%s 引用了不存在的图片 %s" % (rel(p), m))
        # 分包页里的相对路径图片（如 ../../images/...）
        for m in re.findall(r'(?:src|url)="(\.\./[^"{]+\.(?:png|jpg|jpeg|gif|svg))"', txt):
            target = os.path.normpath(os.path.join(dp, m))
            if not os.path.exists(target):
                problems.append("%s 引用了不存在的图片 %s" % (rel(p), m))

# 4) WXML 文本裸 <
for dp, dn, fn in os.walk(ROOT):
    for f in fn:
        if not f.endswith(".wxml"):
            continue
        p = os.path.join(dp, f)
        relp = rel(p)
        for i, line in enumerate(read(p).split("\n"), 1):
            for c, ch in enumerate(line, 1):
                if ch != "<":
                    continue
                nxt = line[c:c + 1]
                if nxt and (nxt.isalpha() or nxt in "/!"):
                    continue
                problems.append("%s:%d:%d 文本里的裸 <（要写成 &lt;），发布校验会报 unexpected character" % (relp, i, c))

# 5) 分包页 require 主包 JS + 跳转 url 目标存在
#    注意：微信编译器只认相对路径跨包 require（require('../../utils/x')），
#    绝对路径 require('/utils/x') 在分包页会报 Couldn't resolve
def page_exists(url):
    u = url.split("?")[0].lstrip("/")
    return u in main_pages or u in sub_page_map


for page in all_pages:
    js_p = os.path.join(ROOT, page + ".js")
    if not os.path.exists(js_p):
        continue
    js = read(js_p)
    page_dir = os.path.dirname(os.path.join(ROOT, page + ".js"))
    for req in re.findall(r"require\('([^']+)'\)", js):
        if req.startswith("/"):
            if page in main_pages:
                # 主包页允许绝对路径
                target = os.path.join(ROOT, req.lstrip("/").replace("/", os.sep))
            else:
                problems.append("%s 用了绝对路径 require('%s')，分包页必须用相对路径" % (page, req))
                continue
        else:
            target = os.path.normpath(os.path.join(page_dir, req.replace("/", os.sep)))
        if not os.path.exists(target):
            problems.append("%s require 了不存在的 %s" % (page, req))
    for url in NAV.findall(js):
        if not page_exists(url):
            problems.append("%s 跳转目标不存在: %s" % (page, url))

# 6) 包体统计（主包排除分包根目录）
def dir_size(d, skip=()):
    total = 0
    for dp, dn, fn in os.walk(d):
        rel_dp = os.path.relpath(dp, d).replace(os.sep, "/")
        if any(rel_dp == s or rel_dp.startswith(s + "/") for s in skip):
            continue
        for f in fn:
            fp = os.path.join(dp, f)
            if os.path.isfile(fp):
                total += os.path.getsize(fp)
    return total


MB = 1024 * 1024
main_size = dir_size(ROOT, skip=subpkg_roots)
print("主包 %.3fMB（限 2MB，余 %.0fKB）" % (main_size / MB, (2 * MB - main_size) / 1024))
if main_size > 2 * MB:
    problems.append("主包超 2MB 限制！")
for sp in subpkgs:
    s = dir_size(os.path.join(ROOT, sp["root"]))
    print("分包 %s %.3fMB" % (sp["root"], s / MB))
    if s > 2 * MB:
        problems.append("分包 %s 超 2MB 限制！" % sp["root"])

print("检查完成，主包页面 %d 个，分包页面 %d 个" % (len(main_pages), len(sub_page_map)))
if problems:
    print("发现 %d 个问题：" % len(problems))
    for x in problems:
        print("  -", x)
else:
    print("未发现问题 ✓")
