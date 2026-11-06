#!/usr/bin/env bash
# 一键部署 5 个云函数 + 同步环境变量
#
# 用法：
#   bash miniprogram-tools/deploy_cloud.sh              # 部署全部 5 个
#   bash miniprogram-tools/deploy_cloud.sh listContent  # 只部署某一个
#
# 前置：已执行过 `tcb login`（设备码扫码即可）
# 环境 ID / 白名单写在 cloudbaserc.json 里，本脚本只负责推上去。

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_ID="net-online-d7g1ig4c6f07a8abb"
RUNTIME="Nodejs20.19"

# tcb CLI 全局安装在 npm 全局目录，Windows 下不一定在 PATH 里
if ! command -v tcb >/dev/null 2>&1; then
  NPM_BIN="$(npm config get prefix 2>/dev/null)/bin"
  [ -d "$NPM_BIN" ] && export PATH="$PATH:$NPM_BIN"
  NPM_BIN2="$NPM_BIN/tcb.cmd" && [ -f "$NPM_BIN2" ] && export PATH="$PATH:$NPM_BIN"
fi

if ! command -v tcb >/dev/null 2>&1; then
  echo "✗ 找不到 tcb 命令，请先执行：npm install -g @cloudbase/cli" >&2
  exit 1
fi

ALL_FUNCS="publishContent submitContribution listContent reviewContribution getCmdLib"

TARGETS="${*:-}"
[ -z "$TARGETS" ] && TARGETS="$ALL_FUNCS"

echo "环境：$ENV_ID"
echo "目标：$TARGETS"
echo ""

for fn in $TARGETS; do
  DIR="cloudfunctions/$fn"
  if [ ! -d "$DIR" ]; then
    echo "✗ 跳过 $fn —— 找不到目录 $DIR" >&2
    continue
  fi
  # getCmdLib 的内置整库 cmdlib.json 不入库（1.58MB，见 .gitignore），
  # 部署前从 cmdbook.js 现场生成 —— 保证云端拿到的就是当前命令库。
  if [ "$fn" = "getCmdLib" ]; then
    echo "── 生成 cmdlib.json（命令库整库快照）──"
    node miniprogram-tools/build_cmdlib.js
    echo ""
  fi
  echo "── 部署 $fn ──"
  tcb fn deploy "$fn" -e "$ENV_ID" --dir "$DIR" --runtime "$RUNTIME" --force
  # 部署成功后记录本次版本号：DEPLOYED_VERSION 是「云端已在跑哪一版」的唯一凭据，
  # CI 守卫靠它比对「本地生成的版本」与「云端在跑的版本」。
  # 部署失败不写 —— 否则标记文件会比云端实际版本新，守卫就失去意义了。
  if [ "$fn" = "getCmdLib" ]; then
    NEW_VER="$(node miniprogram-tools/build_cmdlib.js --check | sed -n 's/^版本号：//p')"
    if [ -n "$NEW_VER" ]; then
      echo "$NEW_VER" > cloudfunctions/getCmdLib/DEPLOYED_VERSION
      echo "  ✓ 已记录 DEPLOYED_VERSION = $NEW_VER"
    fi
  fi
  echo ""
done

# 环境变量同步（publishContent / reviewContribution / listContent 需要 ADMIN_OPENIDS）
#
# 白名单**不入库**：仓库里的 cloudbaserc.json 只有占位符 __ADMIN_OPENIDS__，
# 真实值放在本地的 cloudbaserc.local.json（已 gitignore）。
# 优先级：环境变量 ADMIN_OPENIDS > cloudbaserc.local.json > cloudbaserc.json 里的占位符
ADMIN_OPENIDS="${ADMIN_OPENIDS:-}"

if [ -z "$ADMIN_OPENIDS" ] && [ -f "cloudbaserc.local.json" ]; then
  ADMIN_OPENIDS="$(python -c "
import json,io
with io.open('cloudbaserc.local.json', encoding='utf-8') as f:
    print(json.load(f).get('adminOpenids',''))
" 2>/dev/null || echo '')"
  [ -n "$ADMIN_OPENIDS" ] && echo "（白名单来自 cloudbaserc.local.json）"
fi

if [ -z "$ADMIN_OPENIDS" ]; then
  ADMIN_OPENIDS="$(python -c "
import json,io
with io.open('cloudbaserc.json', encoding='utf-8') as f:
    d = json.load(f)
for fn in d.get('functions', []):
    if fn['name'] in ('publishContent', 'reviewContribution', 'listContent'):
        v = fn.get('envVariables', {}).get('ADMIN_OPENIDS', '')
        print('' if v == '__ADMIN_OPENIDS__' else v)
        break
" 2>/dev/null || echo '')"
fi

if [ -n "$ADMIN_OPENIDS" ]; then
  echo "── 同步 ADMIN_OPENIDS ──"
  for fn in publishContent reviewContribution listContent; do
    tcb api scf UpdateFunctionConfiguration --api-version 2018-04-16 --json \
      --body "{\"Namespace\":\"$ENV_ID\",\"FunctionName\":\"$fn\",\"Environment\":{\"Variables\":[{\"Key\":\"ADMIN_OPENIDS\",\"Value\":\"$ADMIN_OPENIDS\"}]}}" \
      >/dev/null && echo "  ✓ $fn"
  done
else
  echo "! 未读到 ADMIN_OPENIDS，跳过环境变量同步"
  echo "  请建 cloudbaserc.local.json（照抄 cloudbaserc.local.example.json），"
  echo "  或设置环境变量 ADMIN_OPENIDS 后重跑。"
fi

echo ""
echo "✓ 部署完成。验证："
echo "  tcb fn invoke listContent -e $ENV_ID -d '{\"since\":0,\"extraSince\":0}'"
