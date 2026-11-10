<template>
  <header class="app-header">
    <!-- 文档详情：顶栏最左侧文件名（上，可直接改名）+ 保存状态轻提示（下），参考飞书；文档/表格/思维导图/流程图共用 -->
    <div v-if="isDocs && docsActiveDoc" class="docs-head-meta">
      <input
        v-model="docsActiveDoc.title"
        class="docs-head-title"
        placeholder="无标题文档"
        maxlength="120"
        @input="docsTitleRev++"
      />
      <span class="docs-save-state" :class="`is-${docsSaveState}`">{{ docsSaveStateText }}</span>
    </div>
    <div class="header-left" :class="{ collapsed: sidebarCollapsed, 'no-logo': isDesktop }">
      <!-- 文档页侧栏折叠时：左侧菜单消失，展开入口固定在顶栏最左侧 -->
      <button v-if="isDocs && docsSideCollapsed" type="button" class="docs-side-expand" title="展开菜单" @click="docsSideCollapsed = false">
        <MenuUnfoldOutlined />
      </button>
      <!-- 左上角菜单入口：点击弹出一级菜单（文档页已移至左侧文档菜单 Logo 左侧） -->
      <AppNavPopover v-if="!isDocs" />

      <!-- 空间切换（仅工作台）：与折叠按钮互换 -->
      <div v-if="isWorkbench" class="header-space">
        <HeaderSpaceSwitcher />
      </div>

      <div class="header-left-right">
        <a-divider v-if="!hideSidebarToggle" type="vertical" class="header-divider" />
        <component :is="sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined" v-if="!hideSidebarToggle" class="header-fold-icon" @click="$emit('toggle-sidebar')" />
      </div>
    </div>

    <!-- 公告横幅（上下滚动轮播，内容见 @/config/banner）；文档页不显示 -->
    <HeaderBanner v-if="!isDocs" />

    <div class="header-center" v-if="false">
      <div class="workspace-btn" @click="$emit('workspace-click')">
        <HomeOutlined />
        <span>控制台</span>
      </div>
    </div>

    <div class="header-right">
      <!-- 文档详情：分享 / 编辑（原详情页工具条按钮，移至顶栏） -->
      <template v-if="isDocs && docsActiveDoc">
        <button type="button" class="docs-share" @click="shareDoc">
          <ShareAltOutlined /> 分享
        </button>
        <a-dropdown trigger="click" placement="bottomRight">
          <button type="button" class="docs-edit-btn">
            <EditOutlined v-if="docsEditMode" />
            <EyeOutlined v-else />
            {{ docsEditMode ? '编辑' : '预览' }}
            <CaretDownOutlined class="docs-edit-caret" />
          </button>
          <template #overlay>
            <a-menu :selected-keys="[docsEditMode ? 'edit' : 'preview']" @click="onEditModeMenu">
              <a-menu-item key="edit"><EditOutlined /> 编辑模式</a-menu-item>
              <a-menu-item key="preview"><EyeOutlined /> 预览模式</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </template>
      <!-- 文档页：一级菜单入口移至头像左侧（顶栏左上角不再显示） -->
      <AppNavPopover v-if="isDocs" class="header-nav-right" placement="bottomRight" />
      <!-- 搜索框 + 自控下拉面板（不用 a-dropdown：受控 open 会被组件内部重置，结果有数据也不弹出） -->
      <div v-if="isWorkbench" class="header-search-wrap">
        <a-input
          v-model:value="searchValue"
          :placeholder="searchPlaceholder"
          class="header-search"
          allow-clear
          @focus="onSearchFocus"
          @blur="onSearchBlur"
          @press-enter="handleEnter"
          @keydown="onSearchKeydown"
        >
          <template #prefix>
            <SearchOutlined style="color: #bbb" />
          </template>
        </a-input>
        <div v-if="dropdownOpen" class="search-panel" @mousedown.prevent>
          <!-- 有输入：搜索结果（参考 Google / Spotlight：单行、灰色辅助信息、命中词加粗） -->
          <div v-if="searchValue.trim()" class="sp-body">
            <div v-if="fuzzyResults.length" class="sp-section">
              问题<span v-if="scopeSpaceName" class="sp-scope"> · {{ scopeSpaceName }}</span>
            </div>
            <div v-if="fuzzyResults.length" class="sp-list">
              <div
                v-for="(item, i) in fuzzyResults"
                :key="item.issueKey"
                :class="['sp-item', { 'is-active': i === activeIndex }]"
                @mouseenter="activeIndex = i"
                @click="openIssue(item)"
              >
                <span
                  class="sp-icon"
                  :style="{ color: item.issueTypeColor || '#8c8c8c', background: `${item.issueTypeColor || '#8c8c8c'}1f` }"
                  :title="item.issueTypeName"
                ><component :is="issueTypeIconOf()" /></span>
                <div class="sp-text">
                  <div class="sp-title" :title="item.summary">
                    <template v-for="(seg, k) in highlight(item.summary || '（无概要）')" :key="k">
                      <b v-if="seg.hit">{{ seg.text }}</b><template v-else>{{ seg.text }}</template>
                    </template>
                  </div>
                  <div class="sp-sub">
                    <template v-for="(seg, k) in highlight(item.issueKey)" :key="k">
                      <b v-if="seg.hit">{{ seg.text }}</b><template v-else>{{ seg.text }}</template>
                    </template>
                  </div>
                </div>
                <span
                  v-if="item.statusName"
                  class="sp-status"
                  :style="item.statusColor ? { color: item.statusColor, background: `${item.statusColor}14` } : undefined"
                >{{ item.statusName }}</span>
              </div>
            </div>
            <div v-else-if="fuzzyLoading" class="sp-empty">搜索中…</div>
            <div v-else class="sp-empty">
              {{ scopeSpaceName ? `在「${scopeSpaceName}」中没有找到相关问题` : '没有找到相关问题' }}
            </div>
          </div>
          <!-- 未输入：搜索提示 -->
          <div v-else class="sp-body">
            <div class="sp-empty">
              {{ scopeSpaceName ? `在「${scopeSpaceName}」中搜索问题单号或概要` : '输入问题单号或概要' }}
            </div>
          </div>
          <!-- 最近搜索 / 最近访问：暂时隐藏（数据为占位，待接入真实记录后恢复）
          <div v-else class="search-dropdown">
            <div class="search-dropdown-section">
              <div class="search-dropdown-title">最近搜索</div>
              <div class="search-dropdown-tags">
                <span
                  v-for="item in recentSearches"
                  :key="item"
                  class="search-tag"
                  @mousedown.prevent
                  @click="handleSelect(item)"
                >{{ item }}</span>
              </div>
            </div>
            <div class="search-dropdown-divider" />
            <div class="search-dropdown-section">
              <div class="search-dropdown-title">最近访问</div>
              <div class="search-dropdown-list">
                <div
                  v-for="item in recentVisits"
                  :key="item"
                  class="search-dropdown-item"
                  @mousedown.prevent
                  @click="handleSelect(item)"
                >
                  <DragOutlined style="color: #bbb; margin-right: 8px;" />
                  <span>{{ item }}</span>
                </div>
              </div>
            </div>
          </div>
          -->
        </div>
      </div>

      <button v-if="isWorkbench" class="header-create-btn" @click="$emit('create-click')">
        <PlusOutlined />
        <span class="create-label">新建</span>
      </button>

      <!-- 用户菜单：自绘浮层（不受点击页面其它位置影响，仅点头像或菜单项收起） -->
      <div ref="userDropdownRef" class="user-dropdown-wrap">
        <div class="user-trigger" :class="{ active: userPopoverOpen }" @click="toggleUserPopover">
          <a-avatar :size="30" :src="avatarSrc" class="user-avatar" :load-error="onAvatarError">
            {{ userInitials }}
          </a-avatar>
          <span class="user-name">{{ username }}</span>
          <DownOutlined class="user-caret" />
        </div>
        <div v-if="userPopoverOpen" class="user-dropdown-popover user-dropdown-float">
          <div class="user-panel">
            <div class="user-panel-header">
              <a-avatar :size="48" :src="avatarSrc" class="user-panel-avatar" :load-error="onAvatarError">
                {{ userInitials }}
              </a-avatar>
              <div class="user-panel-info">
                <div class="user-panel-name" :title="userDisplayLabel">
                  {{ userDisplayLabel }}
                </div>
                <div v-if="user?.email" class="user-panel-email" :title="user.email">{{ user.email }}</div>
                <div v-if="userTags.length" class="user-panel-tags">
                  <span v-for="t in userTags" :key="t.text" :class="['user-panel-tag', t.kind]">{{ t.text }}</span>
                </div>
              </div>
            </div>
            <div class="user-divider" />

            <!-- 主题色：界面保持浅色，切换品牌主色（按钮 / 选中 / 链接 / 高亮） -->
            <div class="user-section-title">主题色</div>
            <div class="theme-picker">
              <button
                v-for="t in themes"
                :key="t.key"
                type="button"
                class="theme-swatch"
                :class="{ active: currentTheme.key === t.key }"
                :style="{ '--swatch': t.primary }"
                :title="t.source"
                @click.stop="setTheme(t.key)"
              >
                <span class="theme-swatch-dot"><CheckOutlined v-if="currentTheme.key === t.key" /></span>
                <span class="theme-swatch-name">{{ t.name }}</span>
              </button>
            </div>
            <div class="user-divider" />

            <div class="user-menu-list">
              <div class="user-menu-text" @click="setLocale(locale === 'en' ? 'zh' : 'en')">
                {{ locale === 'en' ? '切换到中文' : 'Switch to English' }}
              </div>
              <div class="user-menu-text" @click="handleMenuSelect('settings')">个人中心</div>
              <div class="user-menu-text" @click="handleMenuSelect('account')">账户设置</div>
              <div v-if="isDesktop" class="user-menu-text" @click="handleMenuSelect('desktop')">客户端设置</div>
              <div class="user-menu-text" @click="handleMenuSelect('logout')">退出登录</div>
            </div>

            <div class="user-divider" />

            <div class="user-section-title">组织</div>
            <div class="user-org-card" @click="handleMenuSelect('switch')">
              <div class="user-org-logo">{{ orgLogo }}</div>
              <div class="user-org-name" :title="orgName">{{ orgName }}</div>
              <div class="user-org-switch">切换 <RightOutlined /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <DesktopSettingsModal v-if="isDesktop" v-model:open="desktopSettingsOpen" />
  </header>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import {
  HomeOutlined,
  SearchOutlined,
  RightOutlined,
  DownOutlined,
  PlusOutlined,
  // DragOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CheckOutlined,
  ShareAltOutlined,
  EditOutlined,
  EyeOutlined,
  CaretDownOutlined,
} from '@ant-design/icons-vue'
import HeaderBanner from './HeaderBanner.vue'
import AppNavPopover from './AppNavPopover.vue'
import { message } from 'ant-design-vue'
import { docsEditMode, docsActiveDoc, docsSideCollapsed, docsSaveState, docsTitleRev } from '@/utils/docs-layout'
import HeaderSpaceSwitcher from './HeaderSpaceSwitcher.vue'
import DesktopSettingsModal from './DesktopSettingsModal.vue'
import { isDesktop } from '@/utils/desktop'
import { currentSpaceCode } from '@/utils/current-space'
import { useSpaces } from '@/utils/space-store'
import { useAuth, setAuthUser } from '@/utils/auth'
import { useTheme } from '@/utils/theme'
import { useLocale } from '@/i18n'
import { formatPersonLabel } from '@/utils/person'
import { logout, getCurrentUser, fuzzyQueryIssues, type FuzzyIssueItem } from '@/api/faiz'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'

