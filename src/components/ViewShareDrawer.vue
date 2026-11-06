<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CopyOutlined,
  CloseOutlined,
  LockOutlined,
  LinkOutlined,
  TeamOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
} from '@ant-design/icons-vue'
import { getViewDetail, shareView, queryUsers, getOrganizationTree, querySpaceOptions, type OrganizationNode } from '@/api/faiz'
import type { UserItem } from '@/types/faiz'
import { personAvatar, personInitial, personKey, personLabel } from '@/utils/person'

/**
 * 视图分享抽屉（仅创建人可操作）
 * 默认只有创建人可见；分享范围单选：链接分享 / 指定用户 / 指定组织（含下级）/ 指定空间。
 * 被分享人只读。
 */
const props = defineProps<{
  open: boolean
  filterCode: string
  filterName?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved'): void
}>()

const drawerOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

type ShareScope = 'NONE' | 'ALL' | 'MEMBERS' | 'ORG' | 'SPACE'

const SCOPES: { value: ShareScope; label: string; desc: string; icon: any }[] = [
  { value: 'NONE', label: '仅自己', desc: '只有创建人可以访问', icon: LockOutlined },
  { value: 'ALL', label: '链接分享', desc: '所有登录用户通过链接查看', icon: LinkOutlined },
  { value: 'MEMBERS', label: '指定用户', desc: '仅勾选的用户可查看', icon: TeamOutlined },
  { value: 'ORG', label: '指定组织', desc: '勾选组织及其下级成员可查看', icon: ApartmentOutlined },
  { value: 'SPACE', label: '指定空间', desc: '勾选空间的成员可查看', icon: AppstoreOutlined },
]

/** 展开区的标题 */
const detailTitle = computed(() => {
  switch (shareScope.value) {
    case 'ALL': return '分享链接'
    case 'MEMBERS': return '选择用户'
    case 'ORG': return '选择组织'
    case 'SPACE': return '选择空间'
    default: return ''
  }
})

const shareScope = ref<ShareScope>('NONE')
const memberIds = ref<string[]>([])
const orgCodes = ref<string[]>([])
const spaceCodes = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)

// ---- 用户 ----
const users = ref<UserItem[]>([])
const userSearching = ref(false)
let userSeq = 0
let userTimer: ReturnType<typeof setTimeout> | undefined

async function searchUsers(keyword = '') {
  const seq = ++userSeq
  userSearching.value = true
  try {
    const res = await queryUsers({ keyword: keyword.trim(), isActive: 1, page: 1, pageSize: 50 })
    if (seq !== userSeq) return
    users.value = res?.success ? res.data?.list || [] : []
  } catch {
    if (seq === userSeq) users.value = []
  } finally {
    if (seq === userSeq) userSearching.value = false
  }
}

function onUserSearch(keyword: string) {
  clearTimeout(userTimer)
  userTimer = setTimeout(() => searchUsers(keyword), 300)
}

/** 已选用户不在搜索结果里时用 memberId 兜底，保证回显 */
const userOptions = computed<UserItem[]>(() => {
  const map = new Map(users.value.map(u => [personKey(u), u]))
  for (const id of memberIds.value) {
    if (!map.has(id)) map.set(id, { memberId: id, userNo: id, isActive: 1 } as UserItem)
  }
  return [...map.values()]
})

// person 工具接收 Record<string, unknown>，UserItem 是 interface，这里做一次收窄
const asPerson = (u: UserItem) => u as unknown as Record<string, unknown>
const labelOf = (u: UserItem) => personLabel(asPerson(u)) || personKey(u)
const avatarOf = (u: UserItem) => personAvatar(asPerson(u))
const initialOf = (u: UserItem) => personInitial(asPerson(u))

// ---- 组织（勾选父组织即包含下级） ----
const orgTree = ref<OrganizationNode[]>([])
const orgTreeData = computed(() => mapOrg(orgTree.value))

function mapOrg(nodes: OrganizationNode[]): any[] {
  return nodes
    .filter(n => !!n.organizationCode)
    .map(n => ({ ...n, children: n.children?.length ? mapOrg(n.children) : undefined }))
}

