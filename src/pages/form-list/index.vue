<template>
  <div class="form-list-page">
    <!-- 搜索与操作栏 -->
    <div class="toolbar">
      <div class="search-box">
        <SearchOutlined class="search-icon" />
        <input v-model="searchValue" class="search-input" placeholder="搜索表单…" />
        <div v-if="searchValue" class="search-clear" @click="searchValue = ''">
          <CloseCircleFilled />
        </div>
      </div>
      <div class="toolbar-actions">
        <div class="filter-group">
          <button
            v-for="f in filters" :key="f.value"
            :class="['filter-chip', { active: filterCategory === f.value }]"
            @click="filterCategory = f.value"
          >{{ f.label }}</button>
        </div>
        <button class="create-btn" @click="handleCreate">
          <PlusOutlined /><span>新建表单</span>
        </button>
      </div>
    </div>

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ forms.length }}</span><span class="stat-label">表单总数</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-blue">{{ totalWidgets }}</span><span class="stat-label">控件字段</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-green">{{ templatesWithForms.length }}</span><span class="stat-label">所属模板</span></div>
    </div>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <button v-for="tab in tabs" :key="tab.value"
        :class="['tab-item', { active: tabCategory === tab.value }]"
        @click="tabCategory = tab.value"
      >{{ tab.label }}</button>
    </div>

    <!-- 卡片列表 -->
    <div v-if="filteredForms.length > 0" class="card-grid">
      <div v-for="form in filteredForms" :key="form.id"
        :class="['form-card', { disabled: !form.templateStatus }]"
        @click="handlePreview(form)">
        <div class="card-header">
          <div :class="['card-icon', categoryClass(form.category)]"><FileTextOutlined /></div>
          <div class="card-header-right">
            <span :class="['status-dot', form.templateStatus ? 'on' : 'off']" />
            <a-dropdown trigger="click" @click.stop>
              <button class="card-more" @click.stop><MoreOutlined /></button>
              <template #overlay>
                <a-menu @click="({ key }: { key: string }) => handleMenuAction(key, form)">
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
          <h3 class="card-title">{{ form.name }}</h3>
          <p class="card-desc">
            <span class="desc-tag">{{ categoryMap[form.category] || form.category }}</span>
            所属模板：<strong>{{ form.templateName }}</strong>
          </p>
        </div>
        <div class="card-footer">
          <div class="card-meta">
            <span class="meta-item"><AppstoreOutlined /> {{ form.widgetCount }} 个控件</span>
            <span class="meta-sep">·</span>
            <span class="meta-item meta-time">{{ relativeTime(form.updatedAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon-box"><InboxOutlined class="empty-icon" /></div>
      <h3 class="empty-title">{{ searchValue || filterCategory ? '未找到匹配的表单' : '还没有表单' }}</h3>
      <p class="empty-desc">{{ searchValue || filterCategory ? '尝试更换搜索条件或筛选' : '去模板列表为模板添加表单' }}</p>
      <button v-if="!searchValue && !filterCategory" class="create-btn-empty" @click="handleCreate">
        <PlusOutlined /> 新建表单
      </button>
    </div>

    <!-- ====================== 预览弹窗 ====================== -->
    <a-modal
      v-model:open="showPreviewModal"
      title="表单预览"
      width="900px"
      :footer="null"
      destroy-on-close
      class="edit-modal"
    >
      <div class="preview-section" v-if="previewForm">
        <div class="preview-meta">
          <span class="preview-tpl">所属模板：{{ previewForm.templateName }}</span>
          <span class="preview-widgets">{{ previewForm.widgetCount }} 个控件</span>
        </div>
        <div v-if="previewForm.widgetData?.length" class="preview-wrap">
          <vxe-form-view
            :config="{ formConfig: previewForm.formConfig, widgetData: previewForm.widgetData }"
            v-model="previewFormData"
          />
        </div>
        <div v-else class="empty-preview">此表单暂无配置</div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, SearchOutlined, CloseCircleFilled, FileTextOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, CopyOutlined,
  MoreOutlined, AppstoreOutlined, InboxOutlined,
} from '@ant-design/icons-vue'

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
interface FormItem {
  id: string
  name: string
  widgetCount: number
  formConfig: any
  widgetData: any[]
  templateId: string
  templateName: string
  templateStatus: boolean
  category: string
  updatedAt: string
}

// ---- 常量 ----
const STORAGE_KEY = 'TEMPLATE_LIST'
const tabs = [
  { label: '全部', value: '' },
  { label: '需求', value: 'requirement' },
  { label: '任务', value: 'task' },
  { label: '缺陷', value: 'bug' },
  { label: '其他', value: 'other' },
]
const filters = [
  { label: '全部', value: '' },
  { label: '需求', value: 'requirement' },
  { label: '任务', value: 'task' },
  { label: '缺陷', value: 'bug' },
  { label: '其他', value: 'other' },
]
const categoryMap: Record<string, string> = { requirement: '需求', task: '任务', bug: '缺陷', other: '其他' }
const categoryColors: Record<string, { bg: string }> = {
  requirement: { bg: 'icon-blue' },
  task: { bg: 'icon-green' },
  bug: { bg: 'icon-orange' },
  other: { bg: 'icon-purple' },
}

// ---- 状态 ----
const searchValue = ref('')
const filterCategory = ref('')
const tabCategory = ref('')
const showPreviewModal = ref(false)
const previewForm = ref<FormItem | null>(null)
const previewFormData = ref<Record<string, any>>({})
const forms = ref<FormItem[]>([])
const templates = ref<Template[]>([])

// ---- 工具函数 ----
function categoryClass(cat: string) { return categoryColors[cat]?.bg || 'icon-blue' }
function generateId() { return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6) }
function formatNow() { return new Date().toISOString().replace('T', ' ').substring(0, 19) }

function countWidgets(widgets: any[]): number {
  let c = 0
  widgets.forEach(w => { c++; if (w.children?.length) c += countWidgets(w.children) })
  return c
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

// ---- 从模板列表提取表单 ----
function loadForms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    templates.value = raw ? JSON.parse(raw) : []
    const result: FormItem[] = []
    templates.value.forEach(tpl => {
      (tpl.tabs || []).forEach(tab => {
        result.push({
          id: tab.id,
          name: tab.name || '未命名表单',
          widgetCount: tab.widgetData?.length ? countWidgets(tab.widgetData) : 0,
          formConfig: tab.formConfig,
          widgetData: tab.widgetData || [],
          templateId: tpl.id,
          templateName: tpl.templateName || '未命名模板',
          templateStatus: tpl.status,
          category: tpl.category,
          updatedAt: tpl.updatedAt,
        })
      })
    })
    forms.value = result
  } catch { forms.value = [] }
}

