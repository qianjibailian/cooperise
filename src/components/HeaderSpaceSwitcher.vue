<template>
  <a-dropdown
    v-model:open="open"
    :trigger="['click']"
    placement="bottomLeft"
    overlay-class-name="header-space-dropdown"
    @open-change="onOpenChange"
  >
    <button type="button" class="header-space-trigger" :class="{ active: open }">
      <span
        v-if="current"
        class="hs-avatar"
        :style="{ background: current.color || '#0A84FF' }"
      >{{ spaceAvatarText(current.spaceName) }}</span>
      <AppstoreOutlined v-else class="hs-placeholder-icon" />
      <span class="hs-name">{{ current?.spaceName || '全部空间' }}</span>
      <DownOutlined class="hs-arrow" />
    </button>

    <template #overlay>
      <div class="hs-panel" @click.stop>
        <a-input
          ref="searchRef"
          v-model:value="keyword"
          placeholder="搜索空间名称 / 标识"
          allow-clear
          size="small"
          class="hs-search"
        >
          <template #prefix><SearchOutlined style="color: #bbb" /></template>
        </a-input>

        <a-spin :spinning="(loading || mineLoading) && !mySpaces.length" size="small">
          <div class="hs-list">
            <div
              v-if="!keyword.trim()"
              class="hs-item"
              :class="{ selected: !current }"
              @click="switchTo(undefined)"
            >
              <AppstoreOutlined class="hs-all-icon" />
              <span class="hs-item-name">全部空间</span>
              <CheckOutlined v-if="!current" class="hs-check" />
            </div>
            <div
              v-for="sp in filtered"
              :key="sp.spaceCode"
              class="hs-item"
              :class="{ selected: sp.spaceCode === current?.spaceCode }"
              @click="switchTo(sp)"
            >
              <span class="hs-avatar" :style="{ background: sp.color || '#0A84FF' }">{{ spaceAvatarText(sp.spaceName) }}</span>
              <span class="hs-item-name">{{ sp.spaceName }}</span>
              <span v-if="sp.spaceKey" class="hs-item-key">{{ sp.spaceKey }}</span>
              <CheckOutlined v-if="sp.spaceCode === current?.spaceCode" class="hs-check" />
            </div>
            <div v-if="!loading && !mineLoading && !filtered.length" class="hs-empty">
              {{ keyword.trim() ? '没有匹配的空间' : '你还没有加入任何空间' }}
            </div>
          </div>
        </a-spin>

        <div class="hs-footer" @click="goSpaceManage">
          <SettingOutlined />
          <span>空间管理</span>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppstoreOutlined, DownOutlined, SearchOutlined, CheckOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { getUserDetail, type SpaceItem } from '@/api/faiz'
import { useSpaces, spaceAvatarText } from '@/utils/space-store'
import { useAuth } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const { spaces, loading, ensureLoaded, currentSpaceCode, setCurrentSpace } = useSpaces()
const { user: authUser } = useAuth()

const open = ref(false)
const keyword = ref('')
const searchRef = ref<{ focus: () => void } | null>(null)

/**
 * 当前用户拥有的空间编码（/user/detail 的 spaces，与后端事项查询的 user_space 权限一致）。
 * null：尚未取到或接口失败，此时退回展示全部启用空间。
 */
const mySpaceCodes = ref<string[] | null>(null)
const mineLoading = ref(false)
async function loadMySpaces() {
  const id = Number(authUser.value?.id)
  if (!id) return
  mineLoading.value = true
  try {
    const res = await getUserDetail(id)
    if (res?.success) mySpaceCodes.value = (res.data?.spaces || []).map(s => String(s.spaceCode))
  } catch {
    // 请求层已统一提示
  } finally {
    mineLoading.value = false
  }
}

/** 可切换的空间：启用 + 属于当前用户，按 sort 升序 */
const mySpaces = computed(() => {
  const mine = mySpaceCodes.value
  return spaces.value
    .filter(s => s.status === 1 && (!mine || mine.includes(s.spaceCode)))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
})

/** 当前空间：已停用 / 已删除 / 不再属于该用户时视为「全部空间」 */
const current = computed(() => mySpaces.value.find(s => s.spaceCode === currentSpaceCode.value))

/** 支持按名称 / 标识 / 编码搜索 */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return mySpaces.value
    .filter(s => !kw
      || s.spaceName?.toLowerCase().includes(kw)
      || s.spaceKey?.toLowerCase().includes(kw)
      || s.spaceCode?.toLowerCase().includes(kw))
})

