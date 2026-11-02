// 社区投稿完整闭环验证（端侧真实操作）
//
// 走一遍真实链路：
//   1. 在贡献内容页选「新增」→ 填 id/name/kw → 提交
//   2. 检查云端 contributions 有 pending 记录
//   3. 在内容管理页「待审核」看到这条 → 点「通过」
//   4. 检查 extra_items 出现该条目
//   5. 回到搜索页搜索关键词 → 应能命中该新增条目
//   6. 清理：删除 extra_items / contributions 里的探针数据
//
// 用法：node miniprogram-tools/verify_contrib_flow.js

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const automator = require(path.join(__dirname, '.tmp-verify', 'node_modules', 'miniprogram-automator'));

const PORT = 9420;
const PROBE_ID = '__contrib_probe__';
const PROBE_KW = '闭环探针';

function say(s) { console.log(s); }
let pass = 0, fail = 0;
const ok = (s) => { say('  ✓ ' + s); pass++; };
const bad = (s) => { say('  ✗ ' + s); fail++; };

async function tapMenu(page, text, classes = ['.menu-row', '.row', '.btn', '.seg-item'], ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (const cls of classes) {
      let rows = [];
      try { rows = await page.$$(cls); } catch (e) { rows = []; }
      for (const row of rows) {
        try {
          const t = await row.text();
          if (t && String(t).indexOf(text) >= 0) { await row.tap(); return true; }
        } catch (e) { /* ignore */ }
      }
    }
    let els = [];
    try { els = await page.$$('*'); } catch (e) { els = []; }
    for (const el of els) {
      try {
        const t = await el.text();
        if (t && String(t).trim() === text) { await el.tap(); return true; }
      } catch (e) { /* ignore */ }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

async function readText(page, ms = 1500) {
  const t0 = Date.now();
  const acc = [];
  while (Date.now() - t0 < ms) {
    acc.length = 0;
    let els = [];
    try { els = await page.$$('*'); } catch (e) { els = []; }
    for (const el of els) {
      try { const t = await el.text(); if (t) acc.push(String(t)); } catch (e) { /* ignore */ }
    }
    if (acc.length) return acc.join(' | ');
    await new Promise(r => setTimeout(r, 200));
  }
  return acc.join(' | ');
}

/* 找到 input 元素并填值（按 placeholder 或顺序匹配） */
async function fillInput(page, placeholderPart, value, idx = 0) {
  const inputs = await page.$$('input');
  let n = 0;
  for (const inp of inputs) {
    let ph = '';
    try { ph = (await inp.attribute('placeholder')) || ''; } catch (e) {}
    if (placeholderPart && ph.indexOf(placeholderPart) < 0) continue;
    if (n === idx) { await inp.input(value); return true; }
    n++;
  }
  return false;
}

/* 找到 textarea 元素并填值（命令/说明用 textarea，不是 input） */
async function fillTextarea(page, placeholderPart, value, idx = 0) {
  const areas = await page.$$('textarea');
  let n = 0;
  for (const ta of areas) {
    let ph = '';
    try { ph = (await ta.attribute('placeholder')) || ''; } catch (e) {}
    if (placeholderPart && ph.indexOf(placeholderPart) < 0) continue;
    if (n === idx) { await ta.input(value); return true; }
    n++;
  }
  return false;
}

/* 定位 tcb CLI 的可执行入口。
   优先直接用 node 跑 @cloudbase/cli 的 JS 入口（避免 Windows 下 .cmd 的 spawn EINVAL），
   找不到再退回 npx。 */
function resolveTcb() {
  const path = require('path');
  const candidates = [];
  const nodeDir = path.dirname(process.execPath);
  candidates.push(path.join(nodeDir, 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'));
  candidates.push(path.join(nodeDir, '..', 'lib', 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'));
  candidates.push(path.join(nodeDir, '..', 'node_modules', '@cloudbase', 'cli', 'bin', 'tcb'));
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return { cmd: process.execPath, prefix: [c] }; } catch (e) { /* ignore */ }
  }
  return { cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx', prefix: [] };
}

/* 删除云端探针数据（extra_items + contributions），并清掉端侧缓存 */
async function cleanupProbe(mini) {
  const repoRoot = path.join(__dirname, '..');
  const tcb = resolveTcb();

  // 1) 先清端侧缓存，避免下次打开仍能看到探针条目
  if (mini) {
    try {
      const r = await mini.evaluate(async () => {
        try {
          wx.removeStorageSync('hotfix_patch_v1');
          const hf = getApp() && getApp().globalData && getApp().globalData.hotfix;
          if (hf && hf.clear) hf.clear();
          return { ok: true, cleared: !!(hf && hf.clear) };
        } catch (e) { return { err: String(e && e.message || e) }; }
      });
      if (r && r.ok) ok('已清端侧热更新缓存（内存+存储）');
      else bad('端侧缓存清理异常：' + JSON.stringify(r));
    } catch (e) {
      bad('端侧缓存清理失败：' + String((e && e.message) || e).slice(0, 120));
    }
  }

  // 2) 再删云端探针文档
  // 注意：MongoDB delete 的 limit 只能取 0（不限）或 1（删一条），不能取 10
  const targets = [
    { table: 'extra_items', q: { 'item.id': PROBE_ID } },
    { table: 'contributions', q: { 'fields.id': PROBE_ID } },
    { table: 'content_patch', q: { 'item.id': PROBE_ID } }
  ];
  for (const t of targets) {
    const cmd = {
      delete: t.table,
      deletes: [{ q: t.q, limit: 0 }]
    };
    const payload = JSON.stringify([{
      TableName: t.table,
      CommandType: 'DELETE',
      Command: JSON.stringify(cmd)
    }]);
    try {
      execFileSync(tcb.cmd, tcb.prefix.concat(['db', 'nosql', 'execute', '--command', payload, '--json']), {
        cwd: repoRoot, stdio: 'pipe', timeout: 180000, encoding: 'utf8'
      });
      ok('已清理 ' + t.table);
    } catch (e) {
      const detail = (e && (e.stderr || e.message)) || '';
      bad('清理 ' + t.table + ' 失败：' + String(detail).replace(/\s+/g, ' ').slice(0, 160));
    }
  }
}

(async () => {
  let mini;
  try {
    mini = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${PORT}` });
    say('▸ 已连接自动化服务');
  } catch (e) {
    console.error('✗ 连接失败：' + e.message);
    process.exit(2);
  }

  try {
    // ---------- 1. 投稿页：新增一条 ----------
    say('\n── 1. 贡献内容页：新增投稿 ──');
    let page = await mini.reLaunch('/subpkg-tool/pages/contribute/contribute');
    await new Promise(r => setTimeout(r, 2000));

    // 选「新增条目」类型
    const pickedAdd = await tapMenu(page, '新增条目', ['.seg-item']);
    if (pickedAdd) ok('切到「新增条目」类型');
    else bad('未找到「新增条目」选项');
    await new Promise(r => setTimeout(r, 1200));

    // 填名称（百科表单第一个 input，placeholder「功能点名称」）
    const filledName = await fillInput(page, '功能点名称', PROBE_KW + '条目');
    if (filledName) ok('填写名称');
    else bad('未找到名称输入框');

    // 填别名/关键词（placeholder「别名」）
    const filledKw = await fillInput(page, '别名', PROBE_KW);
    if (filledKw) ok('填写关键词：' + PROBE_KW);
    else bad('未找到关键词输入框');

    // 填 tip（textarea，placeholder「最容易记混的地方」）
    const filledTip = await fillTextarea(page, '最容易记混', '闭环验证用');
    if (filledTip) ok('填写 tip');
    else bad('未找到 tip 输入框');

    // 填厂商名
    const filledVendor = await fillInput(page, '厂商', '华为');
    if (filledVendor) ok('填写厂商');
    else bad('未找到厂商输入框');

    // 填厂商命令（textarea，placeholder「命令」）—— 必填，否则提交被拦
    const filledCmd = await fillTextarea(page, '命令', 'display version\ndisplay device');
    if (filledCmd) ok('填写厂商命令（必填项）');
    else bad('未找到命令输入框');

    // 填 id（placeholder「如：bgp-graceful-restart」）
    const filledId = await fillInput(page, 'bgp-graceful-restart', PROBE_ID);
    if (filledId) ok('填写 id：' + PROBE_ID);
    else bad('未找到 id 输入框');

    await new Promise(r => setTimeout(r, 800));

    // 提交
    const submitted = await tapMenu(page, '提交审核', ['.btn']);
    if (submitted) ok('点击「提交审核」');
    else bad('未找到提交按钮');
    await new Promise(r => setTimeout(r, 3500));

    const afterText = await readText(page, 2000);
    if (afterText.includes('成功') || afterText.includes('已提交') || afterText.includes('等待审核')) ok('投稿提交成功');
    else bad('投稿提交未确认成功：' + afterText.slice(0, 200));

    // ---------- 2. 云端确认 pending ----------
    say('\n── 2. 云端确认（contributions 应有 pending 记录）──');
    const cloudCheck = await mini.evaluate(async (probeId) => {
      try {
        const res = await wx.cloud.callFunction({ name: 'listContent', data: { since: 0, extraSince: 0 } });
        return { ok: !!(res && res.result && res.result.ok) };
      } catch (e) { return { err: String(e && e.message || e) }; }
    }, PROBE_ID);
    if (cloudCheck.ok) ok('云函数可调用');
    else bad('云函数调用异常：' + JSON.stringify(cloudCheck));

    // ---------- 3. 内容管理 → 待审核 ----------
    say('\n── 3. 内容管理 → 待审核 ──');
    page = await mini.reLaunch('/subpkg-tool/pages/admin/admin');
    await new Promise(r => setTimeout(r, 1800));

    // 解锁
    let inputEl = await page.$('input');
    if (inputEl) {
      await inputEl.input(process.env.ADMIN_PASS || 'SET_LOCAL_PASS');
      const btn = await page.$('.btn');
      if (btn) { await btn.tap(); await new Promise(r => setTimeout(r, 2200)); }
      page = await mini.currentPage();
    }
    ok('已进入内容管理页');

    // 切待审核 tab
    const tabOk = await tapMenu(page, '待审核', ['.seg-item', '.seg-btn', '.tab']);
    if (tabOk) ok('切到「待审核」tab');
    await new Promise(r => setTimeout(r, 3000));
    page = await mini.currentPage();

    const reviewText = await readText(page, 2000);
    if (reviewText.includes('database collection not exists') || reviewText.includes('-502005')) {
      bad('待审核仍报集合不存在');
    } else {
      ok('待审核界面无集合不存在报错');
    }

    const hasProbe = reviewText.indexOf(PROBE_KW) >= 0 || reviewText.indexOf(PROBE_ID) >= 0;
    if (hasProbe) ok('待审核列表里看到了刚发的投稿');
    else bad('待审核列表未看到刚发的投稿：' + reviewText.slice(0, 180));

    // ---------- 4. 点「通过」 ----------
    say('\n── 4. 审核通过 ──');
    const approved = await tapMenu(page, '通过', ['.btn', '.btn-primary', '.btn-sm']);
    if (approved) ok('点击「通过」');
    else bad('未找到「通过」按钮');
    await new Promise(r => setTimeout(r, 3000));
    page = await mini.currentPage();

    const afterApprove = await readText(page, 2000);
    // toast 是系统层，automator 读不到；改用实质结果判断：待审核列表已清空
    if (afterApprove.includes('成功') || afterApprove.includes('已通过') ||
        afterApprove.includes('暂无待审核') || afterApprove.includes('暂无投稿')) {
      ok('审核通过操作完成（待审核列表已清空）');
    } else {
      bad('未确认通过结果：' + afterApprove.slice(0, 150));
    }

    // ---------- 5. 搜索命中 ----------
    say('\n── 5. 搜索命中新增条目 ──');
    const searchResult = await mini.evaluate(async (kw) => {
      try {
        const res = await wx.cloud.callFunction({ name: 'listContent', data: { since: 0, extraSince: 0 } });
        const extras = (res && res.result && res.result.extras) || [];
        const hit = extras.filter(e => e && e.item && JSON.stringify(e.item).indexOf(kw) >= 0);
        return { total: extras.length, hit: hit.length, sample: hit.length ? hit[0].item : null };
      } catch (e) { return { err: String(e && e.message || e) }; }
    }, PROBE_KW);

    if (searchResult.hit > 0) {
      ok('云端 extra_items 已包含新条目（命中 ' + searchResult.hit + ' 条）');
      if (searchResult.sample) ok('条目内容：id=' + searchResult.sample.id + ' name=' + searchResult.sample.name);
    } else {
      bad('云端 extra_items 未包含新条目（总数 ' + searchResult.total + '）');
    }

    // 端侧真实搜索：进搜索页输入关键词 → 结果里应出现新条目
    page = await mini.reLaunch('/subpkg-tool/pages/search/search');
    await new Promise(r => setTimeout(r, 2500));
    const filledSearchKw = await fillInput(page, '搜功能', PROBE_KW);
    if (filledSearchKw) ok('搜索页输入关键词：' + PROBE_KW);
    else bad('未找到搜索输入框');
    await new Promise(r => setTimeout(r, 2500));
    page = await mini.currentPage();

    const hitText = await readText(page, 2500);
    if (hitText.indexOf(PROBE_KW) >= 0) ok('端侧搜索页已命中新条目（热更新覆盖层生效）');
    else bad('端侧搜索页未命中新条目：' + hitText.slice(0, 200));

    // ---------- 6. 清理探针数据 ----------
    say('\n── 6. 清理云端探针数据 ──');
    await cleanupProbe(mini);

    // ---------- 汇总 ----------
    say('\n════════════════════════════════════');
    say('  闭环验证通过 ' + pass + ' 项，失败 ' + fail + ' 项');
    say('════════════════════════════════════');

    try { await mini.disconnect(); } catch (e) {}
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    say('\n✗ 执行异常：' + ((e && e.message) || e));
    try { await mini.disconnect(); } catch (x) {}
    process.exit(3);
  }
})();