defineProps<{
  drawerOpen?: boolean
  searchPlaceholder?: string
  sidebarCollapsed?: boolean
  hideSidebarToggle?: boolean
}>()

const emit = defineEmits<{
  (e: 'menu-click'): void
  (e: 'workspace-click'): void
  (e: 'create-click'): void
  (e: 'search', value: string): void
  (e: 'toggle-sidebar'): void
}>()

const searchValue = ref('')
const dropdownOpen = ref(false)
const userPopoverOpen = ref(false)
function openSearchDropdown() { dropdownOpen.value = true }
function closeSearchDropdown() { dropdownOpen.value = false }

function setUserPopoverOpen(next: boolean) {
  userPopoverOpen.value = next
}
function toggleUserPopover() { setUserPopoverOpen(!userPopoverOpen.value) }

// 用户下拉：点击下拉区域以外的任意位置或按 Esc 关闭
const userDropdownRef = ref<HTMLElement | null>(null)
function onDocPointerDown(e: PointerEvent) {
  const el = userDropdownRef.value
  if (userPopoverOpen.value && el && !el.contains(e.target as Node)) setUserPopoverOpen(false)
}
function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && userPopoverOpen.value) setUserPopoverOpen(false)
}
watch(userPopoverOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onDocKeydown)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    document.removeEventListener('keydown', onDocKeydown)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onDocKeydown)
})

