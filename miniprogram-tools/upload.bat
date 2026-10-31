@echo off
REM ============================================================
REM  一键上传小程序代码（绕过开发者工具 GUI 上传弹窗）
REM
REM  用法：
REM    upload.bat                自动用上一次版本号的下一版
REM    upload.bat 1.0.1          指定版本号
REM    upload.bat 1.0.1 "发版说明"
REM
REM  原理：调用微信开发者工具的 cli.bat upload。
REM  开发者工具 GUI 的「上传」弹窗在版本号为空时会直接拦截、
REM  连请求都不发（首次发布的小程序因为没有「线上/草稿版本号」
REM  很容易踩到），CLI 通道没有这个拦截。
REM ============================================================
setlocal enabledelayedexpansion

set "REPO=%~dp0.."
for %%I in ("%REPO%") do set "REPO=%%~fI"

REM ---------- 1. 找开发者工具 ----------
set "CLI="
for %%P in (
  "D:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat"
  "C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat"
  "C:\Program Files\Tencent\微信web开发者工具\cli.bat"
  "D:\Program Files\Tencent\微信web开发者工具\cli.bat"
) do (
  if not defined CLI if exist %%P set "CLI=%%~P"
)
if not defined CLI (
  echo [错误] 找不到微信开发者工具 cli.bat
  echo        请确认已安装，或把路径加到本脚本顶部的候选列表里。
  if not defined NOPAUSE pause
  exit /b 1
)
echo [1/3] 开发者工具：%CLI%

REM ---------- 2. 决定版本号 ----------
set "VER=%~1"
set "DESC=%~2"
if "%DESC%"=="" set "DESC=自动化上传 %DATE% %TIME%"

if "%VER%"=="" (
  set "LASTFILE=%REPO%\miniprogram-tools\.last_upload_version"
  if exist "%LASTFILE%" (
    set /p PREV=<"%LASTFILE%"
  ) else (
    set "PREV=1.0.0"
  )
  for /f "tokens=1,2,3 delims=." %%a in ("!PREV!") do (
    set "MAJ=%%a"
    set "MIN=%%b"
    set "PAT=%%c"
  )
  set /a PAT+=1
  set "VER=!MAJ!.!MIN!.!PAT!"
)
echo [2/3] 版本号：%VER%    备注：%DESC%

REM ---------- 3. 上传 ----------
echo [3/3] 开始上传...
"%CLI%" upload --project "%REPO%" --version "%VER%" --desc "%DESC%"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
  echo [成功] 版本 %VER% 已上传到微信后台（开发版本）。
  echo        去 mp.weixin.qq.com -^> 版本管理 查看，并提交审核。
  echo %VER%>"%REPO%\miniprogram-tools\.last_upload_version"
) else (
  echo [失败] 退出码 %RC%
  echo        常见原因：
  echo          1. 开发者工具未登录 —— 先在 IDE 里扫码登录
  echo          2. 该 AppID 当前开发者没有权限 —— mp 后台加你为开发者
  echo          3. 版本号与线上/草稿版本重复 —— 换一个更大的版本号
  echo          4. 开发者工具服务端口未开启 —— 设置-^>安全设置-^>服务端口
)
if not defined NOPAUSE pause
exit /b %RC%
