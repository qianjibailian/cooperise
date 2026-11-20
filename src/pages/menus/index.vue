<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <h2 class="mgmt-title">菜单管理</h2>
      <a-button type="primary" class="mgmt-create-btn" @click="openCreate">
        <PlusOutlined /> 新增
      </a-button>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索菜单名称 / 路径"
          allow-clear
          class="mgmt-search"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <a-segmented v-model:value="statusFilter" :options="STATUS_FILTERS" />
        <a-tooltip title="刷新">
          <button class="mgmt-icon-btn" @click="resetFilters"><ReloadOutlined /></button>
        </a-tooltip>
      </div>

      <a-table
        :columns="columns"
        :data-source="filteredMenus"
        row-key="id"
        :pagination="false"
        :scroll="{ x: 860 }"
        class="mgmt-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'menu'">
            <div class="menu-cell">
              <span class="menu-avatar">
                <component :is="ICON_MAP[record.icon] ?? AppstoreOutlined" />
              </span>
              <span class="menu-name">{{ record.name }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'path'">
            <span class="code-chip">{{ record.path }}</span>
          </template>
          <template v-else-if="column.key === 'sortOrder'">
            <span class="text-muted">{{ record.sortOrder }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              size="small"
              :checked="record.enabled"
              @change="(v: boolean) => (record.enabled = v)"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-tooltip title="编辑">
                <span class="row-action" @click="openEdit(record as MenuItem)"><EditOutlined /></span>
              </a-tooltip>
              <a-tooltip title="删除">
                <span class="row-action danger" @click="confirmRemove(record as MenuItem)"><DeleteOutlined /></span>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增 / 编辑（仅前端演示，数据保存在页面内存中，刷新后恢复初始数据，未接入后端） -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑菜单' : '新增菜单'"
      :width="520"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      @ok="saveForm"
    >
      <a-form layout="vertical" :model="form">
        <a-form-item label="菜单名称" required>
          <a-input v-model:value="form.name" placeholder="如 工作台" :maxlength="20" />
        </a-form-item>
        <a-form-item label="路由路径" required>
          <a-input v-model:value="form.path" placeholder="如 /workbench/board" :maxlength="100" />
        </a-form-item>
        <a-form-item label="图标">
          <a-select v-model:value="form.icon" :options="ICON_OPTIONS" />
        </a-form-item>
        <a-form-item label="排序">
          <a-input-number v-model:value="form.sortOrder" :min="0" :max="999" style="width: 100%" />
        </a-form-item>
        <a-form-item label="状态">
          <a-switch v-model:checked="form.enabled" checked-children="启用" un-checked-children="停用" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  HomeOutlined,
  IdcardOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'

interface MenuItem {
  id: number
  name: string
  path: string
  icon: string
  sortOrder: number
  enabled: boolean
}

const ICON_MAP: Record<string, unknown> = {
  home: HomeOutlined,
  file: FileTextOutlined,
  appstore: AppstoreOutlined,
  team: TeamOutlined,
  idcard: IdcardOutlined,
  tool: ToolOutlined,
}
const ICON_OPTIONS = Object.keys(ICON_MAP).map((k) => ({ label: k, value: k }))

const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]

const columns = [
  { title: '菜单', key: 'menu', width: 200, fixed: 'left' as const },
  { title: '路由路径', key: 'path', ellipsis: true },
  { title: '排序', key: 'sortOrder', width: 90 },
  { title: '启用', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' as const },
]

const menus = ref<MenuItem[]>([
  { id: 1, name: '工作台', path: '/workbench/board', icon: 'home', sortOrder: 1, enabled: true },
  { id: 2, name: '云文档', path: '/docs', icon: 'file', sortOrder: 2, enabled: true },
  { id: 3, name: '空间', path: '/space', icon: 'appstore', sortOrder: 3, enabled: true },
  { id: 4, name: '管理后台', path: '/admin/users', icon: 'tool', sortOrder: 4, enabled: true },
])
let seq = menus.value.length

// ---- 搜索 / 筛选 ----
const keyword = ref('')
const statusFilter = ref('all')
const filteredMenus = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return menus.value.filter((m) => {
    if (statusFilter.value === '1' && !m.enabled) return false
    if (statusFilter.value === '0' && m.enabled) return false
    if (!kw) return true
    return m.name.toLowerCase().includes(kw) || m.path.toLowerCase().includes(kw)
  })
})
function resetFilters() {
  keyword.value = ''
  statusFilter.value = 'all'
}

