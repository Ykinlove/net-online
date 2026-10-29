import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
CH = os.path.join(BASE, '..', 'miniprogram', 'images', 'preset', 'char')

# (id, 性别, 姿势, 表情)
ROWS = [
    ('01', '男', '单膝蹲着，低头看测线仪', '皱眉抿嘴，专注'),
    ('02', '男', '一手高举网线盘，一手叉腰', '张嘴大笑，弯月眼'),
    ('03', '女', '侧背回眸，肩上搭光纤跳线', '挑眉坏笑，得瑟'),
    ('04', '女', '双手抱笔记本挡住半张脸', '睁大眼抬眉，俏皮'),
    ('05', '男', '一手叉腰，举水晶头端详', '撇嘴斜眼，怀疑'),
    ('08', '女', '双手插兜，略侧身抬下巴', '半眯眼睨视，冷淡'),
    ('09', '男', '两指捏领带整理，头微侧', '视线上扬，自信笑'),
    ('10', '女', '手按耳麦通话，腋下夹平板', '说话中微蹙眉，干练'),
    ('12', '男', '单腿放松站，翻转光模块', '眯眼坏笑，散漫自信'),
    ('14', '女', '侧身撩发，一手扶胯', '挑眉斜视，从容'),
]

def font(sz):
    for p in ['C:/Windows/Fonts/msyh.ttc']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()

CELL, GAP = 226, 16
W = 56 + 5 * (CELL + GAP) + 8
H = 92 + 2 * (CELL + 62 + GAP) + 44
canvas = Image.new('RGB', (W, H), (234, 244, 251))
d = ImageDraw.Draw(canvas)
d.text((56, 20), 'Net 操作命令速记 · 形象重做版', font=font(30), fill=(38, 56, 74))
d.text((56, 58), '10 个角色，姿势与表情逐个区分 · 前 5 个免费，后 5 个待解锁', font=font(21), fill=(122, 142, 162))

for i, (k, sex, pose, face) in enumerate(ROWS):
    im = Image.open(os.path.join(CH, 'character_%s.png' % k)).convert('RGBA')
    r, c = divmod(i, 5)
    x = 56 + c * (CELL + GAP)
    y = 92 + r * (CELL + 62 + GAP)
    paid = i >= 5
    d.rectangle([x, y, x + CELL, y + CELL], fill=(242, 248, 253),
                outline=(201, 164, 85) if paid else (194, 212, 227), width=4 if paid else 3)
    t = im.copy()
    t.thumbnail((CELL - 10, CELL - 10), Image.LANCZOS)
    canvas.paste(t, (x + (CELL - t.width) // 2, y + (CELL - t.height) // 2), t)

    d.text((x + 2, y + CELL + 8), '%s  %s  %s' % (k, sex, '付费' if paid else '免费'),
           font=font(20), fill=(176, 132, 44) if paid else (110, 130, 150))
    d.text((x + 2, y + CELL + 32), pose, font=font(17), fill=(96, 116, 136))
    d.text((x + 2, y + CELL + 52), face, font=font(17), fill=(96, 116, 136))

out = os.path.join(BASE, 'final_sheet.png')
canvas.save(out)
print('ok', out, canvas.size)