function onOpenChange(v: boolean) {
  if (!v) return
  keyword.value = ''
  // 打开时刷新，保证与空间管理 / 用户空间分配的改动同步
  ensureLoaded(true)
  loadMySpaces()
  nextTick(() => searchRef.value?.focus())
}

/**
 * 切换空间（undefined = 全部空间）：
 * - 工作台：原地切换，页面随空间重新加载（见 WorkbenchPanel）
 * - 空间主页：跳到所选空间的主页；选「全部空间」回到空间列表
 * - 其它页面：只记录当前空间，回到工作台时生效
 */
function switchTo(sp: SpaceItem | undefined) {
  setCurrentSpace(sp?.spaceCode)
  open.value = false
  if (route.name === 'SpaceHome') {
    if (!sp) router.push({ name: 'Space' })
    else if (route.params.spaceCode !== sp.spaceCode) router.push({ name: 'SpaceHome', params: { spaceCode: sp.spaceCode } })
  }
}

function goSpaceManage() {
  open.value = false
  router.push({ name: 'Space' })
}

// 进入某个空间主页时，若是自己的空间则同步为当前空间（保证顶部显示与页面一致）
watch(
  () => [route.name === 'SpaceHome' ? String(route.params.spaceCode || '') : '', mySpaces.value] as const,
  ([code]) => {
    if (code && mySpaces.value.some(s => s.spaceCode === code)) setCurrentSpace(code)
  },
  { immediate: true },
)

// 当前空间已不可用（停用 / 删除 / 被移出）时清掉，避免工作台带着一个看不到的空间条件查询
watch([mySpaces, mySpaceCodes, loading], () => {
  // 空间列表或用户空间尚未取到（含接口失败）时不判断，避免误清
  if (loading.value || mySpaceCodes.value === null || !spaces.value.length) return
  if (currentSpaceCode.value && !current.value) setCurrentSpace('')
})

onMounted(() => {
  ensureLoaded()
  loadMySpaces()
})
</script>

<style scoped>
.header-space-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  /* 与侧栏「我的事项」所在的二级菜单同宽：sider 280 - icon-bar 64 = 216px */
  width: 216px;
  max-width: 216px;
  height: 32px;
  padding: 0 10px 0 6px;
  font-size: 14px;
  font-family: inherit;
  color: #1d1d1f;
  background: #f5f5f7;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.header-space-trigger:hover,
.header-space-trigger.active {
  background: #eef1f6;
  border-color: #e5e5ea;
}
.hs-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  text-align: left;
}
.hs-placeholder-icon {
  font-size: 16px;
  color: #8e8e93;
  padding-left: 2px;
}
.hs-arrow {
  flex-shrink: 0;
  font-size: 10px;
  color: #8e8e93;
}
</style>

<style>
/* 下拉弹层挂在 body，需非 scoped */
.header-space-dropdown .hs-panel {
  width: 280px;
  padding: 8px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
}
.header-space-dropdown .hs-search {
  margin-bottom: 6px;
}
.header-space-dropdown .hs-list {
  max-height: 320px;
  overflow-y: auto;
}
.header-space-dropdown .hs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.header-space-dropdown .hs-item:hover {
  background: #f5f5f7;
}
.header-space-dropdown .hs-item.selected {
  background: #eef4ff;
}
.header-space-dropdown .hs-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #1d1d1f;
}
.header-space-dropdown .hs-all-icon {
  width: 20px;
  flex-shrink: 0;
  font-size: 15px;
  color: #8e8e93;
}
.header-space-dropdown .hs-item-key {
  flex-shrink: 0;
  font-size: 11px;
  color: #8e8e93;
}
.header-space-dropdown .hs-check {
  flex-shrink: 0;
  color: var(--c-primary, #0a84ff);
}
.header-space-dropdown .hs-empty {
  padding: 16px 0;
  font-size: 12px;
  color: #8e8e93;
  text-align: center;
}
.header-space-dropdown .hs-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  margin-top: 6px;
  padding: 0 8px;
  border-top: 1px solid #f0f0f0;
  font-size: 13px;
  color: var(--c-primary, #0a84ff);
  cursor: pointer;
}
.header-space-dropdown .hs-footer:hover {
  background: #f5f5f7;
  border-radius: 6px;
}
/* 触发按钮和下拉列表共用的空间头像 */
.hs-avatar {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}
</style>
