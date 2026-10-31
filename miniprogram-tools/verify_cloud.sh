#!/usr/bin/env bash
# 云函数端到端自动验证
#
# 用法：
#   bash miniprogram-tools/verify_cloud.sh          # 全量验证
#   bash miniprogram-tools/verify_cloud.sh --with-ui # 额外做 CLI 层面的调用检查
#
# 验证内容：
#   1. 四个云函数状态（是否 Deployment completed）
#   2. 环境变量 ADMIN_OPENIDS 是否配好
#   3. 三个集合是否存在 + 权限是否正确
#   4. 集合缺失容错（listContent 在空集合下不报错）
#   5. 鉴权拦截（无 openid 调用 reviewContribution 被拒）
#   6. 写入→拉取闭环（投稿→extra_items→listContent 能读到）
#   7. 清理自检数据

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_ID="net-online-d7g1ig4c6f07a8abb"
PROBE_ID="__verify_probe__"

export PATH="$PATH:$(npm config get prefix 2>/dev/null)/bin"

PASS=0
FAIL=0

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
head_() { echo ""; echo "── $1 ──"; }

echo "════════════════════════════════════════════"
echo "  云函数端到端验证"
echo "  环境: $ENV_ID"
echo "════════════════════════════════════════════"

# ---------- 1. 云函数状态 ----------
head_ "1. 云函数状态"
FN_LIST=$(tcb fn list -e "$ENV_ID" 2>&1 | tr -d ' ')
for fn in publishContent submitContribution listContent reviewContribution; do
  if echo "$FN_LIST" | grep -q "$fn"; then
    if echo "$FN_LIST" | grep "$fn" | grep -q "Deploymentcompleted"; then
      ok "$fn 已部署完成"
    else
      bad "$fn 状态异常"
    fi
  else
    bad "$fn 未找到"
  fi
done

# ---------- 2. 环境变量 ----------
head_ "2. 环境变量 ADMIN_OPENIDS"
for fn in publishContent reviewContribution; do
  VAL=$(tcb fn detail "$fn" -e "$ENV_ID" --json 2>/dev/null | grep -A4 '"Variables"' | grep '"Value"' | head -1 \
        | sed 's/.*"Value": "//; s/".*//' | tr -d ' ')
  if [ -n "$VAL" ]; then
    ok "$fn 已配置 (${VAL:0:20}...)"
  else
    bad "$fn 未配置 ADMIN_OPENIDS"
  fi
done

# ---------- 3. 集合与权限 ----------
head_ "3. 集合与权限"
COLLS=$(tcb db nosql execute --command '[{"TableName":"c","CommandType":"COMMAND","Command":"{\"listCollections\":1,\"filter\":{}}"}]' --json 2>/dev/null | grep '"name"')
for c in content_patch extra_items contributions; do
  if echo "$COLLS" | grep -q "\"$c\""; then
    ACL=$(tcb api tcb DescribeDatabaseACL --api-version 2018-06-08 \
          --body "{\"EnvId\":\"$ENV_ID\",\"CollectionName\":\"$c\"}" --json 2>/dev/null \
          | grep -oE '"AclTag": "[A-Z]+"' | sed 's/.*: "//; s/"//')
    if [ "$ACL" = "READONLY" ] || [ "$ACL" = "ADMINWRITE" ]; then
      ok "$c 存在，权限 $ACL"
    else
      bad "$c 权限异常: ${ACL:-未取到}"
    fi
  else
    bad "$c 不存在"
  fi
done

# ---------- 4. 集合缺失容错 ----------
head_ "4. 集合缺失容错（不报 -502005）"
OUT=$(tcb fn invoke listContent -e "$ENV_ID" -d '{"since":0,"extraSince":0}' 2>&1)
if echo "$OUT" | grep -q '"ok":true'; then
  ok "listContent 正常返回（无 -502005）"
else
  bad "listContent 异常: $(echo "$OUT" | grep 'Return result' | head -1)"
fi

# ---------- 5. 鉴权拦截 ----------
head_ "5. 鉴权拦截（无 openid 应被拒）"
OUT=$(tcb fn invoke reviewContribution -e "$ENV_ID" -d '{"action":"list"}' 2>&1)
if echo "$OUT" | grep -q '无审核权限'; then
  ok "reviewContribution 正确拦截无权限调用"
else
  bad "reviewContribution 未按预期拦截: $(echo "$OUT" | grep 'Return result' | head -1)"
fi

# ---------- 6. 写入→拉取闭环 ----------
head_ "6. 写入 → 拉取 闭环"
OUT=$(tcb fn invoke submitContribution -e "$ENV_ID" \
      -d "{\"kind\":\"book\",\"type\":\"add\",\"targetId\":\"\",\"fields\":{\"id\":\"$PROBE_ID\",\"name\":\"验证探针条目\",\"kw\":[\"验证探针\"],\"cmds\":[[\"探针\",\"临时验证数据\"]],\"tip\":\"临时\"}}" 2>&1)
if echo "$OUT" | grep -q '"ok":true'; then
  ok "投稿写入成功 (contributions.status=pending)"
else
  bad "投稿写入失败: $(echo "$OUT" | grep 'Return result' | head -1)"
fi

# 直接写 extra_items 模拟审核通过
tcb db nosql execute --command "[{\"TableName\":\"extra_items\",\"CommandType\":\"INSERT\",\"Command\":\"{\\\"insert\\\":\\\"extra_items\\\",\\\"documents\\\":[{\\\"kind\\\":\\\"book\\\",\\\"item\\\":{\\\"id\\\":\\\"$PROBE_ID\\\",\\\"name\\\":\\\"验证探针条目\\\",\\\"kw\\\":[\\\"验证探针\\\"],\\\"cmds\\\":[[\\\"探针\\\",\\\"临时\\\"]],\\\"tip\\\":\\\"临时\\\"},\\\"approvedAt\\\":$(date +%s000)}]}\"}]" --json >/dev/null 2>&1 || true

OUT=$(tcb fn invoke listContent -e "$ENV_ID" -d '{"since":0,"extraSince":0}' 2>&1)
if echo "$OUT" | grep -q "$PROBE_ID"; then
  ok "listContent 成功拉到新增条目（覆盖层生效）"
else
  bad "listContent 未拉到探针条目"
fi

# ---------- 7. 清理 ----------
head_ "7. 清理自检数据"
tcb db nosql execute --command "[{\"TableName\":\"extra_items\",\"CommandType\":\"DELETE\",\"Command\":\"{\\\"delete\\\":\\\"extra_items\\\",\\\"deletes\\\":[{\\\"q\\\":{\\\"item.id\\\":\\\"$PROBE_ID\\\"},\\\"limit\\\":1}]}\"}]" --json >/dev/null 2>&1 || true
tcb db nosql execute --command "[{\"TableName\":\"contributions\",\"CommandType\":\"DELETE\",\"Command\":\"{\\\"delete\\\":\\\"contributions\\\",\\\"deletes\\\":[{\\\"q\\\":{\\\"fields.id\\\":\\\"$PROBE_ID\\\"},\\\"limit\\\":1}]}\"}]" --json >/dev/null 2>&1 || true

OUT=$(tcb fn invoke listContent -e "$ENV_ID" -d '{"since":0,"extraSince":0}' 2>&1)
if echo "$OUT" | grep -q "$PROBE_ID"; then
  bad "探针数据未清理干净"
else
  ok "探针数据已清理"
fi

# ---------- 汇总 ----------
echo ""
echo "════════════════════════════════════════════"
echo "  通过 $PASS 项，失败 $FAIL 项"
echo "════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
