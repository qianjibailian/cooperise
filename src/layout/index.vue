<template>
  <a-layout class="layout-container">
    <AppHeader
      :drawer-open="drawerOpen"
      search-placeholder="搜索事项单号或者概要"
      @menu-click="handleMenuClick"
      @workspace-click="handleWorkspaceClick"
      @create-click="handleNewFormOpen"
      @search="handleHeaderSearch"
    />

    <AppSideDrawer
      :open="drawerOpen"
      @close="drawerOpen = false"
      @menu-click="handleRemoteMenuClick"
    />

    <a-layout-sider :width="280" class="sider" :collapsed="false">
      <div class="sider-inner">
        <!-- 左侧图标栏 -->
        <div class="icon-bar">
          <div
            v-for="item in iconBarItems"
            :key="item.key"
            class="icon-bar-item"
            :class="{ active: activeSection === item.key }"
            @click="handleSectionClick(item.key)"
          >
            <component :is="item.icon" class="icon-bar-icon" />
            <span class="icon-bar-label">{{ item.label }}</span>
          </div>
        </div>

        <!-- 右侧面板 -->
        <div class="side-panel">
          <template v-if="activeSection === 'workspace'">
            <a-menu
              theme="light"
              mode="inline"
              :selectedKeys="[currentPath]"
              @click="handleLocalMenuClick"
              class="sidebar-menu"
            >
              <a-menu-item key="/workbench/filters">
                <component :is="FilterOutlined" />
                <span>新筛选器</span>
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="/workbench/todo">
                <component :is="CheckSquareOutlined" />
                <span>我的事项 (2)</span>
              </a-menu-item>
            </a-menu>

            <a-divider class="panel-divider" />

            <!-- 视图区域 -->
            <div class="panel-section scrollable">
              <div class="panel-section-header">
                <span class="section-title">我的视图</span>
                <div class="section-header-actions">
                  <component :is="SearchOutlined" class="action-icon" />
                  <component :is="PlusOutlined" class="action-icon" />
                </div>
              </div>
              <a-menu
                theme="light"
                mode="inline"
                :selectedKeys="['/view/folder1/item3']"
                :openKeys="['/view/folder1']"
                @click="handleLocalMenuClick"
                class="sidebar-menu"
              >
                <!-- 产品需求 (可展开) -->
                <a-sub-menu key="/view/folder1">
                  <template #title>
                    <span class="view-item-content">
                      <component :is="FolderOutlined" />
                      <span>产品需求 (12)</span>
                      <a-tag class="view-tag external">外</a-tag>
                    </span>
                  </template>
                  <a-menu-item key="/view/folder1/item1">
                    <span class="child-item">
                      <span>CLUB开卡需求</span>
                      <component :is="StarFilled" class="favorite-icon" />
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item2">
                    <span class="child-item">
                      <span>会员体系优化</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item3">
                    <span class="child-item">
                      <span>积分商城改版</span>
                      <component :is="MoreOutlined" class="child-more-icon" />
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item4">
                    <span class="child-item">
                      <span>签到功能迭代</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item5">
                    <span class="child-item">
                      <span class="child-text-truncate">超省卡营销工具需...</span>
                    </span>
                  </a-menu-item>
                </a-sub-menu>

                <!-- 独立视图项 -->
                <a-menu-item key="/view/sprint-board">
                  <component :is="AppstoreOutlined" />
                  <span>Sprint 看板</span>
                </a-menu-item>
                <a-menu-item key="/view/bug-list">
                  <component :is="UnorderedListOutlined" />
                  <span>待修复 Bug (3)</span>
                </a-menu-item>
              </a-menu>
            </div>
          </template>

          <template v-else-if="activeSection === 'system'">
            <div class="panel-section">
              <div class="panel-section-header">
                <component :is="SettingOutlined" class="section-icon" />
                <span class="section-title">系统管理</span>
              </div>
              <a-menu
                theme="light"
                mode="inline"
                :selectedKeys="[currentPath]"
                @click="handleLocalMenuClick"
                class="sidebar-menu"
              >
                <a-menu-item key="/users">
                  <component :is="UserOutlined" />
                  <span>用户管理</span>
                </a-menu-item>
                <a-menu-item key="/roles">
                  <component :is="TeamOutlined" />
                  <span>角色管理</span>
                </a-menu-item>
                <a-menu-item key="/permissions">
                  <component :is="LockOutlined" />
                  <span>权限管理</span>
                </a-menu-item>
                <a-menu-item key="/departments">
                  <component :is="BuildOutlined" />
                  <span>部门管理</span>
                </a-menu-item>
              </a-menu>
            </div>
          </template>

          <template v-else-if="activeSection === 'settings'">
            <div class="panel-section">
              <div class="panel-section-header">
                <component :is="SettingOutlined" class="section-icon" />
                <span class="section-title">设置</span>
              </div>
              <a-menu
                theme="light"
                mode="inline"
                :selectedKeys="[currentPath]"
                @click="handleLocalMenuClick"
                class="sidebar-menu"
              >
                <a-sub-menu key="template-config">
                  <template #title>
                    <component :is="AppstoreOutlined" />
                    <span>模板配置</span>
                  </template>
                  <a-menu-item key="/settings/template-list">
                    <component :is="UnorderedListOutlined" />
                    <span>模板列表</span>
                  </a-menu-item>
                  <a-menu-item key="/settings/form-list">
                    <component :is="TableOutlined" />
                    <span>表单列表</span>
                  </a-menu-item>
                </a-sub-menu>
                <a-menu-item key="/settings/profile">
                  <component :is="UserOutlined" />
                  <span>个人中心</span>
                </a-menu-item>
                <a-menu-item key="/settings/account">
                  <component :is="LockOutlined" />
                  <span>账户设置</span>
                </a-menu-item>
              </a-menu>
            </div>
          </template>
        </div>
      </div>
    </a-layout-sider>
    <a-layout class="main-layout">
      <a-layout-content class="content">
        <WorkbenchPanel />
      </a-layout-content>
    </a-layout>

    <!-- 登录态过期弹窗 -->
    <a-modal
      v-model:open="showLoginExpiredModal"
      :closable="true"
      :mask-closable="false"
      :keyboard="false"
      width="400px"
      :style="{ top: '15%' }"
      @cancel="handleRelogin"
    >
      <div class="login-expired-modal">
        <InfoCircleOutlined class="login-expired-icon" />
        <span class="login-expired-text">登录态已过期，请重新登录</span>
      </div>
      <template #footer>
        <a-button type="primary" @click="handleRelogin">重新登录</a-button>
      </template>
    </a-modal>

    <!-- 新建弹窗 -->
    <a-modal
      v-model:open="showNewFormModal"
      title="新建"
      width="60%"
      centered
      :mask-closable="false"
      @ok="handleNewFormSubmit"
      @cancel="handleNewFormCancel"
      ok-text="提交"
      cancel-text="取消"
      destroy-on-close
      class="new-form-modal"
    >
      <div class="new-form-scroll">
        <div class="form-type-row">
          <label class="form-type-label">事项类型</label>
          <a-select
            v-model:value="newFormIssueType"
            placeholder="请选择事项类型"
            size="large"
            style="width: 100%"
          >
            <a-select-option value="requirement">需求</a-select-option>
            <a-select-option value="task">任务</a-select-option>
            <a-select-option value="bug">缺陷</a-select-option>
            <a-select-option value="other">其他</a-select-option>
          </a-select>
        </div>
        <a-tabs v-if="newFormTabs.length > 0" v-model:activeKey="newFormActiveTab" class="new-form-tabs">
          <a-tab-pane v-for="(tab, idx) in newFormTabs" :key="tab.id" :tab="tab.name">
            <vxe-form-view
              v-if="showNewFormModal"
              :key="`${formTemplateKey}_${idx}`"
              :config="tab.viewConfig"
              v-model="newFormData"
            />
          </a-tab-pane>
        </a-tabs>
        <a-empty v-else description="选择事项类型后加载表单" />
      </div>
    </a-modal>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  HomeOutlined,
  SettingOutlined,
  FilterOutlined,
  CheckSquareOutlined,
  SearchOutlined,
  PlusOutlined,
  FolderOutlined,
  StarFilled,
  AppstoreOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  TeamOutlined,
  LockOutlined,
  BuildOutlined,
  UserOutlined,
  TableOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSideDrawer from '@/components/AppSideDrawer.vue'
