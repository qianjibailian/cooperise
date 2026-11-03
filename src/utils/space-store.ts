import { ref } from 'vue'
import { querySpaces, type SpaceItem } from '@/api/faiz'
import { currentSpaceCode, setCurrentSpace } from './current-space'

/** 全部空间（含停用，便于历史数据回显名称）；模块级缓存，多页面共享 */
const spaces = ref<SpaceItem[]>([])
const loading = ref(false)
let pending: Promise<void> | null = null
let loaded = false

/** 拉取空间列表；force=true 时忽略缓存（如打开表单时同步空间管理的最新改动） */
function ensureLoaded(force = false): Promise<void> {
  if (pending) return pending
  if (loaded && !force) return Promise.resolve()
  loading.value = true
  pending = (async () => {
    try {
      const res = await querySpaces({ page: 1, pageSize: 999 })
      if (res?.success) {
        spaces.value = res.data?.list || []
        loaded = true
      }
    } catch {
      // 请求层已统一提示
    } finally {
      loading.value = false
      pending = null
    }
  })()
  return pending
}

function findSpace(code?: string | null): SpaceItem | undefined {
  if (!code) return undefined
  return spaces.value.find(s => s.spaceCode === code)
}

/** 空间编码 → 名称（查不到时返回空串） */
function spaceNameOf(code?: string | null): string {
  return findSpace(code)?.spaceName || ''
}

/** 空间头像文字：取名称首字（英文取前两位大写） */
export function spaceAvatarText(name?: string): string {
  const s = (name || '').trim()
  return /^[a-zA-Z]/.test(s) ? s.slice(0, 2).toUpperCase() : s.slice(0, 1)
}

/** 空间所属组织编码：问题类型 / 模板 / 工作流不再单独选组织，提交时取所属空间的组织（会等待空间列表加载） */
async function orgCodeOfSpace(code?: string | null): Promise<string | undefined> {
  if (!code) return undefined
  if (!findSpace(code)) await ensureLoaded(true)
  return findSpace(code)?.organizationCode || undefined
}

export function useSpaces() {
  return { spaces, loading, ensureLoaded, findSpace, spaceNameOf, orgCodeOfSpace, currentSpaceCode, setCurrentSpace }
}
