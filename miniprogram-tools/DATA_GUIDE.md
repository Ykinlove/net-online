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

17 项检查全绿再提交：源产物一致、源格式体检、语法检查、宽评测(690)、排序评测(56)、模板评测(29)、收藏分享(31)、基础清单(107)、页面冒烟(19)、热更新覆盖层(16)、投稿页数据链路(11)、云端新增合并(14)、条目数一致、云函数/投稿结构、重复 id 检查、入口路径/集合容错、部署结构、体积上限。

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
| `ci.py` | 一键回归 18 项 |
| `check_src_style.py` | 源排版体检 |
| `normalize_src.py` | 长 kw 数组折行 |
| `normalize_tpl.py` | tplbook 字段拆行 |
| `compare_data.js` | 源与产物逐条对比（按 id 深比） |
| `verify_pipeline.py` | 源与产物字节级比对 |
| `sync_kw.js` | 诊断：源与产物的 kw 差异 |
| `patch_kw.js` | 批量补 kw（只改源） |
| `add_tpl_kw.js` | 补模板 kw（只改源） |
| `fix_orphan_devs.js` | 孤儿条目补设备分类（只改源） |

---

## 云端内容热更新（不发版改内容）

### 解决什么

小程序发版要走微信审核。某条命令的厂商写法变了、某个易错点 tip 要修正——
如果只能等发版，用户要隔几天才能看到。热更新让作者改完**立刻**生效，用户下次打开就更新。

### 架构

```
本地打包数据（data-src 构建产物，真源）
        │ 运行时叠加
        ▼
云端 content_patch 集合（只存「覆盖记录」，不是全量）
        ▲
        │ 作者发布（小程序内管理页，直连数据库）
        │
    content_patch：{ _id, kind, targetId, patch:{name?,kw?,cmds?,tip?,note?}, updatedAt, remark? }
```

- **数据真源仍是本地包**。云端只存「某条条目要改哪几个字段」，运行时把覆盖记录叠加到
  本地条目的副本上，不污染包内常量，断网也能用本地缓存。
- **优先走云函数**：作者发布 / 用户投稿 / 统一拉取都由云函数处理，带 openid 白名单鉴权；
  **未部署云函数时自动降级为直连数据库**（旧行为），不会让功能不可用。
- **两类云端数据**：
  - `content_patch`：覆盖已有条目的 name/kw/cmds/tip/note 等（只改字段，不增删条目）。
  - `extra_items`：社区投稿审核通过后、本地包还没有的**新条目**（新增场景）。

### 三个角色

| 文件 | 作用 |
|---|---|
| `miniprogram/utils/hotfix.js` | 消费端：拉取（优先云函数 `listContent`）/ 缓存 / 覆盖层 / 已批准新增合并 / 失效索引 / 发布（优先云函数 `publishContent`） |
| `miniprogram/utils/contrib.js` | 客户端投稿封装：`submit` / `listPending` / `approve` / `reject`（审核类必须走云函数） |
| `miniprogram/subpkg-tool/utils/cmdbook.js` | 在 `buildIndex`/`tplIndex` 里叠加 `content_patch` 覆盖层并合并 `extra_items` 已批准新增，以 `hotfix.version()` 失效缓存 |
| `miniprogram/subpkg-tool/pages/admin/admin` | 作者工作台：编辑发布（口令保护）+ 待审核（审核投稿） |
| `miniprogram/subpkg-tool/pages/contribute/contribute` | 用户投稿公开页（新增 / 修改命令百科或模板） |
| `miniprogram/app.js` | `onLaunch` 里 `hotfix.refresh()` 后台静默拉取（覆盖层 + 新增） |
| `cloudfunctions/{publishContent,submitContribution,listContent,reviewContribution}` | 云端逻辑：发布 / 投稿 / 统一拉取 / 审核，带 openid 白名单鉴权 |

### 数据流

