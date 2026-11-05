<template>
  <div class="h5-page">
    <header class="sp-head">
      <h1 class="sp-title">空间</h1>
      <van-button type="primary" size="small" round icon="plus" @click="openCreate">新建空间</van-button>
    </header>

    <van-sticky>
      <div class="sp-filters">
        <van-search v-model="keyword" placeholder="搜索空间名称 / 编码" shape="round" background="transparent" @search="reload" @clear="reload" />
        <div class="sp-tools">
          <span v-for="s in STATUS_FILTERS" :key="s.value" class="sp-chip" :class="{ active: statusFilter === s.value }" @click="setStatus(s.value)">{{ s.label }}</span>
          <span class="sp-chip sp-org" :class="{ active: orgFilter != null }" @click="orgFilterOpen = true">
            <van-icon name="cluster-o" /><span class="h5-ellipsis" data-no-i18n>{{ orgFilter != null ? orgFilterLabel : '全部组织' }}</span>
          </span>
        </div>
      </div>
    </van-sticky>

    <van-pull-refresh v-model="refreshing" @refresh="reload">
      <van-list
        v-model:loading="loading"
        v-model:error="error"
        :finished="finished"
        error-text="加载失败，点击重试"
        :finished-text="list.length ? `共 ${total} 个空间` : ''"
        :immediate-check="false"
        @load="loadMore"
      >
        <van-empty v-if="finished && !list.length" image-size="72" :description="keyword ? '没有匹配的空间' : '暂无空间'" />

        <!-- 空间卡片：点开操作菜单（设为当前 / 编辑 / 删除），右上角直接启用 / 停用 -->
        <div v-for="s in list" :key="s.id" class="sp-card" :class="{ disabled: s.status !== 1 }" @click="openActions(s)">
          <div class="sp-card-top">
            <span class="sp-avatar" :style="{ background: s.color || DEFAULT_COLOR }">{{ spaceAvatarText(s.spaceName) }}</span>
            <div class="sp-main">
              <div class="sp-name-row">
                <span class="sp-name h5-ellipsis" data-no-i18n>{{ s.spaceName }}</span>
                <span v-if="s.spaceKey" class="sp-key" data-no-i18n>{{ s.spaceKey }}</span>
                <span v-if="s.spaceCode === currentSpaceCode" class="sp-current">当前</span>
              </div>
              <div class="sp-code" data-no-i18n>{{ s.spaceCode }}</div>
            </div>
            <van-switch
              :model-value="s.status === 1"
              :loading="togglingId === s.id"
              size="20px"
              @click.stop
              @update:model-value="toggleStatus(s, $event)"
            />
          </div>
          <div class="sp-meta">
            <span v-if="orgLabelOf(s)" class="sp-meta-item h5-ellipsis"><van-icon name="cluster-o" /><span data-no-i18n>{{ orgLabelOf(s) }}</span></span>
            <span v-if="s.ownerMemberId" class="sp-meta-item h5-ellipsis"><van-icon name="user-o" /><span data-no-i18n>{{ s.ownerName || s.ownerMemberId }}</span></span>
            <span v-if="s.updateTime" class="sp-meta-time">{{ formatRelative(s.updateTime) }}</span>
          </div>
          <div v-if="s.description" class="sp-desc" data-no-i18n>{{ s.description }}</div>
        </div>
      </van-list>
      <div class="sp-bottom" />
    </van-pull-refresh>

    <!-- 操作菜单 -->
    <van-action-sheet
      v-model:show="actionsOpen"
      :title="acting?.spaceName"
      :actions="actionList"
      cancel-text="取消"
      close-on-click-action
      @select="onAction"
    />

    <SpaceForm v-model:show="formOpen" :space="editing" :org-tree="orgTree" @saved="onSaved" />
    <OrgPicker ref="orgPickerRef" v-model:show="orgFilterOpen" v-model="orgFilter" :tree="orgTree" title="按组织筛选" allow-all />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { showConfirmDialog, showSuccessToast } from 'vant'
