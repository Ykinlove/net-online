# -*- coding: utf-8 -*-
"""规范化 data-src 里 tplbook 的字段排版：把 id 与 kw 挤在一行的写法拆开

背景：tplbook.js 里有 64 个模板是
    id: 'tpl-xxx',kw:['a','b'], 
    cat: '...',
这种写法——id 和 kw 挤一行，尾部还带个空格。
其它数据文件都是每字段一行的标准写法。

跑法：python normalize_tpl.py [--dry]
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'data-src', 'tplbook.js')

# 匹配 "id: 'xxx',kw:[...]," 这一整段（kw 内容不含嵌套方括号）
PAT = re.compile(r"^(\s*)id:\s*('[^']+'),\s*kw:\[([^\]]*)\],\s*$")


def main():
    dry = '--dry' in sys.argv
    if not os.path.exists(SRC):
        print('找不到 ' + SRC)
        return 1

    src = io.open(SRC, encoding='utf-8').read()
    lines = src.split('\n')
    out = []
    changed = 0

    for line in lines:
        m = PAT.match(line)
        if not m:
            out.append(line)
            continue
        indent = m.group(1)
        tid = m.group(2)
        words = re.findall(r"'[^']*'|\"[^\"]*\"", m.group(3))
        out.append(indent + 'id: ' + tid + ',')
        out.append(indent + 'kw: [' + ', '.join(words) + '],')
        changed += 1

    if not changed:
        print('无需调整')
        return 0

    new_src = '\n'.join(out)
    if not dry:
        io.open(SRC, 'w', encoding='utf-8', newline='\n').write(new_src)

    print('调整 %d 处' % changed + ('（dry-run，未落盘）' if dry else ''))

    # 安全闸：语法必须能过
    if not dry:
        import subprocess, tempfile
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False,
                                         encoding='utf-8', newline='\n') as tf:
            tf.write(new_src)
            tmp = tf.name
        try:
            r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
            if r.returncode != 0:
                print('  ✗ 语法错误，已中止')
                print('  ' + (r.stderr or '').strip().split('\n')[0])
                os.unlink(tmp)
                return 1
            print('  语法检查通过 ✓')
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
    return 0


if __name__ == '__main__':
    sys.exit(main())