1. 作者进「我的 → 内容管理（作者）」，输入口令（默认 `net-admin-2026`，见 `admin.js` 的 `ADMIN_PASS`）
2. 按 id / 关键词定位一条命令百科或模板，改字段 → 「发布更新」
3. `hotfix.publishPatch` 优先调 `publishContent` 云函数把改动（只传被改的字段）写入 `content_patch` 集合（未部署云函数则直连数据库），并**立即合并到本地内存**，作者当场就能在搜索/详情看到
4. 用户端拉取增量，合并进内存 + 本地缓存：
   - **冷启动**：`app.js` 的 `onLaunch` 调 `hotfix.refresh()` 后台拉取
   - **运行中**：进「搜索页」或「浏览页」时各自调 `syncCloud()` 静默补一次
     （小程序长时间运行不重启时，只有 onLaunch 那一次是远远不够的）
5. `cmdbook` 的索引因 `hotfix.version()` 变化而失效重建，搜索 / 列表 / 详情 / 分类**全都反映最新内容**

### 首次部署（一次性）

1. 云开发控制台 → 数据库 → 新建集合 `content_patch`
2. 集合权限设为 **「所有用户可读，仅创建者可写」**（普通用户要读补丁做热更新；只有发布者能写）
3. 用发布账号打开小程序，走一遍上面的发布流程验证

### 注意事项

- **作者发布走云函数鉴权**（`publishContent` 校验 openid 是否在 `ADMIN_OPENIDS` 白名单）。
  未在云函数控制台配置白名单时，发布会失败并降级为旧口令 + 直连数据库方案，需尽快配置。
- 发布用 `updatedAt` 做增量拉取；同一条目的多次发布，云端按 `kind + targetId` 唯一更新（后者覆盖前者）。
- 改了本地包数据（`data-src`）后照常 `build_data.py build`；热更新覆盖层只在「不重新发版」的场景用。
  两者不冲突：包内数据是基础真源，云端补丁是临时修正层。
- `remark` 是发布备注（记录元数据），与条目自身的 `note`（模板说明）字段不同，别混淆。

### 评测

- `node miniprogram-tools/eval_hotfix.js`：覆盖层合并、搜索反映、不污染原始数据、ingest 逻辑，16 项。
- `node miniprogram-tools/eval_admin.js`：投稿页「定位 → 灌字段 → 增量 diff」全链路，含模板修复，11 项。
- `node miniprogram-tools/eval_extras.js`：`extra_items` 合并进索引 / 搜索 / 分类 / 详情，14 项。

---

## 云函数方案（作者鉴权 + 统一拉取）

### 为什么上云函数

旧方案「硬编码口令 + 端侧直连数据库」有两个硬伤：

1. **口令是弱保护**：任何拿到口令的人都能写 `content_patch`。
2. **端侧要持有数据库写权限**：`content_patch` 必须设成「仅创建者可写」，作者账号的 openid 写自己的记录——但换设备或换号就失效。

云函数把「发布 / 投稿 / 拉取 / 审核」收口到服务端，按 **openid 白名单** 鉴权，端侧拿不到任何写权限、也不存口令。

### 四个云函数

| 云函数 | 入参 | 作用 | 鉴权 |
|---|---|---|---|
| `publishContent` | `{ kind, targetId, fields, remark }` | 作者发布覆盖记录（upsert `content_patch`） | openid ∈ 白名单 |
| `submitContribution` | `{ kind, type, targetId, fields }` | 用户投稿（insert `contributions`，status=pending） | 无（任何登录用户） |
| `listContent` | `{ since, extraSince }` | 统一拉取覆盖层 + 已批准新增（增量） | 无（公开只读） |
| `reviewContribution` | `{ action, id, fields?, reviewNote? }` | 作者列出 / 通过 / 驳回投稿 | openid ∈ 白名单 |

### 端侧调用与降级

