/* utils/motion.js —— v6 微交互公共逻辑
   只放与触点/数值有关的辅助函数，视觉全部在 app.wxss 的 v6 层。
   页面各自保留自己的 data 字段，这里不持有状态。

   性能约定（2026-11-09）：所有高频交互一律走「路径式 setData」——
   整条数组 / 整个对象覆盖会把无关字段一起送过逻辑层→渲染层桥，
   是小程序里最典型的掉帧来源。数值类状态（抽屉位移、上一帧数字）
   存在页面实例上，不进 data，只有真正要渲染的字段才 setData。 */

/* 波纹：rect 由页面在 onReady 里缓存，避免每次触摸都做一次节点查询 */
function cacheRects(page, selector, key) {
  try {
    wx.createSelectorQuery().in(page).selectAll(selector).boundingClientRect((rects) => {
      page[key || '_rects'] = rects || [];
    }).exec();
  } catch (e) {
    page[key || '_rects'] = [];
  }
}

/* 在触点位置生成一枚新涟漪。
   改版前：每次触摸把整条 ripples 数组 concat 一遍再整体 setData，
   640ms 后 filter 一遍再整体 setData；home.wxml 还用 4 个 wx:for
   各扫一遍全数组做 i === N 过滤 —— 一次点击 = 4 次数组遍历 + 2 次整数组传输。
   现在 ripples 是「按 data-r 槽位」的固定数组，只更新 ripples[idx] 一个槽，
   wxml 直接读 ripples[N]，零遍历。
   cls 在 0/1 间交替，让复用节点的 animation-name 变化、动画得以重播。 */
function ripple(page, e) {
  const idx = Number((e.currentTarget && e.currentTarget.dataset.r) || 0);
  const rect = (page._rects || [])[idx];
  const t = e.touches && e.touches[0];
  if (!rect || !t) return;
  const x = Math.max(0, Math.min(rect.width, t.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, t.clientY - rect.top));
  page._rid = (page._rid || 0) + 1;
  const id = page._rid;
  const key = 'ripples[' + idx + ']';
  const o = {};
  o[key] = { id: id, x: x, y: y, cls: id % 2 };
  page.setData(o);
  setTimeout(() => {
    /* 只把 id 清零让 wx:if 隐藏节点，x/y/cls 留着，不必再传整个对象 */
    const q = {};
    q[key + '.id'] = 0;
    page.setData(q);
  }, 640);
}

/* 数字滚动：三次方缓出，32ms 一帧，最多 700ms，不常驻定时器。
   缓出曲线末端经常连续好几帧算出同一个整数，重复 setData 纯属浪费：
   只在数值真的变化时推一帧，视觉表现完全不变。 */
function roll(page, key, from, to, ms) {
  const a = Number(from) || 0;
  const b = Number(to) || 0;
  if (a === b) {
    if (page.data[key] !== b) { const o = {}; o[key] = b; page.setData(o); }
    return;
  }
  const dur = Math.min(ms || 420, 700);
  const start = Date.now();
  let last = a;
  const tick = () => {
    const p = Math.min(1, (Date.now() - start) / dur);
    const v = Math.round(a + (b - a) * (1 - Math.pow(1 - p, 3)));
    if (v !== last) {
      last = v;
      const o = {}; o[key] = v; page.setData(o);
    }
    if (p < 1) setTimeout(tick, 32);
  };
  tick();
}

/* 抽屉跟手：只在按下把手区时触发，超过 90px 才关闭。
   drawerY 只用于 drawerEnd 判阈值，属于纯数值状态 —— 存在页面实例上，
   不再进 data；每次 touchmove 只传一个 drawerStyle 字符串。
   16ms 节流挡住高刷机型一帧内的多次 touchmove。 */
function drawerStart(page, e) {
  page._dy0 = (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
  page._drawerY = 0;
  page._drawerShown = 0;
  page._drawerAt = 0;
  page.setData({ drawerDragging: true, drawerStyle: '' });
}
function drawerMove(page, e) {
  if (page._dy0 == null) return;
  const y = (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
  const d = Math.max(0, y - page._dy0);
  /* 判阈值用的是真实位移，不能被节流丢掉（快速甩动时最后一帧常恰好被吃掉） */
  page._drawerY = d;
  if (d === page._drawerShown) return;
  const now = Date.now();
  if (now - (page._drawerAt || 0) < 16) return;
  page._drawerAt = now;
  page._drawerShown = d;
  page.setData({ drawerStyle: 'transform:translateY(' + d + 'px)' });
}
function drawerEnd(page, close) {
  const y = page._drawerY || 0;
  page._dy0 = null;
  page._drawerY = 0;
  page._drawerShown = 0;
  if (y > 90 && typeof close === 'function') {
    page.setData({ drawerDragging: false, drawerStyle: '' });
    close();
    return;
  }
  page.setData({ drawerDragging: false, drawerStyle: '' });
}

module.exports = { cacheRects, ripple, roll, drawerStart, drawerMove, drawerEnd };