import WorkbenchPanel from './WorkbenchPanel.vue'
import { useAuth } from '@/utils/auth'
import { getNewFormTemplate, submitIssueForm } from '@/api/faiz'

const iconBarItems = [
  { key: 'workspace', icon: HomeOutlined, label: '工作台' },
  { key: 'settings', icon: SettingOutlined, label: '设置' },
]

const router = useRouter()
const route = useRoute()
const { isLoggedIn, refresh: refreshAuth } = useAuth()

const drawerOpen = ref(false)
const activeSection = ref('workspace')

// 登录态过期弹窗
const showLoginExpiredModal = ref(false)

// 新建表单弹窗
const showNewFormModal = ref(false)
const newFormViewRef = ref<any>()
const newFormData = ref<Record<string, any>>({})
const newFormIssueType = ref('requirement')

// 默认空模板（兜底）
const emptyFormConfig = () => ({
  pcVisible: true, pcVertical: true, pcTitleBold: true, pcTitleColon: false,
  pcTitleAlign: '', pcTitleWidth: '', pcTitleAutoWidth: true, pcTitleWidthUnit: '',
  mobileVisible: false, mobileVertical: true, mobileTitleBold: true, mobileTitleColon: false,
  mobileTitleAlign: '', mobileTitleWidth: '', mobileTitleAutoWidth: true, mobileTitleWidthUnit: '',
  isLog: false, isPC: true, isMobile: false, isApplet: false,
})