- **作者发布**：`hotfix.publishPatch` 先调 `publishContent`；云函数不可用（未部署 / 鉴权失败）时降级为**直连数据库**（旧行为），保证不阻塞。
- **统一拉取**：`hotfix.refresh` 先调 `listContent`；失败降级为直连 `content_patch` + `extra_items`。
- **投稿提交**：`contrib.submit` 先调 `submitContribution`；失败降级为端侧直连 `contributions`（集合「所有用户可读、仅创建者可写」）。
- **审核类（list/approve/reject）**：**必须走云函数**。未部署时 `contrib` 会提示「请先部署 reviewContribution 云函数」，无降级。

---

## 社区投稿（用户参与，不进内容管理）

### 解决什么

让每个用户都能贡献命令百科 / 配置模板，**提交先由作者审核**，通过才生效——
既调动社区参与感，又不让未验证内容污染库。投稿页是一个**独立的公开页**，
不集成进作者管理页（作者管理页只做「编辑发布 + 待审核」）。

### 入口位置（2026-10 调整）

两个入口统一收口在 **「我的 → 设置 → 关于 → 制作人」** 页面里，菜单文案只有
「内容管理」和「贡献内容」，不带「（作者）/（投稿）」后缀：

```
我的 → 设置 → 关于 → 制作人
                        ├── 内容管理   → /subpkg-tool/pages/admin/admin
                        └── 贡献内容   → /subpkg-tool/pages/contribute/contribute
```

「我的」页不再直接暴露这两个入口（避免普通用户误触进入管理区）。

### 数据流

```
用户（任何人）                      作者（白名单）                  云端
─────────────                      ──────────────                 ──────
贡献内容页
  └ 新增 / 修改条目
       │ submitContribution
       ▼
  contributions(status=pending) ───────────────► 管理页「待审核」tab
                                                ├ 通过 → 修改类写 content_patch
                                                │          新增类写 extra_items
                                                │          contributions.status=approved
                                                └ 驳回 → contributions.status=rejected
```

### 投稿两种类型

- **修改已有（edit）**：用户在投稿页按 id / 关键词定位条目，改字段后提交；作者通过时把字段写进 `content_patch`（覆盖记录）。
- **新增条目（add）**：用户填一条完整新条目（含 id）；作者通过时整条写进 `extra_items`（已批准新增），运行时合并进索引。

### 已批准新增如何生效

`extra_items` 是「本地包没有的新条目」。运行时 `hotfix.refresh` 拉到后 `ingestExtras` 进内存，
`cmdbook.buildIndex` / `tplIndex` 在构造索引时把 `extra_items` 追加进去（本地已有同名 id 时本地优先），
于是搜索 / 列表 / 详情 / 分类**自动包含这些新条目**。

---

## 云函数部署（一次性）

> 📖 **完整图文步骤见 [DEPLOY_CLOUD.md](DEPLOY_CLOUD.md)** —— 含项目结构说明、
> 查 openid 的方法、环境变量配置、验证清单和常见报错对照表。

### 1. 建集合

云开发控制台 → 数据库 → 新建集合，权限：

| 集合 | 权限 |
|---|---|
| `content_patch` | 所有用户可读，仅创建者可写 |
| `extra_items` | 所有用户可读，仅管理端可写（客户端不直接写，只经云函数） |
| `contributions` | 所有用户可读，仅创建者可写 |

> `extra_items` 客户端不直接写，但集合权限仍建议设为「仅管理端可写」以防越权；云函数运行在
> 管理端环境，不受端侧权限限制，可读写全部集合。

> **不用手动建表也行**：写集合的云函数（`submitContribution` / `publishContent` /
> `reviewContribution`）在首次调用时会自动 `createCollection`，报「集合不存在」已被吞掉；
> 读集合的 `listContent` 在集合缺失时返回空数组，不影响本地内容。
> 手动建表只是让第一次访问更快，不是必需步骤。

### 2. 上传并部署四个云函数

用微信开发者工具：右键 `cloudfunctions/` 下的四个目录 → 「上传并部署：云端安装依赖」。
每个目录已带 `package.json`（`wx-server-sdk`）。

### 3. 配置作者白名单（关键）

在 `publishContent` 与 `reviewContribution` 两个云函数的**环境变量**里加：

