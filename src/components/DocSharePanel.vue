<template>
  <div class="doc-share-panel">
    <div class="dsp-header">
      <div class="dsp-title">
        <span>分享文档</span>
        <a-tooltip title="协作者可以查看该文档；链接分享开启后，符合范围的人打开链接即可查看">
          <QuestionCircleOutlined class="dsp-help" />
        </a-tooltip>
      </div>
      <button type="button" class="dsp-settings" @click="onSettingsClick">
        <SettingOutlined />
        <span>权限设置</span>
      </button>
    </div>

    <div v-if="!loaded" class="dsp-loading">
      <span v-if="loadFailed" class="dsp-muted">分享信息加载失败，请稍后重试</span>
      <a-spin v-else size="small" />
    </div>

    <template v-else>
      <!-- 邀请协作者 -->
      <div class="dsp-section">
        <div class="dsp-row">
          <span class="dsp-label">邀请协作者</span>
          <div class="dsp-row-end">
            <a-avatar-group v-if="collaborators.length" :max-count="4">
              <a-avatar
                v-for="m in collaborators"
                :key="m.memberId"
                size="small"
                :src="personAvatar(asPerson(m)) || undefined"
                :style="{ backgroundColor: colorOf(m.memberId) }"
              >
                {{ personInitial(asPerson(m)) }}
              </a-avatar>
            </a-avatar-group>
            <span v-else class="dsp-muted">暂无协作者</span>
            <button
              type="button"
              class="dsp-toggle"
              :aria-expanded="expanded ? 'true' : 'false'"
              aria-label="展开或收起协作者列表"
              @click="expanded = !expanded"
            >
              <RightOutlined class="dsp-chevron" :class="{ open: expanded }" />
            </button>
          </div>
        </div>

        <ul v-if="expanded" class="dsp-members">
          <li v-for="m in collaborators" :key="m.memberId" class="dsp-member">
            <a-avatar
              size="small"
              :src="personAvatar(asPerson(m)) || undefined"
              :style="{ backgroundColor: colorOf(m.memberId) }"
            >
              {{ personInitial(asPerson(m)) }}
            </a-avatar>
            <div class="dsp-member-info">
              <span class="dsp-member-name">{{ personName(asPerson(m)) || m.memberId }}</span>
              <span v-if="personAccount(asPerson(m))" class="dsp-member-sub">{{ personAccount(asPerson(m)) }}</span>
            </div>
            <a-select
              v-if="owner"
              class="dsp-member-perm"
              size="small"
              :bordered="false"
              :value="m.permission ?? 'READ'"
              :options="PERMISSION_OPTIONS"
              :disabled="saving"
              :get-popup-container="popupContainer"
              @change="(v: DocPermission) => changePermission(m.memberId, v)"
            />
            <span v-else class="dsp-perm-text">{{ permissionLabel(m.permission) }}</span>
            <button
              v-if="owner"
              type="button"
              class="dsp-remove"
              :disabled="saving"
              @click="removeCollaborator(m.memberId)"
            >
              移除
            </button>
          </li>
          <li v-if="!collaborators.length" class="dsp-muted dsp-members-empty">还没有协作者</li>
        </ul>

        <div class="dsp-invite">
        <a-select
          class="dsp-select"
          mode="multiple"
          :bordered="false"
          :value="pendingIds"
          :search-value="searchText"
          show-search
          :filter-option="false"
          :disabled="!owner || saving"
          :loading="searching"
          :options="selectOptions"
          :get-popup-container="popupContainer"
          :not-found-content="searchText.trim() ? '未找到用户' : '输入姓名或工号搜索'"
          placeholder="可搜索用户名添加协作者"
          @search="onSearch"
          @select="onPickMember"
          @deselect="onUnpickMember"
        >
          <template #option="item">
            <div class="dsp-option">
              <a-avatar
                size="small"
                :src="item.avatarUrl || undefined"
                :style="{ backgroundColor: colorOf(item.memberId) }"
              >
                {{ personInitial(asPerson(item)) }}
              </a-avatar>
              <span class="dsp-option-name">{{ item.label }}</span>
            </div>
          </template>
        </a-select>
        <!-- 权限：选中框右侧，默认可阅读；作用于本次选中的所有协作者 -->
        <a-select
          class="dsp-perm-select"
          :bordered="false"
          :value="newPermission"
          :options="PERMISSION_OPTIONS"
          :disabled="!owner || saving"
          :get-popup-container="popupContainer"
          @change="onNewPermissionChange"
        />
        </div>
        <div v-if="pendingIds.length" class="dsp-invite-actions">
          <button type="button" class="dsp-cancel" :disabled="saving" @click="clearPending">取消</button>
          <button type="button" class="dsp-send" :disabled="saving" @click="addPending">添加协作者</button>
        </div>
      </div>

      <!-- 链接分享 -->
      <div class="dsp-section">
        <span class="dsp-label">链接分享</span>
        <div class="dsp-link-row">
          <div class="dsp-link-icon">
            <TeamOutlined />
          </div>
          <div class="dsp-link-main">
            <a-dropdown :disabled="!owner || saving" trigger="click" :get-popup-container="popupContainer">
              <button type="button" class="dsp-link-trigger" :disabled="!owner || saving">
                <span>{{ currentLink.label }}</span>
                <DownOutlined v-if="owner" class="dsp-caret" />
              </button>
              <template #overlay>
                <a-menu :selected-keys="[linkScope]" @click="onLinkScopeClick">
                  <a-menu-item v-for="o in LINK_OPTIONS" :key="o.value">{{ o.label }}</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <div class="dsp-link-hint">{{ currentLink.hint }}</div>
          </div>
        </div>
      </div>

      <div v-if="!owner" class="dsp-readonly">仅创建人可修改分享设置</div>
    </template>

    <div class="dsp-footer">
      <button type="button" class="dsp-copy" @click="copyLink">
        <LinkOutlined />
        <span>复制链接</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  DownOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'