// 最近搜索 / 最近访问：暂时隐藏，恢复时取消注释（模板同步恢复）
// const recentSearches = ref(['待办事项', '项目', '文档', '工作台', '设置'])
// const recentVisits = ref(['轻量应用服务器', '控制台首页', '云解析DNS', '费用与成本', '大模型服务平台百炼'])

// ---------- 事项模糊搜索（POST /issue/fuzzy-query）：输入即查，防抖 300ms ----------
const FUZZY_PAGE_SIZE = 10
const fuzzyResults = ref<FuzzyIssueItem[]>([])
const fuzzyTotal = ref(0)
const fuzzyLoading = ref(false)
let fuzzySeq = 0
let fuzzyTimer: ReturnType<typeof setTimeout> | undefined

/** 输入框是否聚焦：接口返回时仍聚焦才弹出结果下拉 */
const searchFocused = ref(false)
function onSearchFocus() {
  searchFocused.value = true
  openSearchDropdown()
}
function onSearchBlur() {
  searchFocused.value = false
  closeSearchDropdown()
}

// 输入变化即查询（不用 @update:value：与 v-model 合并成数组会触发 antd 的 prop 类型告警）
watch(searchValue, (v) => onSearchInput(v))

function onSearchInput(v: string) {
  clearTimeout(fuzzyTimer)
  const keyword = (v ?? '').trim()
  if (!keyword) {
    fuzzySeq++
    fuzzyResults.value = []
    fuzzyTotal.value = 0
    fuzzyLoading.value = false
    return
  }
  openSearchDropdown()
  fuzzyLoading.value = true
  fuzzyTimer = setTimeout(() => runFuzzyQuery(keyword), 300)
}

