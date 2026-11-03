#!/usr/bin/env bash
#
# iOS 打包脚本：本地 Mac（装好 Xcode）与 CI（Codemagic / 云效 macOS 构建机）通用。
#
# 用法：
#   ./scripts/ios-build.sh                          # 模拟器版本，免签名（CI 验证编译是否通过）
#   BUILD_MODE=device TEAM_ID=ABCDE12345 ./scripts/ios-build.sh          # 真机 ipa（自动签名）
#   BUILD_MODE=device EXPORT_METHOD=ad-hoc EXPORT_OPTIONS=ios/App/exportOptions.plist ./scripts/ios-build.sh
#
# 可用环境变量：
#   BUILD_MODE      simulator | device        默认 simulator
#   EXPORT_METHOD   development | ad-hoc | app-store-connect | enterprise   默认 development
#   TEAM_ID         Apple Developer Team ID，device 模式必填
#   EXPORT_OPTIONS  exportOptions.plist 路径；文件存在时直接使用（CI 用 xcode-project use-profiles 生成）
#   SKIP_WEB        1 = 跳过 vite 构建（CI 已单独构建时）
#   SKIP_SYNC       1 = 跳过 cap sync
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${BUILD_MODE:-simulator}"
EXPORT_METHOD="${EXPORT_METHOD:-development}"
TEAM_ID="${TEAM_ID:-}"
EXPORT_OPTIONS="${EXPORT_OPTIONS:-ios/App/exportOptions.plist}"
BUILD_DIR="ios/App/build"

# CI 上没必要下载 Electron 二进制（100MB+，iOS 打包完全用不到）
export ELECTRON_SKIP_BINARY_DOWNLOAD=1

if [ "${SKIP_WEB:-0}" != "1" ]; then
  echo "==> 构建前端（mode=ios）"
  pnpm exec vite build --mode ios
fi

if [ "${SKIP_SYNC:-0}" != "1" ]; then
  echo "==> 同步 web 产物到 iOS 工程"
  pnpm exec cap sync ios
fi

cd ios/App

# Capacitor 模板不一定带 shared scheme，没有就用 -target，避免 CI 上报 "scheme not found"
SCHEME="$(xcodebuild -list -project App.xcodeproj 2>/dev/null | awk '/Schemes:/{f=1;next} f && NF {print $1; exit}')"
if [ -n "$SCHEME" ]; then
  TARGET_ARGS=(-scheme "$SCHEME")
else
  TARGET_ARGS=(-target App)
fi

if [ "$MODE" = "simulator" ]; then
  echo "==> 构建模拟器版本（不签名）"
  xcodebuild -project App.xcodeproj "${TARGET_ARGS[@]}" \
    -configuration Release -sdk iphonesimulator \
    -derivedDataPath "$BUILD_DIR" \
    CODE_SIGNING_ALLOWED=NO \
    build

  APP_PATH="$(find "$BUILD_DIR/Build/Products/Release-iphonesimulator" -maxdepth 1 -name '*.app' | head -1)"
  echo "==> 产物：$APP_PATH"
  echo "    安装到模拟器：xcrun simctl install booted \"$APP_PATH\""
  exit 0
fi

if [ -z "$TEAM_ID" ]; then
  echo "!! device 模式需要 TEAM_ID（Apple Developer Team ID）" >&2
  exit 1
fi

if [ ! -f "$EXPORT_OPTIONS" ]; then
  echo "==> 生成 exportOptions.plist（method=$EXPORT_METHOD）"
  mkdir -p "$(dirname "$EXPORT_OPTIONS")"
  cat > "$EXPORT_OPTIONS" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${EXPORT_METHOD}</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>compileBitcode</key>
  <false/>
  <key>uploadSymbols</key>
  <false/>
</dict>
</plist>
EOF
fi

echo "==> Archive（device）"
rm -rf "$BUILD_DIR/App.xcarchive" "$BUILD_DIR/ipa"
xcodebuild -project App.xcodeproj "${TARGET_ARGS[@]}" \
  -configuration Release -sdk iphoneos \
  -archivePath "$BUILD_DIR/App.xcarchive" \
  archive

echo "==> 导出 ipa（method=$EXPORT_METHOD）"
xcodebuild -exportArchive \
  -archivePath "$BUILD_DIR/App.xcarchive" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$BUILD_DIR/ipa"

ls -lh "$BUILD_DIR/ipa"
echo "==> 完成：$BUILD_DIR/ipa/*.ipa"