import {
  deleteSpace, getOrganizationTree, querySpaces, updateSpace,
  type OrganizationNode, type SpaceItem,
} from '@/api/faiz'
import { findOrgCode } from '@/utils/orgTree'
import { spaceAvatarText, useSpaces } from '@/utils/space-store'
import OrgPicker from '../components/OrgPicker.vue'
import SpaceForm from '../components/SpaceForm.vue'
import { formatRelative } from '../utils'

defineOptions({ name: 'H5Spaces' })

const DEFAULT_COLOR = '#0A84FF'
const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]
const PAGE_SIZE = 20

const { ensureLoaded: ensureSpaceCache, currentSpaceCode, setCurrentSpace } = useSpaces()

// ---------------- 组织树（筛选 / 表单共用） ----------------
const orgTree = ref<OrganizationNode[]>([])
const orgPickerRef = ref<InstanceType<typeof OrgPicker>>()
async function loadOrgTree() {
  try {
    const res = await getOrganizationTree()
    if (res?.success) orgTree.value = res.data || []
  } catch {
    // 请求层已统一提示
  }
}
function orgNameOf(code?: string): string {
  if (!code) return ''
  const walk = (nodes: OrganizationNode[]): string => {
    for (const n of nodes) {
      if (n.organizationCode === code) return n.organizationName
      const hit = n.children?.length ? walk(n.children) : ''
      if (hit) return hit
    }
    return ''
  }
  return walk(orgTree.value)
}
const orgLabelOf = (s: SpaceItem) => s.organizationName || orgNameOf(s.organizationCode)

// ---------------- 列表（与网页版一致：只看我加入的空间） ----------------
const keyword = ref('')
const statusFilter = ref('all')
const orgFilter = ref<number | undefined>()
const orgFilterOpen = ref(false)
const orgFilterLabel = computed(() => orgPickerRef.value?.labelOf(orgFilter.value) || '组织')

const list = ref<SpaceItem[]>([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const finished = ref(false)
const error = ref(false)
const refreshing = ref(false)
let seq = 0

async function loadMore() {
  const mySeq = seq
  const next = page.value + 1
  try {
    const res = await querySpaces({
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value === 'all' ? undefined : Number(statusFilter.value),
      organizationId: orgFilter.value,
      onlyJoined: true,
      page: next,
      pageSize: PAGE_SIZE,
    })
    if (mySeq !== seq) return
    if (!res?.success) {
      error.value = true
      return
    }
    const rows = res.data?.list || []
    list.value = next === 1 ? rows : [...list.value, ...rows]
    total.value = Number(res.data?.total || 0)
    page.value = next
    finished.value = rows.length < PAGE_SIZE || list.value.length >= total.value
  } catch {
    if (mySeq === seq) error.value = true
  } finally {
    if (mySeq === seq) {
      loading.value = false
      refreshing.value = false
    }
  }
}

function reload() {
  seq++
  page.value = 0
  finished.value = false
  error.value = false
  loading.value = true
  void loadMore()
}

function setStatus(v: string) {
  if (statusFilter.value === v) return
  statusFilter.value = v
  reload()
}
watch(orgFilter, reload)

/** 空间有变动：刷新列表，并刷新共享的空间缓存（顶部空间切换、新建事项等用） */
function onSaved() {
  reload()
  void ensureSpaceCache(true)
}

// ---------------- 启用 / 停用 ----------------
const togglingId = ref<number | null>(null)
async function toggleStatus(s: SpaceItem, checked: boolean) {
  togglingId.value = s.id
  try {
    const res = await updateSpace({
      id: s.id,
      spaceName: s.spaceName,
      spaceKey: s.spaceKey || '',
      organizationCode: s.organizationCode ?? findOrgCode(orgTree.value, s.organizationId),
      ownerMemberId: s.ownerMemberId,
      color: s.color,
      description: s.description,
      sort: s.sort,
      status: checked ? 1 : 0,
    })
    if (res?.success) {
      s.status = checked ? 1 : 0
      void ensureSpaceCache(true)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    togglingId.value = null
  }
}

// ---------------- 新建 / 编辑 ----------------
const formOpen = ref(false)
const editing = ref<SpaceItem | null>(null)
function openCreate() {
  editing.value = null
  formOpen.value = true
}

// ---------------- 操作菜单 ----------------
const actionsOpen = ref(false)
const acting = ref<SpaceItem | null>(null)
const actionList = computed(() => {
  const s = acting.value
  if (!s) return []
  return [
    ...(s.status === 1 && s.spaceCode !== currentSpaceCode.value ? [{ name: '设为当前空间', key: 'current' }] : []),
    { name: '编辑', key: 'edit' },
    { name: '删除', key: 'delete', color: '#ee0a24' },
  ]
})
function openActions(s: SpaceItem) {
  acting.value = s
  actionsOpen.value = true
}

async function onAction(a: { key: string }) {
  const s = acting.value
  if (!s) return
  if (a.key === 'current') {
    setCurrentSpace(s.spaceCode)
    showSuccessToast(`已切换到「${s.spaceName}」`)
  } else if (a.key === 'edit') {
    editing.value = s
    formOpen.value = true
  } else if (a.key === 'delete') {
    try {
      await showConfirmDialog({
        title: `删除空间「${s.spaceName}」？`,
        message: '删除后空间内的成员关系将被移除，且不可恢复。',
        confirmButtonText: '删除',
        confirmButtonColor: '#ee0a24',
      })
    } catch {
      return
    }
    try {
      const res = await deleteSpace(s.id)
      if (res?.success) onSaved()
    } catch {
      // 请求层已统一提示
    }
  }
}

onMounted(() => {
  reload()
  void loadOrgTree()
})
</script>

<style scoped>
.sp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 14px) var(--h5-gutter) 2px;
}

.sp-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
}

