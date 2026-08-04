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
                  <a-menu-item key="/view/testing-calendar">
                    <span class="child-item">
                      <span>测试平台需求</span>
                      <component :is="StarFilled" class="favorite-icon" />
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/member-gantt">
                    <span class="child-item">
                      <span>会员体系优化</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item3">
                    <span class="child-item">
                      <span>商城改版</span>
                      <component :is="MoreOutlined" class="child-more-icon" />
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item4">
                    <span class="child-item">
                      <span>日常功能迭代</span>
                    </span>
                  </a-menu-item>
                  <a-menu-item key="/view/folder1/item5">
                    <span class="child-item">
                      <span class="child-text-truncate">88VIP会员工具需...</span>
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
                  <a-menu-item key="/settings/component-list">
                    <component :is="AppstoreOutlined" />
                    <span>组件列表</span>
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
      width="60%"
      centered
      :mask-closable="false"
      :confirm-loading="newFormSubmitting"
      @ok="handleNewFormSubmit"
      @cancel="handleNewFormCancel"
      ok-text="提交"
      cancel-text="取消"
      destroy-on-close
      class="new-form-modal"
    >
      <template #title>
        <div class="new-form-title-bar">
          <span class="new-form-title-side"></span>
          <span class="new-form-title-text">新建</span>
          <div class="new-form-title-side new-form-title-side-right">
            <div class="new-form-template-selector">
              <span class="new-form-template-label">选择模板</span>
              <a-select
                v-model:value="selectedTemplate"
                class="new-form-template-select"
                :popup-match-select-width="false"
                @change="handleTemplateChange"
              >
                <a-select-option
                  v-for="tpl in templateOptions"
                  :key="tpl.value"
                  :value="tpl.value"
                >{{ tpl.label }}</a-select-option>
              </a-select>
            </div>
          </div>
        </div>
      </template>
      <a-spin :spinning="newFormLoading" class="new-form-spin">
        <div class="new-form-inner">
          <!-- 上部固定区：事项类型（垂直居中于分割线上方） -->
          <div class="new-form-header">
            <a-form layout="horizontal" :label-width="120">
              <a-form-item label="事项类型">
                <a-select
                  v-model:value="newFormIssueTypeId"
                  style="width: 100%"
                  @change="loadCreateMeta"
                >
                  <a-select-option v-for="opt in issueTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
                </a-select>
              </a-form-item>
            </a-form>
          </div>
          <!-- 分割线：放在 header 与 tabs 之间 -->
          <a-divider class="new-form-divider" />
          <!-- 下部固定容器：承载 Tabs + 内容区 -->
          <div class="new-form-tabs-area">
            <template v-if="newFormTabs.length > 0">
              <a-tabs
                v-model:activeKey="newFormActiveTab"
                class="new-form-tabs"
                :tab-bar-style="{ marginBottom: '16px' }"
              >
                <a-tab-pane v-for="tab in newFormTabs" :key="tab.title" :tab="tab.title">
                  <!-- 每个 tab 内部包一层独立滚动容器 -->
                  <div class="tab-pane-scroll">
                    <a-form layout="horizontal" :label-width="120" :model="newFormData">
                      <a-form-item
                        v-for="field in tab.issueFields"
                        :key="field.id"
                      >
                        <template #label>
                          <span>{{ field.name }}</span>
                          <span v-if="field.required" class="form-item-required-mark">*</span>
                        </template>
                        <template v-if="field.type === 'TEXT_BOX_SINGLE_LINE'">
                          <a-input v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                        </template>
                        <template v-else-if="field.type === 'RICH_TEXT' || field.type === 'TEXT_BOX_MULTILINE'">
                          <a-textarea v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :rows="4" :disabled="!field.editable" style="width: 100%" />
                        </template>
                        <template v-else-if="field.type === 'NUMERIC_FIELD'">
                          <a-input-number v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                        </template>
                        <template v-else-if="field.type === 'DATE_PICKER'">
                          <a-date-picker v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                        </template>
                        <template v-else-if="field.type === 'SELECT_LIST_SINGLE' || field.type === 'SELECT_LIST_CASCADING' || field.type === 'SELECT_USER_SINGLE' || field.type === 'SPRINT_FIELD'">
                          <a-select v-model:value="newFormData[field.id]" :placeholder="field.description || '请选择'" :disabled="!field.editable" allow-clear style="width: 100%" />
                        </template>
                        <template v-else-if="field.type === 'CHECKBOX'">
                          <a-checkbox-group v-model:value="newFormData[field.id]" :disabled="!field.editable" />
                        </template>
                        <template v-else-if="field.type === 'ATTACHMENT_FIELD'">
                          <a-upload :disabled="!field.editable">
                            <a-button>点击上传</a-button>
                          </a-upload>
                        </template>
                        <template v-else-if="field.type === 'LINKS_FIELD'">
                          <a-input v-model:value="newFormData[field.id]" placeholder="输入关联事项编号" :disabled="!field.editable" style="width: 100%" />
                        </template>
                        <template v-else>
                          <a-input v-model:value="newFormData[field.id]" :placeholder="field.description || ''" :disabled="!field.editable" style="width: 100%" />
                        </template>
                      </a-form-item>
                    </a-form>
                  </div>
                </a-tab-pane>
              </a-tabs>
            </template>
            <a-empty v-else description="暂无表单字段" />
          </div>
        </div>
      </a-spin>
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
import { getIssueCreateMeta, submitIssueForm } from '@/api/faiz'

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
const newFormLoading = ref(false)
const newFormSubmitting = ref(false)
const newFormData = ref<Record<string, any>>({})
const newFormTabs = ref<{ title: string; sequence: number; issueFields: any[] }[]>([])
const newFormActiveTab = ref('')
const newFormIssueTypeId = ref('10002')
const issueTypeOptions = [
  { value: '10001', label: '需求' },
  { value: '10002', label: '任务' },
  { value: '10003', label: '缺陷' },
  { value: '10004', label: '其他' },
]

