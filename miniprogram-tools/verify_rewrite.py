#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验历史重写是否「只做了敏感串替换、其它一字未动」。

思路：以未重写的原始仓库为 ground truth，把原始每个 commit 的每个文件
      按替换规则变换一遍，要求结果与重写后对应 commit 的文件逐字节相同。

用法：
    git fetch <原始仓库> master:refs/heads/orig-check
    python miniprogram-tools/verify_rewrite.py [原ref] [新ref]

替换表来自本地私密配置 cloudbaserc.local.json（仓库里不含明文）：
    replacements 反向 + secrets 兜底
"""
import io
import json
import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def git(*args, binary=False):
    r = subprocess.run(['git', '-C', REPO] + list(args), capture_output=True)
    if r.returncode != 0:
        raise SystemExit('git failed: %s\n%s'
                         % (' '.join(args), r.stderr.decode('utf-8', 'replace')))
    return r.stdout if binary else r.stdout.decode('utf-8', 'replace')


def load_pairs():
    cfg_path = os.path.join(REPO, 'cloudbaserc.local.json')
    if not os.path.isfile(cfg_path):
        raise SystemExit('✗ 缺少 cloudbaserc.local.json，无法取替换表')
    with io.open(cfg_path, encoding='utf-8') as f:
        cfg = json.load(f)

    pairs = []
    covered = set()

    # 1) historyScrub：与 scrub_history.py 共用的权威规则（占位符 → 真实值）
    for ph, real in (cfg.get('historyScrub') or {}).items():
        if isinstance(real, str) and real:
            pairs.append((real, ph))
            covered.add(real)

    # 2) replacements 反向补充
    for ph, real in (cfg.get('replacements') or {}).items():
        if isinstance(real, str) and real and real not in covered:
            pairs.append((real, ph))
            covered.add(real)

    # 3) secrets 兜底
    idx = 0
    for s in (cfg.get('secrets') or []):
        if isinstance(s, str) and s and s not in covered:
            idx += 1
            pairs.append((s, '__SECRET_%d__' % idx))
            covered.add(s)

    # 长的先替换，避免前缀截断
    pairs.sort(key=lambda x: len(x[0]), reverse=True)
    return [(o.encode('utf-8'), n.encode('utf-8')) for o, n in pairs]


def cat_file_batch(items):
    """items: [(commit, path), ...] -> [blob bytes, ...]，一次进程读完，避免逐个起进程。"""
    if not items:
        return []
    p = subprocess.Popen(['git', '-C', REPO, 'cat-file', '--batch'],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    payload = ''.join('%s:%s\n' % (c, f) for c, f in items).encode('utf-8')
    out, _ = p.communicate(payload)

    res = []
    pos = 0
    for _ in items:
        nl = out.index(b'\n', pos)
        parts = out[pos:nl].decode('utf-8', 'replace').split()
        if len(parts) < 3 or parts[1] != 'blob':
            raise SystemExit('✗ cat-file 返回异常: %s' % out[pos:nl][:120])
        size = int(parts[2])
        res.append(out[nl + 1:nl + 1 + size])
        pos = nl + 1 + size + 1
    return res


def scrub(b, pairs):
    for old, new in pairs:
        if old in b:
            b = b.replace(old, new)
    return b


def main():
    old_ref = sys.argv[1] if len(sys.argv) > 1 else 'orig-check'
    new_ref = sys.argv[2] if len(sys.argv) > 2 else 'master'

    pairs = load_pairs()
    old_list = git('rev-list', '--reverse', old_ref).split()
    new_list = git('rev-list', '--reverse', new_ref).split()

    print('原历史 %s: %d commits   新历史 %s: %d commits'
          % (old_ref, len(old_list), new_ref, len(new_list)))
    if len(old_list) != len(new_list):
        print('✗ commit 数量不一致')
        return 1

    bad = []
    msg_bad = []
    pairs_checked = 0

    # 先把全部待查文件收集起来，一次 cat-file --batch 读完
    todo = []
    for o, n in zip(old_list, new_list):
        of = [x for x in git('ls-tree', '-r', '--name-only', o).split('\n') if x]
        nf = [x for x in git('ls-tree', '-r', '--name-only', n).split('\n') if x]
        if of != nf:
            bad.append((o[:8], n[:8], 'FILE SET DIFFERS (%d vs %d)' % (len(of), len(nf))))
            continue

        om = git('log', '-1', '--format=%s%n%an%n%ae%n%ad', '--date=iso', o)
        nm = git('log', '-1', '--format=%s%n%an%n%ae%n%ad', '--date=iso', n)
        if om != nm:
            msg_bad.append((o[:8], n[:8], om.replace('\n', ' | '), nm.replace('\n', ' | ')))

        for f in of:
            todo.append((o, n, f))

    print('待比对文件对：%d' % len(todo), flush=True)

    CHUNK = 600
    for start in range(0, len(todo), CHUNK):
        chunk = todo[start:start + CHUNK]
        items = []
        for o, n, f in chunk:
            items.append((o, f))
            items.append((n, f))
        blobs = cat_file_batch(items)
        for i, (o, n, f) in enumerate(chunk):
            ob, nb = blobs[2 * i], blobs[2 * i + 1]
            pairs_checked += 1
            if scrub(ob, pairs) != nb:
                bad.append((o[:8], n[:8], f))
        print('  已比对 %d/%d' % (pairs_checked, len(todo)), flush=True)

    print('逐文件比对：%d 对' % pairs_checked)
    if msg_bad:
        print('✗ commit 元信息不一致 %d 处：' % len(msg_bad))
        for m in msg_bad[:10]:
            print('   ', m)
    if bad:
        print('✗ 内容不一致 %d 处：' % len(bad))
        for b in bad[:40]:
            print('   ', b)
        return 1
    if msg_bad:
        return 1
    print('✓ 通过：新历史每一处内容都严格等于「原内容经替换规则处理」的结果')
    print('✓ 通过：commit message / 作者 / 日期全部保留')
    return 0


if __name__ == '__main__':
    sys.exit(main())
