/**
 * 手机 H5 构建（vite --mode h5）里替代 ant-design-vue 的最小实现。
 * 共用的 @/utils/request 默认用 antd 的 message 弹提示，H5 已通过 setRequestNotifier 换成 Vant，
 * 这里只提供空的 message，避免把整个 antd 打进手机包。H5 页面不要直接使用 antd 组件
 */
const noop = () => {}
export const message = { success: noop, error: noop, warning: noop, info: noop, loading: noop, destroy: noop }
export default { message }
