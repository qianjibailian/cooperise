<template>
  <header class="app-header">
    <!-- 文档页侧栏折叠时的展开按钮：固定在顶栏最左侧，位于文件名 / 保存状态的左边 -->
    <button v-if="isDocs && docsSideCollapsed" type="button" class="docs-side-expand" title="展开菜单" @click="docsSideCollapsed = false">
      <MenuUnfoldOutlined />
    </button>
    <!-- 文档详情：顶栏最左侧文件名（上，可直接改名）+ 保存状态轻提示（下），参考飞书；文档/表格/思维导图/流程图共用 -->
    <div v-if="isDocDetailPage && docsActiveDoc" class="docs-head-meta">
      <!-- 外层用隐藏的同款文字撑出宽度：输入框宽度 = 文件名长度，最长到分享按钮前，再长显示省略号 -->
      <span class="docs-head-title-wrap" :data-value="docTitleInputValue(docsActiveDoc.title) || '请输入标题'">
        <input
          :value="docTitleInputValue(docsActiveDoc.title)"
          class="docs-head-title"
          placeholder="请输入标题"
          maxlength="120"
          size="1"
          @input="onDocsHeadTitleInput"
        />
      </span>
      <span class="docs-save-state" :class="`is-${docsSaveState}`">{{ docsSaveStateText }}</span>
    </div>
    <div
      class="header-left"
      :class="{ collapsed: sidebarCollapsed, 'no-logo': isDesktop, 'header-left-fixed': !!leftWidth, 'header-left-centered': centerTitle }"
      :style="leftWidth ? { '--header-left-w': `${leftWidth}px` } : undefined"
    >
      <div class="header-left-main">
        <AppLogo v-if="showLogo" class="header-logo" />
        <!-- 模块名：各模块布局自己传入（工作台 / 云文档 / 空间 / 管理后台） -->
        <span v-if="moduleTitle" class="header-module-title" :class="{ 'is-large': moduleTitleLarge }">{{ moduleTitle }}</span>
      </div>

      <div class="header-left-right">
        <a-divider v-if="!hideSidebarToggle" type="vertical" class="header-divider" />
        <component :is="sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined" v-if="!hideSidebarToggle" class="header-fold-icon" @click="$emit('toggle-sidebar')" />
      </div>
    </div>


    <div class="header-right">
      <!-- 文档详情：分享 / 编辑（原详情页工具条按钮，移至顶栏） -->
      <template v-if="isDocDetailPage && docsActiveDoc">
        <a-popover
          v-model:open="sharePanelOpen"
          trigger="click"
          placement="bottomRight"
          :arrow="false"
          overlay-class-name="doc-share-popover"
        >
          <template #content>
            <DocSharePanel :doc-id="sharePanelDocId" />
          </template>
          <button type="button" class="docs-share">
            <ShareAltOutlined /> 分享
          </button>
        </a-popover>
        <!-- 文档模式：编辑 / 修订 / 阅读（默认阅读）；切换即改变页面是否可编辑 -->
        <a-dropdown trigger="click" placement="bottomRight">
          <button type="button" class="docs-edit-btn">
            <component :is="docModeIcon" />
            <span>{{ docModeLabel }}</span>
            <DownOutlined class="docs-edit-caret" />
          </button>
          <template #overlay>
            <a-menu :selected-keys="[docModeKey]" class="docs-mode-menu" @click="onDocModeMenu">
              <a-menu-item key="edit">
                <div class="docs-mode-item">
                  <div class="docs-mode-title"><EditOutlined /><span>编辑</span><CheckOutlined v-if="docModeKey === 'edit'" class="docs-mode-check" /></div>
                  <div class="docs-mode-desc">可编辑文档</div>
                </div>
              </a-menu-item>
              <a-menu-item key="revision">
                <div class="docs-mode-item">
                  <div class="docs-mode-title"><FormOutlined /><span>修订</span><CheckOutlined v-if="docsSuggestMode" class="docs-mode-check" /></div>
                  <div class="docs-mode-desc">提出修改建议</div>
                </div>
              </a-menu-item>
              <a-menu-item key="read">
                <div class="docs-mode-item">
                  <div class="docs-mode-title"><EyeOutlined /><span>阅读</span><CheckOutlined v-if="!docsEditMode" class="docs-mode-check" /></div>
                  <div class="docs-mode-desc">仅查看或者评论文档</div>
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <!-- 编辑右侧：横向三个点（更多）：移动到 / 收藏 / 下载 / 打印 / 文档信息 / 移到回收站 -->
        <a-dropdown trigger="click" placement="bottomRight" overlay-class-name="docs-more-popover">
          <button type="button" class="docs-more-btn" title="更多">
            <EllipsisOutlined />
          </button>
          <template #overlay>
            <a-menu class="docs-more-menu" @click="onDocMoreMenu">
              <a-sub-menu key="move" title="移动到">
                <template #icon><SwapOutlined /></template>
                <a-menu-item v-for="t in docsMoveTargets" :key="`move:${t.key}`">{{ t.label }}</a-menu-item>
              </a-sub-menu>
              <a-menu-item key="star">
                <template #icon><StarOutlined /></template>
                {{ docsActiveDoc?.starred ? '取消收藏' : '添加到收藏' }}
              </a-menu-item>
              <a-sub-menu key="download" title="下载为">
                <template #icon><DownloadOutlined /></template>
                <a-menu-item key="download:word">Word</a-menu-item>
                <a-menu-item key="download:pdf">PDF</a-menu-item>
                <a-menu-item key="download:md">Markdown</a-menu-item>
              </a-sub-menu>
              <a-menu-item key="print">
                <template #icon><PrinterOutlined /></template>
                打印
              </a-menu-item>
              <a-menu-item key="info">
                <template #icon><InfoCircleOutlined /></template>
                文档信息
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="trash" danger>
                <template #icon><DeleteOutlined /></template>
                删除
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <!-- 编辑 与 新建（+）之间的竖线分隔 -->
        <span class="docs-header-sep" aria-hidden="true" />
        <!-- 新建：文档 / 表格 / 思维导图 / 流程图已接入，其余类型提示开发中 -->
        <button
          ref="createBtnRef"
          type="button"
          class="docs-create-btn"
          :class="{ 'is-open': createMenuOpen }"
          title="新建"
          @click="toggleCreateMenu"
        >
          <PlusOutlined />
        </button>
        <!-- 新建菜单：自绘浮层挂到 body，位置紧贴「+」按钮正下方、右对齐（与头像菜单同一方式） -->
        <Teleport to="body">
          <div v-if="createMenuOpen" ref="createMenuRef" class="docs-create-panel" :style="createMenuStyle">
            <button type="button" class="docs-create-item" @click="pickDocCreate('doc')">
              <FileTextOutlined class="docs-create-ico" style="color: #3370ff" /><span>文档</span>
            </button>
            <button type="button" class="docs-create-item" @click="pickDocCreate('sheet')">
              <TableOutlined class="docs-create-ico" style="color: #34c724" /><span>表格</span>
            </button>
            <button type="button" class="docs-create-item" @click="pickDocCreate('slides')">
              <PieChartOutlined class="docs-create-ico" style="color: #ff7a00" /><span>幻灯片</span>
            </button>
            <button type="button" class="docs-create-item" @click="pickDocCreate('bitable')">
              <AppstoreOutlined class="docs-create-ico" style="color: #7b61ff" /><span>多维表格</span>
            </button>
            <button type="button" class="docs-create-item" @click="pickDocCreate('survey')">
              <FormOutlined class="docs-create-ico" style="color: #ffc60a" /><span>问卷</span>
            </button>
            <button type="button" class="docs-create-item" @click="pickDocCreate('notes')">
              <BulbOutlined class="docs-create-ico" style="color: #14c0ff" /><span>思维笔记</span>
            </button>
            <div class="docs-create-sep" />
            <button type="button" class="docs-create-item" @click="pickDocCreate('wiki')">
              <ReadOutlined class="docs-create-ico" style="color: #3370ff" /><span>知识库</span>
            </button>
            <div class="docs-create-sep" />
            <div class="docs-create-group">文档应用</div>
            <button type="button" class="docs-create-item" @click="pickDocCreate('whiteboard')">
              <EditOutlined class="docs-create-ico" style="color: #34c724" /><span>画板</span>
            </button>
            <button type="button" class="docs-create-item" @click="pickDocCreate('mindmap')">
              <ApartmentOutlined class="docs-create-ico" style="color: #14c0ff" /><span>思维导图</span>
            </button>
            <button type="button" class="docs-create-item" @click="pickDocCreate('flow')">
              <NodeIndexOutlined class="docs-create-ico" style="color: #ff8800" /><span>流程图</span>
            </button>
            <div class="docs-create-sep" />
            <div class="docs-create-group">团队协作</div>
            <button
              v-for="t in TEAM_COLLAB_ITEMS"
              :key="t.key"
              type="button"
              class="docs-create-item"
              @click="pickTeamItem(t.key)"
            >
              <component :is="t.icon" class="docs-create-ico" :style="{ color: t.color }" /><span>{{ t.label }}</span>
            </button>
            <div class="docs-create-sep" />
            <button type="button" class="docs-create-item" @click="pickDocCreate('upload')">
              <UploadOutlined class="docs-create-ico" style="color: #3370ff" /><span>上传及导入</span>
              <RightOutlined class="docs-create-caret" />
            </button>
          </div>
        </Teleport>
        <!-- 团队协作：点击条目在弹窗中管理 -->
        <TeamManageModal
          v-model:open="teamManage.open"
          :kind="teamManage.kind"
          :title="teamManage.title"
          :type-name="teamManage.typeName"
        />
      </template>
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
            <div v-if="fuzzyResults.length" class="sp-section">问题</div>
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
            <div v-else class="sp-empty">没有找到相关问题</div>
          </div>
          <!-- 未输入：搜索提示 -->
          <div v-else class="sp-body">
            <div class="sp-empty">输入问题单号或概要</div>
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

      <button v-if="isWorkbench" class="header-create-btn" @click="openNewIssueModal()">
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
              <a-avatar :size="36" :src="avatarSrc" class="user-panel-avatar" :load-error="onAvatarError">
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

            <div class="user-section-title">个人</div>
            <div class="user-ws-item" :class="{ 'is-active': currentWs === 'personal' }" @click="switchWs('personal')">
              <img v-if="user?.avatarUrl && !avatarFailed" class="user-ws-avatar user-ws-avatar--person" :src="user.avatarUrl" alt="" @error="avatarFailed = true" />
              <div v-else class="user-ws-avatar user-ws-avatar--person">{{ personalInitial }}</div>
              <div class="user-ws-name" :title="personalName">{{ personalName }}</div>
              <CheckOutlined v-if="currentWs === 'personal'" class="user-ws-check" />
            </div>

            <div class="user-section-title">企业</div>
            <template v-if="enterprises.length">
              <div
                v-for="org in enterprises"
                :key="org.id"
                class="user-ws-item"
                :class="{ 'is-active': currentWs === org.id }"
                @click="switchWs(org.id)"
              >
                <div class="user-ws-avatar user-ws-avatar--org">{{ orgInitial(org.organizationName) }}</div>
                <div class="user-ws-name" :title="org.organizationName">{{ org.organizationName }}</div>
                <CheckOutlined v-if="currentWs === org.id" class="user-ws-check" />
              </div>
            </template>
            <div class="user-ws-item user-ws-action" @click="openOrgSetup">
              <span class="user-ws-action-icon"><PlusOutlined /></span>
              <span class="user-ws-name">新建企业</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <DesktopSettingsModal v-if="isDesktop" v-model:open="desktopSettingsOpen" />
    <OrgSetupModal
      v-model:open="orgSetupOpen"
      :loading="orgSetupLoading"
      @create="handleOrgCreate"
      @join="handleOrgJoin"
    />
  </header>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import {
  EllipsisOutlined,
  SwapOutlined,
  StarOutlined,
  DownloadOutlined,
  PrinterOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
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
  FormOutlined,
  FileTextOutlined,
  TableOutlined,
  PieChartOutlined,
  AppstoreOutlined,
  BulbOutlined,
  ReadOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'
import AppLogo from './AppLogo.vue'
import OrgSetupModal from './OrgSetupModal.vue'
import { setCurrentWorkspace } from '@/utils/workspace'
import { docsEditMode, docsSuggestMode, docsActiveDoc, docsSideCollapsed, docsSaveState, docsTitleRev, docTitleInputValue, requestDocCreate, requestDocMore, docsMoveTargets } from '@/utils/docs-layout'
import { message } from 'ant-design-vue'
import { TEAM_COLLAB_ITEMS, type TeamManageSpec } from '@/utils/team-collab'
import TeamManageModal from '@/components/docs/TeamManageModal.vue'
import { docSharePanelOpen } from '@/utils/doc-share'
import DocSharePanel from './DocSharePanel.vue'
import DesktopSettingsModal from './DesktopSettingsModal.vue'
import { isDesktop } from '@/utils/desktop'
import { useAuth, setAuthUser } from '@/utils/auth'
import { useLocale } from '@/i18n'
import { formatPersonLabel } from '@/utils/person'
import { logout, getCurrentUser, createSelfOrganization, startInitConfig, checkInitWorkspace, fuzzyQueryIssues, type FuzzyIssueItem } from '@/api/faiz'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'
import { openNewIssueModal } from '@/utils/new-issue-modal'

defineProps<{
  searchPlaceholder?: string
  sidebarCollapsed?: boolean
  hideSidebarToggle?: boolean
  /** 当前模块名（每个模块布局传入，显示在顶栏左侧） */
  moduleTitle?: string
  /** 是否在顶栏左侧显示应用 Logo（工作台） */
  showLogo?: boolean
  /** 顶栏左侧固定宽度（与左侧菜单同宽，折叠图标落在菜单分界线上） */
  leftWidth?: number
  /** 模块名是否在左侧区域内水平居中（工作台） */
  centerTitle?: boolean
  /** 模块名字号加大一号（云文档） */
  moduleTitleLarge?: boolean
}>()

const emit = defineEmits<{
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
const { locale, setLocale } = useLocale()
const username = computed(() => user.value?.realName || realName.value || '用户')
/** 用户面板展示：realName（coAccount） */
const userDisplayLabel = computed(() =>
  formatPersonLabel(user.value?.realName || realName.value, user.value?.coAccount) || username.value,
)
const userInitials = computed(() => username.value.slice(-2).toUpperCase())
const router = useRouter()
const route = useRoute()

/** 搜索事项 / 新建按钮只在工作台菜单下展示 */
const isWorkbench = computed(() => route.path.startsWith('/workbench'))

/** 文档页：不显示搜索 / 新建 */
const isDocs = computed(() => route.path.startsWith('/docs') || route.path.startsWith('/wiki'))
/** 文档详情页（/docs/wiki/:id、/docs/library/wiki/:id）才显示标题、保存状态、分享 / 编辑 / 更多 等文档操作 */
const isDocDetailPage = computed(() => /^\/(docs\/wiki|docs\/library\/wiki|wiki)\/[^/]+/.test(route.path))

/** 文档保存状态轻提示文案（分享按钮左侧，参考飞书：不显眼的灰色小字） */
/** 顶栏文件名输入（输入框里默认标题显示为空，所以不用 v-model，手动回写） */
function onDocsHeadTitleInput(e: Event) {
  if (!docsActiveDoc.value) return
  docsActiveDoc.value.title = (e.target as HTMLInputElement).value
  docsTitleRev.value++
}

const docsSaveStateText = computed(() => {
  switch (docsSaveState.value) {
    case 'saving': return '保存中…'
    case 'unsaved': return '保存失败，将在下次修改时重试'
    default: return '已经保存到云端'
  }
})

/** 顶栏「分享」面板：开关与文档页菜单共用 docSharePanelOpen；面板针对当前打开的文档 */
const sharePanelOpen = computed({
  get: () => docSharePanelOpen.value,
  set: (open: boolean) => {
    docSharePanelOpen.value = open
  },
})
const sharePanelDocId = computed(() => docsActiveDoc.value?.id ?? '')

/** 当前文档模式：阅读（只读）/ 编辑 / 修订（可编辑，但修改以修订形式呈现） */
const docModeKey = computed(() => (!docsEditMode.value ? 'read' : docsSuggestMode.value ? 'revision' : 'edit'))
const DOC_MODE_META: Record<string, { label: string; icon: unknown }> = {
  read: { label: '阅读', icon: EyeOutlined },
  edit: { label: '编辑', icon: EditOutlined },
  revision: { label: '修订', icon: FormOutlined },
}
const docModeLabel = computed(() => DOC_MODE_META[docModeKey.value].label)
const docModeIcon = computed(() => DOC_MODE_META[docModeKey.value].icon)
/** 顶栏"+"新建菜单：已接入的类型交给文档页新建，其余暂未开放 */
const DOC_CREATE_SUPPORTED = ['doc', 'sheet', 'mindmap', 'flow', 'wiki']
function onDocCreateMenu({ key }: { key: string | number }) {
  const k = String(key)
  if (DOC_CREATE_SUPPORTED.includes(k)) requestDocCreate(k)
  else message.info('功能开发中')
}

/* 新建菜单（自绘浮层）：紧贴「+」按钮正下方、右对齐；点击菜单外或选中项后收起 */
const createBtnRef = ref<HTMLElement | null>(null)
const createMenuRef = ref<HTMLElement | null>(null)
const createMenuOpen = ref(false)
const createMenuStyle = ref<Record<string, string>>({})
function toggleCreateMenu() {
  if (createMenuOpen.value) {
    createMenuOpen.value = false
    return
  }
  const rect = createBtnRef.value?.getBoundingClientRect()
  if (rect) {
    createMenuStyle.value = {
      top: `${rect.bottom + 8}px`,
      right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    }
  }
  createMenuOpen.value = true
}
function pickDocCreate(key: string) {
  createMenuOpen.value = false
  onDocCreateMenu({ key })
}

/** 团队协作：点击在弹窗中管理（需求 / 任务 / 看板 / 人员 / 部门），不跳转页面 */
const teamManage = reactive({
  open: false,
  title: '',
  kind: 'issue' as TeamManageSpec['kind'],
  typeName: '',
})
function openTeamManage(key: string) {
  const item = TEAM_COLLAB_ITEMS.find((t) => t.key === key)
  if (!item) return
  teamManage.title = item.label
  teamManage.kind = item.manage.kind
  teamManage.typeName = item.manage.typeName || ''
  teamManage.open = true
}
function pickTeamItem(key: string) {
  createMenuOpen.value = false
  openTeamManage(key)
}
function onCreateOutsideDown(e: MouseEvent) {
  if (!createMenuOpen.value) return
  const target = e.target as Node
  if (createBtnRef.value?.contains(target) || createMenuRef.value?.contains(target)) return
  createMenuOpen.value = false
}
function onCreateViewportChange() {
  createMenuOpen.value = false
}
onMounted(() => {
  document.addEventListener('mousedown', onCreateOutsideDown, true)
  window.addEventListener('resize', onCreateViewportChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onCreateOutsideDown, true)
  window.removeEventListener('resize', onCreateViewportChange)
})

/**
 * 文档模式菜单：编辑 = 可编辑；修订 = 可编辑但修改记为修订；阅读 = 只读。
 * 切换时由文档页负责把未保存内容落盘、刷新修订标记。
 */
function onDocModeMenu({ key }: { key: string | number }) {
  if (key === 'read') {
    docsEditMode.value = false
    docsSuggestMode.value = false
  } else if (key === 'edit') {
    docsEditMode.value = true
    docsSuggestMode.value = false
  } else if (key === 'revision') {
    docsEditMode.value = true
    docsSuggestMode.value = true
  }
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

/** 个人：当前登录用户 */
const personalName = computed(() => user.value?.realName || user.value?.userEnName || user.value?.coAccount || user.value?.email || '')
const personalInitial = computed(() => personalName.value.slice(0, 1).toUpperCase())

/**
 * 企业：登录返回的所属组织（排除注册时自动创建的个人组织）。
 * 个人组织的过滤依赖组织名前缀，后端若返回专门的个人标记，改为按标记过滤。
 */
const enterprises = computed(() =>
  (user.value?.organizations || []).filter(o => o.status !== 0 && !(o.organizationName || '').startsWith('个人组织')),
)

/** 当前工作空间：'personal' 或企业 id，记在本地，切换后保持 */
const WS_KEY = 'faiz.currentWorkspace'
function readWorkspace(): string | number {
  try {
    const v = localStorage.getItem(WS_KEY)
    if (v === 'personal') return v
    if (v) return Number(v)
  } catch { /* 隐私模式等读取失败时回退默认 */ }
  return 'personal'
}
const currentWs = ref<string | number>(readWorkspace())
/**
 * 切换个人 / 企业工作空间：先校验（企业存在、用户是成员、目标空间已初始化）。
 * 未初始化则开始同步并进入初始化进度页，完成后再进入目标空间。
 */
async function switchWs(key: string | number) {
  setUserPopoverOpen(false)
  const isPersonal = key === 'personal'
  const orgCode = isPersonal ? undefined : enterprises.value.find(o => String(o.id) === String(key))?.organizationCode
  if (!isPersonal && !orgCode) {
    message.error('企业信息缺失，请重新登录后再试')
    return
  }
  try {
    const res = await checkInitWorkspace(orgCode)
    if (!res?.success || !res.data) return
    if (res.data.needsInit) {
      const started = await startInitConfig(orgCode ? { organizationCode: orgCode } : {})
      if (!started?.success) return
      router.push({
        name: 'InitProgress',
        query: orgCode ? { org: orgCode, ws: String(key) } : { ws: 'personal' },
      })
      return
    }
    currentWs.value = key
    setCurrentWorkspace(key)
  } catch {
    // 错误提示由 request 拦截器统一处理
  }
}
function orgInitial(name?: string) {
  return (name || '').trim().slice(0, 1).toUpperCase()
}

/** 创建 / 加入组织弹窗 */
const orgSetupOpen = ref(false)
const orgSetupLoading = ref(false)
function openOrgSetup() {
  setUserPopoverOpen(false)
  orgSetupOpen.value = true
}
/** 创建组织：调用后端创建，刷新用户资料让「企业」列表包含新组织，并切换到该组织 */
async function handleOrgCreate(name: string) {
  if (orgSetupLoading.value) return
  orgSetupLoading.value = true
  try {
    const res = await createSelfOrganization({ organizationName: name })
    if (res?.success === false) return
    const profile = await getCurrentUser()
    if (profile?.success && profile.data) {
      setAuthUser({ organizations: profile.data.organizations })
    }
    orgSetupOpen.value = false
    // 创建组织后进入初始化页面，由用户确认后开始同步企业默认空间数据
    const org = res?.data
    if (org?.organizationCode) {
      const started = await startInitConfig({ organizationCode: org.organizationCode })
      if (!started?.success) return
      router.push({
        name: 'InitProgress',
        query: { org: org.organizationCode, ws: org.id ? String(org.id) : 'personal' },
      })
    }
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    orgSetupLoading.value = false
  }
}
function handleOrgJoin(code: string) {
  console.log('加入组织（待接口）', code)
  message.info('加入组织功能即将上线')
}

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
/** 「更多」菜单：动作交给文档页执行（移动 / 收藏 / 下载 / 打印 / 文档信息 / 回收站） */
function onDocMoreMenu(e: { key?: string | number }) {
  const key = String(e?.key ?? '')
  if (key.startsWith('move:')) requestDocMore('move', key.slice(5))
  else if (key.startsWith('download:')) requestDocMore('download', key.slice(9))
  else requestDocMore(key)
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

/* 左侧 Logo + 模块名 */
.header-left-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-logo {
  flex: none;
}

.header-logo :deep(svg) {
  width: 32px;
  height: 32px;
}

/* 固定宽度（与左侧菜单同宽）：Logo 靠左，分割线 + 折叠图标贴在该宽度右边界上 */
.header-left.header-left-fixed {
  position: relative;
  /* 抵消顶栏左右 16px 内边距：让这一块的左边缘贴住窗口左侧，右边缘正好落在左侧菜单的竖线上 */
  margin-left: -16px;
  padding-left: 16px;
  padding-right: 0;
  width: var(--header-left-w);
  min-width: var(--header-left-w);
  flex: 0 0 var(--header-left-w);
  justify-content: flex-start;
}

/* 分割线贴在左侧菜单右边界上，向上与菜单竖线连成一线 */
.header-left-fixed .header-left-right {
  position: absolute;
  left: calc(100% - 1px);
  top: 50%;
  margin-left: 0;
  transform: translateY(-50%);
}

.header-left-fixed .header-divider {
  margin-left: 0;
  margin-right: 8px;
}

/* 模块名：由各模块布局传入 */
.header-module-title {
  margin-right: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
  white-space: nowrap;
}

.header-module-title.is-large {
  font-size: 21px;
}

/* 工作台：模块名相对左侧菜单宽度水平居中（Logo 仍靠左） */
.header-left-centered .header-module-title {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-right: 0;
  transform: translate(-50%, -50%);
  pointer-events: none;
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
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.docs-side-expand:hover {
  color: var(--docs-text);
  background: var(--docs-hover);
}

/* 文档详情：顶栏最左侧文件名 + 保存状态（上下两行，参考飞书） */
.docs-head-meta {
  /* 占满左侧到右边按钮组（分享）之间的全部空间 */
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  margin-right: 16px;
  line-height: 1.3;
}
/* 文档详情页顶栏左侧没有 Logo / 模块名：去掉这块的最小宽度，把位置让给文件名 */
.docs-head-meta + .header-left {
  min-width: 0;
  padding-right: 0;
}
/* 文件名容器：::after 放一份不可见的同款文字决定宽度，输入框叠在同一格里铺满 */
.docs-head-title-wrap {
  display: inline-grid;
  max-width: 100%;
  min-width: 0;
}
.docs-head-title-wrap::after {
  content: attr(data-value);
  grid-area: 1 / 1;
  height: 24px;
  /* 与输入框同字号、同内边距。输入框左右各有 4px 内边距（共 8px），
     这里右侧补 10px，保证文字未超出可用宽度时输入框内容区仍放得下整段标题，
     不会在标题没超长时也显示省略号 */
  padding: 0 10px 0 4px;
  margin-left: -4px;
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  white-space: pre;
  visibility: hidden;
}
.docs-head-title-wrap .docs-head-title {
  grid-area: 1 / 1;
}

/* 文件名：保存状态上方一行，可直接改名（样式同纯文本，聚焦才显边框） */
.docs-head-title {
  width: 100%;
  height: 24px;
  min-width: 0;
  padding: 0 4px;
  margin-left: -4px;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--docs-text);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius-sm);
  outline: none;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: box-shadow 0.12s, background 0.12s;
}
.docs-head-title::placeholder {
  color: var(--docs-text-3);
  font-weight: 500;
}
.docs-head-title:focus {
  background: var(--docs-hover);
  box-shadow: 0 0 0 1px var(--c-primary-border);
}

/* 保存状态轻提示（灰色小字，不抢视觉；保存失败用警示色） */
.docs-save-state {
  font-size: 12px;
  color: var(--docs-text-3);
  white-space: nowrap;
  user-select: none;
}
.docs-save-state.is-saving {
  color: var(--docs-text-3);
}
.docs-save-state.is-unsaved {
  color: var(--docs-warn);
}
/* 窄屏兼容：保存状态为辅助信息，宽度不足时隐藏（文件名保留但收窄） */
@media (max-width: 960px) {
  .docs-head-meta .docs-save-state {
    display: none;
  }
}

/* 文档详情：分享（主按钮，主题主色）与编辑/预览切换（分段控件观感） */
.docs-share {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  /* 静止底色用主题的按下色（苹果蓝 #0071E3）：白字对比度 4.7:1，达到 AA */
  background: var(--c-primary-active);
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: background-color var(--docs-dur) var(--docs-ease), box-shadow var(--docs-dur) var(--docs-ease);
}
.docs-share:hover {
  background: color-mix(in srgb, var(--c-primary-active) 88%, #000);
}
.docs-share:active {
  background: color-mix(in srgb, var(--c-primary-active) 78%, #000);
}
.docs-share:focus-visible {
  outline: none;
  box-shadow: var(--docs-focus);
}
/* 编辑 / 预览：1px 边框的圆角组，选中段用主题浅底 + 主色字；仍由整个按钮触发原下拉 */
.docs-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 34px;
  padding: 0 6px 0 2px;
  font-size: 14px;
  color: var(--docs-text-2);
  background: var(--docs-canvas);
  border: 1px solid var(--docs-border-strong);
  border-radius: var(--docs-radius);
  cursor: pointer;
  transition: border-color var(--docs-dur) var(--docs-ease), box-shadow var(--docs-dur) var(--docs-ease);
}
.docs-edit-btn:hover {
  border-color: var(--docs-text-3);
}
.docs-edit-btn {
  gap: 6px;
  padding: 0 12px;
}
.docs-edit-btn .docs-edit-caret {
  margin-left: 2px;
  font-size: 10px;
}
/* 编辑右侧的「更多」（横向三个点） */
/* 「更多」下拉：宽度与内容适中，与参考菜单一致的紧凑样式 */
.docs-more-popover .docs-more-menu {
  min-width: 200px;
  padding: 6px 0;
  border-radius: 10px;
}
.docs-more-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--docs-text-2);
  font-size: 18px;
  cursor: pointer;
}
.docs-more-btn:hover {
  background: var(--docs-hover);
  color: var(--docs-text);
}

/* 编辑 与 新建（+）之间的竖线 */
.docs-header-sep {
  flex: none;
  width: 1px;
  height: 18px;
  margin: 0 8px;
  background: var(--docs-border-strong);
}

/* 顶栏「+」新建按钮：与编辑 / 分享同高，仅图标 */
.docs-create-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 22px;
  color: var(--docs-text-2);
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.docs-create-btn:hover,
.docs-create-btn.is-open {
  color: var(--docs-text);
  background: var(--docs-hover);
}
/* 新建菜单浮层：固定定位，宽一些、字号 15px，分组标题与分隔线同截图 */
.docs-create-panel {
  position: fixed;
  z-index: 1000;
  box-sizing: border-box;
  width: 264px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  padding: 8px;
  background: var(--docs-canvas);
  border-radius: var(--docs-radius-xl);
  box-shadow: var(--docs-shadow-float);
}
.docs-create-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  font-size: 15px;
  color: var(--docs-text);
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--docs-radius);
  cursor: pointer;
}
.docs-create-item:hover {
  background: var(--docs-hover);
}
.docs-create-ico {
  flex: none;
  font-size: 20px;
}
.docs-create-caret {
  margin-left: auto;
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-create-group {
  padding: 10px 12px 4px;
  font-size: 13px;
  color: var(--docs-text-3);
}
.docs-create-sep {
  height: 1px;
  margin: 6px 4px;
  background: var(--docs-border);
}
/* 文档模式下拉：每项两行（标题 + 说明），当前模式打勾 */
.docs-mode-menu {
  min-width: 220px;
  padding: 6px 0;
}
.docs-mode-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}
.docs-mode-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.docs-mode-check {
  margin-left: auto;
  color: var(--c-primary);
}
.docs-mode-desc {
  padding-left: 24px;
  font-size: 12px;
  color: var(--docs-text-3);
}
.docs-edit-btn:focus-visible {
  outline: none;
  box-shadow: var(--docs-focus);
}
.docs-seg {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: var(--docs-radius-sm);
  color: var(--docs-text-2);
  white-space: nowrap;
}
.docs-seg.is-active {
  background: var(--c-primary-bg);
  color: var(--c-primary);
}
.docs-edit-caret {
  margin: 0 2px;
  font-size: 10px;
  color: var(--docs-text-3);
}
@media (max-width: 767px) {
  .docs-seg .anticon {
    display: none;
  }
}

