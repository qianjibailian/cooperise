<template>
  <div class="template-list-page">
    <!-- 搜索与操作栏 -->
    <div class="toolbar">
      <div class="search-box">
        <SearchOutlined class="search-icon" />
        <input v-model="searchValue" class="search-input" placeholder="搜索模板…" @keyup.enter="loadTemplates" />
        <div v-if="searchValue" class="search-clear" @click="searchValue = ''">
          <CloseCircleFilled />
        </div>
      </div>
      <button class="search-btn" @click="loadTemplates"><SearchOutlined /> 查询</button>
      <div class="toolbar-actions">
        <div class="filter-group">
          <button
            v-for="f in filters" :key="f.value"
            :class="['filter-chip', { active: filterStatus === f.value }]"
            @click="filterStatus = f.value"
          >{{ f.label }}</button>
        </div>
        <button class="create-btn" @click="handleCreate">
          <PlusOutlined /><span>新建模板</span>
        </button>
      </div>
    </div>

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ templates.length }}</span><span class="stat-label">模板总数</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-green">{{ enabledCount }}</span><span class="stat-label">已启用</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-blue">{{ totalTabs }}</span><span class="stat-label">表单配置</span></div>
    </div>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <button v-for="tab in tabs" :key="tab.value"
        :class="['tab-item', { active: tabCategory === tab.value }]"
        @click="tabCategory = tab.value"
      >{{ tab.label }}</button>
    </div>

    <!-- 卡片列表 -->
    <div v-if="filteredTemplates.length > 0" class="card-grid">
      <div v-for="tpl in filteredTemplates" :key="tpl.id"
        :class="['template-card', { disabled: !tpl.status }]"
        @click="handleEdit(tpl)">
        <div class="card-header">
          <div :class="['card-icon', categoryClass(tpl.category)]"><FormOutlined /></div>
          <div class="card-header-right">
            <span :class="['status-dot', tpl.status ? 'on' : 'off']" />
            <a-dropdown trigger="click" @click.stop>
              <button class="card-more" @click.stop><MoreOutlined /></button>
              <template #overlay>
                <a-menu @click="handleMenuClick($event, tpl)">
                  <a-menu-item key="preview"><EyeOutlined /> 预览</a-menu-item>
                  <a-menu-item key="edit"><EditOutlined /> 编辑</a-menu-item>
                  <a-menu-item key="copy"><CopyOutlined /> 创建副本</a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="delete" danger><DeleteOutlined /> 删除</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title">{{ tpl.templateName }}</h3>
          <p class="card-desc">{{ tpl.description || '暂无描述' }}</p>
        </div>
        <div class="card-footer">
          <a-tag :color="categoryTagColor(tpl.category)" class="card-tag">{{ categoryMap[tpl.category] || tpl.category }}</a-tag>
          <div class="card-meta">
            <span class="meta-item"><AppstoreOutlined /> {{ tpl.tabs?.length || 0 }} 个表单</span>
            <span class="meta-sep">·</span>
            <span class="meta-item meta-time">{{ relativeTime(tpl.updatedAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon-box"><InboxOutlined class="empty-icon" /></div>
      <h3 class="empty-title">{{ searchValue || filterStatus ? '未找到匹配的模板' : '还没有模板' }}</h3>
      <p class="empty-desc">{{ searchValue || filterStatus ? '尝试更换搜索条件或筛选' : '创建第一个模板，开始构建你的表单' }}</p>
      <button v-if="!searchValue && !filterStatus" class="create-btn-empty" @click="handleCreate">
        <PlusOutlined /> 新建模板
      </button>
    </div>

    <!-- ====================== 编辑 / 新建弹窗 ====================== -->
    <a-modal
      v-model:open="showEditModal"
      :title="isEdit ? '编辑模板' : '新建模板'"
      width="800px"
      :footer="null"
      destroy-on-close
      class="edit-modal"
    >
      <div class="edit-layout">
        <!-- 基本信息 -->
        <div class="edit-basic">
          <a-form :model="editForm" layout="vertical">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="模板名称" required>
                  <a-input v-model:value="editForm.templateName" placeholder="输入模板名称" size="large" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="事项类型">
                  <a-select v-model:value="editForm.category" placeholder="选择" size="large">
                    <a-select-option value="requirement">需求</a-select-option>
                    <a-select-option value="task">任务</a-select-option>
                    <a-select-option value="bug">缺陷</a-select-option>
                    <a-select-option value="other">其他</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="状态">
                  <a-switch v-model:checked="editForm.status" checked-children="启用" un-checked-children="停用" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="描述">
              <a-textarea v-model:value="editForm.description" placeholder="简要描述模板用途" :rows="2" />
            </a-form-item>
          </a-form>
        </div>

        <!-- Tab 配置区 -->
        <div class="edit-tabs-section">
          <div class="tabs-header">
            <span class="tabs-title">关联表单</span>
            <button class="add-tab-btn" @click="addTab">
              <PlusOutlined /> 添加表单
            </button>
          </div>

          <!-- 已保存的 Tab 列表 -->
          <a-tabs v-model:activeKey="activeEditTab" type="card" class="form-tabs" @change="onTabSwitch">
            <a-tab-pane v-for="(tab, idx) in editForm.tabs" :key="tab.id" :tab="tab.name || `表单 ${Number(idx) + 1}`">
              <!-- Tab 名称编辑行 -->
              <div class="tab-name-row">
                <a-input
                  v-model:value="tab.name"
                  placeholder="输入表单名称"
                  size="small"
                  style="width: 220px"
                  @blur="onTabNameBlur(idx, $event)"
                />
                <a-button size="small" danger type="text" @click="removeTab(idx)">
                  <DeleteOutlined />
                </a-button>
              </div>

              <!-- 表单预览摘要 -->
              <div v-if="tab.widgetData?.length" class="tab-form-preview">
                <div class="form-summary">
                  <span class="summary-count">{{ countWidgets(tab.widgetData) }} 个控件</span>
                  <a-button size="small" type="link" @click="handleEditTabInDesigner(idx)">在表单设计器中编辑</a-button>
                </div>
                <div class="widget-chips">
                  <a-tag v-for="w in tab.widgetData?.slice(0, 6)" :key="w.id" color="default">{{ w.title }}</a-tag>
                  <a-tag v-if="tab.widgetData?.length > 6" color="default">+{{ tab.widgetData.length - 6 }} …</a-tag>
                </div>
              </div>
              <div v-else class="tab-empty">
                <p>暂无表单配置，请在表单设计器中创建并关联</p>
                <a-button size="small" type="primary" @click="handleEditTabInDesigner(idx)">前往表单设计器</a-button>
              </div>
            </a-tab-pane>
          </a-tabs>
        </div>

        <div class="modal-footer">
          <a-space>
            <a-button @click="showEditModal = false">取消</a-button>
            <a-button type="primary" @click="handleEditSubmit">保存</a-button>
          </a-space>
        </div>
      </div>
    </a-modal>

    <!-- ====================== 预览弹窗 ====================== -->
    <a-modal
      v-model:open="showPreviewModal"
      title="模板预览"
      width="900px"
      :footer="null"
      destroy-on-close
      class="edit-modal"
    >
      <div class="preview-section" v-if="previewTemplate">
        <a-tabs v-if="previewTemplate.tabs?.length > 1" v-model:activeKey="previewActiveTab" type="line">
          <a-tab-pane v-for="tab in previewTemplate.tabs" :key="tab.id" :tab="tab.name">
            <div v-if="tab.widgetData?.length" class="preview-wrap">
              <vxe-form-view
                :config="{ formConfig: tab.formConfig, widgetData: tab.widgetData }"
                v-model="previewTabData[tab.id]"
              />
            </div>
            <div v-else class="empty-preview">此表单暂无配置</div>
          </a-tab-pane>
        </a-tabs>
        <div v-else-if="previewTemplate.tabs?.length === 1" class="preview-wrap">
          <vxe-form-view
            v-if="previewTemplate.tabs[0].widgetData?.length"
            :config="{ formConfig: previewTemplate.tabs[0].formConfig, widgetData: previewTemplate.tabs[0].widgetData }"
            v-model="previewTabData[previewTemplate.tabs[0].id]"
          />
          <div v-else class="empty-preview">此表单暂无配置</div>
        </div>
        <div v-else class="empty-preview">模板无表单配置</div>
      </div>
      <div v-else class="empty-preview">模板无表单配置</div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, SearchOutlined, CloseCircleFilled, FormOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, CopyOutlined,
  MoreOutlined, AppstoreOutlined, InboxOutlined,
} from '@ant-design/icons-vue'
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, copyTemplate } from '@/api/faiz'

const router = useRouter()

// ---- 类型 ----
interface TemplateTab {
  id: string
  name: string
  formConfig: any
  widgetData: any[]
}

interface Template {
  id: string
  templateName: string
  description: string
  category: string
  status: boolean
  tabs: TemplateTab[]
  createdAt: string
  updatedAt: string
}

// ---- 常量 ----

const tabs = [
  { label: '全部', value: '' },
  { label: '需求', value: 'requirement' },
  { label: '任务', value: 'task' },
  { label: '缺陷', value: 'bug' },
  { label: '其他', value: 'other' },
]
const filters = [
  { label: '全部', value: '' },
  { label: '已启用', value: '1' },
  { label: '已停用', value: '0' },
]
const categoryMap: Record<string, string> = { requirement: '需求', task: '任务', bug: '缺陷', other: '其他' }
const categoryColors: Record<string, { bg: string; tag: string }> = {
  requirement: { bg: 'icon-blue', tag: 'blue' },
  task: { bg: 'icon-green', tag: 'green' },
  bug: { bg: 'icon-orange', tag: 'orange' },
  other: { bg: 'icon-purple', tag: 'purple' },
}

// ---- 状态 ----
const searchValue = ref('')
const filterStatus = ref('')
const tabCategory = ref('')
const showEditModal = ref(false)
const showPreviewModal = ref(false)
const isEdit = ref(false)
const activeEditTab = ref('')
const previewActiveTab = ref('')
const previewTabData = ref<Record<string, any>>({})
const previewTemplate = ref<Template | null>(null)
const templates = ref<Template[]>([])

const editForm = reactive<{
  id: string; templateName: string; description: string; category: string; status: boolean; tabs: TemplateTab[]
}>({ id: '', templateName: '', description: '', category: 'requirement', status: true, tabs: [] })

// ---- 工具函数 ----
function categoryClass(cat: string) { return categoryColors[cat]?.bg || 'icon-blue' }
function categoryTagColor(cat: string) { return categoryColors[cat]?.tag || 'blue' }
function generateId() { return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6) }

