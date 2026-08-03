<template>
  <div class="component-list-page">
    <!-- 搜索与操作栏 -->
    <div class="toolbar">
      <div class="search-box">
        <SearchOutlined class="search-icon" />
        <input v-model="searchValue" class="search-input" placeholder="搜索组件…" @keyup.enter="loadComponents" />
        <div v-if="searchValue" class="search-clear" @click="searchValue = ''">
          <CloseCircleFilled />
        </div>
      </div>
      <button class="search-btn" @click="loadComponents"><SearchOutlined /> 查询</button>
      <div class="toolbar-actions">
        <button class="create-btn" @click="handleCreate">
          <PlusOutlined /><span>新建组件</span>
        </button>
      </div>
    </div>

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ components.length }}</span><span class="stat-label">组件总数</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-blue">{{ categoryCount }}</span><span class="stat-label">分类数量</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-green">{{ enabledCount }}</span><span class="stat-label">已启用</span></div>
    </div>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <button v-for="tab in tabs" :key="tab.value"
        :class="['tab-item', { active: tabCategory === tab.value }]"
        @click="tabCategory = tab.value"
      >{{ tab.label }}</button>
    </div>

    <!-- 卡片列表 -->
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="filteredComponents.length > 0" class="card-grid">
      <div v-for="comp in filteredComponents" :key="comp.id"
        :class="['component-card', { disabled: comp.status !== 1 }]"
      >
        <div class="card-header">
          <div :class="['card-icon', categoryClass(comp.componentKey)]">
            <component :is="getIcon(comp.type)" />
          </div>
          <div class="card-header-right">
            <span :class="['status-dot', comp.status === 1 ? 'on' : 'off']" />
            <a-dropdown trigger="click" @click.stop>
              <button class="card-more" @click.stop><MoreOutlined /></button>
              <template #overlay>
                <a-menu @click="handleMenuClick($event, comp)">
                  <a-menu-item key="edit"><EditOutlined /> 编辑</a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="delete" danger><DeleteOutlined /> 删除</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title">{{ comp.name }}</h3>
          <p class="card-desc">{{ comp.description || '暂无描述' }}</p>
        </div>
        <div class="card-footer">
          <a-tag :color="categoryTagColor(comp.componentKey)" class="card-tag">{{ categoryMap[comp.componentKey] || comp.componentKey }}</a-tag>
          <div class="card-meta">
            <span class="meta-item"><AppstoreOutlined /> {{ comp.type }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon-box"><InboxOutlined class="empty-icon" /></div>
      <h3 class="empty-title">{{ searchValue || tabCategory ? '未找到匹配的组件' : '还没有组件' }}</h3>
      <p class="empty-desc">{{ searchValue || tabCategory ? '尝试更换搜索条件或筛选' : '创建第一个组件' }}</p>
      <button v-if="!searchValue && !tabCategory" class="create-btn-empty" @click="handleCreate">
        <PlusOutlined /> 新建组件
      </button>
    </div>

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="showEditModal"
      :title="isEdit ? '编辑组件' : '新建组件'"
      width="600px"
      :footer="null"
      destroy-on-close
      class="edit-modal"
    >
      <a-form :model="editForm" layout="vertical" :disabled="detailLoading">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="组件标题" required>
              <a-input v-model:value="editForm.name" placeholder="输入组件名称" size="large" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="组件类型" required>
              <a-select v-model:value="editForm.componentKey" placeholder="选择类型" size="large">
                <a-select-option v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="分类">
              <a-select v-model:value="editForm.type" placeholder="选择分类" size="large">
                <a-select-option v-for="t in tabs.filter(t => t.value)" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-switch :checked="editForm.status === 1" checked-children="启用" un-checked-children="停用" @change="(v: boolean) => (editForm.status = v ? 1 : 0)" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="描述">
          <a-textarea v-model:value="editForm.description" placeholder="简要描述组件用途" :rows="3" />
        </a-form-item>
      </a-form>
      <div class="modal-footer">
        <a-space>
          <a-button @click="showEditModal = false">取消</a-button>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">保存</a-button>
        </a-space>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  SearchOutlined, CloseCircleFilled, AppstoreOutlined, InboxOutlined, PlusOutlined,
  MoreOutlined, EditOutlined, DeleteOutlined,
  FontSizeOutlined, CheckSquareOutlined, DownCircleOutlined,
  CalendarOutlined, ClockCircleOutlined, NumberOutlined,
  PictureOutlined, UploadOutlined, EnvironmentOutlined,
  TeamOutlined, LinkOutlined, BlockOutlined,
} from '@ant-design/icons-vue'
import type { Component } from 'vue'
import { getComponents, getComponent, createComponent, updateComponent, deleteComponent } from '@/api/faiz'
import type { ComponentItem } from '@/types/faiz'