```
ADMIN_OPENIDS = oxxxxxx1,oxxxxxxx2
```

取值是作者微信的 openid（可在云函数日志 / `cloud.getWXContext().OPENID` 拿到自己的）。
**未配置则任何人无法发布 / 审核**，此时作者发布会降级为旧方案，请尽快配置。

### 4. 验证

- 用作者号进「我的 → 设置 → 关于 → 制作人 → 贡献内容」发一条投稿
  → 再进「制作人 → 内容管理 → 待审核」看到它 → 通过 → 普通用户搜索能命中该新增 / 修正。
- 作者进「内容管理 → 编辑发布」改一条条目 → 发布成功 → 搜索立即反映。

### 常见报错对照

| 报错 | 原因 | 处理 |
|---|---|---|
| `errCode -502005 / Db or Table not exist: contributions` | 云端没建 `contributions` 集合 | 重新部署 `reviewContribution`（新版会自动建表）；或手动建集合 |
| `无审核权限（请配置 ADMIN_OPENIDS）` | 云函数没配白名单 | 在 `reviewContribution` 环境变量加 `ADMIN_OPENIDS` |
| `无发布权限（请配置 ADMIN_OPENIDS）` | 同上 | 在 `publishContent` 环境变量加 `ADMIN_OPENIDS` |
| `无法读取待审核列表：云函数未部署…` | 云函数没上传或网络失败 | 上传部署 `reviewContribution` 云函数 |

> 端侧所有读集合的路径都加了 try/catch：集合缺失时返回友好中文提示，
> 不会再把 `database collection not exists` 的原始 errMsg 抛到页面上。

---

## 相关脚本速查（续）

| 脚本 | 作用 |
|---|---|
| `eval_admin.js` | 投稿页数据链路校验（含模板结构修复） |
| `eval_extras.js` | extra_items 合并到索引 / 搜索 / 分类 / 详情 校验 |
| `scan_dup_ids.js` | 扫描 data-src 真源里的重复 id（有重复返回退出码 1，CI 门禁） |
| `analyze_dup.js` | 重复 id 详细分析（内容是否真的重复） |
| `rename_dup_ids.js` | 按「保留较早批次原 id、较晚批次改名」执行去重 |
| `deploy_cloud.sh` | 一键部署 4 个云函数 + 同步 `ADMIN_OPENIDS` 环境变量 |
| `verify_cloud.sh` | 云端全量自检（函数/环境变量/集合权限/鉴权/闭环，14 项） |
| `verify_miniprogram.js` | 端侧自动化自检（入口/口令/待审核/云函数调用，22 项） |
| `verify_contrib_flow.js` | 投稿闭环自检（发→审→生效→搜索命中→自动清理，24 项） |
| `upload.sh` / `upload.bat` | 一键上传代码到微信后台（绕过 GUI 上传弹窗，见下节） |

---

## 代码上传（发布）怎么走

**推荐用脚本，不点 GUI 的「上传」按钮。**

```bash
bash miniprogram-tools/upload.sh              # 自动用上一版 +1
bash miniprogram-tools/upload.sh 1.0.2 "改了什么"
```

Windows 双击 `miniprogram-tools/upload.bat` 同样可用（会 `pause`，方便看结果）。

### 为什么不点 GUI 的「上传」

GUI 的「上传」弹窗有两类坑，脚本（CLI 通道）都能绕开：

**坑 1：版本号为空时的纯前端拦截（静默无反应）**

```js
// app.asar 内开发者工具源码（上传弹窗组件）
_getUploadQuery() {
  if (!this.state.version) {            // ← 版本号为空
    this.versionInput.focus();
    this.setState({ versionError: true });
    return;                             // ← 直接返回，一次请求都不发
  }
  ...
}
```

版本号输入框初始值取自「线上版本号 / 草稿版本号」：

```js
version: x(latestVersion?.version, project.uploadInfo?.version, updateType)
// x() 在没有线上/草稿版本号时返回 ""  →  输入框是空的
```