import {
  getDocShareInfo,
  setDocCollaborators,
  setDocLinkScope,
  type DocLinkScope,
  type DocPermission,
  type DocShareMember,
} from '@/api/docs'
import { queryUsers } from '@/api/faiz'
import { PRESET_COLORS } from '@/config/colors'
import { useAuth } from '@/utils/auth'
import { docSharePanelOpen } from '@/utils/doc-share'
import { personAccount, personAvatar, personInitial, personLabel, personName, type PersonLike } from '@/utils/person'

const props = defineProps<{ docId: string }>()

/** 搜索结果（下拉选项） */
interface SearchOption {
  value: string
  label: string
  memberId: string
  realName?: string
  coAccount?: string
  avatarUrl?: string
}

/** 链接分享选项：文案与灰色提示 */
const LINK_OPTIONS: { value: DocLinkScope; label: string; hint: string }[] = [
  { value: 'OFF', label: '未开启', hint: '仅协作者可访问' },
  { value: 'ORG', label: '组织内可访问', hint: '组织内成员可访问' },
  { value: 'ALL', label: '所有人可访问', hint: '所有人可访问（拿到链接即可查看）' },
]

const loaded = ref(false)
const loadFailed = ref(false)
/** 当前用户是否为创建人：只有创建人能修改协作者与链接分享 */
const owner = ref(false)
const collaborators = ref<DocShareMember[]>([])
const linkScope = ref<DocLinkScope>('OFF')
const expanded = ref(false)
/** 写操作进行中：禁止重复提交 */
const saving = ref(false)

/** 权限选项：可管理 / 可编辑 / 可阅读（默认可阅读） */
const PERMISSION_OPTIONS: { value: DocPermission; label: string }[] = [
  { value: 'MANAGE', label: '可管理' },
  { value: 'EDIT', label: '可编辑' },
  { value: 'READ', label: '可阅读' },
]
function permissionLabel(p?: DocPermission): string {
  return PERMISSION_OPTIONS.find((o) => o.value === (p ?? 'READ'))?.label ?? '可阅读'
}

/** 待添加的协作者（多选）与本次统一的权限，默认可阅读 */
const pendingIds = ref<string[]>([])
const pendingPeople = new Map<string, SearchOption>()
const newPermission = ref<DocPermission>('READ')
const searchText = ref('')
const searchOptions = ref<SearchOption[]>([])
const searching = ref(false)

const { user: authUser } = useAuth()
const router = useRouter()

/** 搜索结果里不再展示：本人与已是协作者的人 */
const excludedIds = computed(() => {
  const ids = [authUser.value?.memberId, ...collaborators.value.map((m) => m.memberId)]
  return new Set(ids.filter((id): id is string => Boolean(id)))
})

const currentLink = computed(() => LINK_OPTIONS.find((o) => o.value === linkScope.value) ?? LINK_OPTIONS[0])

/** 人员工具函数接收宽松的 Record 类型，这里把具名接口转成普通对象 */
function asPerson(p: object): PersonLike {
  return { ...p } as Record<string, unknown>
}