// ---- 常量 ----
const tabs = [
  { label: '全部', value: '' },
  { label: '基础', value: 'basic' },
  { label: '选择', value: 'select' },
  { label: '日期', value: 'date' },
  { label: '高级', value: 'advanced' },
]
const categoryMap: Record<string, string> = {
  basic: '基础',
  select: '选择',
  date: '日期',
  advanced: '高级',
}
const categoryColors: Record<string, { bg: string; tag: string }> = {
  basic: { bg: 'icon-blue', tag: 'blue' },
  select: { bg: 'icon-green', tag: 'green' },
  date: { bg: 'icon-orange', tag: 'orange' },
  advanced: { bg: 'icon-purple', tag: 'purple' },
}

const typeOptions = [
  { value: 'input', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'number', label: '数字' },
  { value: 'select', label: '下拉选择' },
  { value: 'checkbox', label: '复选框' },
  { value: 'radio', label: '单选框' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'time', label: '时间' },
  { value: 'image', label: '图片' },
  { value: 'upload', label: '附件' },
  { value: 'location', label: '定位' },
  { value: 'member', label: '成员' },
  { value: 'link', label: '链接' },
]

const iconMap: Record<string, Component> = {
  input: FontSizeOutlined,
  textarea: BlockOutlined,
  number: NumberOutlined,
  select: DownCircleOutlined,
  checkbox: CheckSquareOutlined,
  radio: CheckSquareOutlined,
  date: CalendarOutlined,
  datetime: ClockCircleOutlined,
  time: ClockCircleOutlined,
  image: PictureOutlined,
  upload: UploadOutlined,
  location: EnvironmentOutlined,
  member: TeamOutlined,
  link: LinkOutlined,
}

function getIcon(type: string): Component {
  return iconMap[type] || AppstoreOutlined
}

// ---- 状态 ----
const searchValue = ref('')
const tabCategory = ref('')
const components = ref<ComponentItem[]>([])
const loading = ref(false)

const showEditModal = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const detailLoading = ref(false)

const editForm = ref<Partial<ComponentItem>>({
  id: 0, type: '', name: '', description: '', componentKey: 'basic', status: 1,
})

// ---- 工具函数 ----
function categoryClass(cat: string) { return categoryColors[cat]?.bg || 'icon-blue' }
function categoryTagColor(cat: string) { return categoryColors[cat]?.tag || 'blue' }

// ---- 数据加载 ----
async function loadComponents() {
  loading.value = true
  try {
    const res = await getComponents(searchValue.value || undefined, tabCategory.value || undefined)
    if (res.success) {
      components.value = res.data?.list || []
    }
  } catch {
    message.error('加载组件列表失败')
  } finally {
    loading.value = false
  }
}

// ---- 计算属性 ----
const filteredComponents = computed(() =>
  components.value.filter(c => {
    const match = !searchValue.value
      || c.name.toLowerCase().includes(searchValue.value.toLowerCase())
      || c.type.toLowerCase().includes(searchValue.value.toLowerCase())
    const ct = !tabCategory.value || c.componentKey === tabCategory.value
    return match && ct
  })
)

