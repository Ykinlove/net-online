#!/usr/bin/env bash
# ============================================================
#  一键上传小程序代码（绕过开发者工具 GUI 上传弹窗）
#
#  用法：
#    ./upload.sh                自动用上一次版本号的下一版
#    ./upload.sh 1.0.1          指定版本号
#    ./upload.sh 1.0.1 "发版说明"
#
#  原理：调用微信开发者工具的 CLI 上传通道（等价于 cli.bat upload，
#  但不经过 cmd.exe，所以在 Git Bash / WSL 里也能跑）。
#
#  为什么需要它：
#  开发者工具 GUI 的「上传」弹窗在版本号为空时会直接拦下来，
#  连请求都不发（首次发布的小程序因为没有「线上/草稿版本号」
#  很容易踩到），CLI 通道没有这个拦截。
# ============================================================
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

# ---------- 1. 找开发者工具 ----------
DEVTOOLS=""
for p in \
  "D:/Program Files (x86)/Tencent/微信web开发者工具" \
  "C:/Program Files (x86)/Tencent/微信web开发者工具" \
  "C:/Program Files/Tencent/微信web开发者工具" \
  "D:/Program Files/Tencent/微信web开发者工具" ; do
  if [ -d "$p" ]; then DEVTOOLS="$p"; break; fi
done
if [ -z "$DEVTOOLS" ]; then
  echo "[错误] 找不到微信开发者工具安装目录"
  echo "       请确认已安装，或把路径加到本脚本顶部的候选列表里。"
  exit 1
fi

# electron 运行时（cli.bat 会自动挑体积 > 50MB 的那个 exe）
ELECTRON=""
for exe in "$DEVTOOLS"/*.exe; do
  base="$(basename "$exe")"
  case "$base" in
    node.exe|node-18.exe|wxfilewatcher.exe|wxfilewatcher_x64.exe|notification_helper.exe|wechatdevtools.exe) continue ;;
  esac
  size=$(stat -c%s "$exe" 2>/dev/null || echo 0)
  if [ "$size" -gt 50000000 ]; then ELECTRON="$exe"; break; fi
done
CLI_JS="$DEVTOOLS/resources/app.asar.unpacked/js/common/cli/index.js"
if [ -z "$ELECTRON" ] || [ ! -f "$CLI_JS" ]; then
  echo "[错误] 开发者工具目录结构异常：$DEVTOOLS"
  echo "       找不到 electron 运行时或 cli/index.js"
  exit 1
fi
echo "[1/3] 开发者工具：$DEVTOOLS"

# ---------- 2. 决定版本号 ----------
VER="${1:-}"
DESC="${2:-自动化上传 $(date '+%Y-%m-%d %H:%M:%S')}"

if [ -z "$VER" ]; then
  LASTFILE="$HERE/.last_upload_version"
  if [ -f "$LASTFILE" ]; then
    PREV="$(tr -d ' \r\n' < "$LASTFILE")"
  else
    PREV="1.0.0"
  fi
  IFS='.' read -r MAJ MIN PAT <<< "$PREV"
  VER="${MAJ:-1}.${MIN:-0}.$(( ${PAT:-0} + 1 ))"
fi
echo "[2/3] 版本号：$VER    备注：$DESC"

# ---------- 3. 上传 ----------
# 与 cli.bat 完全相同的引导方式：electron 以 node 模式跑 cli/index.js
BOOTSTRAP='const e=process.argv[1],a=process.argv.slice(2).filter(function(x){return x!=="--electron"});if(!process.env.cwd)process.env.cwd=process.cwd();process.argv=[process.execPath,"--ms-enable-electron-run-as-node",e,"--electron"].concat(a);require(e)'

WIN_REPO="$(cygpath -w "$REPO" 2>/dev/null || echo "$REPO")"

echo "[3/3] 开始上传..."
ELECTRON_RUN_AS_NODE=1 "$ELECTRON" -e "$BOOTSTRAP" "$CLI_JS" \
  upload --project "$WIN_REPO" --version "$VER" --desc "$DESC"
RC=$?

echo
if [ "$RC" -eq 0 ]; then
  echo "[成功] 版本 $VER 已上传到微信后台（开发版本）。"
  echo "       去 mp.weixin.qq.com -> 版本管理 查看，并提交审核。"
  echo "$VER" > "$HERE/.last_upload_version"
else
  echo "[失败] 退出码 $RC"
  echo "       常见原因："
  echo "         1. 开发者工具未登录 —— 先在 IDE 里扫码登录"
  echo "         2. 该 AppID 当前开发者没有权限 —— mp 后台加你为开发者"
  echo "         3. 版本号与线上/草稿版本重复 —— 换一个更大的版本号"
  echo "         4. 开发者工具服务端口未开启 —— 设置->安全设置->服务端口"
fi
exit $RC