// ---- 计算属性 ----
const filteredForms = computed(() =>
  forms.value.filter(f => {
    const match = !searchValue.value
      || f.name.toLowerCase().includes(searchValue.value.toLowerCase())
      || f.templateName.toLowerCase().includes(searchValue.value.toLowerCase())
    const ct = !tabCategory.value || f.category === tabCategory.value
    return match && ct
  })
)

const totalWidgets = computed(() => forms.value.reduce((s, f) => s + f.widgetCount, 0))
const templatesWithForms = computed(() => {
  const ids = new Set(forms.value.map(f => f.templateId))
  return templates.value.filter(t => ids.has(t.id))
})

// ---- BaseFormConfig ----
const baseFormConfig = () => ({
  pcVisible: true, pcVertical: true, pcTitleBold: true, pcTitleColon: false,
  pcTitleAlign: '', pcTitleWidth: '', pcTitleAutoWidth: true, pcTitleWidthUnit: '',
  mobileVisible: false, mobileVertical: true, mobileTitleBold: true, mobileTitleColon: false,
  mobileTitleAlign: '', mobileTitleWidth: '', mobileTitleAutoWidth: true, mobileTitleWidthUnit: '',
  isLog: false, isPC: true, isMobile: false, isApplet: false,
})

// ---- CRUD ----
function handleCreate() { router.push('/settings/form-design') }