/** 无头像时的占位底色：按 memberId 稳定取色，同一人颜色一致 */
function colorOf(key: string): string {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PRESET_COLORS[hash % PRESET_COLORS.length]
}

/** 下拉与选择框的浮层挂在面板内部，避免点击选项时被当作点击外部而关闭分享面板 */
function popupContainer(node: HTMLElement): HTMLElement {
  return node.parentElement ?? document.body
}

let infoSeq = 0

/** 读取分享信息；面板展开时才请求，不在应用启动时加载 */
async function loadInfo() {
  const seq = ++infoSeq
  try {
    const res = await getDocShareInfo(props.docId)
    if (seq !== infoSeq) return
    if (!res.success || !res.data) {
      loadFailed.value = true
      return
    }
    owner.value = res.data.owner
    collaborators.value = res.data.collaborators ?? []
    linkScope.value = res.data.linkScope ?? 'OFF'
    loaded.value = true
    loadFailed.value = false
  } catch {
    // 请求层已统一提示
    if (seq === infoSeq) loadFailed.value = true
  }
}

onMounted(() => {
  if (docSharePanelOpen.value) void loadInfo()
})

// 面板每次展开都重新读取，保证显示的是最新的协作者与链接状态
watch(docSharePanelOpen, (open) => {
  if (open) void loadInfo()
})

watch(
  () => props.docId,
  () => {
    loaded.value = false
    loadFailed.value = false
    collaborators.value = []
    expanded.value = false
    clearPending()
    if (docSharePanelOpen.value) void loadInfo()
  },
)