function countWidgets(widgets: any[]): number {
  let c = 0; widgets.forEach(w => { c++; if (w.children?.length) c += countWidgets(w.children) }); return c
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return '-'
  const past = new Date(dateStr.replace(' ', 'T')).getTime()
  if (isNaN(past)) return dateStr
  const diff = Date.now() - past
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  if (days < 30) return `${Math.floor(days / 7)} 周前`
  return dateStr.substring(0, 10)
}

// ---- 计算属性 ----
const filteredTemplates = computed(() =>
  templates.value.filter(t => {
    const match = !searchValue.value
      || t.templateName.toLowerCase().includes(searchValue.value.toLowerCase())
      || (t.description || '').toLowerCase().includes(searchValue.value.toLowerCase())
    const st = !filterStatus.value || String(t.status) === filterStatus.value
    const ct = !tabCategory.value || t.category === tabCategory.value
    return match && st && ct
  })
)
const enabledCount = ref(0)
const totalTabs = computed(() => templates.value.reduce((s, t) => s + (t.tabs?.length || 0), 0))

// ---- BaseFormConfig ----
const baseFormConfig = () => ({
  pcVisible: true, pcVertical: true, pcTitleBold: true, pcTitleColon: false,
  pcTitleAlign: '', pcTitleWidth: '', pcTitleAutoWidth: true, pcTitleWidthUnit: '',
  mobileVisible: false, mobileVertical: true, mobileTitleBold: true, mobileTitleColon: false,
  mobileTitleAlign: '', mobileTitleWidth: '', mobileTitleAutoWidth: true, mobileTitleWidthUnit: '',
  isLog: false, isPC: true, isMobile: false, isApplet: false,
})