async function loadOrgTree() {
  try {
    const res = await getOrganizationTree()
    orgTree.value = res?.success ? res.data || [] : []
  } catch {
    orgTree.value = []
  }
}

// ---- 空间 ----
const spaces = ref<{ spaceCode: string; spaceName: string }[]>([])
async function loadSpaces() {
  try {
    const res = await querySpaceOptions()
    spaces.value = res?.success ? res.data || [] : []
  } catch {
    spaces.value = []
  }
}

// ---- 链接 ----
/** 视图类型：list 类型走「我的事项」路由，其余走视图路由 */
const viewType = ref('')
const shareUrl = computed(() => {
  const code = encodeURIComponent(props.filterCode)
  const path = viewType.value === 'list'
    ? `/workbench/todo?filterCode=${code}`
    : `/workbench/view/${code}`
  // qiankun / hash 模式下保留 hash 路由
  return location.hash ? `${location.origin}${location.pathname}#${path}` : `${location.origin}${path}`
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    message.success('链接已复制')
  } catch {
    message.warning('复制失败，请手动选择链接复制')
  }
}

/** 聚焦链接输入框时全选，方便手动复制 */
function onLinkFocus(e: Event) {
  ;(e.target as HTMLInputElement).select()
}

// ---- 打开：加载详情 + 回填 ----
function reset() {
  shareScope.value = 'NONE'
  viewType.value = ''
  memberIds.value = []
  orgCodes.value = []
  spaceCodes.value = []
  users.value = []
}

