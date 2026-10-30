# 云函数部署指南（4 个云函数 + 环境变量）

> 面向：第一次部署 `publishContent` / `submitContribution` / `listContent` / `reviewContribution`
> 全程约 10 分钟。部署完成后「内容管理」和「贡献内容」两个页面才能真正跑通。

---

## ✅ 当前状态：已完成部署（2026-10-30）

四个云函数已上线，环境变量已配好，集合权限已设好。**你不需要再手动部署了**。

| 项 | 状态 |
|---|---|
| 四个云函数 | ✅ 全部 `Deployment completed`（Runtime: Nodejs20.19） |
| `ADMIN_OPENIDS` | ✅ 已配置在 `publishContent` + `reviewContribution` |
| 三个集合 | ✅ 已自动创建（`content_patch` / `extra_items` / `contributions`） |
| 集合权限 | ✅ 三个都是 `READONLY`（所有用户可读，仅创建者可写） |
| 端到端验证 | ✅ 写入 → `listContent` 拉取 → 数据正确返回 |

**已配置的作者白名单**（两个都是本人账号）：

```
__OPENID_A__   ← "Yang" / 正元智慧集团（资料完整，主账号）
__OPENID_B__   ← "Ykin" / 清华大学
```

> 改白名单：编辑 `cloudbaserc.json` 里的 `ADMIN_OPENIDS`，然后跑
> `bash miniprogram-tools/deploy_cloud.sh`。

### 以后改代码怎么重新部署

```bash
# 部署全部 4 个
bash miniprogram-tools/deploy_cloud.sh

# 只部署某一个
bash miniprogram-tools/deploy_cloud.sh listContent
```

脚本会自动：部署代码 → 同步 `ADMIN_OPENIDS` 环境变量。

> 需要先 `tcb login`（设备码扫码授权，一次就够，登录状态有效期约 30 天）。

---

## 0. 先看这里：项目结构（重要）

微信开发者工具要求 **小程序代码和云函数在同一个项目根目录下**，靠 `project.config.json`
里的两个字段指路：

```
net-online/                        ← 用开发者工具「打开这个目录」
├── project.config.json            ← 指路文件（miniprogramRoot + cloudfunctionRoot）
├── miniprogram/                   ← 小程序代码（app.js / app.json / pages / subpkg-*）
└── cloudfunctions/                ← 四个云函数
    ├── publishContent/
    ├── submitContribution/
    ├── listContent/
    └── reviewContribution/
```

`project.config.json` 里这两行是关键：

```json
"miniprogramRoot": "miniprogram/",
"cloudfunctionRoot": "cloudfunctions/",
```

> ⚠️ 如果你在开发者工具里打开的是 `net-online/miniprogram/` 这个子目录，
> 左侧文件树里**看不到云函数目录**（云函数在外面），也就无法右键上传部署。
> 正确做法是打开 **`net-online/`** 这一层。

确认环境 ID：`net-online-d7g1ig4c6f07a8abb`（写在 `miniprogram/app.js` 第 3 行）。

---

## 1. 打开项目

1. 打开**微信开发者工具**（需已登录，且该 AppID `wx88017afd93e90f27` 有开发者权限）。
2. 点「导入项目」→ 项目目录选 **`E:\Work buddy\命令\net-online`**（注意是 net-online 这一层，不是 miniprogram）。
3. AppID 选 `wx88017afd93e90f27`（会自动带出）。
4. 点「导入」。
5. 导入后左侧文件树应该同时看到 **`miniprogram`** 和 **`cloudfunctions`** 两个目录。

> 若之前已经导入过 `miniprogram/` 子目录：工具里「项目 → 关闭项目」，
> 重新导入 `net-online/` 这一层即可（设置会自动带过来）。

---

## 2. 部署 4 个云函数

> ⚠️ **当前已经部署完成了**，下面这节是给「以后重新部署」或「换环境」时用的参考。

**方式 0：一键脚本（推荐）**

```bash
bash miniprogram-tools/deploy_cloud.sh              # 全部 4 个
bash miniprogram-tools/deploy_cloud.sh listContent  # 只部署某一个
```