/* 分享面板的浮层（antd 浮层挂在 body，故用 :global）：靠 overlay-class-name 定位，
   去掉内容区内边距，圆角与阴影直接用 token，不再用内联样式 + !important 覆盖 */
:global(.doc-share-popover .ant-popover-inner) {
  border-radius: var(--docs-radius-lg);
  box-shadow: var(--docs-shadow-float);
  padding: 0;
}
:global(.doc-share-popover .ant-popover-inner-content) {
  padding: 0;
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
   顶部一行：搜索 + 新建 + 头像
   ========================================================================== */
@media (max-width: 767px) {
  .app-header {
    min-width: 0;
    gap: 6px;
    padding: 0 8px;
  }

  .header-left,
  .header-left.collapsed,
  .header-left.header-left-fixed {
    /* 桌面端这里是侧栏宽度，手机必须让位给搜索区 */
    width: auto;
    min-width: 0 !important;
    /* 不参与收缩，否则后面的菜单按钮会被搜索框挤掉 */
    flex: 0 0 auto;
    gap: 4px;
    margin-left: 0;
    padding-left: 0;
    padding-right: 0;
  }

  /* 手机端不按菜单宽度居中：模块名跟随内容从左排 */
  .header-left-centered .header-module-title {
    position: static;
    transform: none;
    margin-right: 0;
  }

  /* 手机屏幕窄，logo 让位给功能区（保留在平板 / 桌面） */
  .header-left > .app-logo,
  .header-logo {
    display: none;
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
  width: 260px;
  padding: 6px 0;
}

.user-panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 14px 2px;
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
  display: flex;
  flex-direction: column;
  padding: 2px 16px;
}

.user-menu-text {
  padding: 5px 0;
  font-size: 13px;
  color: #262626;
  cursor: pointer;
  transition: color 0.15s;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu-text:hover {
  color: var(--c-primary);
}

.user-divider {
  height: 1px;
  background: #f0f0f0;
  margin: 6px 16px;
}

.user-section-title {
  padding: 0 16px 2px;
  font-size: 12px;
  line-height: 18px;
  color: #8c8c8c;
  font-weight: 500;
}

/* 用户弹层内的工作空间列表：更紧凑 */
.user-panel .user-ws-item {
  padding: 4px 8px;
  margin: 0 6px;
}
.user-panel .user-ws-avatar,
.user-panel .user-ws-action-icon {
  width: 24px;
  height: 24px;
  font-size: 11px;
}
.user-panel .user-ws-action-icon {
  font-size: 12px;
}
.user-panel .user-ws-name {
  font-size: 13px;
  line-height: 20px;
}
.user-panel .user-ws-empty {
  padding: 4px 14px;
  font-size: 12px;
}

.user-ws-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.user-ws-item:hover {
  background: #f5f5f5;
}

.user-ws-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  object-fit: cover;
}

.user-ws-avatar--person {
  border-radius: 50%;
  background: linear-gradient(135deg, #a8c5ff 0%, #6e9bff 100%);
}

.user-ws-avatar--org {
  border-radius: 8px;
  background: linear-gradient(135deg, #0052d9 0%, #7f5cff 55%, #ff7a45 100%);
}

.user-ws-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  color: #262626;
}

.user-ws-check {
  color: var(--c-primary, #0052d9);
  font-size: 14px;
  flex-shrink: 0;
}

.user-ws-empty {
  margin: 0 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: #bfbfbf;
}

.user-ws-action {
  color: var(--c-primary, #0052d9);
}

.user-ws-action .user-ws-name {
  color: inherit;
}

.user-ws-action-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.user-org-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 16px 8px;
  padding: 12px;
  background: linear-gradient(135deg, #f0f6ff 0%, #f7fbff 100%);
  border: 1px dashed #b7d4ff;
  border-radius: 10px;
}

.user-org-empty-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  background: linear-gradient(135deg, #0052d9 0%, #60a8ff 100%);
}

.user-org-empty-text {
  flex: 1;
  min-width: 0;
}

.user-org-empty-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f1f1f;
}

.user-org-empty-desc {
  margin-top: 2px;
  font-size: 12px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-org-empty-btn {
  flex-shrink: 0;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background: var(--c-primary, #0052d9);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.user-org-empty-btn:hover {
  opacity: 0.88;
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
