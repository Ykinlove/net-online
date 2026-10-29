# -*- coding: utf-8 -*-
"""规范化 data-src 源的排版：把过长的 kw 数组折行

源是唯一真源，要人读得懂。历史上有的条目 kw 挤在一行（几十个词），
diff 里看不全、review 时容易漏词。

跑法：python normalize_src.py [--dry]
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'data-src')

# 一个 kw 数组如果超过这个长度就折行
MAX_KW_LEN = 100
# 折行后每行放几个词
PER_LINE = 6

# 匹配 "kw: [ ... ]" 或 "kw:[...]"（内容里不含嵌套方括号）
KW_RE = re.compile(r"kw:\s*\[([^\]]*)\]")


def fold_kw(line, match):
    """把一行里的 kw 数组折成多行。

    只替换数组本体（match 的 span），行首缩进和行尾内容（含逗号）原样保留。
    早先版本整行替换，吞掉了行尾逗号，导致压缩后变成 kw:[...]cmds:[...] 语法错误。
    """
    body = match.group(1)
    # 拆成词（引号包裹的字符串）
    words = re.findall(r"'[^']*'|\"[^\"]*\"", body)
    if not words:
        return line
    if len(body) <= MAX_KW_LEN:
        return line

    # 本行在源里的缩进
    indent = len(line) - len(line.lstrip())
    pad = ' ' * indent
    lines = []
    for i in range(0, len(words), PER_LINE):
        chunk = words[i:i + PER_LINE]
        lines.append(pad + '  ' + ', '.join(chunk) + ',')
    # 最后一行去掉尾逗号（数组内部不_trailing comma）
    lines[-1] = lines[-1].rstrip(',')
    folded = 'kw: [\n' + '\n'.join(lines) + '\n' + pad + ']'

    # 精确替换数组本体
    return line[:match.start()] + folded + line[match.end():]


def check_syntax(files):
    """安全闸：折行后的源必须能被 Node 解析，否则中止。

    早先版本整行替换 kw 数组，吞掉了行尾逗号，
    压缩后变成 kw:[...]cmds:[...] —— 语法错误但构建不报错，评测才炸。
    这里在落盘前就拦住。
    """
    import subprocess, tempfile
    bad = []
    for name in files:
        p = os.path.join(SRC, name)
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False,
                                         encoding='utf-8', newline='\n') as tf:
            tf.write(io.open(p, encoding='utf-8').read())
            tmp = tf.name
        try:
            r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
            if r.returncode != 0:
                bad.append((name, (r.stderr or '').strip().split('\n')[0]))
        finally:
            os.unlink(tmp)
    return bad


def main():
    dry = '--dry' in sys.argv
    changed = []

    for name in sorted(f for f in os.listdir(SRC) if f.endswith('.js')):
        p = os.path.join(SRC, name)
        src = io.open(p, encoding='utf-8').read()
        lines = src.split('\n')
        out = []
        touched = 0

        for line in lines:
            m = KW_RE.search(line)
            # 只处理「整行就是一个 kw 字段」的情况
            if m and line.strip().startswith('kw:') and len(line) > MAX_KW_LEN:
                new = fold_kw(line, m)
                if new == line:
                    out.append(line)
                    continue
                out.append(new)
                touched += 1
                continue
            out.append(line)

        if not touched:
            continue

        new_src = '\n'.join(out)
        if new_src == src:
            continue
        changed.append((name, touched))
        if not dry:
            io.open(p, 'w', encoding='utf-8', newline='\n').write(new_src)

    print('折行 %d 个文件' % len(changed))
    for name, n in changed:
        print('  %-28s %d 处' % (name, n))
    if dry:
        print('（dry-run，未落盘）')
        return 0

    if changed:
        print('')
        print('语法检查...')
        bad = check_syntax([n for n, _ in changed])
        if bad:
            print('  ✗ %d 个文件语法错误，已中止（请手动检查）' % len(bad))
            for name, why in bad:
                print('    %-28s %s' % (name, why))
            print('')
            print('提示：用 git checkout -- miniprogram-tools/data-src/ 可回滚')
            return 1
        print('  全部通过 ✓')

    return 0


if __name__ == '__main__':
    sys.exit(main())
