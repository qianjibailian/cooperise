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
      title="新建"
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
      <a-spin :spinning="newFormLoading" class="new-form-spin">
        <div class="new-form-inner">
          <!-- 上部固定区：事项类型 + 分割线 -->
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
            <a-divider style="margin: 0 0 8px" />
          </div>
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
  showNewFormModal.value = true
  await loadCreateMeta()
}

function handleNewFormCancel() {
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
  flex-shrink: 0;
}

.new-form-modal .ant-modal-title {
  width: 100%;
  text-align: center;
}

/* content 是最高层 flex 容器：自身拥有 60vh 上限高度，高度链路从这里开始确定 */
.new-form-modal .ant-modal-content {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  min-height: 0;
}

.new-form-modal .ant-modal-footer {
  flex-shrink: 0;
}

/* body 占满 content 剩余高度（= 60vh - header - footer），交给内部 flex 分区 */
.new-form-modal .ant-modal-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 24px;
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

/* ===== 第一段固定区：事项类型 + 分割线 ===== */
.new-form-header {
  flex-shrink: 0;
}

.new-form-header .ant-form-item {
  margin-bottom: 16px;
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
}

/* ===== Tabs 自身拆成 flex：导航栏固定 + 内容区传高度 ===== */
.new-form-tabs-area .new-form-tabs,
.new-form-tabs-area .new-form-tabs > .ant-tabs {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

/* Tab 导航栏固定（不参与滚动） */
.new-form-tabs-area .new-form-tabs .ant-tabs-nav {
  flex-shrink: 0;
  margin-bottom: 16px;
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
  padding-right: 4px;
  /* 兜底：即便链路异常也确保能滚动 */
  max-height: calc(60vh - 260px);
}

/* ====== 新建弹窗 - 水平表单布局样式 ====== */
/* 必填星号（插槽独立渲染） */
.form-item-required-mark {
  color: #ff4d4f;
  margin-left: 2px;
  font-family: SimSun, serif;
}

/* label 与组件在同一行且垂直居中对齐，保留 Ant Design 原生两栏结构 */
.new-form-modal .ant-form-item {
  margin-bottom: 16px;
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
  height: 32px;
  align-items: center;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.88);
  font-size: 14px;
}

/* 去掉 Ant Design 默认在 label 后追加的额外冒号 */
.new-form-modal .ant-form-item-label > label::after {
  display: none;
}

/* 控件栏占满剩余宽度 */
.new-form-modal .ant-form-item .ant-form-item-control {
  flex: 1;
  min-width: 0;
}
</style>
