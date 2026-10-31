// 小程序端到端自动化验证
//
// 用微信开发者工具的自动化接口驱动真实模拟器，走一遍：
//   我的 → 设置 → 关于 → 制作人 → 贡献内容
//   我的 → 设置 → 关于 → 制作人 → 内容管理 → 待审核
// 并在真实端侧环境调用云函数，验证鉴权与数据链路。
//
// 用法：
//   node miniprogram-tools/verify_miniprogram.js
//
// 前置：
//   1. 开发者工具已打开项目 E:\Work buddy\命令\net-online
//   2. 已执行 cli.bat auto --project <路径> --auto-port 9420
//
// 注意：脚本结束时用 disconnect() 而非 close()，避免把 IDE 的自动化服务关掉。

const path = require('path');
const automator = require(path.join(__dirname, '.tmp-verify', 'node_modules', 'miniprogram-automator'));

const PORT = 9420;
function say(s) { console.log(s); }

let pass = 0, fail = 0;
const ok = (s) => { say('  ✓ ' + s); pass++; };
const bad = (s) => { say('  ✗ ' + s); fail++; };

async function tapText(mini, page, text, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    let els = [];
    try { els = await page.$$('*'); } catch (e) { els = []; }
    for (const el of els) {
      try {
        const t = await el.text();
        const attr = await el.attribute('data-text');
        if (t === text || attr === text || (t && String(t).trim() === text)) {
          await el.tap();
          return true;
        }
      } catch (e) { /* 元素可能已销毁 */ }
    }
    try { await page.waitFor(250); } catch (e) { await new Promise(r => setTimeout(r, 250)); }
  }
  return false;
}

/* 读取页面里所有可见文本。
   page.data() 拿不到静态 wxml 文案（只有 __webviewId__），
   必须遍历元素取 text()。 */
async function readText(page, ms = 4000) {
  const t0 = Date.now();
  const acc = [];
  while (Date.now() - t0 < ms) {
    acc.length = 0;
    let els = [];
    try { els = await page.$$('*'); } catch (e) { els = []; }
    for (const el of els) {
      try {
        const t = await el.text();
        if (t) acc.push(String(t));
      } catch (e) { /* ignore */ }
    }
    if (acc.length) return acc.join(' | ');
    await new Promise(r => setTimeout(r, 250));
  }
  return acc.join(' | ');
}

