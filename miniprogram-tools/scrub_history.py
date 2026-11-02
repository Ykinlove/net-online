#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把敏感串替换成占位符 —— 供 git filter-branch --tree-filter 调用。

敏感串清单**不在仓库里**，而是从本地私密配置读取：
    cloudbaserc.local.json（已被 .gitignore 忽略）
  - replacements: {"__占位符__": "真实值", ...}  → 反向得到 真实值 → 占位符
  - secrets:     ["真实值", ...]                → 未被 replacements 覆盖的，按序补占位符

按「真实值长度降序」替换，避免前缀截断
（例：若一个真实密码是另一个的前缀，必须先替换长的，否则会留下「占位符 + 残留尾巴」）。

用法（在仓库根）：
    python miniprogram-tools/scrub_history.py <目录>

filter-branch 会对每个 commit 的工作树跑一次本脚本，
把所有文件里的敏感串替换掉，从而重写历史。
"""
import io
import json
import os
import sys

# 只处理文本文件
TEXT_EXT = ('.js', '.json', '.md', '.py', '.sh', '.wxml', '.wxss',
            '.txt', '.yml', '.yaml', '.html', '.css', '.ts', '.bat', '.cfg', '.ini')

SKIP_DIR = {'.git', 'node_modules', '.workbuddy', '.git-rewrite'}

CONFIG_CANDIDATES = ('cloudbaserc.local.json',)


def find_config(root):
    env = os.environ.get('LOCAL_CONFIG')
    if env and os.path.isfile(env):
        return env
    for name in CONFIG_CANDIDATES:
        p = os.path.join(root, name)
        if os.path.isfile(p):
            return p
    return None


def build_replacements(root):
    """返回 [(真实值, 占位符), ...]，长的真实值在前。"""
    cfg_path = find_config(root)
    if not cfg_path:
        raise SystemExit(
            '✗ 找不到本地私密配置（cloudbaserc.local.json）。\n'
            '  历史清理需要真实敏感串才能定位，请先创建该文件，\n'
            '  或用环境变量 LOCAL_CONFIG 指定其路径。')

    with io.open(cfg_path, encoding='utf-8') as f:
        cfg = json.load(f)

    pairs = []
    covered = set()

    # 1) historyScrub：历史清理的权威规则（占位符 → 真实值，这里反向使用）
    for ph, real in (cfg.get('historyScrub') or {}).items():
        if isinstance(real, str) and real:
            pairs.append((real, ph))
            covered.add(real)

    # 2) replacements 反向补充
    for ph, real in (cfg.get('replacements') or {}).items():
        if isinstance(real, str) and real and real not in covered:
            pairs.append((real, ph))
            covered.add(real)

    # 3) secrets 里未被覆盖的，补一个通用占位符
    secrets = cfg.get('secrets') or []
    idx = 0
    for s in secrets:
        if not isinstance(s, str) or not s or s in covered:
            continue
        idx += 1
        ph = '__SECRET_%d__' % idx
        pairs.append((s, ph))
        covered.add(s)

    # 长的真实值先替换，避免前缀截断
    pairs.sort(key=lambda x: len(x[0]), reverse=True)
    return pairs


def scrub_text(s, replacements):
    for old, new in replacements:
        if old in s:
            s = s.replace(old, new)
    return s


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    # 配置在仓库根（filter-branch 的工作目录里通常没有配置文件），
    # 所以先在当前目录找，找不到就往上一层找。
    cfg_root = root
    for _ in range(4):
        if find_config(cfg_root):
            break
        parent = os.path.dirname(os.path.abspath(cfg_root))
        if parent == cfg_root:
            break
        cfg_root = parent

    replacements = build_replacements(cfg_root)
    changed = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR]
        for fn in filenames:
            if not fn.endswith(TEXT_EXT):
                continue
            p = os.path.join(dirpath, fn)
            try:
                with io.open(p, encoding='utf-8') as f:
                    old = f.read()
            except (UnicodeDecodeError, IOError):
                continue
            new = scrub_text(old, replacements)
            if new != old:
                with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
                    f.write(new)
                changed += 1
    print('  scrubbed %d files' % changed)


if __name__ == '__main__':
    main()