.sp-filters {
  background: var(--h5-bg);
  padding-bottom: 4px;
}

.sp-filters :deep(.van-search) {
  padding: 8px var(--h5-gutter) 4px;
}

.sp-filters :deep(.van-search__content) {
  background: #fff;
  border: 1px solid #e3e6eb;
}

.sp-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px var(--h5-gutter) 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.sp-tools::-webkit-scrollbar {
  display: none;
}

.sp-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid #e3e6eb;
  border-radius: 15px;
  background: #fff;
  font-size: 13px;
  color: var(--h5-text-2);
}

.sp-chip.active {
  border-color: color-mix(in srgb, var(--van-primary-color) 40%, transparent);
  background: color-mix(in srgb, var(--van-primary-color) 8%, #fff);
  color: var(--van-primary-color);
  font-weight: 500;
}

.sp-org {
  max-width: 50vw;
}

.sp-card {
  margin: 10px var(--h5-gutter) 0;
  padding: 14px;
  border-radius: var(--h5-radius);
  background: var(--h5-card);
  transition: transform 0.1s;
}

.sp-card:active {
  transform: scale(0.99);
}

.sp-card.disabled .sp-avatar,
.sp-card.disabled .sp-name {
  opacity: 0.5;
}

.sp-card-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sp-avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.sp-main {
  flex: 1;
  min-width: 0;
}

.sp-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.sp-name {
  font-size: 16px;
  font-weight: 600;
}

.sp-key {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 4px;
  background: #f2f4f7;
  font-size: 11px;
  line-height: 18px;
  color: var(--h5-text-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.sp-current {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--van-primary-color) 12%, #fff);
  font-size: 11px;
  line-height: 18px;
  color: var(--van-primary-color);
}

.sp-code {
  margin-top: 2px;
  font-size: 12px;
  color: var(--h5-text-3);
  font-variant-numeric: tabular-nums;
}

.sp-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-top: 10px;
  font-size: 12px;
  color: var(--h5-text-2);
}

.sp-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.sp-meta-time {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--h5-text-3);
}

.sp-desc {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--h5-text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sp-bottom {
  height: 16px;
}
</style>
