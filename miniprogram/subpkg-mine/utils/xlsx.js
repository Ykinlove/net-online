// utils/xlsx.js —— 极简 .xlsx 生成器（纯 JS，不依赖任何库）
// 原理：xlsx 就是一个 zip 包，里面放几份固定结构的 XML。
// 这里用 ZIP 的「store（不压缩）」方式打包，省掉 deflate，只需要 CRC32。
// 用法：const buf = buildBook([{ name: '命令', rows: [['标题1','标题2'], ['a','b']] }]);

/* ---------------- CRC32 ---------------- */
const CRC_TABLE = (function () {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------------- 字符串 → UTF-8 字节 ---------------- */
function utf8(str) {
  const s = String(str);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    } else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
      const c2 = s.charCodeAt(++i);
      const cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
      out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else {
      out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return new Uint8Array(out);
}

/* ---------------- ZIP（store 模式） ---------------- */
function makeZip(files) {
  const DOS_DATE = 20513; // 2020-01-01，固定值即可，只为让日期字段合法
  const parts = [];
  const central = [];
  let offset = 0;

  files.forEach(function (f) {
    const nameBytes = utf8(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // 文件名用 UTF-8
    lv.setUint16(8, 0, true);      // 0 = 不压缩
    lv.setUint16(10, 0, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local);
    parts.push(data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + size;
  });

  let cdSize = 0;
  central.forEach(function (c) { cdSize += c.length; });

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const all = parts.concat(central).concat([eocd]);
  let total = 0;
  all.forEach(function (p) { total += p.length; });
  const out = new Uint8Array(total);
  let pos = 0;
  all.forEach(function (p) { out.set(p, pos); pos += p.length; });
  return out;
}

/* ---------------- XML 工具 ---------------- */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function colName(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function sheetXml(sheet) {
  const rows = sheet.rows || [];
  const widths = sheet.widths || [];
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
  out.push('<sheetViews><sheetView workbookViewId="0">');
  out.push('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
  out.push('</sheetView></sheetViews>');
  out.push('<sheetFormatPr defaultRowHeight="16"/>');

  if (widths.length) {
    out.push('<cols>');
    widths.forEach(function (w, i) {
      out.push('<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>');
    });
    out.push('</cols>');
  }

  out.push('<sheetData>');
  rows.forEach(function (row, ri) {
    const r = ri + 1;
    const style = ri === 0 ? ' s="1"' : '';
    out.push('<row r="' + r + '">');
    (row || []).forEach(function (cell, ci) {
      const ref = colName(ci + 1) + r;
      if (cell === null || cell === undefined || cell === '') {
        out.push('<c r="' + ref + '"' + style + '/>');
      } else if (typeof cell === 'number' && isFinite(cell)) {
        out.push('<c r="' + ref + '"' + style + '><v>' + cell + '</v></c>');
      } else {
        out.push('<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' + esc(cell) + '</t></is></c>');
      }
    });
    out.push('</row>');
  });
  out.push('</sheetData>');
  out.push('</worksheet>');
  return out.join('');
}

/* ---------------- 打包成 xlsx ---------------- */
function buildBook(sheets) {
  const list = (sheets || []).filter(function (s) { return s && s.name; });
  if (!list.length) list.push({ name: 'Sheet1', rows: [['(空)']] });

  const files = [];

  // [Content_Types].xml
  const ct = [];
  ct.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  ct.push('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">');
  ct.push('<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>');
  ct.push('<Default Extension="xml" ContentType="application/xml"/>');
  ct.push('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>');
  ct.push('<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>');
  list.forEach(function (s, i) {
    ct.push('<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
  });
  ct.push('</Types>');
  files.push({ name: '[Content_Types].xml', data: utf8(ct.join('')) });

  // _rels/.rels
  files.push({
    name: '_rels/.rels',
    data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>')
  });

  // xl/workbook.xml
  const wb = [];
  wb.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  wb.push('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
  wb.push('<sheets>');
  list.forEach(function (s, i) {
    wb.push('<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>');
  });
  wb.push('</sheets></workbook>');
  files.push({ name: 'xl/workbook.xml', data: utf8(wb.join('')) });

  // xl/_rels/workbook.xml.rels
  const rels = [];
  rels.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  rels.push('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">');
  list.forEach(function (s, i) {
    rels.push('<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>');
  });
  rels.push('<Relationship Id="rId' + (list.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');
  rels.push('</Relationships>');
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: utf8(rels.join('')) });

  // xl/styles.xml —— 0=普通，1=加粗（表头）
  files.push({
    name: 'xl/styles.xml',
    data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
      '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
      '</fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>')
  });

  // 各 sheet
  list.forEach(function (s, i) {
    files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: utf8(sheetXml(s)) });
  });

  const zip = makeZip(files);
  // 返回 ArrayBuffer，方便直接写文件
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
}

module.exports = { buildBook };