/* 页面上是否存在某个文案 */
async function hasText(page, text, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    let els = [];
    try { els = await page.$$('*'); } catch (e) { els = []; }
    for (const el of els) {
      try {
        const t = await el.text();
        if (t && String(t).indexOf(text) >= 0) return true;
      } catch (e) { /* ignore */ }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

/* 点击文案所在的菜单行。
   直接 tap 文本节点在小程序里不触发父元素的 bindtap，
   要往上找到带 class 的可点击容器。 */
async function tapMenu(page, text, classes = ['.menu-row', '.row', '.menu-item'], ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (const cls of classes) {
      let rows = [];
      try { rows = await page.$$(cls); } catch (e) { rows = []; }
      for (const row of rows) {
        try {
          const t = await row.text();
          if (t && String(t).indexOf(text) >= 0) {
            await row.tap();
            return true;
          }
        } catch (e) { /* ignore */ }
      }
    }
    // 兜底：直接点文本节点
    let els = [];
    try { els = await page.$$('*'); } catch (e) { els = []; }
    for (const el of els) {
      try {
        const t = await el.text();
        if (t === text) { await el.tap(); return true; }
      } catch (e) { /* ignore */ }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

(async () => {
  let mini;
  try {
    say('▸ 连接开发者工具自动化服务…');
    mini = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${PORT}` });
    say('  ✓ 已连接');
  } catch (e) {
    console.error('✗ 连接失败：' + e.message);
    console.error('  请先执行：cli.bat auto --project "E:\\Work buddy\\命令\\net-online" --auto-port 9420');
    process.exit(2);
  }

  try {
    // ---------- 1. 小程序启动 ----------
    say('\n── 1. 小程序启动 ──');
    let page = await mini.currentPage();
    say('  当前页面：' + page.path);
    await new Promise(r => setTimeout(r, 2000));

    const appState = await mini.evaluate(() => {
      const app = typeof getApp === 'function' ? getApp() : null;
      const g = (app && app.globalData) || {};
      return { ready: !!g.cloudReady, env: g.env || '', err: g.envError || '' };
    });
    if (appState.ready) ok('云开发已就绪（env=' + appState.env + '）');
    else bad('云开发未就绪：' + (appState.err || 'cloudReady=false'));

    // ---------- 2. 入口路径 ----------
    say('\n── 2. 入口路径：我的 → 设置 → 关于 → 制作人 ──');
    page = await mini.reLaunch('/pages/mine/mine');
    await new Promise(r => setTimeout(r, 1500));
    ok('进入「我的」页');

    const mineText = await readText(page, 2500);
    if (!mineText.includes('内容管理') && !mineText.includes('贡献内容')) {
      ok('「我的」页未直接暴露内容管理/贡献内容');
    } else {
      bad('「我的」页仍直接暴露这两个入口');
    }

    const t1 = await tapMenu(page, '设置');
    if (t1) ok('点击「设置」'); else bad('未找到「设置」');
    await new Promise(r => setTimeout(r, 1400));
    page = await mini.currentPage();

    const t2 = await tapMenu(page, '关于');
    if (t2) ok('点击「关于」'); else bad('未找到「关于」');
    await new Promise(r => setTimeout(r, 1400));
    page = await mini.currentPage();

    const t3 = await tapMenu(page, '制作人');
    if (t3) ok('点击「制作人」'); else bad('未找到「制作人」');
    await new Promise(r => setTimeout(r, 1600));
    page = await mini.currentPage();

    if (page.path.includes('/maker/maker')) ok('已进入制作人页（' + page.path + '）');
    else bad('未进入制作人页，当前：' + page.path);

    // ---------- 3. 制作人页文案 ----------
    say('\n── 3. 制作人页菜单文案 ──');
    const makerText = await readText(page, 2500);
    if (makerText.includes('内容管理')) ok('存在「内容管理」入口');
    else bad('缺少「内容管理」入口');
    if (makerText.includes('贡献内容')) ok('存在「贡献内容」入口');
    else bad('缺少「贡献内容」入口');
    const suffix = ['（作者）', '（投稿）', '(作者)', '(投稿)'];
    const found = suffix.filter(s => makerText.includes(s));
    if (!found.length) ok('菜单文案不带「（作者）/（投稿）」后缀');
    else bad('菜单文案仍带后缀：' + found.join(' '));

    // ---------- 4. 内容管理页：口令保护 ----------
    say('\n── 4. 内容管理页（口令保护）──');
    // 清掉本地存储，确保走「未解锁」分支（解锁态是持久化的）
    try { await mini.callWxMethod('clearStorageSync'); } catch (e) {}

    await tapMenu(page, '内容管理');
    await new Promise(r => setTimeout(r, 1800));
    page = await mini.currentPage();
    if (page.path.includes('/admin/admin')) ok('进入内容管理页');
    else bad('未进入内容管理页，当前：' + page.path);

    // 锁屏判定：输入框 placeholder 是「请输入管理口令」
    const inputEl0 = await page.$('input');
    let ph = null;
    if (inputEl0) { try { ph = await inputEl0.attribute('placeholder'); } catch (e) {} }
    if (ph && String(ph).includes('管理口令')) ok('未解锁时显示口令卡片（placeholder=' + ph + '）');
    else bad('未见口令卡片，placeholder=' + ph);

    // 权限说明文案
    const adminText0 = await readText(page, 1500);
    if (adminText0.includes('openid 白名单') || adminText0.includes('ADMIN_OPENIDS')) {
      ok('锁屏页说明「权限由云端 openid 白名单鉴权」');
    } else {
      bad('锁屏页缺少权限说明');
    }

    // 错误口令：直接调 unlock() 并检查是否拒绝
    // （showToast 是系统弹层，automator 读不到；这里验证的是「是否解锁」这个实质结果）
    let inputEl = inputEl0;
    if (inputEl) {
      await inputEl.input('wrong-password-test');
      await new Promise(r => setTimeout(r, 400));

      // 方式 A：点按钮
      const btn = await page.$('.btn');
      if (btn) {
        await btn.tap();
        await new Promise(r => setTimeout(r, 900));
      }
      // 方式 B：直接调页面方法（覆盖 input 事件没触发的情况）
      try {
        await page.callMethod('unlock');
        await new Promise(r => setTimeout(r, 500));
      } catch (e) { /* ignore */ }

      const stillLocked = await page.$('input');
      const storageFlag = await mini.callWxMethod('getStorageSync', 'admin_unlocked');
      const unlocked = (storageFlag === '1');

      if (stillLocked && !unlocked) ok('错误口令被正确拒绝（仍在锁屏，未写入解锁标记）');
      else bad('错误口令竟然通过了（锁屏元素=' + !!stillLocked + ', storage=' + JSON.stringify(storageFlag) + '）');
    } else bad('未找到口令输入框');

    // 正确口令
    inputEl = await page.$('input');
    if (inputEl) {
      await inputEl.input('__ADMIN_PASS__');
      const btn = await page.$('.btn');
      if (btn) {
        await btn.tap();
        await new Promise(r => setTimeout(r, 2500));
        page = await mini.currentPage();
        const t = await readText(page, 2500);
        if (t.includes('待审核')) ok('正确口令进入管理界面，可见「待审核」tab');
        else bad('未进入管理主界面，当前：' + t.slice(0, 100));
      }
    }

    // ---------- 5. 待审核 tab 无 -502005 ----------
    say('\n── 5. 待审核 tab（验证 -502005 已修复）──');
    await tapMenu(page, '待审核');
    await new Promise(r => setTimeout(r, 3000));
    page = await mini.currentPage();
    const reviewText = await readText(page, 2500);
    const hasErr = reviewText.includes('database collection not exists') ||
                   reviewText.includes('-502005') ||
                   reviewText.includes('Db or Table not exist');
    if (!hasErr) ok('待审核界面无集合不存在报错');
    else bad('待审核界面仍报错');
    if (reviewText.includes('暂无') || reviewText.includes('没有') || reviewText.includes('待审核')) {
      ok('待审核列表正常渲染（当前：' + reviewText.slice(0, 60) + '）');
    } else {
      bad('待审核列表未正常渲染：' + reviewText.slice(0, 80));
    }

    // ---------- 6. 贡献内容页 ----------
    say('\n── 6. 贡献内容页 ──');
    page = await mini.reLaunch('/subpkg-mine/pages/maker/maker');
    await new Promise(r => setTimeout(r, 1500));
    await tapMenu(page, '贡献内容');
    await new Promise(r => setTimeout(r, 2000));
    page = await mini.currentPage();
    if (page.path.includes('/contribute/contribute')) ok('进入贡献内容页');
    else bad('未进入贡献内容页，当前：' + page.path);

    const contribText = await readText(page, 2500);
    if (contribText.includes('新增') || contribText.includes('修改')) ok('投稿页有新增/修改选项');
    else bad('投稿页未见新增/修改选项，当前：' + contribText.slice(0, 100));

    // ---------- 7. 端侧真实调云函数 ----------
    say('\n── 7. 端侧真实调用云函数 ──');
    const r = await mini.evaluate(async () => {
      const out = {};
      const call = async (name, data) => {
        try {
          const res = await wx.cloud.callFunction({ name, data });
          return { ok: true, result: res && res.result };
        } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
      };
      const a = await call('listContent', { since: 0, extraSince: 0 });
      out.list = a.ok ? { ok: !!(a.result && a.result.ok), patches: (a.result && a.result.patches || []).length, extras: (a.result && a.result.extras || []).length, msg: (a.result && a.result.msg) || '' } : { err: a.err };
      const b = await call('reviewContribution', { action: 'list' });
      out.review = b.ok ? { ok: !!(b.result && b.result.ok), msg: (b.result && b.result.msg) || '', count: (b.result && b.result.list || []).length } : { err: b.err };
      const c = await call('listContent', { action: 'whoami' });
      out.whoami = c.ok ? { ok: !!(c.result && c.result.ok), openid: (c.result && c.result.openid) || '' } : { err: c.err };
      return out;
    });

    if (r.list && r.list.ok) ok('listContent 调用成功（patches=' + r.list.patches + ', extras=' + r.list.extras + '）');
    else bad('listContent 失败：' + JSON.stringify(r.list));

    if (r.review && r.review.ok) ok('reviewContribution 调用成功（待审核 ' + r.review.count + ' 条）—— 白名单鉴权通过');
    else bad('reviewContribution 失败：' + (r.review && (r.review.err || r.review.msg)));

    if (r.whoami && r.whoami.ok) {
      const oid = r.whoami.openid || '(空)';
      ok('whoami 返回 openid：' + oid);
    } else bad('whoami 失败：' + JSON.stringify(r.whoami));

    // ---------- 汇总 ----------
    say('\n════════════════════════════════════');
    say('  端侧验证通过 ' + pass + ' 项，失败 ' + fail + ' 项');
    say('════════════════════════════════════');

    // 清理：清掉测试期间的解锁态和本地缓存，别影响日常使用
    try { await mini.callWxMethod('clearStorageSync'); say('  ✓ 已清理本地存储'); } catch (e) {}

    try { await mini.disconnect(); } catch (e) {}
    process.exit(fail === 0 ? 0 : 1);
  } catch (e) {
    say('\n✗ 执行异常：' + ((e && e.message) || e));
    try { await mini.disconnect(); } catch (x) {}
    process.exit(3);
  }
})();