// 选择模板（标题栏右侧下拉）
const DEFAULT_TEMPLATE = 'default'
const selectedTemplate = ref<string>(DEFAULT_TEMPLATE)
const templateOptions = [
  { value: 'default', label: '默认模板' },
]

const handleTemplateChange = (_val: string) => {
  // TODO: 根据不同模板预填表单/切换字段配置
  // 目前仅记录选择，保持现有新建流程不变
}

// 加载创建表单元数据
async function loadCreateMeta() {
  newFormLoading.value = true
  try {
    const res = await getIssueCreateMeta({ projectId: '18701', issueTypeId: newFormIssueTypeId.value })
    const info = res?.data
    if (info?.data?.tabItems?.length) {
      newFormTabs.value = info.data.tabItems
      newFormActiveTab.value = info.data.tabItems[0].title
    } else if (info?.issueFields?.length) {
      newFormTabs.value = [{ title: '表单', sequence: 0, issueFields: info.issueFields }]
      newFormActiveTab.value = '表单'
    } else {
      newFormTabs.value = []
    }
    // 初始化表单值
    const form: Record<string, unknown> = {}
    for (const tab of newFormTabs.value) {
      for (const f of tab.issueFields) {
        form[f.id] = f.value ?? null
      }
    }
    newFormData.value = form
  } catch {
    message.error('获取表单元数据失败')
    newFormTabs.value = []
  } finally {
    newFormLoading.value = false
  }
}

async function handleNewFormOpen() {
  // 每次打开时重置为默认模板
  selectedTemplate.value = DEFAULT_TEMPLATE
  showNewFormModal.value = true
  await loadCreateMeta()
}

function handleNewFormCancel() {
  // 关闭时清理模板选择
  selectedTemplate.value = DEFAULT_TEMPLATE
  showNewFormModal.value = false
}