/**
 * 同一关键字分别按单号、概要模糊查询后合并去重（后端两个条件同时传为「且」，
 * 单个输入框需要「或」的效果）；单号命中排在前面，最多展示 10 条
 */
async function runFuzzyQuery(keyword: string) {
  const seq = ++fuzzySeq
  try {
    const [byKey, bySummary] = await Promise.all([
      fuzzyQueryIssues({ issueKey: keyword, page: 1, pageSize: FUZZY_PAGE_SIZE }).catch(() => null),
      fuzzyQueryIssues({ summary: keyword, page: 1, pageSize: FUZZY_PAGE_SIZE }).catch(() => null),
    ])
    if (seq !== fuzzySeq) return
    const merged = new Map<string, FuzzyIssueItem>()
    for (const item of [...(byKey?.data?.list ?? []), ...(bySummary?.data?.list ?? [])]) {
      if (item?.issueKey && !merged.has(item.issueKey)) merged.set(item.issueKey, item)
    }
    fuzzyResults.value = [...merged.values()].slice(0, FUZZY_PAGE_SIZE)
    // 两路结果可能重叠，总数取较大值作为参考
    fuzzyTotal.value = Math.max(byKey?.data?.total ?? 0, bySummary?.data?.total ?? 0, fuzzyResults.value.length)
    // 有数据且输入框仍聚焦：展开下拉
    if (searchFocused.value) dropdownOpen.value = true
  } finally {
    if (seq === fuzzySeq) fuzzyLoading.value = false
  }
}

/** 搜索范围：顶部选了空间时只搜该空间（fuzzyQueryIssues 自动带 spaceCode），面板里提示当前范围 */
const { findSpace } = useSpaces()
const scopeSpaceName = computed(() => (currentSpaceCode.value ? findSpace(currentSpaceCode.value)?.spaceName || '' : ''))
// 切换空间时，若搜索框有内容，按新空间重新搜索
watch(currentSpaceCode, () => {
  const kw = searchValue.value.trim()
  if (!kw) return
  fuzzyLoading.value = true
  runFuzzyQuery(kw)
})

/** 键盘选中项：↑↓ 切换，回车打开 */
const activeIndex = ref(0)
watch(fuzzyResults, () => (activeIndex.value = 0))
function moveActive(step: number) {
  const n = fuzzyResults.value.length
  if (!n) return
  openSearchDropdown()
  activeIndex.value = (activeIndex.value + step + n) % n
}

/** 统一处理搜索框按键：esc 关闭面板、上下键移动选中项
 * （多个 @keydown.xxx 修饰符监听会被 Vue 合成为数组，触发 a-input 的 onKeydown 类型校验告警） */
function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeSearchDropdown()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveActive(-1)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveActive(1)
  }
}

/** 关键字高亮：不区分大小写拆分为命中 / 未命中片段 */
function highlight(text: string): { text: string; hit: boolean }[] {
  const kw = searchValue.value.trim()
  if (!kw || !text) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const k = kw.toLowerCase()
  const out: { text: string; hit: boolean }[] = []
  let from = 0
  let idx = lower.indexOf(k)
  while (idx !== -1) {
    if (idx > from) out.push({ text: text.slice(from, idx), hit: false })
    out.push({ text: text.slice(idx, idx + kw.length), hit: true })
    from = idx + kw.length
    idx = lower.indexOf(k, from)
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false })
  return out
}

/** 点击结果：新标签页打开事项详情页 */
function openIssue(item: FuzzyIssueItem) {
  closeSearchDropdown()
  const { href } = router.resolve({ name: 'IssueDetail', params: { issueKey: item.issueKey } })
  window.open(href, '_blank', 'noopener')
}

