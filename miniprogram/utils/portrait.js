/* 头像（头肩特写）与全身立绘的路径映射。
 *
 * 档案里 charImage 一直存的是 /images/preset/char/*.png 全身立绘，
 * 角色选择页的场景预览要靠它，所以存档字段不动。
 * 只在「展示头像」的地方把路径换成 /images/portrait/*.png。
 * 传进来的若是别的路径（旧档、自定义图），原样返回，不会 404。
 */
const CHAR_PREFIX = '/images/preset/char/';
const PORTRAIT_PREFIX = '/images/portrait/';

function fromChar(charPath) {
  var s = String(charPath || '');
  if (s.indexOf(CHAR_PREFIX) !== 0) return s;
  return PORTRAIT_PREFIX + s.slice(CHAR_PREFIX.length);
}

function fromId(charId) {
  return PORTRAIT_PREFIX + String(charId || '').replace(/\.png$/, '') + '.png';
}

module.exports = { fromChar: fromChar, fromId: fromId, CHAR_PREFIX: CHAR_PREFIX, PORTRAIT_PREFIX: PORTRAIT_PREFIX };
