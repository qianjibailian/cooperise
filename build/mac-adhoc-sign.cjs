/**
 * electron-builder afterPack 钩子：macOS 包做 ad-hoc 签名（codesign --sign -）。
 *
 * 没有 Apple 开发者证书时（package.json 里 mac.identity = null），electron-builder 会跳过签名，
 * 而改过 Info.plist / 打入 asar 后 Electron 自带的签名已失效，Apple Silicon 上更容易被判定为「已损坏」。
 * ad-hoc 签名不需要证书，能让签名重新自洽；首次打开仍需右键 →「打开」（未经 Apple 公证）。
 * 以后有了开发者证书：把 mac.identity 改成证书名并配置公证，此钩子会自动跳过。
 */
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const macConfig = context.packager.platformSpecificBuildOptions || {}
  if (macConfig.identity !== null) return // 配了正式证书，交给 electron-builder 签名

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  console.log(`  • ad-hoc signing  ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