async function handleNewFormSubmit() {
  // 校验必填
  for (const tab of newFormTabs.value) {
    for (const f of tab.issueFields) {
      if (f.required) {
        const val = newFormData.value[f.id]
        if (val === null || val === undefined || val === '') {
          message.warning(`请填写${f.name}`)
          newFormActiveTab.value = tab.title
          return
        }
      }
    }
  }
  newFormSubmitting.value = true
  try {
    await submitIssueForm(newFormData.value)
    message.success('提交成功')
    showNewFormModal.value = false
  } catch (err: any) {
    message.error(err?.response?.data?.message || '提交失败，请稍后重试')
  } finally {
    newFormSubmitting.value = false
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



.new-form-tabs {
  /* scoped 样式保持空壳，Tabs 内部结构写在全局 <style> 里 */
}
</style>

<style>
/* Modal 样式需要写在非 scoped 块中，因为 Ant Design Modal 通过 Teleport 渲染到 body */

/* ========== 苹果 × Google 融合主题色 ========== */
/* 主色：苹果蓝 + Material 亮度；强调用 #0A84FF / Material #667CFF */
/* 参考：Apple HIG 卡片式弹窗 + Material 3 大圆角 + 柔和阴影 */

.new-form-modal .ant-modal-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  /* 弹窗蒙层：Material 3 scrim 风格 */
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.new-form-modal .ant-modal {
  top: 0;
  padding-bottom: 0;
  /* Apple 风多层柔和阴影 + Material elevation */
  box-shadow:
    0 1px 2px 0 rgba(15, 23, 42, 0.04),
    0 8px 24px -4px rgba(15, 23, 42, 0.08),
    0 24px 64px -12px rgba(15, 23, 42, 0.18);
}

.new-form-modal .ant-modal-mask {
  background: transparent;
}

/* ========== 弹窗整体容器：大圆角 + 背景 ========== */
.new-form-modal .ant-modal-content {
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  min-height: 0;
  /* Material 3：推荐圆角 28dp，取 20px 居中兼顾 Apple */
  border-radius: 20px;
  overflow: hidden;
  background: #ffffff;
  /* 顶部极淡高光，模拟 Apple sheet 质感 */
  border: 1px solid rgba(15, 23, 42, 0.06);
}

/* ========== Header：居中标题 + 右侧「选择模板」下拉 ========== */
.new-form-modal .ant-modal-header {
  flex-shrink: 0;
  padding: 14px 24px 10px;
  border-bottom: none;
  background: transparent;
  border-radius: 0;
  display: block;
}

/* 自定义 title 容器：三列对称，保证中间「新建」严格水平居中 */
.new-form-modal .ant-modal-title {
  width: 100%;
  margin: 0;
}

.new-form-title-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  /* 三列等宽，左右两列宽度必须严格对称 */
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  column-gap: 0;
}

/* 左占位：宽度与右侧列严格相等，抵消关闭按钮占用的视觉空间 */
.new-form-title-side {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.new-form-title-text {
  grid-column: 2 / 3;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: #0f172a;
  white-space: nowrap;
  /* 避免挤压两侧列 */
  min-width: 0;
}

/* 右侧列：选择模板靠右对齐 */
.new-form-title-side-right {
  justify-content: flex-end;
  overflow: visible;
}

/* 选择模板：label + select 一行紧凑排列（整体向右内收，不贴边） */
.new-form-template-selector {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  width: auto;
  margin-right: 24px;
}

.new-form-template-label {
  font-size: 13px;
  color: #475569;
  font-weight: 500;
  white-space: nowrap;
}

.new-form-template-select.ant-select {
  width: 160px;
  min-width: 0;
}

.new-form-template-select .ant-select-selector {
  height: 32px !important;
  line-height: 30px !important;
  padding: 0 12px !important;
  border-radius: 8px !important;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  font-size: 13px;
  color: #0f172a;
  transition: all 0.15s ease;
}

.new-form-template-select:hover .ant-select-selector {
  border-color: #cbd5e1 !important;
}

.new-form-template-select.ant-select-focused .ant-select-selector {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12) !important;
}

.new-form-template-select.ant-select-single .ant-select-selector .ant-select-selection-item,
.new-form-template-select.ant-select-single .ant-select-selector .ant-select-selection-placeholder,
.new-form-template-select.ant-select-single .ant-select-selector .ant-select-selection-search-input {
  height: 30px !important;
  line-height: 30px;
}

/* 关闭按钮位置微调，避免和标题栏下拉框重叠 */
.new-form-modal .ant-modal-close {
  top: 20px;
  right: 24px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 0.15s ease;
}

.new-form-modal .ant-modal-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.new-form-modal .ant-modal-close-x {
  width: auto;
  height: auto;
  font-size: 16px;
  line-height: 1;
}

/* ========== Footer：按钮区 + 细分隔线 ========== */
.new-form-modal .ant-modal-footer {
  flex-shrink: 0;
  padding: 12px 24px 16px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  background: transparent;
  text-align: right;
  border-radius: 0;
}

/* Apple 风按钮：主按钮胶囊蓝底，次按钮白底轻边 */
.new-form-modal .ant-modal-footer .ant-btn {
  height: 34px;
  padding: 0 20px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}

/* 取消按钮：Material Outlined + Apple 浅边 */
.new-form-modal .ant-modal-footer .ant-btn-default {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #0f172a;
}

.new-form-modal .ant-modal-footer .ant-btn-default:hover {
  background: #f8fafc;
  border-color: #94a3b8;
  color: #0f172a;
}

/* 确定按钮：Apple 蓝主色 + Material 轻微高光 + hover 阴影 */
.new-form-modal .ant-modal-footer .ant-btn-primary {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  color: #ffffff;
  box-shadow:
    0 1px 2px 0 rgba(37, 99, 235, 0.18),
    0 4px 12px -2px rgba(37, 99, 235, 0.35);
}

.new-form-modal .ant-modal-footer .ant-btn-primary:hover {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow:
    0 1px 2px 0 rgba(29, 78, 216, 0.20),
    0 6px 16px -2px rgba(29, 78, 216, 0.40);
  transform: translateY(-0.5px);
}

.new-form-modal .ant-modal-footer .ant-btn-primary:active {
  transform: translateY(0);
  box-shadow:
    0 1px 2px 0 rgba(29, 78, 216, 0.25),
    inset 0 1px 2px 0 rgba(0, 0, 0, 0.08);
}

/* loading 下保持原色不闪灰 */
.new-form-modal .ant-modal-footer .ant-btn-primary.ant-btn-loading {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  opacity: 0.85;
}

/* body 占满 content 剩余高度（= 75vh - header - footer），交给内部 flex 分区 */
.new-form-modal .ant-modal-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 6px 24px 16px;
  box-sizing: border-box;
}