const formTemplateKey = ref(0)
const newFormTabs = ref<{ id: string; name: string; formConfig: any; widgetData: any[] }[]>([])
const newFormActiveTab = ref('')

function initFormData() {
  Object.keys(newFormData.value).forEach(k => delete newFormData.value[k])
  const walk = (widgets: any[]) => {
    widgets.forEach((w: any) => {
      if (w.children && w.children.length) walk(w.children)
      else if (w.field) newFormData.value[w.field] = null
    })
  }
  newFormTabs.value.forEach(tab => walk(tab.widgetData || []))
}

// 切换事项类型时，从后端加载对应的启用模板
async function loadTemplateByIssueType(issueType: string) {
  try {
    const res = await getNewFormTemplate(issueType)
    const tpl = res.data
    if (tpl && tpl.tabs && tpl.tabs.length > 0) {
      newFormTabs.value = tpl.tabs.map((tab: any) => {
        let formConfig = tab.formConfig || { title: tab.name, ...emptyFormConfig() }
        if (typeof formConfig === 'string') formConfig = { ...emptyFormConfig(), ...JSON.parse(formConfig || '{}') }
        let widgetData = tab.widgetData || []
        if (typeof widgetData === 'string') widgetData = JSON.parse(widgetData || '[]')
        return {
          id: tab.id,
          name: tab.name || '未命名表单',
          formConfig,
          widgetData,
          viewConfig: { formConfig, widgetData },
        }
      })
      newFormActiveTab.value = newFormTabs.value[0]?.id || ''
    } else {
      newFormTabs.value = []
    }
  } catch {
    newFormTabs.value = []
  }
  formTemplateKey.value++
  initFormData()
}

watch(showNewFormModal, (visible) => {
  if (!visible) {
    newFormIssueType.value = 'requirement'
    newFormTabs.value = []
    formTemplateKey.value++
    initFormData()
  }
})

watch(newFormData, (val) => {
  console.log('[newFormData changed]', JSON.stringify(val, null, 2))
}, { deep: true })

watch(newFormIssueType, (val) => {
  if (val) loadTemplateByIssueType(val)
  else newFormTabs.value = []
})

async function handleNewFormOpen() {
  newFormIssueType.value = 'requirement'
  await loadTemplateByIssueType('requirement')
  showNewFormModal.value = true
}

function handleNewFormCancel() {
  showNewFormModal.value = false
}

async function handleNewFormSubmit() {
  const $formView = newFormViewRef.value
  if ($formView) {
    const errMap = await $formView.validate()
    if (Object.keys(errMap).length) {
      message.warning('请完整填写必填项')
      return
    }
  }

  const payload: Record<string, unknown> = {
    issueType: newFormIssueType.value,
    ...newFormData.value,
  }

  try {
    await submitIssueForm(payload)
    message.success('提交成功')
    showNewFormModal.value = false
  } catch (err: any) {
    message.error(err?.response?.data?.message || '提交失败，请稍后重试')
  }
}

watch(isLoggedIn, (loggedIn) => {
  showLoginExpiredModal.value = !loggedIn
}, { immediate: true })

onMounted(() => {
  refreshAuth()
  showLoginExpiredModal.value = !isLoggedIn.value
})

function handleRelogin() {
  const loginUrl = import.meta.env.VITE_ACCOUNT_URL + '?oauth_callback=' + encodeURIComponent(window.location.href)
  window.location.href = loginUrl
}

const currentPath = computed(() => {
  if (route.path.startsWith('/users') || route.path.startsWith('/roles') || route.path.startsWith('/permissions') || route.path.startsWith('/departments')) {
    activeSection.value = 'system'
    return route.path
  }
  if (route.path.startsWith('/settings')) {
    activeSection.value = 'settings'
    return route.path
  }
  return route.path
})

function handleSectionClick(key: string) {
  activeSection.value = key
}

function handleMenuClick() {
  drawerOpen.value = !drawerOpen.value
}

function handleWorkspaceClick() {
  router.push('/dashboard')
}

function handleHeaderSearch(value: string) {
  if (value) router.push(value)
}

function handleLocalMenuClick(info: { key: string }) {
  router.push(info.key)
}
function handleRemoteMenuClick(key: string) {
  let path = key
  if (path.startsWith('/cooperise')) {
    path = path.replace(/^\/cooperise/, '') || '/dashboard'
  }
  router.push(path)
}
</script>

