# -*- coding: utf-8 -*-
"""检查 data-src 源文件的格式一致性（可读性体检）

源是唯一真源，要人读得懂、看得清。跑法：python check_src_style.py
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'data-src')

# 一行里挤了多个字段的可疑写法。
# 注意用 [ \t]* 而不是 \s*——\s 会跨行匹配，把正常的两行写法也误判成问题。
TIGHT_ID_KW = re.compile(r"id:[ \t]*'[^']+',[ \t]*kw[ \t]*:[ \t]*\[")
# 字段行过长（命令文本本身长是正常的，这里只查字段名开头的结构行）
FIELD_START = re.compile(r"^\s*(id|name|kw|cat|devs|vendor|note|sub|title)\s*:\s*(.{170,})")
# 制表符
TAB = '\t'
LONG_LINE = 160


def main():
    files = sorted(f for f in os.listdir(SRC) if f.endswith('.js'))
    problems = []
    total_ids = 0

    for name in files:
        p = os.path.join(SRC, name)
        src = io.open(p, encoding='utf-8').read()
        lines = src.split('\n')
        total_ids += len(re.findall(r"id:\s*'[^']+'", src))

        tight = TIGHT_ID_KW.findall(src)
        if tight:
            problems.append((name, 'id/kw 挤在一行', len(tight)))

        # 结构行超长（字段名开头的行且内容很长，说明漏了换行）
        longs = [i + 1 for i, l in enumerate(lines) if FIELD_START.match(l)]
        if longs:
            problems.append((name, '字段行过长（可能漏换行）', len(longs)))

        # 制表符
        if TAB in src:
            problems.append((name, '含制表符', src.count(TAB)))

        # 尾部空行过多
        if src.endswith('\n\n\n'):
            problems.append((name, '文件尾多余空行', 0))

    print('源文件 %d 个，条目 id 合计 %d' % (len(files), total_ids))
    if not problems:
        print('格式检查：全部通过 ✓')
        return 0
    print('格式检查：%d 个文件有问题' % len(problems))
    for name, why, n in problems:
        print('  %-28s %s（%d 处）' % (name, why, n))
    return 1


if __name__ == '__main__':
    sys.exit(main())
