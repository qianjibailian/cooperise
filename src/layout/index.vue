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
                  <a-menu-item key="/settings/form-design">
                    <component :is="FormOutlined" />
                    <span>表单设计</span>
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
        <vxe-form-view
          v-if="showNewFormModal"
          ref="newFormViewRef"
          :config="formTemplateConfig"
          v-model="newFormData"
        />
      </div>
    </a-modal>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
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
  FormOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppSideDrawer from '@/components/AppSideDrawer.vue'
import WorkbenchPanel from './WorkbenchPanel.vue'
import { useAuth } from '@/utils/auth'

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
const newFormData = reactive<Record<string, any>>({})

// 用户提供的 JSON 模板
const formTemplate = {
  templateName: '模板1',
  formConfig: {
    title: '模板1',
    pcVisible: true,
    pcVertical: true,
    pcTitleBold: true,
    pcTitleColon: false,
    pcTitleAlign: '',
    pcTitleWidth: '',
    pcTitleAutoWidth: true,
    pcTitleWidthUnit: '',
    mobileVisible: false,
    mobileVertical: true,
    mobileTitleBold: true,
    mobileTitleColon: false,
    mobileTitleAlign: '',
    mobileTitleWidth: '',
    mobileTitleAutoWidth: true,
    mobileTitleWidthUnit: '',
    isLog: false,
    isPC: true,
    isMobile: false,
    isApplet: false,
  },
  widgetData: [
    { id: 100071, field: 'inputwidget100071', title: '概要', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请输入', maxLength: 100, showWordCount: true, clearable: true, align: '' }, children: [], model: { update: false, value: null } },
    { id: 100065, field: 'row100065', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
      { id: 100068, field: 'datedatepickerwidget100068', title: '计划开始时间', name: 'DateDatePickerWidget', required: false, hidden: false, options: { placeholder: '请选择', labelFormat: '', clearable: true }, children: [], model: { update: false, value: null } },
      { id: 100069, field: 'datedatepickerwidget100069', title: '计划完成时间', name: 'DateDatePickerWidget', required: false, hidden: false, options: { placeholder: '请选择', labelFormat: '', clearable: true }, children: [], model: { update: false, value: null } },
    ], model: { update: false, value: null } },
    { id: 100070, field: 'wangeditorwidget100070', title: '描述', name: 'WangEditorWidget', required: false, hidden: false, options: { placeholder: '请输入' }, children: [], model: { update: false, value: null } },
    { id: 100294, field: 'row100294', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
      { id: 100298, field: 'selectwidget100298', title: '经办人', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '', multiple: false, clearable: true, filterable: true, options: [{ value: '示例1', label: '示例1', _X_OPTION_KEY: 'opt_789' }, { value: '示例2', label: '示例2', _X_OPTION_KEY: 'opt_790' }, { value: '示例3', label: '示例3', _X_OPTION_KEY: 'opt_791' }] }, children: [], model: { update: false, value: null } },
    ], model: { update: false, value: null } },
    { id: 100462, field: 'row100462', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
      { id: 100463, field: 'createBy', title: '创建人', name: 'CreateByWidget', required: false, hidden: false, options: {}, children: [], model: { update: false, value: null } },
      { id: 100466, field: 'createTime', title: '创建时间', name: 'CreateTimeWidget', required: false, hidden: false, options: { format: '' }, children: [], model: { update: false, value: null } },
    ], model: { update: false, value: null } },
    { id: 100470, field: 'row100470', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
      { id: 100471, field: 'updateBy', title: '更新人', name: 'UpdateByWidget', required: false, hidden: false, options: {}, children: [], model: { update: false, value: null } },
      { id: 100472, field: 'updateTime', title: '更新时间', name: 'UpdateTimeWidget', required: false, hidden: false, options: { format: '' }, children: [], model: { update: false, value: null } },
    ], model: { update: false, value: null } },
  ],
}

// VxeFormView 需要的 config 结构：formConfig + widgetData
const formTemplateConfig = computed(() => ({
  formConfig: formTemplate.formConfig,
  widgetData: formTemplate.widgetData,
}))

function initFormData() {
  Object.keys(newFormData).forEach(k => delete newFormData[k])
  const walk = (widgets: any[]) => {
    widgets.forEach((w: any) => {
      if (w.children && w.children.length) walk(w.children)
      else if (w.field) newFormData[w.field] = null
    })
  }
  walk(formTemplate.widgetData)
}

function handleNewFormOpen() {
  initFormData()
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
  console.log('【新建】提交表单数据:', JSON.stringify({ ...newFormData }, null, 2))
  message.success('提交成功')
  showNewFormModal.value = false
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

.new-form-modal {
  :deep(.ant-modal-content) {
    max-height: 60vh;
    display: flex;
    flex-direction: column;
  }

  :deep(.ant-modal-body) {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}

.new-form-scroll {
  height: calc(60vh - 110px);
  overflow-y: auto;
  padding-right: 4px;
}
</style>