/** 写操作统一入口：写入中禁止重复提交，完成后重新读取分享信息 */
async function runWrite(task: () => Promise<unknown>) {
  if (saving.value) return
  saving.value = true
  try {
    await task()
    await loadInfo()
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

/** 当前协作者（带权限，缺省为可阅读）整体覆盖保存 */
function currentCollaboratorItems(): { memberId: string; permission: DocPermission }[] {
  return collaborators.value.map((m) => ({ memberId: m.memberId, permission: m.permission ?? 'READ' }))
}

function saveCollaborators(items: { memberId: string; permission: DocPermission }[]) {
  return runWrite(() => setDocCollaborators({ id: props.docId, collaborators: items }))
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0

/** 输入防抖后按关键字搜索用户（POST /user/query）；过期的结果直接丢弃 */
function onSearch(value: string) {
  searchText.value = value
  searchSeq++
  if (searchTimer) clearTimeout(searchTimer)
  const keyword = value.trim()
  if (!keyword) {
    searchOptions.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(() => void runSearch(keyword), 300)
}

async function runSearch(keyword: string) {
  const seq = ++searchSeq
  searching.value = true
  try {
    const res = await queryUsers({ keyword, page: 1, pageSize: 10 })
    if (seq !== searchSeq) return
    const list = res.success ? res.data?.list ?? [] : []
    searchOptions.value = list
      .filter((u) => Boolean(u.memberId) && !excludedIds.value.has(u.memberId ?? ''))
      .map((u) => ({
        value: u.memberId ?? '',
        memberId: u.memberId ?? '',
        label: personLabel(asPerson(u)),
        realName: u.realName,
        coAccount: u.coAccount ?? u.userCoAccount,
        avatarUrl: u.avatarUrl ?? u.userAvatar,
      }))
  } catch {
    // 请求层已统一提示
    if (seq === searchSeq) searchOptions.value = []
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

onBeforeUnmount(() => {
  // 面板随页面销毁（如离开文档页）时收起开关，避免下次进入文档页时自动弹出
  docSharePanelOpen.value = false
  if (searchTimer) clearTimeout(searchTimer)
})

/** 多选：选中一个用户加入待添加列表，清空搜索词（可继续选别人） */
function onPickMember(value: unknown) {
  const memberId = String(value ?? '')
  // 先记下这个人的名称（清空搜索结果之后就找不到了）
  const person = searchOptions.value.find((o) => o.value === memberId)
  searchSeq++
  searchText.value = ''
  searchOptions.value = []
  if (!owner.value || !memberId || excludedIds.value.has(memberId)) return
  if (person) pendingPeople.set(memberId, person)
  if (!pendingIds.value.includes(memberId)) pendingIds.value = [...pendingIds.value, memberId]
}

/** 多选框的选项：已选的人（保证能显示名字）+ 当前搜索结果 */
const selectOptions = computed<SearchOption[]>(() => {
  const picked = pendingIds.value
    .map((id) => pendingPeople.get(id))
    .filter((o): o is SearchOption => Boolean(o))
  const seen = new Set(picked.map((o) => o.value))
  return [...picked, ...searchOptions.value.filter((o) => !seen.has(o.value))]
})

/** 多选：取消选中 */
function onUnpickMember(value: unknown) {
  const memberId = String(value ?? '')
  pendingIds.value = pendingIds.value.filter((id) => id !== memberId)
  pendingPeople.delete(memberId)
}

function clearPending() {
  pendingIds.value = []
  pendingPeople.clear()
}

/** 权限下拉改动：只影响之后要添加的协作者 */
function onNewPermissionChange(value: unknown) {
  newPermission.value = (value as DocPermission) ?? 'READ'
}

/** 把待添加的协作者按统一权限加入列表 */
async function addPending() {
  if (!owner.value || !pendingIds.value.length) return
  const added = pendingIds.value.map((memberId) => ({ memberId, permission: newPermission.value }))
  await saveCollaborators([...currentCollaboratorItems(), ...added])
  clearPending()
}

/** 修改已有协作者的权限 */
function changePermission(memberId: string, permission: DocPermission) {
  if (!owner.value) return
  saveCollaborators(
    currentCollaboratorItems().map((m) => (m.memberId === memberId ? { ...m, permission } : m)),
  )
}

async function removeCollaborator(memberId: string) {
  if (!owner.value) return
  await saveCollaborators(currentCollaboratorItems().filter((m) => m.memberId !== memberId))
}

function onLinkScopeClick({ key }: { key: string | number }) {
  const scope = String(key) as DocLinkScope
  if (!owner.value || scope === linkScope.value) return
  void runWrite(() => setDocLinkScope({ id: props.docId, scope }))
}

/** 复制文档链接（与原顶栏分享按钮的逻辑一致） */
async function copyLink() {
  const href = router.resolve({ name: 'WikiDoc', params: { docId: props.docId } }).href
  try {
    await navigator.clipboard.writeText(`${location.origin}${href}`)
    message.success('链接已复制，粘贴给协作者即可分享')
  } catch {
    message.warning('复制失败，请手动复制地址栏链接')
  }
}

function onSettingsClick() {
  message.info('权限设置即将开放')
}
</script>

<style scoped>
/* 浮层规范：外层 popover 的内边距已在 AppHeader 中去掉，内边距与分区由面板自己负责 */
.doc-share-panel {
  position: relative;
  width: 400px;
  max-width: calc(100vw - 32px);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
  color: var(--docs-text);
  font-size: 14px;
  line-height: 1.5;
}

.dsp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 8px;
}

.dsp-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--docs-text);
}

.dsp-help {
  color: var(--docs-text-3);
  font-size: 14px;
  cursor: help;
}

.dsp-settings {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: none;
  border-radius: var(--docs-radius);
  background: transparent;
  color: var(--docs-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.dsp-settings:hover {
  background: var(--docs-hover);
  color: var(--docs-text);
}

.dsp-loading {
  display: flex;
  justify-content: center;
  padding: 24px 16px;
}

/* 分区：内边距统一；分区之间用细线分隔 */
.dsp-section {
  position: relative;
  padding: 12px 16px;
}

.dsp-section + .dsp-section {
  border-top: 1px solid var(--docs-border);
}

.dsp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
}

.dsp-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--docs-text-2);
}

.dsp-row-end {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dsp-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--docs-radius-sm);
  background: transparent;
  color: var(--docs-text-3);
  cursor: pointer;
}

.dsp-toggle:hover {
  background: var(--docs-hover);
}

.dsp-chevron {
  font-size: 12px;
  transition: transform 0.15s;
}

.dsp-chevron.open {
  transform: rotate(90deg);
}

.dsp-muted {
  color: var(--docs-text-3);
  font-size: 13px;
}

.dsp-members {
  max-height: 220px;
  margin: 8px 0 0;
  padding: 4px 0;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--docs-border);
  border-radius: var(--docs-radius);
  background: var(--docs-paper);
}

.dsp-member {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
}

.dsp-member-info {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: baseline;
  gap: 6px;
}

.dsp-member-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--docs-text);
}

.dsp-member-sub {
  flex-shrink: 0;
  color: var(--docs-text-3);
  font-size: 12px;
}

.dsp-members-empty {
  padding: 8px 10px;
}

.dsp-remove {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--docs-danger);
  font-size: 13px;
  cursor: pointer;
}

.dsp-remove:disabled {
  color: var(--docs-text-3);
  cursor: not-allowed;
}