function handleEdit(form: FormItem) {
  const payload = {
    formConfig: { ...form.formConfig, title: form.name },
    widgetData: form.widgetData || [],
  }
  localStorage.setItem('DATA_FormDesignEdit', JSON.stringify(payload))
  const tabIdx = templates.value.find(t => t.id === form.templateId)?.tabs?.findIndex(tb => tb.id === form.id) ?? 0
  localStorage.setItem('TEMPLATE_EDIT_FLAG', JSON.stringify({
    templateId: form.templateId, tabId: form.id, tabIdx,
  }))
  router.push('/settings/form-design')
}

function handleCopy(form: FormItem) {
  const tpl = templates.value.find(t => t.id === form.templateId)
  if (tpl) {
    const newId = generateId()
    tpl.tabs.push({
      id: newId,
      name: form.name + ' - 副本',
      formConfig: form.formConfig,
      widgetData: JSON.parse(JSON.stringify(form.widgetData || [])),
    })
    tpl.updatedAt = formatNow()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.value))
    loadForms()
    message.success('已创建副本')
  }
}

function handleDelete(form: FormItem) {
  Modal.confirm({
    title: '删除表单',
    content: `确定要删除「${form.name}」吗？将同时从所属模板中移除。`,
    okText: '删除', cancelText: '取消', okType: 'danger',
    onOk: () => {
      const tpl = templates.value.find(t => t.id === form.templateId)
      if (tpl) {
        const idx = tpl.tabs.findIndex(tb => tb.id === form.id)
        if (idx > -1 && tpl.tabs.length > 1) {
          tpl.tabs.splice(idx, 1)
          tpl.updatedAt = formatNow()
          localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.value))
          loadForms()
          message.success('已删除')
        } else {
          message.warning('模板需要至少保留一个表单，无法删除')
        }
      }
    },
  })
}

function handleMenuAction(key: string, form: FormItem) {
  const map: Record<string, () => void> = {
    preview: () => handlePreview(form),
    edit: () => handleEdit(form),
    copy: () => handleCopy(form),
    delete: () => handleDelete(form),
  }
  map[key]?.()
}

// ---- 预览 ----
function handlePreview(form: FormItem) {
  previewForm.value = form
  previewFormData.value = {}
  if (form.widgetData?.length) {
    const init = (ws: any[], o: Record<string, any>) =>
      ws.forEach((w: any) => { if (w.children?.length) init(w.children, o); else if (w.field) o[w.field] = null })
    init(form.widgetData, previewFormData.value)
  }
  showPreviewModal.value = true
}

onMounted(loadForms)
</script>

<style scoped>
.form-list-page {
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
.form-card { background: #fff; border-radius: 18px; padding: 22px; cursor: pointer; border: 1.5px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,.04); transition: all 0.25s cubic-bezier(.4,0,.2,1); display: flex; flex-direction: column; gap: 14px; }
.form-card:hover { border-color: #e5e5ea; box-shadow: 0 8px 24px rgba(0,0,0,.08); transform: translateY(-2px); }
.form-card.disabled { opacity: 0.6; }
.form-card.disabled:hover { opacity: 0.75; }
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
.card-desc { font-size: 13px; color: #86868b; margin: 0; line-height: 1.5; }
.desc-tag { display: inline-block; font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 5px; background: #f0f0f5; color: #6e6e73; margin-right: 8px; }
.card-desc strong { font-weight: 600; color: #3a3a3c; }
.card-footer { display: flex; align-items: center; justify-content: flex-start; padding-top: 4px; }
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

/* ---- preview ---- */
.preview-section { display: flex; flex-direction: column; gap: 16px; }
.preview-meta { display: flex; align-items: center; gap: 16px; }
.preview-tpl { font-size: 14px; color: #86868b; font-weight: 500; }
.preview-widgets { font-size: 13px; color: #007aff; font-weight: 600; }
.preview-wrap { max-height: 60vh; overflow-y: auto; }
.empty-preview { text-align: center; color: #aeaeb2; padding: 40px 0; }
</style>
