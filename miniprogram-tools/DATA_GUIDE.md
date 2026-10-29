# 命令百科数据维护指南

## 一句话

**`miniprogram-tools/data-src/` 是唯一真源。改数据只改那里，产物由脚本生成，永远不要手改 `miniprogram/` 里的数据文件。**

---

## 为什么要这样

早期架构是「压缩产物 + 首次备份到 data-src」，方向是 **产物 → 源**。
后果是源永远慢半拍：改数据要同时改两处（源 + 压缩产物），漏一处就漂移。

实测在本项目发现 **4 个文件已经漂移**：
- `cmdbook-batch50.js` / `cmdbook-batch52.js` / `cmdbook-net.js` —— 产物侧有源侧没有的新 kw
- `cmdbook-practice.js` —— 产物被脚本改出了空格，与源不一致

现在改成 **源 → 产物** 单向生成，漂移从根上消失。

---

## 目录职责

| 位置 | 角色 | 谁能改 |
|---|---|---|
| `miniprogram-tools/data-src/*.js` | 唯一真源，可读、带注释 | ✅ 人工 / 脚本 |
| `miniprogram/utils/*.js`（数据文件） | 构建产物，压缩版 | ❌ 禁止手改 |
| `miniprogram/subpkg-tool/utils/*.js`（数据文件） | 构建产物，压缩版 | ❌ 禁止手改 |
| `miniprogram/utils/` 下的逻辑文件 | 手写代码（store / seed / categories 等） | ✅ 人工 |

判定「逻辑文件还是数据文件」：`data-manifest.json` 里列的是数据文件，其余是逻辑文件。

---

## 常用命令

```bash
# 看当前状态（一致性 + 体积）
python miniprogram-tools/build_data.py status

# 改完源 → 生成产物
python miniprogram-tools/build_data.py build

# 校验产物与源一致（CI 门禁，不一致返回非 0）
python miniprogram-tools/build_data.py check

# 救急：源被误改，用产物回灌源
python miniprogram-tools/build_data.py restore
```

## 加一个词到某条记录

```bash
# 只改源，改完自动重建产物
node miniprogram-tools/patch_kw.js
```

批量改的话，直接编辑 `data-src/<文件>.js` 里那条记录的 `kw` 数组，然后 `python miniprogram-tools/build_data.py build`。

## 提交前必跑

```bash
python miniprogram-tools/ci.py
```

11 项检查全绿再提交：源产物一致、源格式体检、语法检查、宽评测(690)、排序评测(56)、模板评测(29)、收藏分享(31)、基础清单(107)、页面冒烟(16)、条目数一致、体积上限。

快跑版（跳过宽评测，约省 5 秒）：`python miniprogram-tools/ci.py --fast`

---

## 新增一个数据文件

1. 在 `data-src/` 建文件，导出形如 `module.exports = { XXX_EXTRA: [...] }`
2. 在 `data-manifest.json` 的 `files` 里加一条，值填 `"main"` 或 `"tool"`
   - `main` → `miniprogram/utils/`
   - `tool` → `miniprogram/subpkg-tool/utils/`
3. 跑 `python miniprogram-tools/build_data.py build`
4. 在 `subpkg-tool/utils/cmdbook.js` 里 require 它并合并进库

### 为什么 batch66~100 留在主包

分包 `subpkg-tool` 已经 1585KB / 2048KB，只剩 463KB 余量。
`cmdbook-batch66~100` 共 468KB，放进分包会超限，所以留在主包 `utils/`。

分包 require 主包公共资源是**合法的**（反过来不行：主包不能引用分包）。

---

## 排版约定

源是给人读的，保持可读：

- 每个字段一行：`id:` / `name:` / `kw:` / `cat:` / `devs:` / `cmds:` / `note:`
- `kw` 数组超过 100 字符要折行（`python miniprogram-tools/normalize_src.py`）
- `id` 和 `kw` 不要挤在一行（`python miniprogram-tools/normalize_tpl.py`）
- 不用制表符

跑 `python miniprogram-tools/check_src_style.py` 检查。

---

## 排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `check` 报某文件不一致 | 改了源没 build | 跑 `build` |
| 改了源但搜索没变化 | 改了不在库里的文件 | 确认 `cmdbook.js` 里 require 了它 |
| 产物被手改过 | 违反约定 | `build` 用源覆盖 |
| 源被误改 | 误操作 | `restore` 回灌，再 build |
| 某条 id 搜不到 | 可能被同义词抢走 Top1 | `node miniprogram-tools/why.js <关键词>` |

---

## 相关脚本速查

| 脚本 | 作用 |
|---|---|
| `build_data.py` | 构建 / 校验 / 回灌（核心） |
| `ci.py` | 一键回归 11 项 |
| `check_src_style.py` | 源排版体检 |
| `normalize_src.py` | 长 kw 数组折行 |
| `normalize_tpl.py` | tplbook 字段拆行 |
| `compare_data.js` | 源与产物逐条对比（按 id 深比） |
| `verify_pipeline.py` | 源与产物字节级比对 |
| `sync_kw.js` | 诊断：源与产物的 kw 差异 |
| `patch_kw.js` | 批量补 kw（只改源） |
| `add_tpl_kw.js` | 补模板 kw（只改源） |
| `fix_orphan_devs.js` | 孤儿条目补设备分类（只改源） |