watch(() => props.open, async (open) => {
  if (!open) return
  reset()
  loading.value = true
  try {
    const [detail] = await Promise.all([
      getViewDetail(props.filterCode),
      loadOrgTree(),
      loadSpaces(),
      searchUsers(''),
    ])
    const data = detail?.data
    viewType.value = data?.viewType || ''
    const scope = (data?.shareScope || 'NONE') as ShareScope
    shareScope.value = SCOPES.some(s => s.value === scope) ? scope : 'NONE'
    const values = data?.shareValues || data?.shareMemberIds || []
    if (scope === 'MEMBERS') memberIds.value = [...values]
    if (scope === 'ORG') orgCodes.value = [...values]
    if (scope === 'SPACE') spaceCodes.value = [...values]
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  const values =
    shareScope.value === 'MEMBERS' ? memberIds.value
      : shareScope.value === 'ORG' ? orgCodes.value
        : shareScope.value === 'SPACE' ? spaceCodes.value
          : []
  if (['MEMBERS', 'ORG', 'SPACE'].includes(shareScope.value) && !values.length) {
    message.warning('请选择要分享的对象')
    return
  }
  saving.value = true
  try {
    const res = await shareView({
      filterCode: props.filterCode,
      shareScope: shareScope.value,
      values: [...values],
    })
    if (res?.success) {
      message.success('分享设置已保存')
      emit('saved')
      drawerOpen.value = false
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <a-drawer
    v-model:open="drawerOpen"
    :width="480"
    :closable="false"
    destroy-on-close
    class="view-share-drawer"
  >
    <!-- 自定义标题栏 -->
    <template #title>
      <div class="vs-topbar">
        <div class="vs-topbar-text">
          <div class="vs-topbar-title">分享视图</div>
          <div class="vs-topbar-sub" :title="props.filterName || props.filterCode">
            {{ props.filterName || props.filterCode }}
          </div>
        </div>
        <button type="button" class="vs-close" aria-label="关闭" @click="drawerOpen = false">
          <CloseOutlined />
        </button>
      </div>
    </template>

    <a-spin :spinning="loading">
      <div class="vs-body">
        <!-- 权限说明 -->
        <section class="vs-card vs-intro">
          <span class="vs-intro-icon"><LockOutlined /></span>
          <div class="vs-intro-text">
            <div class="vs-intro-title">默认仅你可见</div>
            <div class="vs-intro-desc">选择共享范围后，对应成员可通过链接查看。被分享人只读，不能修改视图。</div>
          </div>
        </section>

        <!-- 谁能访问 -->
        <section class="vs-section">
          <h4 class="vs-section-title">谁能访问</h4>
          <div class="vs-scope-list">
            <button
              v-for="s in SCOPES"
              :key="s.value"
              type="button"
              class="vs-scope-item"
              :class="{ active: shareScope === s.value }"
              @click="shareScope = s.value"
            >
              <span class="vs-scope-icon"><component :is="s.icon" /></span>
              <span class="vs-scope-text">
                <span class="vs-scope-name">{{ s.label }}</span>
                <span class="vs-scope-desc">{{ s.desc }}</span>
              </span>
              <span class="vs-radio" :class="{ checked: shareScope === s.value }" aria-hidden="true">
                <span class="vs-radio-dot" />
              </span>
            </button>
          </div>
        </section>

        <!-- 展开配置 -->
        <section v-if="shareScope !== 'NONE'" class="vs-section">
          <h4 class="vs-section-title">{{ detailTitle }}</h4>
          <div class="vs-detail-card">
            <!-- 链接分享 -->
            <template v-if="shareScope === 'ALL'">
              <div class="vs-link-row">
                <LinkOutlined class="vs-link-icon" />
                <input class="vs-link-input" :value="shareUrl" readonly @focus="onLinkFocus" />
                <button type="button" class="vs-copy-btn" @click="copyLink"><CopyOutlined /> 复制</button>
              </div>
              <div class="vs-detail-hint">所有登录用户打开该链接即可查看</div>
            </template>

            <!-- 指定用户 -->
            <template v-else-if="shareScope === 'MEMBERS'">
              <a-select
                v-model:value="memberIds"
                mode="multiple"
                show-search
                :filter-option="false"
                :loading="userSearching"
                placeholder="搜索姓名 / 账号"
                class="vs-select"
                @search="onUserSearch"
              >
                <a-select-option v-for="u in userOptions" :key="personKey(u)" :value="personKey(u)">
                  <span class="vs-user">
                    <a-avatar :src="avatarOf(u) || undefined" :size="18">{{ initialOf(u) }}</a-avatar>
                    <span>{{ labelOf(u) }}</span>
                  </span>
                </a-select-option>
              </a-select>
              <div class="vs-detail-hint">支持搜索姓名或账号，可多选</div>
            </template>

            <!-- 指定组织 -->
            <template v-else-if="shareScope === 'ORG'">
              <div class="vs-tree">
                <a-tree
                  v-model:checkedKeys="orgCodes"
                  :tree-data="orgTreeData"
                  checkable
                  default-expand-all
                  :selectable="false"
                  :field-names="{ key: 'organizationCode', title: 'organizationName', children: 'children' }"
                />
                <a-empty v-if="!orgTreeData.length" description="暂无组织" />
              </div>
              <div class="vs-detail-hint">勾选组织即包含其所有下级成员</div>
            </template>

            <!-- 指定空间 -->
            <template v-else-if="shareScope === 'SPACE'">
              <a-select
                v-model:value="spaceCodes"
                mode="multiple"
                show-search
                option-filter-prop="label"
                placeholder="选择空间"
                class="vs-select"
              >
                <a-select-option v-for="s in spaces" :key="s.spaceCode" :value="s.spaceCode" :label="s.spaceName">
                  {{ s.spaceName }}
                </a-select-option>
              </a-select>
            </template>
          </div>
        </section>
      </div>
    </a-spin>

    <!-- 底部操作栏 -->
    <template #footer>
      <div class="vs-footer">
        <span class="vs-footer-hint">仅创建人可以修改分享设置</span>
        <div class="vs-footer-actions">
          <a-button class="vs-btn" @click="drawerOpen = false">取消</a-button>
          <a-button class="vs-btn" type="primary" :loading="saving" @click="handleSave">保存</a-button>
        </div>
      </div>
    </template>
  </a-drawer>
</template>

<style scoped>
/* ---- 抽屉骨架：内容浅灰分组背景，头尾白色 ---- */
:global(.view-share-drawer .ant-drawer-content) {
  background: #f5f5f7;
}
:global(.view-share-drawer .ant-drawer-header) {
  padding: 18px 22px 14px;
  background: #fff;
  border-bottom: 1px solid #ededf0;
}
:global(.view-share-drawer .ant-drawer-title) {
  width: 100%;
}
:global(.view-share-drawer .ant-drawer-body) {
  padding: 16px 20px 24px;
  background: #f5f5f7;
}
:global(.view-share-drawer .ant-drawer-footer) {
  padding: 0;
  background: #fff;
  border-top: 1px solid #ededf0;
}

/* ---- 标题栏 ---- */
.vs-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.vs-topbar-text {
  min-width: 0;
}
.vs-topbar-title {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #1d1d1f;
}
.vs-topbar-sub {
  max-width: 360px;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  color: #86868b;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vs-close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 13px;
  color: #6e6e73;
  background: #f2f2f7;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.vs-close:hover {
  color: #1d1d1f;
  background: #e8e8ed;
}

/* ---- 内容 ---- */
.vs-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.vs-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.vs-section-title {
  margin: 0;
  padding-left: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #86868b;
}

/* 权限说明卡 */
.vs-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.vs-intro-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 16px;
  color: var(--c-primary);
  background: var(--c-primary-bg);
  border-radius: 10px;
}
.vs-intro-text {
  min-width: 0;
}
.vs-intro-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d1d1f;
}
.vs-intro-desc {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.6;
  color: #86868b;
}

/* 范围列表：卡片式单选 */
.vs-scope-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vs-scope-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  text-align: left;
  background: #fff;
  border: 1px solid transparent;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.vs-scope-item:hover {
  border-color: #e3e3e8;
}
.vs-scope-item.active {
  background: var(--c-primary-bg);
  border-color: var(--c-primary-border);
}
.vs-scope-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 15px;
  color: #6e6e73;
  background: #f2f2f7;
  border-radius: 9px;
  transition: background 0.15s, color 0.15s;
}
.vs-scope-item.active .vs-scope-icon {
  color: var(--c-primary);
  background: #fff;
}
.vs-scope-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.vs-scope-name {
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}
.vs-scope-desc {
  font-size: 12px;
  color: #86868b;
}
.vs-radio {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1.5px solid #d1d1d6;
  border-radius: 50%;
  transition: border-color 0.15s, background 0.15s;
}
.vs-radio.checked {
  background: var(--c-primary);
  border-color: var(--c-primary);
}
.vs-radio-dot {
  width: 7px;
  height: 7px;
  background: #fff;
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.4);
  transition: opacity 0.15s, transform 0.15s;
}
.vs-radio.checked .vs-radio-dot {
  opacity: 1;
  transform: scale(1);
}

/* 展开配置卡片 */
.vs-detail-card {
  padding: 14px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.vs-detail-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #aeaeb2;
}
.vs-link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #f5f5f7;
  border-radius: 10px;
}
.vs-link-icon {
  flex: none;
  font-size: 15px;
  color: #86868b;
}
.vs-link-input {
  flex: 1;
  min-width: 0;
  padding: 0;
  font-size: 12px;
  color: #1d1d1f;
  background: transparent;
  border: none;
  outline: none;
}
.vs-copy-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--c-primary);
  background: #fff;
  border: none;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  transition: background 0.15s;
}
.vs-copy-btn:hover {
  background: var(--c-primary-bg);
}
.vs-select {
  width: 100%;
}
.vs-select :deep(.ant-select-selector) {
  border-radius: 10px !important;
}
.vs-tree {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
  background: #f5f5f7;
  border-radius: 10px;
}
.vs-tree :deep(.ant-tree) {
  background: transparent;
}
.vs-tree :deep(.ant-tree-checkbox-checked .ant-tree-checkbox-inner) {
  background: var(--c-primary);
  border-color: var(--c-primary);
}
.vs-user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 底部操作栏 */
.vs-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
}
.vs-footer-hint {
  font-size: 11px;
  color: #aeaeb2;
}
.vs-footer-actions {
  display: flex;
  gap: 10px;
}
.vs-btn {
  min-width: 80px;
  height: 34px;
  border-radius: 10px;
}
</style>