/* 内部整体容器：纵向 flex 占满 body */
.new-form-spin,
.new-form-spin .ant-spin-container {
  height: 100%;
  min-height: 0;
}

.new-form-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ===== 第一段固定区：事项类型容器（向上提，保持上下舒适留白） ===== */
.new-form-header {
  flex-shrink: 0;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  padding-top: 12px;
}

.new-form-header .ant-form,
.new-form-header .ant-form-item {
  margin-bottom: 0;
}

/* 分割线：紧贴 header 下方，上下呼吸感统一 */
.new-form-divider.ant-divider {
  flex-shrink: 0;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  margin: 0 0 12px;
}

/* ===== 第二段承载区：Tabs 外壳（不滚，传高度给 Tabs） ===== */
.new-form-tabs-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 无 Tabs 时 empty 居中占位 */
.new-form-tabs-area .ant-empty {
  margin: auto;
  color: #64748b;
}

.new-form-tabs-area .ant-empty-description {
  color: #64748b;
}

/* ===== Tabs：Apple Segmented 胶囊风 ===== */
.new-form-tabs-area .new-form-tabs,
.new-form-tabs-area .new-form-tabs > .ant-tabs {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

/* Tab 导航栏：白色背景，细分隔线区分选中项 */
.new-form-tabs-area .new-form-tabs .ant-tabs-nav {
  flex-shrink: 0;
  margin-bottom: 12px;
  background: #ffffff;
  padding: 0;
  border-radius: 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: none;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-nav::before {
  display: none;
}

/* 单个 Tab：白底风格，hover 浅灰，选中加深字重 + 字色 */
.new-form-tabs-area .new-form-tabs .ant-tabs-tab {
  padding: 8px 18px;
  margin: 0 6px 0 0 !important;
  border-radius: 0;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  height: 34px;
  line-height: 18px;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tab:last-child {
  margin-right: 0 !important;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tab:hover {
  color: #0f172a;
  background: #f8fafc;
}

.new-form-tabs-area .new-form-tabs .ant-tabs-tab.ant-tabs-tab-active {
  color: #2563eb;
  background: #ffffff;
  border-bottom-color: #2563eb;
  font-weight: 600;
  box-shadow: none;
}

/* 选中下划线：与 tab 下边框结合，隐藏 Ant 默认 ink-bar */
.new-form-tabs-area .new-form-tabs .ant-tabs-ink-bar {
  display: none !important;
}

/* Tabs 内容外壳：传高度给 tabpane */
.new-form-tabs-area .new-form-tabs .ant-tabs-content-holder,
.new-form-tabs-area .new-form-tabs .ant-tabs-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 单个 tabpane 高度 100% 传高度给内部真正的滚动容器 */
.new-form-tabs-area .new-form-tabs .ant-tabs-tabpane {
  height: 100%;
  min-height: 0;
}

/* ===== 真正的滚动区：Tab 内容（表单字段） ===== */
.tab-pane-scroll {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;
  /* 兜底：即便链路异常也确保能滚动 */
  max-height: calc(75vh - 260px);
}

/* ===== 滚动条：Apple 细条 + Material 圆角 ===== */
.tab-pane-scroll::-webkit-scrollbar,
.new-form-modal ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tab-pane-scroll::-webkit-scrollbar-thumb,
.new-form-modal ::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.tab-pane-scroll::-webkit-scrollbar-thumb:hover,
.new-form-modal ::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
  background-clip: padding-box;
  border: 2px solid transparent;
}

.tab-pane-scroll::-webkit-scrollbar-track,
.new-form-modal ::-webkit-scrollbar-track {
  background: transparent;
}

/* ====== 新建弹窗 - 水平表单布局样式 ====== */
/* 必填星号（插槽独立渲染） */
.form-item-required-mark {
  color: #ef4444;
  margin-left: 2px;
  font-family: -apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-weight: 600;
}

/* label 与组件在同一行且垂直居中对齐 */
.new-form-modal .ant-form-item {
  margin-bottom: 14px;
}

.new-form-modal .ant-form-item:last-child {
  margin-bottom: 0;
}

/* 固定 label 栏宽度，与 :label-width="120" 保持一致 */
.new-form-modal .ant-form-item .ant-form-item-label {
  width: 120px;
  flex: 0 0 120px;
  padding-right: 12px;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.new-form-modal .ant-form-item .ant-form-item-label > label {
  height: 34px;
  align-items: center;
  white-space: nowrap;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

/* 去掉 Ant Design 默认在 label 后追加的额外冒号 */
.new-form-modal .ant-form-item-label > label::after {
  display: none;
}

/* 控件栏占满剩余宽度，输入高度统一 34px（略缩小，更紧凑） */
.new-form-modal .ant-form-item .ant-form-item-control {
  flex: 1;
  min-width: 0;
  min-height: 34px;
}

/* ========== 输入控件：Material Filled × Apple Rounded（更紧凑尺寸） ========== */
/* 所有输入框：统一圆角 8px、高度 34px、细边、focus 主色描边 + 柔光 */
.new-form-modal .ant-input,
.new-form-modal .ant-input-number,
.new-form-modal .ant-picker,
.new-form-modal .ant-select-selector {
  height: 34px !important;
  line-height: 32px;
  border-radius: 8px !important;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  font-size: 13px;
  color: #0f172a;
  padding: 0 12px;
  transition: all 0.15s ease;
}

.new-form-modal .ant-input {
  padding: 0 10px;
}

/* textarea 多行保持自然高度，但圆角与边一致 */
.new-form-modal .ant-input-affix-wrapper,
.new-form-modal textarea.ant-input {
  border-radius: 8px !important;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  transition: all 0.15s ease;
}

.new-form-modal textarea.ant-input {
  padding: 8px 10px;
  line-height: 1.5;
  font-size: 13px;
}

/* hover 态：边框加深 */
.new-form-modal .ant-input:hover,
.new-form-modal .ant-input-number:hover,
.new-form-modal .ant-picker:hover,
.new-form-modal .ant-select:not(.ant-select-disabled):hover .ant-select-selector,
.new-form-modal .ant-input-affix-wrapper:hover,
.new-form-modal textarea.ant-input:hover {
  border-color: #cbd5e1 !important;
  background: #ffffff;
}

/* focus 态：Apple 蓝描边 + 柔光晕（Material focus ring） */
.new-form-modal .ant-input:focus,
.new-form-modal .ant-input-focused,
.new-form-modal .ant-input-number:focus,
.new-form-modal .ant-input-number-focused,
.new-form-modal .ant-picker:focus,
.new-form-modal .ant-picker-focused,
.new-form-modal .ant-select-focused .ant-select-selector,
.new-form-modal .ant-input-affix-wrapper:focus,
.new-form-modal .ant-input-affix-wrapper-focused,
.new-form-modal textarea.ant-input:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.10) !important;
  outline: none;
  background: #ffffff !important;
}

/* disabled/readonly 态：Material Filled disabled 灰底 */
.new-form-modal .ant-input[disabled],
.new-form-modal .ant-input-number.ant-input-number-disabled,
.new-form-modal .ant-picker.ant-picker-disabled,
.new-form-modal .ant-select-disabled .ant-select-selector {
  background: #f8fafc !important;
  border-color: #e2e8f0 !important;
  color: #94a3b8 !important;
  cursor: not-allowed;
}

/* Select 内边距适配 */
.new-form-modal .ant-select .ant-select-selector {
  padding: 0 10px !important;
  height: 34px !important;
}

.new-form-modal .ant-select-single .ant-select-selector .ant-select-selection-search-input {
  height: 32px !important;
  line-height: 32px;
}

.new-form-modal .ant-select-single .ant-select-selector .ant-select-selection-item,
.new-form-modal .ant-select-single .ant-select-selector .ant-select-selection-placeholder {
  line-height: 32px;
  font-size: 13px;
}

/* Input Number 按钮与高度对齐 */
.new-form-modal .ant-input-number-input-wrap {
  height: 32px;
}

.new-form-modal .ant-input-number-input {
  height: 32px;
  line-height: 32px;
  padding: 0 10px !important;
  font-size: 13px;
}

/* Date picker 内部布局修正 */
.new-form-modal .ant-picker .ant-picker-input {
  height: 32px;
  line-height: 32px;
}

.new-form-modal .ant-picker .ant-picker-input > input {
  height: 32px;
  line-height: 32px;
  font-size: 13px;
}

/* Divider：Apple 细分隔线 */
.new-form-modal .ant-divider {
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  margin: 0;
}
</style>