// ---- 新增 / 编辑 ----
const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ name: '', path: '', icon: 'appstore', sortOrder: 0, enabled: true })

function resetForm() {
  Object.assign(form, { name: '', path: '', icon: 'appstore', sortOrder: 0, enabled: true })
}

function openCreate() {
  editingId.value = null
  resetForm()
  modalOpen.value = true
}

function openEdit(record: MenuItem) {
  editingId.value = record.id
  Object.assign(form, { name: record.name, path: record.path, icon: record.icon, sortOrder: record.sortOrder, enabled: record.enabled })
  modalOpen.value = true
}

function saveForm() {
  const name = form.name.trim()
  const path = form.path.trim()
  if (!name || !path) {
    message.warning('请填写菜单名称和路由路径')
    return
  }
  if (!path.startsWith('/')) {
    message.warning('路由路径需以 / 开头')
    return
  }
  const payload = { name, path, icon: form.icon, sortOrder: form.sortOrder, enabled: form.enabled }
  if (editingId.value === null) {
    menus.value.push({ id: ++seq, ...payload })
    message.success('已新增菜单')
  } else {
    const target = menus.value.find((m) => m.id === editingId.value)
    if (target) Object.assign(target, payload)
    message.success('已保存')
  }
  modalOpen.value = false
}

function confirmRemove(record: MenuItem) {
  Modal.confirm({
    title: `删除菜单「${record.name}」？`,
    content: '删除后不可恢复（当前仅前端演示）。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      menus.value = menus.value.filter((m) => m.id !== record.id)
      message.success('已删除')
    },
  })
}
</script>

<style scoped>
.mgmt-page {
  padding: 20px 24px 32px;
  box-sizing: border-box;
  min-height: calc(100dvh - var(--app-header-height, 56px));
}

.mgmt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.mgmt-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
}

.mgmt-create-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-weight: 500;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--c-primary) 24%, transparent);
}

.mgmt-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mgmt-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mgmt-search {
  width: 300px;
  height: 34px;
  border-radius: 10px;
  background: #f5f5f7;
  border-color: transparent;
}

.mgmt-search:hover,
.mgmt-search:focus-within {
  background: #fff;
  border-color: #d2d2d7;
}

.mgmt-search :deep(.ant-input) {
  background: transparent;
}

.mgmt-search-icon {
  color: #aeaeb2;
}

.mgmt-icon-btn {
  margin-left: auto;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6e6e73;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.mgmt-icon-btn:hover {
  background: #f2f2f5;
}

.mgmt-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 500;
  color: #86868b;
  background: #fafafc;
}

.mgmt-table :deep(.ant-table-tbody > tr > td) {
  font-size: 13px;
}

.menu-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.menu-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
  background: #5e5ce6;
}

.menu-name {
  font-weight: 500;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-chip {
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 6px;
}

.text-muted {
  color: #6e6e73;
}

.row-actions {
  display: inline-flex;
  gap: 2px;
}

.row-action {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #6e6e73;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.row-action:hover {
  color: #1d1d1f;
  background: #e9e9ee;
}

.row-action.danger {
  color: #ff453a;
}

.row-action.danger:hover {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.1);
}

@media (max-width: 768px) {
  .mgmt-page {
    padding: 16px;
  }

  .mgmt-toolbar {
    flex-wrap: wrap;
  }

  .mgmt-search {
    flex: 1 1 100%;
    width: auto;
  }
}
</style>