const categoryCount = computed(() => new Set(components.value.map(c => c.componentKey)).size)
const enabledCount = computed(() => components.value.filter(c => c.status === 1).length)

// ---- CRUD ----
function handleCreate() {
  isEdit.value = false
  editForm.value = { id: 0, type: '', name: '', description: '', componentKey: 'basic', status: 1 }
  showEditModal.value = true
}

async function handleEdit(comp: ComponentItem) {
  isEdit.value = true
  showEditModal.value = true
  detailLoading.value = true
  try {
    const res = await getComponent(comp.id)
    if (res.success && res.data) {
      editForm.value = { ...res.data }
    } else {
      message.error(res.message || '获取详情失败')
      showEditModal.value = false
    }
  } catch {
    message.error('获取详情失败')
    showEditModal.value = false
  } finally {
    detailLoading.value = false
  }
}

async function handleSubmit() {
  if (!editForm.value.name?.trim()) { message.warning('请输入组件标题'); return }
  if (!editForm.value.type) { message.warning('请选择组件类型'); return }
  submitting.value = true
  try {
    const payload: Record<string, unknown> = {
      type: editForm.value.type,
      title: editForm.value.name,
      description: editForm.value.description || '',
      category: editForm.value.componentKey || 'basic',
      status: editForm.value.status ?? 1,
    }
    if (isEdit.value && editForm.value.id) {
      const res = await updateComponent(Number(editForm.value.id), payload)
      if (res.success) message.success('更新成功')
      else message.error(res.message || '更新失败')
    } else {
      const res = await createComponent(payload)
      if (res.success) message.success('创建成功')
      else message.error(res.message || '创建失败')
    }
    showEditModal.value = false
    loadComponents()
  } catch {
    message.error(isEdit.value ? '更新失败' : '创建失败')
  } finally {
    submitting.value = false
  }
}

function handleDelete(comp: ComponentItem) {
  Modal.confirm({
    title: '删除组件',
    content: `确定要删除「${comp.name}」吗？删除后不可恢复。`,
    okText: '删除', cancelText: '取消', okType: 'danger',
    onOk: async () => {
      try {
        const res = await deleteComponent(comp.id)
        if (res.success) { message.success('已删除'); loadComponents() }
        else message.error(res.message || '删除失败')
      } catch { message.error('删除失败') }
    },
  })
}

function handleMenuClick({ key }: { key: string }, comp: ComponentItem) {
  if (key === 'edit') handleEdit(comp)
  else if (key === 'delete') handleDelete(comp)
}

onMounted(loadComponents)
</script>

<style scoped>
.component-list-page {
  padding: 0 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
}

