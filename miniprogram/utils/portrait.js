/* 形象资源的路径映射。
 *
 * 分包约束：主包不能引用分包资源，分包可以引用主包资源。
 * 因此全身立绘（360×360，10 张共 400KB）放在 subpkg-mine 里 —— 它只在
 * 「我的形象」选择页渲染；主包只留 128×128 头像（portrait/），两页都在用。
 * 背景图留在主包：主包「我的」页要渲染用户自选的背景。
 *
 * 存档里 charImage 存的是【角色 ID】（如 character_03），不是路径：
 *   - 早期版本存的是旧路径 '/images/preset/char/xxx.png'，仍要认；
 *   - 存 ID 的好处是路径随分包布局变化而变，存档不用跟着改。
 * 展示头像时统一由这里拼路径，各页面不自己拼。
 */

/* 主包头像（头肩特写）—— 主包与分包都能引用 */
const PORTRAIT_PREFIX = '/images/portrait/';
/* 分包全身立绘 —— 只有 subpkg-mine 内的页面能渲染这个路径 */
const CHAR_PREFIX = '/subpkg-mine/images/preset/char/';
/* 背景图留在主包：主包「我的」页要渲染用户自选的背景 */
const BG_PREFIX = '/images/preset/bg/';

/* 取文件名部分：兼容「完整路径」和「纯 ID」两种输入 */
function idOf(charPath) {
  var s = String(charPath || '');
  if (!s) return '';
  var cut = s.lastIndexOf('/');
  s = (cut >= 0 ? s.slice(cut + 1) : s);
  return s.replace(/\.(png|jpg|jpeg|webp)$/i, '');
}

/* 角色 ID / 任意路径 -> 主包头像路径 */
function fromId(charId) {
  var id = idOf(charId);
  return PORTRAIT_PREFIX + (id || 'character_01') + '.png';
}

/* 角色 ID / 任意路径 -> 头像路径（与 fromId 等价，保持旧调用点不变） */
function fromChar(charPath) {
  return fromId(charPath);
}

/* 角色 ID -> 分包全身立绘路径。只有 subpkg-mine 内的页面能渲染这个路径。 */
function charPath(charId) {
  var id = idOf(charId);
  return CHAR_PREFIX + (id || 'character_01') + '.png';
}

/* 背景 ID -> 背景图路径 */
function bgPath(bgId) {
  var id = idOf(bgId);
  return BG_PREFIX + (id || 'background_01') + '.jpg';
}

module.exports = {
  fromChar: fromChar,
  fromId: fromId,
  charPath: charPath,
  bgPath: bgPath,
  idOf: idOf,
  PORTRAIT_PREFIX: PORTRAIT_PREFIX,
  CHAR_PREFIX: CHAR_PREFIX,
  BG_PREFIX: BG_PREFIX
};