**方式 A：在开发者工具里操作：**

1. 左栏展开 `cloudfunctions` 目录。
2. **右键 `publishContent` → 「上传并部署：云端安装依赖」**。
   - 首次会弹窗问「是否安装依赖」→ 选**是**（它会去 npm 装 `wx-server-sdk`）。
   - 等待 1～3 分钟，右下角会提示上传成功。
3. 同样操作其余三个：`submitContribution`、`listContent`、`reviewContribution`。

**方式 B：在云开发控制台操作（备选）：**

1. 开发者工具顶部工具栏点「**云开发**」按钮打开控制台。
2. 左栏「云函数」→ 「新建」，按上表逐个创建。

**方式 C：命令行 tcb CLI（无需开发者工具）**

```bash
npm install -g @cloudbase/cli
tcb login --flow device        # 扫码授权，一次就够
tcb fn deploy listContent -e net-online-d7g1ig4c6f07a8abb \
    --dir cloudfunctions/listContent --runtime Nodejs20.19 --force
```

> 环境变量用云 API 设（注意 `Variables` 是**数组**格式，`Namespace` 填环境 ID）：

```bash
tcb api scf UpdateFunctionConfiguration --api-version 2018-04-16 --json \
  --body '{"Namespace":"net-online-d7g1ig4c6f07a8abb","FunctionName":"publishContent",
           "Environment":{"Variables":[{"Key":"ADMIN_OPENIDS","Value":"oXXXX"}]}}'
```

**四个云函数的区别：**

| 云函数 | 干什么 | 谁会调用 | 需不需要白名单 |
|---|---|---|---|
| `publishContent` | 作者发布内容修改（写 `content_patch`） | 内容管理页 | **要**（`ADMIN_OPENIDS`） |
| `submitContribution` | 用户投稿（写 `contributions`） | 贡献内容页 | 不要（任何人都能投） |
| `listContent` | 拉取云端覆盖内容 + 查自己 openid | 小程序启动时 | 不要 |
| `reviewContribution` | 作者审核投稿（通过/驳回） | 内容管理页「待审核」 | **要**（`ADMIN_OPENIDS`） |

> 四个 `package.json` 已声明 `wx-server-sdk: ~2.6.3`，选「云端安装依赖」即可，
> 不用本地先 npm install。

---

## 3. 配置环境变量 `ADMIN_OPENIDS`（关键一步）

### 3.1 先拿到自己的 openid

**方式 A（推荐，最快）**：在开发者工具里点「云开发」→ 左栏「云函数」→ 点 `listContent`
→ 顶部「**云端测试**」→ 参数填：

```json
{ "action": "whoami" }
```

点「执行」，返回结果里就有：

```json
{ "ok": true, "openid": "o6xxxxxxxxxxxxxxxxxx" }
```

**方式 B（备选）**：真机/模拟器里打开小程序 → 开发者工具右下角「Console」输入：

```js
wx.cloud.callFunction({name:'listContent',data:{action:'whoami'}}).then(r=>console.log(r.result))
```

### 3.2 配置环境变量

**方式 A（控制台，推荐）：**

1. 开发者工具点「云开发」→ 左栏「**云函数**」。
2. 点进 **`publishContent`** → 顶部切到「**函数配置**」页签。
3. 找到「**环境变量**」区域 → 点「添加」：
   - 变量名：`ADMIN_OPENIDS`
   - 变量值：把你刚才拿到的 openid 粘进去（多个用**英文逗号**分隔，如 `oAAA,oBBB`）
4. 点「**保存**」。
5. **对 `reviewContribution` 重复一遍**（两个函数都要配，只配一个会出现「能发布不能审核」）。

**方式 B（开发者工具右键）：**

右键 `publishContent` → 「设置 / 环境变量」→ 同样添加 `ADMIN_OPENIDS` → 保存。
再对 `reviewContribution` 重复。

### 3.3 验证配好了

在云端测试 `reviewContribution`，参数：

```json
{ "action": "list" }
```