/* ---- toolbar ---- */
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.search-box { flex: 1; min-width: 260px; position: relative; display: flex; align-items: center; background: #f5f5f7; border-radius: 14px; transition: background 0.2s, box-shadow 0.2s; }
.search-box:focus-within { background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
.search-icon { font-size: 16px; color: #86868b; margin-left: 14px; flex-shrink: 0; }
.search-input { flex: 1; border: none; background: transparent; padding: 11px 12px 11px 10px; font-size: 15px; color: #1d1d1f; outline: none; font-family: inherit; }
.search-input::placeholder { color: #aeaeb2; }
.search-clear { padding: 0 12px; cursor: pointer; color: #aeaeb2; font-size: 16px; display: flex; align-items: center; }
.search-clear:hover { color: #6e6e73; }
.search-btn { display: inline-flex; align-items: center; gap: 6px; border: none; background: #3b82f6; color: #fff; padding: 9px 18px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s; font-family: inherit; white-space: nowrap; }
.search-btn:hover { background: #2563eb; }
.toolbar-actions { display: flex; align-items: center; gap: 12px; }
.create-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; background: #1d1d1f; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.create-btn:hover { background: #333; transform: scale(1.02); }

/* ---- stats ---- */
.stats-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.stat-item { display: flex; align-items: baseline; gap: 6px; }
.stat-value { font-size: 22px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.3px; }
.stat-label { font-size: 13px; color: #86868b; font-weight: 500; }
.stat-green { color: #34c759; }
.stat-blue { color: #007aff; }
.stat-divider { width: 1px; height: 20px; background: #e5e5ea; }

/* ---- tab nav ---- */
.tab-nav { display: flex; align-items: center; gap: 2px; margin-bottom: 28px; padding: 4px; background: #f5f5f7; border-radius: 14px; width: fit-content; }
.tab-item { border: none; background: transparent; padding: 9px 22px; border-radius: 11px; font-size: 14px; font-weight: 500; color: #6e6e73; cursor: pointer; transition: all 0.25s; font-family: inherit; white-space: nowrap; }
.tab-item.active { background: #fff; color: #1d1d1f; box-shadow: 0 1px 3px rgba(0,0,0,.08); font-weight: 600; }
.tab-item:hover:not(.active) { color: #1d1d1f; }

/* ---- card grid ---- */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; width: 100%; }
.component-card { background: #fff; border-radius: 18px; padding: 22px; border: 1.5px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,.04); transition: all 0.25s cubic-bezier(.4,0,.2,1); display: flex; flex-direction: column; gap: 14px; }
.component-card:hover { border-color: #e5e5ea; box-shadow: 0 8px 24px rgba(0,0,0,.08); transform: translateY(-2px); }
.component-card.disabled { opacity: 0.6; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; }
.card-icon { width: 44px; height: 44px; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff; flex-shrink: 0; }
.icon-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.icon-green { background: linear-gradient(135deg, #10b981, #059669); }
.icon-orange { background: linear-gradient(135deg, #f97316, #ea580c); }
.icon-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
.card-header-right { display: flex; align-items: center; gap: 8px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.on { background: #34c759; box-shadow: 0 0 0 3px rgba(52,199,89,.2); }
.status-dot.off { background: #aeaeb2; }
.card-more { width: 32px; height: 32px; border-radius: 10px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #aeaeb2; font-size: 16px; transition: all 0.15s; }
.card-more:hover { background: #f5f5f7; color: #1d1d1f; }
.card-body { flex: 1; }
.card-title { font-size: 16px; font-weight: 600; color: #1d1d1f; margin: 0 0 4px; line-height: 1.3; }
.card-desc { font-size: 13px; color: #86868b; margin: 0; line-height: 1.5; }
.card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
.card-tag { font-size: 12px; border-radius: 6px; line-height: 1; }
.card-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #aeaeb2; }
.meta-item { display: flex; align-items: center; gap: 3px; }

/* ---- loading / empty ---- */
.loading-state { text-align: center; color: #86868b; padding: 60px 0; font-size: 14px; }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 80px 20px; text-align: center; }
.empty-icon-box { width: 80px; height: 80px; border-radius: 22px; background: #f5f5f7; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
.empty-icon { font-size: 36px; color: #aeaeb2; }
.empty-title { font-size: 18px; font-weight: 600; color: #1d1d1f; margin: 0 0 6px; }
.empty-desc { font-size: 14px; color: #86868b; margin: 0 0 24px; }
.create-btn-empty { display: flex; align-items: center; gap: 6px; padding: 11px 24px; border: none; background: #007aff; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
.create-btn-empty:hover { background: #0066d6; }

/* ---- edit modal ---- */
.edit-modal :deep(.ant-modal-content) { border-radius: 20px; }
.edit-modal :deep(.ant-modal-header) { padding: 28px 28px 0; border-bottom: none; }
.edit-modal :deep(.ant-modal-title) { font-size: 20px; font-weight: 700; color: #1d1d1f; }
.edit-modal :deep(.ant-modal-body) { padding: 20px 28px 28px; }
.modal-footer { display: flex; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #f5f5f7; }
</style>