function handleEnter() {
  // 有结果时回车打开当前选中项（默认第一条）
  const picked = fuzzyResults.value[activeIndex.value] ?? fuzzyResults.value[0]
  if (searchValue.value.trim() && picked && !fuzzyLoading.value) {
    openIssue(picked)
    return
  }
  closeSearchDropdown()
  handleSearch()
}

// function handleSelect(item: string) {
//   searchValue.value = item
//   closeSearchDropdown()
//   handleSearch(item)
// }
/** 登录用户资料（登录接口 data.user / 个人中心同步），姓名缺失时回退占位文案 */
const { realName, user } = useAuth()
const { themes, currentTheme, setTheme } = useTheme()
const { locale, setLocale } = useLocale()
const username = computed(() => user.value?.realName || realName.value || '用户')
/** 用户面板展示：realName（coAccount） */
const userDisplayLabel = computed(() =>
  formatPersonLabel(user.value?.realName || realName.value, user.value?.coAccount) || username.value,
)
const userInitials = computed(() => username.value.slice(-2).toUpperCase())
const router = useRouter()
const route = useRoute()

/** 空间切换 / 搜索事项 / 新建按钮只在工作台菜单下展示 */
const isWorkbench = computed(() => route.path.startsWith('/workbench'))

/** 文档页：保留顶栏空间切换，但不显示搜索 / 新建 */
const isDocs = computed(() => route.path.startsWith('/docs'))

/** 文档保存状态轻提示文案（分享按钮左侧，参考飞书：不显眼的灰色小字） */
const docsSaveStateText = computed(() => {
  switch (docsSaveState.value) {
    case 'saving': return '保存中…'
    case 'unsaved': return '保存失败，将在下次修改时重试'
    default: return '已经保存到云端'
  }
})

/** 文档分享：复制文档链接到剪贴板 */
async function shareDoc() {
  const doc = docsActiveDoc.value
  if (!doc) return
  const href = router.resolve({ path: '/docs', query: { doc: doc.id } }).href
  try {
    await navigator.clipboard.writeText(`${location.origin}${href}`)
    message.success('链接已复制，粘贴给协作者即可分享')
  } catch {
    message.warning('复制失败，请手动复制地址栏链接')
  }
}

/** 顶栏"编辑"下拉：切换编辑 / 预览模式 */
function onEditModeMenu({ key }: { key: string | number }) {
  docsEditMode.value = key === 'edit'
}
// 离开工作台时收起搜索面板，避免回来时残留展开状态
watch(isWorkbench, (v) => { if (!v) closeSearchDropdown() })

/** 头像地址；加载失败后回退为姓名缩写 */
const avatarFailed = ref(false)
const avatarSrc = computed(() => (avatarFailed.value ? undefined : user.value?.avatarUrl || undefined))
function onAvatarError() {
  avatarFailed.value = true
  return true
}

/** 岗位 / 角色标签 */
const userTags = computed(() => {
  const tags: { text: string; kind: string }[] = []
  if (user.value?.positionName) tags.push({ text: user.value.positionName, kind: 'position' })
  ;(user.value?.roleNames || []).forEach(r => tags.push({ text: r, kind: 'role' }))
  return tags
})

/** 所属组织：取部门路径的第一段（公司），缺失时回退默认 */
const orgName = computed(() => (user.value?.deptInfo || '').split('/')[0].trim() || '喝科技')
const orgLogo = computed(() => orgName.value.slice(0, 1).toUpperCase())

/** 老登录态没有本地用户资料：进入页面时补查一次 */
onMounted(async () => {
  if (user.value?.avatarUrl !== undefined || !auth.isLoggedIn.value) return
  try {
    const res = await getCurrentUser()
    if (res?.success && res.data) {
      const d = res.data
      setAuthUser({ realName: d.realName, email: d.email, userEnName: d.userEnName, avatarUrl: d.avatarUrl ?? null, deptInfo: d.deptInfo })
    }
  } catch {
    // 请求层已统一提示
  }
})

function handleSearch(value?: string) {
  if (value || searchValue.value) {
    emit('search', value || searchValue.value)
  }
}

const auth = useAuth()

/** 客户端设置弹窗（仅 Windows 客户端） */
const desktopSettingsOpen = ref(false)

function handleMenuSelect(key: string) {
  setUserPopoverOpen(false)
  switch (key) {
    case 'desktop':
      desktopSettingsOpen.value = true
      break
    case 'logout':
      nextTick(handleLogout)
      break
    case 'settings':
      router.push('/settings/profile')
      break
    case 'account':
      router.push('/settings/account')
      break
    case 'switch':
      console.log('切换组织')
      break
  }
}

