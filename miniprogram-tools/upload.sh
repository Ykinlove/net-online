#!/usr/bin/env bash
# ============================================================
#  一键上传小程序代码（绕过开发者工具 GUI 上传弹窗）
#
#  用法：
#    ./upload.sh                自动用上一次版本号的下一版
#    ./upload.sh 1.0.2          指定版本号
#    ./upload.sh 1.0.2 "发版说明"
#
#  原理：调用微信开发者工具的官方 cli.bat 的 upload 通道。
#  cli.bat 与 GUI「上传」按钮走的是同一套后端（getCommitResultInWeb），
#  但 cli.bat 不需要在 GUI 弹窗里手填版本号，也不会被弹窗的
#  前端校验/偶发客户端异常拦截，最适合发版。
#
#  注意：本脚本在 Windows 的 Git Bash 下运行，会调用 cli.bat
#  （cli.bat 内部用 cmd.exe 拉起开发者工具）。如果你的环境是
#  PowerShell / CMD，请直接双击同目录的 upload.bat。
# ============================================================
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"

# ---------- 1. 找 cli.bat ----------
CLI_BAT=""
for p in \
  "D:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat" \
  "C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat" \
  "C:/Program Files/Tencent/微信web开发者工具/cli.bat" \
  "D:/Program Files/Tencent/微信web开发者工具/cli.bat" ; do
  if [ -f "$p" ]; then CLI_BAT="$p"; break; fi
done
if [ -z "$CLI_BAT" ]; then
  echo "[错误] 找不到微信开发者工具 cli.bat"
  echo "       请确认已安装，或把路径加到本脚本顶部的候选列表里。"
  exit 1
fi

# 转成 Windows 短路径（8.3，去掉空格），避免 cmd 把 "Program Files" 截断
CLI_BAT="$(cygpath -d "$CLI_BAT" 2>/dev/null || cygpath -w "$CLI_BAT" 2>/dev/null || echo "$CLI_BAT")"
# 转成 Windows 路径（cli.bat 在 cmd 里跑，需要反斜杠路径）
WIN_REPO="$(cygpath -w "$REPO" 2>/dev/null || echo "$REPO")"
echo "[1/3] 开发者工具：$CLI_BAT"

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

# ---------- 3. 上传（调用官方 cli.bat）----------
# 自动探测正在运行的 IDE profile：含 .cli 握手文件（里面是 IDE 监听端口）的那个
UDA_ARG=""
for f in "$LOCALAPPDATA/微信开发者工具/User Data"/*/Default/.cli; do
  if [ -f "$f" ]; then
    UDA_DIR="${f%/Default/.cli}"
    UDA_ARG="--user-data-dir $(cygpath -d "$UDA_DIR" 2>/dev/null || echo "$UDA_DIR")"
    echo "[3/3] 使用 IDE profile：$UDA_DIR"
    break
  fi
done
echo "[3/3] 开始上传..."
"$CLI_BAT" upload $UDA_ARG --project "$WIN_REPO" --version "$VER" --desc "$DESC"
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
  echo "         2. 该 AppID 当前账号没有上传权限 —— mp 后台把你加为开发者"
  echo "         3. 版本号与线上/草稿版本重复 —— 换一个更大的版本号"
  echo "         4. 网络/COS 临时失败 —— 直接重跑本脚本即可"
fi
exit $RC