<style scoped>
.layout-container {
  height: 100%;
  background: #fafafa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.sider {
  background: #ffffff !important;
  height: calc(100vh - 56px);
  position: fixed;
  left: 0;
  top: 56px;
  bottom: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.04);
}

.sider-inner {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
  height: 100vh;
}

/* 左侧图标栏 */
.icon-bar {
  width: 64px;
  min-width: 64px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  border-right: 1px solid #e8e8e8;
  height: 100%;
}

.icon-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 64px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.15s ease;
}

.icon-bar-item:hover {
  background: rgba(0, 0, 0, 0.06);
}

.icon-bar-item.active {
  background: #e6f7ff;
}

.icon-bar-item.active .icon-bar-icon {
  color: #1890ff;
}

.icon-bar-item.active .icon-bar-label {
  color: #1890ff;
}

.icon-bar-icon {
  font-size: 20px;
  color: #595959;
  margin-bottom: 2px;
}

.icon-bar-label {
  font-size: 11px;
  color: #595959;
  line-height: 1.2;
}

/* 右侧面板 */
.side-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.panel-section {
  padding: 8px 0;
}

.panel-section.scrollable {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.panel-section-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 8px;
}

.section-icon {
  font-size: 16px;
  color: #595959;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #262626;
}

.section-header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.action-icon {
  font-size: 16px;
  color: #8c8c8c;
  cursor: pointer;
}

.action-icon:hover {
  color: #1890ff;
}

.panel-divider {
  margin: 4px 16px !important;
}

.secondary-nav .sidebar-menu {
  padding: 8px 6px;
}

.sidebar-menu {
  border-right: none !important;
}

.sidebar-menu :deep(.ant-menu-item) {
  margin: 2px 8px;
  border-radius: 6px;
  height: 36px;
  line-height: 36px;
  color: #595959;
  font-size: 13px;
  font-weight: 400;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  transition: all 0.15s ease;
}

.sidebar-menu :deep(.ant-menu-item:hover) {
  background: #f5f5f5 !important;
  color: #262626;
}

.sidebar-menu :deep(.ant-menu-item-selected) {
  background: #e6f7ff !important;
  color: #1890ff !important;
  font-weight: 500;
}

.sidebar-menu :deep(.ant-menu-item-selected::after) {
  display: none;
}

.sidebar-menu :deep(.ant-menu-item .anticon) {
  font-size: 16px;
  color: inherit;
}

.view-item-content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.view-tag {
  font-size: 11px;
  height: 18px;
  line-height: 16px;
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.view-tag.external {
  color: #52c41a;
  border-color: #b7eb8f;
  background: #f6ffed;
}

.view-tag.shared {
  color: #1890ff;
  border-color: #91d5ff;
  background: #e6f7ff;
}

/* 子菜单项样式 */
.child-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.favorite-icon {
  color: #faad14 !important;
  font-size: 13px !important;
  margin-left: -4px;
}

.child-text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.child-more-icon {
  margin-left: auto;
  color: #bfbfbf !important;
  cursor: pointer;
  font-size: 14px !important;
}

.child-more-icon:hover {
  color: #595959 !important;
}

/* 子菜单缩进 */
.sidebar-menu :deep(.ant-menu-sub) {
  background: transparent !important;
}

.sidebar-menu :deep(.ant-menu-sub .ant-menu-item) {
  padding-left: 48px !important;
  height: 32px;
  line-height: 32px;
  margin: 1px 8px;
}

.main-layout {
  padding-top: 56px;
  margin-left: 280px;
  min-height: 100vh;
  transition: margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.content {
  padding: 8px;
  background: #f4f5f8;
  width: 100%;
  box-sizing: border-box;
}

.content > :deep(*) {
  width: 100%;
}

/* 登录态过期弹窗 */
.login-expired-modal {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.login-expired-icon {
  color: #faad14;
  font-size: 20px;
  flex-shrink: 0;
}

.login-expired-text {
  font-size: 16px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.88);
}



.new-form-scroll {
  max-height: calc(60vh - 110px);
  overflow-y: auto;
  padding-right: 4px;
}

.form-type-row {
  margin-bottom: 20px;
}

.form-type-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 6px;
}

.new-form-tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 16px;
  }
}
</style>

<style>
/* Modal 样式需要写在非 scoped 块中，因为 Ant Design Modal 通过 Teleport 渲染到 body */
.new-form-modal .ant-modal-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.new-form-modal .ant-modal {
  top: 0;
  padding-bottom: 0;
}

.new-form-modal .ant-modal-header {
  justify-content: center;
}

.new-form-modal .ant-modal-title {
  width: 100%;
  text-align: center;
}

.new-form-modal .ant-modal-content {
  display: flex;
  flex-direction: column;
}

.new-form-modal .ant-modal-body {
  flex: 1;
  min-height: 0;
  max-height: 60vh;
  overflow: hidden;
}
</style>
