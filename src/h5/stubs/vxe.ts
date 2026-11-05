/**
 * 手机 H5 构建（vite --mode h5）里替代 vxe-pc-ui / vxe-table 语言包的空实现。
 * 共用的 @/i18n 会给网页版的 vxe 表格切换语言，H5 不用 vxe，换成空实现避免把整个表格库打进手机包
 */
export const VxeUI = {
  setI18n: (_lang: string, _messages: unknown) => {},
  setLanguage: (_lang: string) => {},
}
const messages = { vxe: {} }
export default messages