**首次发布**（后台还没有任何版本）的小程序很容易踩到：点「上传」→ 版本号框是空的 → 被前端拦下 → **一个网络请求都不会发出**，开发者工具后端日志里连一条上传记录都没有，用户只看到「点了没反应」。

**坑 2：上传流程中的异常被兜底成「上传失败」**

GUI 弹窗 `onConfirm` 调 `getCommitResultInWeb`，任何异常都进 `_handleUploadError(e)`，
弹窗标题固定为 `上传失败`，内容取 `e.toString()`（含真实 errcode）。这是**兜底提示**，
不是某一种特定错误的专属文案——后端拒绝、账号权限、网络/COS 抖动、甚至 IDE 客户端偶发异常
都会显示成「上传失败」。

> 关键事实：脚本用的 `cli.bat upload` 与 GUI「上传」走的是**同一套后端**
> （同一个 `getCommitResultInWeb`）。已实测 CLI 上传 `1.0.0 / 1.0.1 / 1.0.2` 全部成功
> （后端日志 `progressSuccess`），说明**代码、AppID、账号、网络都没问题**。
> 所以 GUI 报「上传失败」基本是客户端侧拦截/抖动的体现，用脚本即可稳定发版。

**脚本现在直接调用官方 `cli.bat`**（不再用 node 直跑模式，后者在部分环境下会找不到
IDE 的 `.cli` 握手文件而报错）。Windows 也可双击 `upload.bat`。

> 如果你确实想修好 GUI 的上传，请把弹窗里那行**真实报错细节**（通常是形如
> `errcode: xxxxx` 或 `你不是该小程序的开发者` 之类的具体文案）贴出来——
> 那就是 `_handleUploadError` 里的 `e.toString()`，能直接定位根因。

### 包体积参考（2026-10-31 实测）

| 包 | 大小 | 限制 |
|---|---|---|
| main | 1.3 MB | 2 MB |
| /subpkg-tool/ | 1.5 MB | 2 MB（单分包） |
| /subpkg-mine/ | 41.2 KB | 2 MB（单分包） |
| **合计** | **2.8 MB** | 20 MB |

> 上传体积超限会被拦在客户端，错误码 `CODE_SIZE_EXCEED`；
> 单分包超限是 `DEV_COMPILE_SOURCE_MAX_LIMIT_SUBPKG`。


---

## 回归自检怎么跑

三个脚本互相独立，随时可复跑（开发者工具需保持开启且**服务端口已打开**）：

```bash
# 1) 静态门禁（不需要开发者工具，秒级）
python miniprogram-tools/ci.py              # 18 项

# 2) 云端自检（需 tcb 登录态）
bash miniprogram-tools/verify_cloud.sh      # 14 项

# 3) 端侧自动化（需开发者工具 + 服务端口 9420）
node miniprogram-tools/verify_miniprogram.js    # 22 项
node miniprogram-tools/verify_contrib_flow.js   # 24 项，跑完自动清探针数据
```

> `verify_contrib_flow.js` 会在真实环境提交一条 `__contrib_probe__` 投稿并审核通过，
> **脚本结束前会自动删除**云端 `extra_items` / `contributions` / `content_patch`
> 里的探针文档并清空端侧缓存，跑完环境保持干净。
>
> tcb CLI 定位方式：脚本会优先直接用 `node <全局 node_modules>/@cloudbase/cli/bin/tcb`
> （绕开 Windows 下 `npx.cmd` 的 spawn 限制），找不到再退回 `npx tcb`。

---

## 调试句柄

| 入口 | 说明 |
|---|---|
| `getApp().globalData.hotfix` | 热更新模块句柄（`hotfix.clear()` 可清空覆盖层缓存并让索引失效） |
| `hotfix.clear()` | 清空本地 `hotfix_patch_v1` 缓存（覆盖记录 + 已批准新增），并 bump version 触发索引重建 |
| `hotfix.version()` | 当前覆盖层版本号，变化即代表索引失效需重建 |


