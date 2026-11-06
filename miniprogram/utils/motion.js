/* utils/motion.js —— v6 微交互公共逻辑
   只放与触点/数值有关的辅助函数，视觉全部在 app.wxss 的 v6 层。
   页面各自保留自己的 data 字段，这里不持有状态。 */

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

/* 在触点位置生成一枚新涟漪；用数组而不是布尔值，保证每次都是新节点、动画会重播 */
function ripple(page, e) {
  const idx = Number((e.currentTarget && e.currentTarget.dataset.r) || 0);
  const rect = (page._rects || [])[idx];
  const t = e.touches && e.touches[0];
  if (!rect || !t) return;
  const x = Math.max(0, Math.min(rect.width, t.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, t.clientY - rect.top));
  page._rid = (page._rid || 0) + 1;
  const id = page._rid;
  const list = (page.data.ripples || []).concat([{ id: id, i: idx, x: x, y: y }]);
  page.setData({ ripples: list });
  setTimeout(() => {
    const rest = (page.data.ripples || []).filter((r) => r.id !== id);
    page.setData({ ripples: rest });
  }, 640);
}

/* 数字滚动：三次方缓出，32ms 一帧，最多 700ms，不常驻定时器 */
function roll(page, key, from, to, ms) {
  const a = Number(from) || 0;
  const b = Number(to) || 0;
  if (a === b) { const o = {}; o[key] = b; page.setData(o); return; }
  const dur = Math.min(ms || 420, 700);
  const start = Date.now();
  const tick = () => {
    const p = Math.min(1, (Date.now() - start) / dur);
    const v = Math.round(a + (b - a) * (1 - Math.pow(1 - p, 3)));
    const o = {}; o[key] = v; page.setData(o);
    if (p < 1) setTimeout(tick, 32);
  };
  tick();
}

/* 抽屉跟手：只在按下把手区时触发，超过 90px 才关闭 */
function drawerStart(page, e) {
  page._dy0 = (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
  page.setData({ drawerDragging: true, drawerStyle: '' });
}
function drawerMove(page, e) {
  if (page._dy0 == null) return;
  const y = (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
  const d = Math.max(0, y - page._dy0);
  page.setData({ drawerY: d, drawerStyle: 'transform:translateY(' + d + 'px)' });
}
function drawerEnd(page, close) {
  const y = page.data.drawerY || 0;
  page._dy0 = null;
  if (y > 90 && typeof close === 'function') {
    page.setData({ drawerY: 0, drawerDragging: false, drawerStyle: '' });
    close();
    return;
  }
  page.setData({ drawerY: 0, drawerDragging: false, drawerStyle: '' });
}

module.exports = { cacheRects, ripple, roll, drawerStart, drawerMove, drawerEnd };