// ---- 数据适配 ----
function adaptBackendTemplate(t: any): Template {
  return {
    ...t,
    id: String(t.id),
    status: t.status === 1,
    tabs: (t.tabs || []).map((tab: any) => ({
      ...tab,
      id: String(tab.id),
      templateId: String(tab.templateId ?? ''),
      formConfig: typeof tab.formConfig === 'string' ? JSON.parse(tab.formConfig || '{}') : tab.formConfig,
      widgetData: typeof tab.widgetData === 'string' ? JSON.parse(tab.widgetData || '[]') : tab.widgetData,
    })),
  }
}

function serializeTemplatePayload(form: any) {
  return {
    templateName: form.templateName,
    description: form.description,
    category: form.category,
    status: form.status ? 1 : 0,
    tabs: (form.tabs || []).map((tab: any, idx: number) => ({
      name: tab.name,
      tabOrder: tab.tabOrder ?? idx + 1,
      formConfig: typeof tab.formConfig === 'string' ? tab.formConfig : JSON.stringify(tab.formConfig || {}),
      widgetData: typeof tab.widgetData === 'string' ? tab.widgetData : JSON.stringify(tab.widgetData || []),
    })),
  }
}

// ---- 持久化 ----
const loading = ref(false)

async function loadTemplates() {
  loading.value = true
  try {
    const res = await getTemplates()
    if (res.success) {
      templates.value = (res.data.list || []).map(adaptBackendTemplate)
      enabledCount.value = res.data.enabledCount || 0
    }
  } catch {
    message.error('加载模板列表失败')
  } finally {
    loading.value = false
  }
}


