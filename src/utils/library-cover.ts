/**
 * 知识库默认封面插画（可在知识库页选择）。
 * key 与后端 DocServiceImpl.LIBRARY_COVERS 保持一致；顺序与 DocsLibraryCover 的配色一一对应。
 */
export const LIBRARY_COVERS: { key: string; label: string }[] = [
  { key: 'sunset', label: '日落' },
  { key: 'ocean', label: '海洋' },
  { key: 'forest', label: '森林' },
  { key: 'lavender', label: '薰衣草' },
  { key: 'peach', label: '蜜桃' },
]