async function handleLogout() {
  try {
    await logout()
  } catch (e) {
    console.warn('[Logout] 接口调用失败，继续执行登出流程:', e)
    return
  }

  // 接口成功后清除 cookie
  auth.logout()
}
</script>

<style scoped>
.app-header {
  position: fixed;
  /* 客户端：顶栏在页签栏下方（--desktop-tabbar-height，网页版为 0） */
  top: var(--desktop-tabbar-height, 0px);
  left: 0;
  right: 0;
  min-width: var(--app-min-width);
  transform: translateX(calc(-1 * var(--app-scroll-x, 0px)));
  /* iOS 上高度含刘海安全区，见 App.vue 的 html.is-ios；--app-header-height 为整个顶部区域（含客户端页签栏） */
  height: calc(var(--app-header-height, 56px) - var(--desktop-tabbar-height, 0px));
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 16px;
  z-index: 1000;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  /* 折叠按钮不再被 space-between 顶到最右侧，整体靠左跟随 logo */
  justify-content: flex-start;
  min-width: calc(280px + 40px);
  padding-right: 8px;
}

.header-left.collapsed {
  min-width: calc(112px + 40px);
}

.header-left-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}

.header-fold-icon {
  font-size: 18px;
  color: #595959;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}

.header-fold-icon:hover {
  color: var(--c-primary);
  background: #f5f5f5;
}

.menu-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  font-size: 20px;
  color: #595959;
  transition: background 0.15s;
}

.menu-btn:hover {
  background: #f5f5f5;
}

.header-divider {
  height: 24px;
  margin: 0 8px;
}

.header-center {
  margin-left: -8px;
}

.workspace-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  font-size: 14px;
  color: #595959;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.workspace-btn:hover {
  background: #eef1f6;
}

.header-space {
  display: flex;
  align-items: center;
  /*
   * 与侧栏二级菜单（我的事项所在面板）左边缘对齐：
   * 侧栏二级菜单 x = icon-bar 64；顶部 x = header padding 16 + logo 36 + margin-left → margin-left = 12
   * 配合触发器宽度 216px（280 - 64），顶部这块与下方菜单左右边界完全重合
   */
  margin-left: 12px;
}

/* 客户端不显示 logo，省掉的 36px 用 margin 补回来，保持与侧栏菜单对齐 */
.header-left.no-logo .header-space {
  margin-left: 48px;
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

/* 文档页侧栏折叠时的展开按钮（顶栏最左侧） */
.docs-side-expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-right: 6px;
  font-size: 16px;
  color: #646a73;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-side-expand:hover {
  color: #1f2329;
  background: #f2f3f5;
}

/* 文档详情：顶栏最左侧文件名 + 保存状态（上下两行，参考飞书） */
.docs-head-meta {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  max-width: 260px;
  margin-right: 12px;
  line-height: 1.3;
}

/* 文件名：保存状态上方一行，可直接改名（样式同纯文本，聚焦才显边框） */
.docs-head-title {
  width: 100%;
  min-width: 0;
  padding: 0 4px;
  margin-left: -4px;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: #1f2329;
  background: transparent;
  border: none;
  border-radius: 4px;
  outline: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: box-shadow 0.12s, background 0.12s;
}
.docs-head-title::placeholder {
  color: #b8bac0;
  font-weight: 500;
}
.docs-head-title:focus {
  background: #f2f3f5;
  box-shadow: 0 0 0 2px rgba(51, 112, 255, 0.25);
}

/* 保存状态轻提示（灰色小字，不抢视觉） */
.docs-save-state {
  font-size: 12px;
  color: #8f959e;
  white-space: nowrap;
  user-select: none;
}
.docs-save-state.is-saving {
  color: #8f959e;
}
.docs-save-state.is-unsaved {
  color: #d4a106;
}
/* 窄屏兼容：保存状态为辅助信息，宽度不足时隐藏（文件名保留但收窄） */
@media (max-width: 960px) {
  .docs-head-meta {
    max-width: 140px;
  }
  .docs-head-meta .docs-save-state {
    display: none;
  }
}

/* 文档详情：分享（主按钮）与编辑/预览切换 */
.docs-share {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: #3370ff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.docs-share:hover {
  background: #2b5fd9;
}
.docs-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  color: #37352f;
  background: transparent;
  border: 1px solid #e5e5e3;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.docs-edit-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  border-color: #d9d9d6;
}
.docs-edit-caret {
  font-size: 10px;
  color: #91918e;
}

/* 中英文切换已移入用户下拉菜单 */