// ---- 编辑弹窗 Tab 操作 ----
function addTab() {
  const id = generateId()
  editForm.tabs.push({ id, name: '', formConfig: baseFormConfig(), widgetData: [] })
  activeEditTab.value = id
}

function removeTab(idx: number) {
  if (editForm.tabs.length <= 1) { message.warning('至少保留一个表单'); return }
  const removed = editForm.tabs[idx]
  editForm.tabs.splice(idx, 1)
  if (activeEditTab.value === removed.id) {
    activeEditTab.value = editForm.tabs[0]?.id || ''
  }
}

function onTabNameBlur(_idx: number, _e: any) { /* name updated via v-model */ }
function onTabSwitch() { /* tab switched */ }

function handleEditTabInDesigner(idx: number) {
  const tab = editForm.tabs[idx]
  const formConfig = typeof tab.formConfig === 'string' ? JSON.parse(tab.formConfig) : tab.formConfig
  const widgetData = typeof tab.widgetData === 'string' ? JSON.parse(tab.widgetData) : tab.widgetData
  const payload = { formConfig: { ...formConfig, title: tab.name || editForm.templateName }, widgetData: widgetData || [] }
  localStorage.setItem('DATA_FormDesignEdit', JSON.stringify(payload))
  // 记住当前模板和 tab 的 id，表单设计器保存时回写
  localStorage.setItem('TEMPLATE_EDIT_FLAG', JSON.stringify({ templateId: editForm.id || 'NEW', tabId: tab.id, tabIdx: idx }))
  showEditModal.value = false
  router.push('/settings/form-design')
}