- 返回 `{ "ok": true, "list": [] }` → ✅ 白名单配好了（空列表是正常的，还没投稿）
- 返回 `{ "ok": false, "msg": "无审核权限（请配置 ADMIN_OPENIDS）" }` → ❌ 白名单没生效，
  检查：变量名是否拼成 `ADMIN_OPENIDS`、值里有没有多余空格、**两个函数是否都配了**、
  是否点���「保存」并重新部署。

---

## 4. 验证完整链路

按顺序走一遍，每一步都有预期结果：

| 步骤 | 操作 | 预期 |
|---|---|---|
| 1 | 小程序启动 | 首页正常，`content_patch` 为空时内容与线上一致（不报错） |
| 2 | 「我的 → 设置 → 关于 → 制作人 → 贡献内容」 | 投稿页正常打开 |
| 3 | 填一条投稿提交 | 提示提交成功；数据库 `contributions` 里出现一条 `status=pending` |
| 4 | 「制作人 → 内容管理 → 待审核」 | 能看到刚才那条投稿 |
| 5 | 点「通过」 | 提示成功；`contributions.status=approved`；改的是百科则写进 `content_patch`，新增则写进 `extra_items` |
| 6 | 搜索被修改的条目 | 显示新内容（说明覆盖层生效） |

> 第 3 步若提示「投稿提交失败」→ 说明 `submitContribution` 没部署成功，
> 回第 2 步重新部署。**无需手动建集合**——云函数首次调用会自动创建。

---

## 5. 数据库集合说明

**不用手动建**。三个云函数在首次写入时会自动 `createCollection`：

| 集合 | 谁写 | 谁读 | 说明 |
|---|---|---|---|
| `content_patch` | `publishContent` / `reviewContribution` | 全部用户 | 内容修改覆盖记录 |
| `extra_items` | `reviewContribution` | 全部用户 | 审核通过的新增条目 |
| `contributions` | `submitContribution` | 全部用户 | 投稿记录 |

如果想手工建（可选，能让第一次访问更快），在云开发控制台 → 数据库 → 新建集合，
权限建议：

- `content_patch`：**所有用户可读，仅创建者可写**
- `extra_items`：**所有用户可读，仅管理端可写**（客户端不直接写，只经云函数）
- `contributions`：**所有用户可读，仅创建者可写**

> `extra_items` 虽然客户端不写，权限也建议收紧，防止有人绕过云函数直接写库。

---

## 6. 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 开发者工具里看不到 `cloudfunctions` 目录 | 打开的是 `miniprogram/` 子目录 | 重新导入 `net-online/` 这一层 |
| 右键没有「上传并部署」 | 项目类型识别错了 | 检查 `compileType: "miniprogram"` |
| `无发布权限（请配置 ADMIN_OPENIDS）` | 环境变量没配/没保存 | 见 3.2，两个函数都要配 |
| `无审核权限（请配置 ADMIN_OPENIDS）` | 同上但只在审核路径 | 检查 `reviewContribution` 是否配了 |
| `投稿提交失败：…` | `submitContribution` 没部署 | 重新部署该云函数 |
| `-502005 Db or Table not exist` | 集合缺失 | 新版云函数会自动建表，重新部署即可 |
| 云函数报 `Cannot find module 'wx-server-sdk'` | 选成了「上传并部署：不安装依赖」 | 改成「上传并部署：**云端安装依赖**」 |
| 改了代码但线上没变 | 改的是本地文件 | 改完必须重新「上传并部署」 |
| 小程序启动就白屏 | 基础库太低 / 未开通云开发 | 开发者工具右上角切基础库 ≥ 2.2.3；确认云开发环境已开通 |

---

## 7. 一句话流程

> 打开 `net-online/` → 右键 4 个云函数各「上传并部署：云端安装依赖」
> → 查自己 openid（`listContent` 云端测试 `{"action":"whoami"}`）
> → 在 `publishContent` 和 `reviewContribution` 各加环境变量 `ADMIN_OPENIDS`
> → 进小程序走一遍「投稿 → 审核 → 生效」