.header-search {
  width: 220px;
  transition: width 0.3s ease;
}

.header-search:focus-within {
  width: 380px;
}

.header-create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border: none;
  background: linear-gradient(135deg, #0052D9 0%, #2F78E6 50%, #60A8FF 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: box-shadow 0.15s, opacity 0.15s;
}

.header-create-btn:hover {
  box-shadow: 0 2px 8px rgba(0, 82, 217, 0.3);
  opacity: 0.92;
}

.header-create-btn:active {
  opacity: 0.85;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 10px 0 4px;
  cursor: pointer;
  border-radius: 999px;
  transition: background 0.15s;
}

.user-trigger:hover,
.user-trigger.active {
  background: #f5f5f7;
}

.user-avatar {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, #5e5ce6 0%, var(--c-primary) 100%);
  box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(15, 23, 42, 0.06);
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.user-caret {
  font-size: 10px;
  color: #8e8e93;
  transition: transform 0.2s;
}

.user-trigger.active .user-caret {
  transform: rotate(180deg);
}

.user-dropdown-wrap {
  position: relative;
}

/* 自绘浮层：绝对定位于头像下方，替换 a-popover（避免点击页面其它位置时自动收起） */
.user-dropdown-float {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 1050;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* ==========================================================================
   手机端（iPhone 17 / 17 Pro Max 为基准，断点 767px）
   顶部一行：菜单 + 空间切换 + 搜索 + 新建 + 头像
   ========================================================================== */
@media (max-width: 767px) {
  .app-header {
    min-width: 0;
    gap: 6px;
    padding: 0 8px;
  }

  .header-left,
  .header-left.collapsed {
    /* 桌面端这里是 calc(280px + 40px)（与侧栏同宽），手机必须让位给搜索区 */
    min-width: 0 !important;
    /* 不参与收缩，否则后面的菜单按钮会被搜索框挤掉 */
    flex: 0 0 auto;
    gap: 4px;
    padding-right: 0;
  }

  /* 手机屏幕窄，logo 让位给功能区（保留在平板 / 桌面） */
  .header-left > .app-logo {
    display: none;
  }

  /* 空间切换在手机上固定 116px：桌面端的 216px 会挤掉搜索与右侧操作 */
  .header-space {
    margin-left: 0 !important;
    width: 116px;
    flex: 0 0 116px;
    overflow: hidden;
  }

  .header-space :deep(.header-space-trigger) {
    width: 100% !important;
    max-width: 116px !important;
    height: 30px;
    padding: 0 8px 0 4px;
    font-size: 13px;
  }

  /* 菜单按钮（打开抽屉）必须始终可见，不参与收缩 */
  .header-left-right {
    flex: 0 0 auto;
    margin-left: 2px;
    gap: 4px;
  }

  .header-divider {
    display: none;
  }

  .header-fold-icon {
    font-size: 20px;
    padding: 6px;
  }

  /* 右侧区域整体收缩，搜索吃掉剩余宽度，超出部分不再把「新建 / 头像」挤到屏幕外 */
  .header-right {
    flex: 1 1 0;
    min-width: 0;
    justify-content: flex-end;
    gap: 8px;
  }

  .header-search-wrap {
    /* 用 0 作 basis，搜索区严格让出「新建 + 头像」所需宽度，溢出裁掉避免压住按钮 */
    flex: 1 1 0;
    min-width: 88px;
    overflow: hidden;
  }

  .header-search,
  .header-search:focus-within {
    width: 100%;
    min-width: 0;
    font-size: 13px;
  }

  .header-search :deep(.ant-input) {
    min-width: 0;
  }

  /* 手机无 hover，搜索面板改为贴顶全宽浮层 */
  .search-panel {
    position: fixed;
    top: calc(var(--app-header-height, 56px) - 4px);
    left: 8px;
    right: 8px;
    width: auto;
    max-height: 60vh;
    overflow-y: auto;
  }

  /* 手机上新建只留图标 */
  .header-create-btn {
    flex: 0 0 auto;
    min-width: 32px;
    justify-content: center;
    padding: 0 6px;
    height: 30px;
  }

  /* 只隐藏文字，保留 PlusOutlined 图标（anticon 本身也是 span） */
  .header-create-btn .create-label {
    display: none;
  }

  /* 用户菜单只留头像 */
  .user-trigger {
    gap: 0;
    padding: 0;
  }

  .user-name,
  .user-caret {
    display: none;
  }

  .user-dropdown-popover {
    position: fixed;
    top: calc(var(--app-header-height, 56px) + 4px);
    right: 8px;
    left: auto;
    width: min(320px, calc(100vw - 16px));
    max-height: 70vh;
    overflow-y: auto;
  }
}

</style>

<style>
/* 浮层已改为自绘（.user-dropdown-float），不再使用 ant-popover 结构 */

.search-dropdown {
  width: 100%;
  padding: 12px;
  background: #fff;
  border-radius: 8px;
}

.search-dropdown-section {
  margin-bottom: 8px;
}

.search-dropdown-title {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
  padding-left: 2px;
}

.search-dropdown-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.search-tag {
  display: inline-block;
  padding: 3px 10px;
  font-size: 12px;
  color: #595959;
  background: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.search-tag:hover {
  background: var(--c-primary-bg);
  color: var(--c-primary);
}

.search-dropdown-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 10px 0;
}

.search-dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-dropdown-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
  color: #262626;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.search-dropdown-item:hover {
  background: #f5f5f5;
  color: var(--c-primary);
}

.search-dropdown-item .anticon {
  font-size: 14px;
}

.sp-body {
  padding: 6px;
}

.sp-section {
  padding: 6px 10px 4px;
  font-size: 12px;
  font-weight: 500;
  color: #8c8c8c;
}

.sp-scope {
  font-weight: 400;
  color: #aeaeb2;
}

.sp-list {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  overflow-y: auto;
}

.sp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}