// ---- CRUD ----
function handleCreate() {
  isEdit.value = false
  const tabId = generateId()
  Object.assign(editForm, {
    id: '', templateName: '', description: '', category: 'requirement', status: true,
    tabs: [{ id: tabId, name: '', formConfig: baseFormConfig(), widgetData: [] }],
  })
  activeEditTab.value = tabId
  showEditModal.value = true
}

function handleEdit(record: Template) {
  isEdit.value = true
  editForm.id = record.id
  editForm.templateName = record.templateName
  editForm.description = record.description
  editForm.category = record.category
  editForm.status = record.status
  editForm.tabs = (record.tabs || []).length
    ? JSON.parse(JSON.stringify(record.tabs))
    : [{ id: generateId(), name: '', formConfig: baseFormConfig(), widgetData: [] }]
  activeEditTab.value = editForm.tabs[0]?.id || ''
  showEditModal.value = true
}

function handleEditSubmit() {
  if (!editForm.templateName.trim()) return message.warning('请输入模板名称')
  // 自动补 tab name
  editForm.tabs.forEach((t, i) => { if (!t.name.trim()) t.name = `表单 ${i + 1}` })
  const payload = serializeTemplatePayload(editForm)
  if (isEdit.value) {
    const tplId = Number(editForm.id)
    updateTemplate(tplId, payload).then(res => {
      if (res.success) message.success('更新成功')
      else message.error(res.message || '更新失败')
      loadTemplates(); showEditModal.value = false
    }).catch(() => { message.error('更新失败') })
  } else {
    createTemplate(payload).then(res => {
      if (res.success) message.success('创建成功')
      else message.error(res.message || '创建失败')
      loadTemplates(); showEditModal.value = false
    }).catch(() => { message.error('创建失败') })
  }
}

function handleCopy(record: Template) {
  const tplId = Number(record.id)
  copyTemplate(tplId).then(res => {
    if (res.success) { message.success('已创建副本'); loadTemplates() }
    else message.error(res.message || '复制失败')
  }).catch(() => { message.error('复制失败') })
}

function handleDelete(record: Template) {
  Modal.confirm({
    title: '删除模板',
    content: `确定要删除「${record.templateName}」吗？删除后不可恢复。`,
    okText: '删除', cancelText: '取消', okType: 'danger',
    onOk: () => {
      const tplId = Number(record.id)
      deleteTemplate(tplId).then(res => {
        if (res.success) { message.success('已删除'); loadTemplates() }
        else message.error(res.message || '删除失败')
      }).catch(() => { message.error('删除失败') })
    },
  })
}

function handleMenuClick({ key }: { key: string }, record: Template) {
  handleMenuAction(key, record)
}

function handleMenuAction(key: string, record: Template) {
  const map: Record<string, () => void> = {
    preview: () => handlePreview(record),
    edit: () => handleEdit(record),
    copy: () => handleCopy(record),
    delete: () => handleDelete(record),
  }
  map[key]?.()
}

// ---- 预览 ----
function handlePreview(record: Template) {
  // 深克隆并解析 JSON 字段（后端返回的 formConfig/widgetData 是字符串）
  const parsed = JSON.parse(JSON.stringify(record))
  parsed.tabs = parsed.tabs || []
  parsed.tabs.forEach((tab: any) => {
    tab.formConfig = typeof tab.formConfig === 'string' ? JSON.parse(tab.formConfig) : tab.formConfig
    tab.widgetData = typeof tab.widgetData === 'string' ? JSON.parse(tab.widgetData) : tab.widgetData
  })
  previewTemplate.value = parsed
  previewTabData.value = {}
  previewActiveTab.value = String(parsed.tabs?.[0]?.id || '')
  parsed.tabs?.forEach((tab: any) => {
    const data: Record<string, any> = {}
    const init = (ws: any[], o: Record<string, any>) =>
      ws.forEach((w: any) => { if (w.children?.length) init(w.children, o); else if (w.field) o[w.field] = null })
    tab.widgetData?.length && init(tab.widgetData, data)
    previewTabData.value[tab.id] = data
  })
  showPreviewModal.value = true
}

onMounted(loadTemplates)
</script>

