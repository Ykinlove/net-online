// utils/config.js —— 解锁 / 广告 / 存档 相关配置

// 激励视频广告位 ID。
// 留空：锁照样显示，但点击只提示「解锁功能正在开发中」（当前状态）。
// 填上：点击锁会真的播放激励视频，看完即解锁。
// 获取方式：小程序后台 → 流量主 → 广告位管理 → 新建「激励式广告」。
// 注意：流量主需累计独立访客 ≥ 1000 才能开通（个人主体）。
const REWARDED_AD_UNIT = '';

// 前几个免费
const FREE_CHARS = 5;
const FREE_BGS = 2;

// 锁定总开关。
// true ：后段的形象/背景显示锁标，点击提示「解锁功能正在开发中」；
//        等 REWARDED_AD_UNIT 填上之后，同一个按钮自动变成看广告解锁。
// false：全部免费，界面上不出现任何锁。
const ENABLE_LOCKS = true;

// 自动存档最多保留几份
const ARCHIVE_KEEP = 5;

// 两次自动存档的最小间隔（毫秒），防止连续删几条时生成一堆快照
const ARCHIVE_GAP = 60 * 1000;

module.exports = { REWARDED_AD_UNIT, FREE_CHARS, FREE_BGS, ENABLE_LOCKS, ARCHIVE_KEEP, ARCHIVE_GAP };
