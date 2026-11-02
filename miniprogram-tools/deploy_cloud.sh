#!/usr/bin/env bash
# 一键部署 4 个云函数 + 同步环境变量
#
# 用法：
#   bash miniprogram-tools/deploy_cloud.sh              # 部署全部 4 个
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

ALL_FUNCS="publishContent submitContribution listContent reviewContribution"

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
  echo "── 部署 $fn ──"
  tcb fn deploy "$fn" -e "$ENV_ID" --dir "$DIR" --runtime "$RUNTIME" --force
  echo ""
done

# 环境变量同步（publishContent / reviewContribution / listContent 需要 ADMIN_OPENIDS）
ADMIN_OPENIDS="$(python -c "
import json,io
with io.open('cloudbaserc.json', encoding='utf-8') as f:
    d = json.load(f)
for fn in d.get('functions', []):
    if fn['name'] in ('publishContent', 'reviewContribution', 'listContent'):
        print(fn.get('envVariables', {}).get('ADMIN_OPENIDS', ''))
        break
" 2>/dev/null || echo '')"

if [ -n "$ADMIN_OPENIDS" ]; then
  echo "── 同步 ADMIN_OPENIDS ──"
  for fn in publishContent reviewContribution listContent; do
    tcb api scf UpdateFunctionConfiguration --api-version 2018-04-16 --json \
      --body "{\"Namespace\":\"$ENV_ID\",\"FunctionName\":\"$fn\",\"Environment\":{\"Variables\":[{\"Key\":\"ADMIN_OPENIDS\",\"Value\":\"$ADMIN_OPENIDS\"}]}}" \
      >/dev/null && echo "  ✓ $fn"
  done
else
  echo "! 未读到 ADMIN_OPENIDS，跳过环境变量同步（cloudbaserc.json 里检查 functions[].envVariables）"
fi

echo ""
echo "✓ 部署完成。验证："
echo "  tcb fn invoke listContent -e $ENV_ID -d '{\"since\":0,\"extraSince\":0}'"