<style scoped>
.template-list-page {
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
.filter-group { display: flex; background: #f5f5f7; border-radius: 10px; padding: 3px; gap: 2px; }
.filter-chip { border: none; background: transparent; padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #6e6e73; cursor: pointer; transition: all 0.2s; font-family: inherit; white-space: nowrap; }
.filter-chip.active { background: #fff; color: #1d1d1f; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.filter-chip:hover:not(.active) { color: #1d1d1f; }
.create-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; background: #1d1d1f; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.create-btn:hover { background: #333; transform: scale(1.02); }
.create-btn:active { transform: scale(0.98); }

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
.template-card { background: #fff; border-radius: 18px; padding: 22px; cursor: pointer; border: 1.5px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,.04); transition: all 0.25s cubic-bezier(.4,0,.2,1); display: flex; flex-direction: column; gap: 14px; }
.template-card:hover { border-color: #e5e5ea; box-shadow: 0 8px 24px rgba(0,0,0,.08); transform: translateY(-2px); }
.template-card.disabled { opacity: 0.6; }
.template-card.disabled:hover { opacity: 0.75; }
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
.card-title { font-size: 16px; font-weight: 600; color: #1d1d1f; margin: 0 0 4px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.card-desc { font-size: 13px; color: #86868b; margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
.card-tag { font-size: 12px; border-radius: 6px; line-height: 1; }
.card-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #aeaeb2; }
.meta-item { display: flex; align-items: center; gap: 3px; }
.meta-sep { color: #d1d1d6; }

/* ---- empty state ---- */
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
.edit-layout { display: flex; flex-direction: column; gap: 24px; }

.edit-basic :deep(.ant-form-item) { margin-bottom: 16px; }
.edit-basic :deep(.ant-form-item-label > label) { font-weight: 600; color: #1d1d1f; font-size: 14px; }
.edit-basic :deep(.ant-input), .edit-basic :deep(.ant-select-selector) { border-radius: 12px !important; }

/* tab 配置区域 */
.edit-tabs-section { border: 1px solid #f0f0f0; border-radius: 16px; padding: 20px; }
.tabs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.tabs-title { font-size: 15px; font-weight: 600; color: #1d1d1f; }
.add-tab-btn { display: flex; align-items: center; gap: 5px; border: 1.5px dashed #d1d1d6; background: transparent; padding: 7px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; color: #6e6e73; cursor: pointer; font-family: inherit; transition: all 0.2s; }
.add-tab-btn:hover { border-color: #007aff; color: #007aff; }

.form-tabs { margin-top: 4px; }
.form-tabs :deep(.ant-tabs-nav) { margin-bottom: 16px; }
.form-tabs :deep(.ant-tabs-tab) { border-radius: 10px 10px 0 0 !important; font-size: 14px; padding: 8px 20px !important; }
.form-tabs :deep(.ant-tabs-tab-active) { font-weight: 600; }
.form-tabs :deep(.ant-tabs-content-holder) { min-height: 120px; }

.tab-name-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.tab-name-row :deep(.ant-input) { border-radius: 8px; font-size: 14px; font-weight: 500; }

.tab-form-preview { display: flex; flex-direction: column; gap: 12px; }
.form-summary { display: flex; align-items: center; justify-content: space-between; }
.summary-count { font-size: 13px; color: #6e6e73; font-weight: 500; }
.widget-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.tab-empty { text-align: center; padding: 30px 0; }
.tab-empty p { font-size: 14px; color: #aeaeb2; margin: 0 0 14px; }

.modal-footer { display: flex; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #f5f5f7; }

/* ---- preview ---- */
.preview-section :deep(.ant-tabs-nav) { margin-bottom: 16px; }
.preview-section :deep(.ant-tabs-tab) { font-size: 15px; font-weight: 500; }
.preview-wrap { max-height: 60vh; overflow-y: auto; }
.empty-preview { text-align: center; color: #aeaeb2; padding: 40px 0; }
</style>