/* 头像：圆形 28px（antd 的 small 为 24px）；无头像时的底色仍由 colorOf 按 memberId 决定 */
.dsp-section :deep(.ant-avatar) {
  width: 28px;
  height: 28px;
  line-height: 28px;
  font-size: 13px;
}

.dsp-select {
  width: 100%;
  margin-top: 12px;
}

/* 输入框：antd 默认的悬停 / 聚焦蓝色描边改为主题浅色描边；选择器加长以压过 antd 同级规则 */
.dsp-select.ant-select:not(.ant-select-disabled):not(.ant-select-customize-input) :deep(.ant-select-selector) {
  border-color: var(--docs-border-strong);
  border-radius: var(--docs-radius);
}
.dsp-select.ant-select:not(.ant-select-disabled):not(.ant-select-customize-input):hover :deep(.ant-select-selector) {
  border-color: var(--docs-text-3);
}
.dsp-select.ant-select:not(.ant-select-disabled):not(.ant-select-customize-input).ant-select-focused :deep(.ant-select-selector) {
  border-color: var(--c-primary-border);
  box-shadow: 0 0 0 2px var(--c-primary-bg);
}

/* 下拉浮层：与面板同一套浮层底色 / 圆角 / 阴影；选中项浅底 + 主色字，悬停用面板浅底 */
.dsp-section :deep(.ant-select-dropdown),
.dsp-section :deep(.ant-dropdown-menu) {
  background: var(--docs-canvas);
  border-radius: var(--docs-radius);
  box-shadow: var(--docs-shadow-float);
}
.dsp-section :deep(.ant-select-item-option-selected:not(.ant-select-item-option-disabled)) {
  background-color: var(--c-primary-bg);
  color: var(--c-primary);
}
.dsp-section :deep(.ant-select-item-option-selected .ant-select-item-option-state) {
  color: var(--c-primary);
}
.dsp-section :deep(.ant-select-item-option-active:not(.ant-select-item-option-disabled)) {
  background-color: var(--docs-hover);
}
.dsp-section :deep(.ant-dropdown-menu-item-selected) {
  background-color: var(--c-primary-bg);
  color: var(--c-primary);
}

.dsp-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dsp-option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--docs-text);
}

.dsp-link-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 8px;
}

.dsp-link-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--c-primary-bg);
  color: var(--c-primary);
  font-size: 14px;
}

.dsp-link-main {
  min-width: 0;
}

.dsp-link-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  margin-left: -8px;
  border: none;
  border-radius: var(--docs-radius);
  background: transparent;
  color: var(--docs-text);
  font-size: 14px;
  cursor: pointer;
}

.dsp-link-trigger:hover:not(:disabled) {
  background: var(--docs-hover);
}

.dsp-link-trigger:disabled {
  color: var(--docs-text-2);
  cursor: not-allowed;
}

.dsp-caret {
  color: var(--docs-text-3);
  font-size: 12px;
}

.dsp-link-hint {
  font-size: 12px;
  color: var(--docs-text-3);
}

.dsp-readonly {
  padding: 0 16px 12px;
  color: var(--docs-text-3);
  font-size: 12px;
}

/* 页脚：浅底 + 上边细线；底部圆角与面板内侧对齐（扣掉 1px 边框） */
.dsp-footer {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--docs-border);
  border-radius: 0 0 calc(var(--docs-radius-lg) - 1px) calc(var(--docs-radius-lg) - 1px);
  background: var(--docs-paper);
}

/* 次按钮：白底 + 1px 描边 */
.dsp-copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius);
  background: var(--docs-canvas);
  color: var(--docs-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
}

.dsp-copy:hover {
  background: var(--docs-hover);
}

/* 邀请协作者：多选框与右侧权限合在一个边框里（参考飞书） */
.dsp-invite {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  padding-right: 4px;
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius);
  background: var(--docs-canvas);
}
.dsp-invite .dsp-select {
  flex: 1;
  min-width: 0;
  margin-top: 0;
}
.dsp-perm-select {
  flex: none;
  width: 92px;
}
.dsp-invite-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.dsp-cancel,
.dsp-send {
  height: 30px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.dsp-cancel {
  color: var(--docs-text);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
}
.dsp-send {
  color: #fff;
  background: var(--c-primary);
  border: none;
}
.dsp-send:disabled,
.dsp-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 已有协作者的权限 */
.dsp-member-perm {
  flex: none;
  width: 88px;
}
.dsp-perm-text {
  flex: none;
  font-size: 13px;
  color: var(--docs-text-3);
}
</style>