.sp-item.is-active {
  background: #f5f5f7;
}

.sp-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border-radius: 6px;
}

.sp-text {
  flex: 1;
  min-width: 0;
}

.sp-title {
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  color: #1f1f1f;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sp-sub {
  margin-top: 1px;
  font-size: 12px;
  line-height: 16px;
  color: #8c8c8c;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.sp-status {
  flex-shrink: 0;
  padding: 0 8px;
  font-size: 11px;
  line-height: 20px;
  color: #595959;
  background: #f0f0f0;
  border-radius: 10px;
  white-space: nowrap;
}

.sp-item b {
  font-weight: 600;
  color: #000;
}

.sp-empty {
  padding: 10px;
  font-size: 13px;
  color: #8c8c8c;
}

.search-result-empty {
  padding: 16px 0;
  font-size: 13px;
  color: #8c8c8c;
  text-align: center;
}

.header-search-wrap {
  position: relative;
  flex-shrink: 0;
}

.search-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 1050;
  /* 与输入框同宽（输入框聚焦时 380px，容器随之变宽） */
  width: 100%;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.user-panel {
  width: 280px;
  padding: 12px 0;
}

.user-panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px 4px;
}

.user-panel-avatar {
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #5e5ce6 0%, var(--c-primary) 100%);
  box-shadow: 0 2px 8px transparent;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--c-primary) 25%, transparent);
}

.user-panel-info {
  flex: 1;
  min-width: 0;
}

.user-panel-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: #1d1d1f;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.user-panel-en {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: #8e8e93;
}

.user-panel-email {
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: #6e6e73;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.theme-picker {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 4px 12px 10px;
}
.theme-swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  border: 1px solid #e5e5ea;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.theme-swatch:hover {
  background: #fafafc;
}
.theme-swatch.active {
  border-color: var(--swatch);
  box-shadow: 0 0 0 3px transparent;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--swatch) 18%, transparent);
}
.theme-swatch-dot {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
  color: #fff;
  background: var(--swatch);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.theme-swatch-name {
  font-size: 12px;
  color: #3a3a3c;
  white-space: nowrap;
}
.user-panel-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.user-panel-tag {
  padding: 0 8px;
  font-size: 11px;
  line-height: 18px;
  border-radius: 999px;
}

.user-panel-tag.position {
  color: #c93400;
  background: #fff4e5;
}

.user-panel-tag.role {
  color: #5e5ce6;
  background: #f0efff;
}

.user-menu-list {
  padding: 4px 16px;
}

.user-menu-text {
  padding: 8px 0;
  font-size: 14px;
  color: #262626;
  cursor: pointer;
  transition: color 0.15s;
  line-height: 1.5;
}

.user-menu-text:hover {
  color: var(--c-primary);
}

.user-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 12px 16px;
}

.user-section-title {
  padding: 0 16px 8px;
  font-size: 13px;
  color: #8c8c8c;
  font-weight: 500;
}

.user-org-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 16px 8px;
  padding: 10px 12px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.user-org-card:hover {
  background: #e8e8e8;
}

.user-org-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(135deg, #0052D9 0%, #2F78E6 50%, #60A8FF 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-org-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.user-org-switch {
  font-size: 13px;
  color: #8c8c8c;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.user-org-card:hover .user-org-switch {
  color: var(--c-primary);
}

</style>
