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
            <a-tab-pane v-for="(tab, idx) in editForm.tabs" :key="tab.id" :tab="tab.name || `表单 ${idx + 1}`">
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
function formatNow() { return new Date().toISOString().replace('T', ' ').substring(0, 19) }

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

function getDefaultTemplates(): Template[] {
  const now = formatNow()
  return [
    // ========== 需求创建 ==========
    {
      id: 'tpl_001', templateName: '需求创建', description: '创建产品需求的标准表单，包含标准字段和团队自定义字段',
      category: 'requirement', status: true, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '需求信息',
          formConfig: { title: '需求信息', ...baseFormConfig() },
          widgetData: [
            // 标准字段
            { id: 1, field: 'title', title: '需求标题', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请输入需求标题', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'row_2', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 3, field: 'priority', title: '优先级', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择优先级', options: [{ value: 'P0', label: 'P0-紧急' }, { value: 'P1', label: 'P1-高' }, { value: 'P2', label: 'P2-中' }, { value: 'P3', label: 'P3-低' }] }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'assignee', title: '指派人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择指派人', options: [{ value: 'u1', label: '张三' }, { value: 'u2', label: '李四' }, { value: 'u3', label: '王五' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 5, field: 'row_5', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 6, field: 'module', title: '所属模块', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择模块', options: [{ value: 'user', label: '用户中心' }, { value: 'order', label: '订单系统' }, { value: 'payment', label: '支付系统' }, { value: 'product', label: '商品管理' }] }, children: [], model: { update: false, value: null } },
              { id: 7, field: 'status', title: '需求状态', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择状态', options: [{ value: 'draft', label: '草稿' }, { value: 'review', label: '评审中' }, { value: 'dev', label: '开发中' }, { value: 'done', label: '已完成' }] }, children: [], model: { update: false, value: null } },
              { id: 8, field: 'version', title: '目标版本', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 v3.2.0', maxLength: 50, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 9, field: 'description', title: '需求描述', name: 'WangEditorWidget', required: true, hidden: false, options: { placeholder: '请详细描述需求背景和内容' }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 10, field: 'row_10', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 11, field: 'source', title: '需求来源', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择来源', options: [{ value: 'customer', label: '客户反馈' }, { value: 'internal', label: '内部规划' }, { value: 'ops', label: '运营需求' }, { value: 'competitor', label: '竞品对标' }] }, children: [], model: { update: false, value: null } },
              { id: 12, field: 'customer', title: '客户名称', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '请输入客户名称', maxLength: 100, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 13, field: 'row_13', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 14, field: 'expectedValue', title: '预期收益', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请描述预期收益', minRows: 2 }, children: [], model: { update: false, value: null } },
              { id: 15, field: 'attachment', title: '相关附件', name: 'UploadImageWidget', required: false, hidden: false, options: { multiple: true, limitCount: 10 }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '评估与排期',
          formConfig: { title: '评估与排期', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'row_1', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 2, field: 'estimate', title: '预估工时(人天)', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 5', maxLength: 20, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 3, field: 'reviewer', title: '评审人', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择评审人', options: [{ value: 'u4', label: '赵六' }, { value: 'u5', label: '孙七' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 4, field: 'row_4', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 5, field: 'planStartDate', title: '计划开始', name: 'DateDatePickerWidget', required: false, hidden: false, options: { placeholder: '请选择计划开始日期' }, children: [], model: { update: false, value: null } },
              { id: 6, field: 'planEndDate', title: '计划完成', name: 'DateDatePickerWidget', required: false, hidden: false, options: { placeholder: '请选择计划完成日期' }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
          ],
        },
      ],
    },
    // ========== 任务创建 ==========
    {
      id: 'tpl_002', templateName: '任务创建', description: '开发任务的创建与追踪表单，支持子任务和工时登记',
      category: 'task', status: true, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '任务信息',
          formConfig: { title: '任务信息', ...baseFormConfig() },
          widgetData: [
            // 标准字段
            { id: 1, field: 'taskName', title: '任务名称', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请输入任务名称', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'row_2', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 3, field: 'taskType', title: '任务类型', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择类型', options: [{ value: 'dev', label: '开发' }, { value: 'test', label: '测试' }, { value: 'design', label: '设计' }, { value: 'review', label: '代码评审' }] }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'executor', title: '执行人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择执行人', options: [{ value: 'u1', label: '张三' }, { value: 'u2', label: '李四' }, { value: 'u3', label: '王五' }] }, children: [], model: { update: false, value: null } },
              { id: 5, field: 'taskStatus', title: '任务状态', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择状态', options: [{ value: 'todo', label: '待开始' }, { value: 'doing', label: '进行中' }, { value: 'done', label: '已完成' }, { value: 'closed', label: '已关闭' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 6, field: 'row_6', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 7, field: 'startDate', title: '开始日期', name: 'DateDatePickerWidget', required: false, hidden: false, options: { placeholder: '请选择开始日期' }, children: [], model: { update: false, value: null } },
              { id: 8, field: 'endDate', title: '截止日期', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择截止日期' }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 9, field: 'desc', title: '任务描述', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请输入任务描述', minRows: 3 }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 10, field: 'row_10', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 11, field: 'sprint', title: '所属迭代', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择迭代', options: [{ value: 's1', label: 'Sprint 21' }, { value: 's2', label: 'Sprint 22' }, { value: 's3', label: 'Sprint 23' }] }, children: [], model: { update: false, value: null } },
              { id: 12, field: 'workHours', title: '工时预估(小时)', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 16', maxLength: 20, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 13, field: 'row_13', title: '一行一列', name: 'row', required: false, hidden: false, options: { colSize: 1, colSpan: '24' }, children: [
              { id: 14, field: 'relatedReq', title: '关联需求', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '请输入关联需求单号，多个用逗号分隔', maxLength: 500, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '工时登记',
          formConfig: { title: '工时登记', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'row_1', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 2, field: 'logDate', title: '登记日期', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择日期' }, children: [], model: { update: false, value: null } },
              { id: 3, field: 'logHours', title: '工时(小时)', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '如 8', maxLength: 20, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 4, field: 'logContent', title: '工作内容', name: 'TextareaWidget', required: true, hidden: false, options: { placeholder: '请描述今日工作内容', minRows: 3 }, children: [], model: { update: false, value: null } },
          ],
        },
      ],
    },
    // ========== 缺陷报告 ==========
    {
      id: 'tpl_003', templateName: '缺陷报告', description: '提交和追踪 Bug 的详细报告模板',
      category: 'bug', status: true, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '缺陷详情',
          formConfig: { title: '缺陷详情', ...baseFormConfig() },
          widgetData: [
            // 标准字段
            { id: 1, field: 'bugTitle', title: '缺陷标题', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请简明描述缺陷现象', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'row_2', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 3, field: 'severity', title: '严重程度', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择', options: [{ value: 'critical', label: '致命' }, { value: 'major', label: '严重' }, { value: 'minor', label: '一般' }, { value: 'trivial', label: '轻微' }] }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'priority', title: '处理优先级', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择', options: [{ value: 'urgent', label: '紧急' }, { value: 'high', label: '高' }, { value: 'normal', label: '普通' }, { value: 'low', label: '低' }] }, children: [], model: { update: false, value: null } },
              { id: 5, field: 'bugStatus', title: '缺陷状态', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择', options: [{ value: 'new', label: '新建' }, { value: 'confirmed', label: '已确认' }, { value: 'fixing', label: '修复中' }, { value: 'fixed', label: '已修复' }, { value: 'closed', label: '已关闭' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 6, field: 'row_6', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 7, field: 'assignee', title: '指派人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择指派人', options: [{ value: 'u1', label: '张三' }, { value: 'u2', label: '李四' }, { value: 'u3', label: '王五' }] }, children: [], model: { update: false, value: null } },
              { id: 8, field: 'reporter', title: '报告人', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择报告人', options: [{ value: 'u4', label: '赵六' }, { value: 'u5', label: '孙七' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 9, field: 'steps', title: '复现步骤', name: 'TextareaWidget', required: true, hidden: false, options: { placeholder: '请详细描述复现步骤：\n1. 打开...\n2. 点击...\n3. 观察到...', minRows: 4 }, children: [], model: { update: false, value: null } },
            { id: 10, field: 'expectedResult', title: '预期结果', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '请输入预期结果', maxLength: 500, clearable: true }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 11, field: 'row_11', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 12, field: 'bugModule', title: '所属模块', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择模块', options: [{ value: 'ui', label: '前端UI' }, { value: 'api', label: '后端接口' }, { value: 'db', label: '数据库' }, { value: 'other', label: '其他' }] }, children: [], model: { update: false, value: null } },
              { id: 13, field: 'foundVersion', title: '发现版本', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 v3.1.5', maxLength: 50, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 14, field: 'fixVersion', title: '修复版本', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 v3.2.0', maxLength: 50, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 15, field: 'env', title: '运行环境', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 iOS 17.0 + Safari / Chrome 120 + Windows 11', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '附件与截图',
          formConfig: { title: '附件与截图', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'screenshot', title: '缺陷截图/录屏', name: 'UploadImageWidget', required: false, hidden: false, options: { multiple: true, limitCount: 10 }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'logFile', title: '日志文件', name: 'UploadImageWidget', required: false, hidden: false, options: { multiple: true, limitCount: 5 }, children: [], model: { update: false, value: null } },
          ],
        },
      ],
    },
    // ========== 会议纪要 ==========
    {
      id: 'tpl_004', templateName: '会议纪要', description: '团队会议的记录与归档，支持待办事项跟踪',
      category: 'other', status: false, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '会议信息',
          formConfig: { title: '会议纪要', ...baseFormConfig() },
          widgetData: [
            // 标准字段
            { id: 1, field: 'meetingTitle', title: '会议主题', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请输入会议主题', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'row_2', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 3, field: 'meetingDate', title: '会议日期', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择日期' }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'meetingTime', title: '会议时间', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '如 14:00-15:30', maxLength: 50, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 5, field: 'recorder', title: '记录人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择记录人', options: [{ value: 'u1', label: '张三' }, { value: 'u2', label: '李四' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 6, field: 'content', title: '会议内容', name: 'WangEditorWidget', required: true, hidden: false, options: { placeholder: '请记录会议讨论内容' }, children: [], model: { update: false, value: null } },
            { id: 7, field: 'conclusion', title: '会议结论', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请输入会议结论和决议', minRows: 3 }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 8, field: 'row_8', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 9, field: 'meetingType', title: '会议类型', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择类型', options: [{ value: 'standup', label: '每日站会' }, { value: 'sprint', label: '迭代规划' }, { value: 'review', label: '评审会' }, { value: 'retro', label: '回顾会' }] }, children: [], model: { update: false, value: null } },
              { id: 10, field: 'location', title: '会议地点', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 3F 会议室A / 腾讯会议 123', maxLength: 100, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '参会与待办',
          formConfig: { title: '参会与待办', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'attendees', title: '参会人员', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '请输入参会人员，用逗号分隔', maxLength: 500, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'absentees', title: '缺席人员', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '请输入缺席人员及原因', maxLength: 300, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 3, field: 'actionItems', title: '待办事项', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请列明待办事项：\n1. @张三 完成XX方案 - 07/25 前\n2. @李四 跟进XX问题 - 07/26 前', minRows: 4 }, children: [], model: { update: false, value: null } },
            { id: 4, field: 'attachments', title: '会议资料', name: 'UploadImageWidget', required: false, hidden: false, options: { multiple: true, limitCount: 10 }, children: [], model: { update: false, value: null } },
          ],
        },
      ],
    },
    // ========== 技术方案评审 ==========
    {
      id: 'tpl_005', templateName: '技术方案评审', description: '技术方案评审与归档，记录评审意见和结论',
      category: 'requirement', status: true, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '方案信息',
          formConfig: { title: '技术方案', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'proposalTitle', title: '方案标题', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请输入技术方案标题', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'row_2', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 3, field: 'author', title: '方案作者', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择作者', options: [{ value: 'u1', label: '张三' }, { value: 'u2', label: '李四' }, { value: 'u3', label: '王五' }] }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'proposalType', title: '方案类型', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择类型', options: [{ value: 'arch', label: '架构设计' }, { value: 'detail', label: '详细设计' }, { value: 'migration', label: '迁移方案' }, { value: 'optimize', label: '优化方案' }] }, children: [], model: { update: false, value: null } },
              { id: 5, field: 'proposalStatus', title: '方案状态', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择状态', options: [{ value: 'draft', label: '草稿' }, { value: 'review', label: '评审中' }, { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已驳回' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 6, field: 'background', title: '背景与问题', name: 'TextareaWidget', required: true, hidden: false, options: { placeholder: '请描述当前存在的问题或需求背景', minRows: 3 }, children: [], model: { update: false, value: null } },
            { id: 7, field: 'solution', title: '技术方案', name: 'WangEditorWidget', required: true, hidden: false, options: { placeholder: '请详细描述技术方案，包括架构图和关键流程' }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 8, field: 'row_8', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 9, field: 'techStack', title: '技术栈', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 React + Node.js + MySQL', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 10, field: 'riskLevel', title: '风险等级', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择风险等级', options: [{ value: 'high', label: '高风险' }, { value: 'medium', label: '中风险' }, { value: 'low', label: '低风险' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 11, field: 'attachment', title: '方案附件', name: 'UploadImageWidget', required: false, hidden: false, options: { multiple: true, limitCount: 10 }, children: [], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '评审记录',
          formConfig: { title: '评审记录', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'row_1', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 2, field: 'reviewers', title: '评审人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择评审人', options: [{ value: 'u4', label: '赵六' }, { value: 'u5', label: '孙七' }, { value: 'u6', label: '周八' }] }, children: [], model: { update: false, value: null } },
              { id: 3, field: 'reviewDate', title: '评审日期', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择评审日期' }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 4, field: 'reviewComments', title: '评审意见', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请输入评审意见', minRows: 3 }, children: [], model: { update: false, value: null } },
            { id: 5, field: 'reviewResult', title: '评审结论', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择评审结论', options: [{ value: 'pass', label: '通过' }, { value: 'pass_with_condition', label: '有条件通过' }, { value: 'reject', label: '不通过' }] }, children: [], model: { update: false, value: null } },
          ],
        },
      ],
    },
    // ========== 发布审核 ==========
    {
      id: 'tpl_006', templateName: '发布审核', description: '版本发布审批流程，包含变更记录和回滚方案',
      category: 'task', status: true, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '发布信息',
          formConfig: { title: '发布信息', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'releaseTitle', title: '发布标题', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请输入发布标题', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'row_2', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 3, field: 'releaseVersion', title: '版本号', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '如 v3.2.0', maxLength: 50, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'releaseEnv', title: '发布环境', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择环境', options: [{ value: 'dev', label: '开发环境' }, { value: 'test', label: '测试环境' }, { value: 'staging', label: '预发布' }, { value: 'prod', label: '生产环境' }] }, children: [], model: { update: false, value: null } },
              { id: 5, field: 'releaseType', title: '发布类型', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择类型', options: [{ value: 'feature', label: '功能发布' }, { value: 'hotfix', label: '紧急修复' }, { value: 'rollback', label: '版本回滚' }, { value: 'config', label: '配置变更' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 6, field: 'row_6', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 7, field: 'releaseDate', title: '发布日期', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择发布日期' }, children: [], model: { update: false, value: null } },
              { id: 8, field: 'releaseWindow', title: '发布窗口', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 02:00-04:00', maxLength: 50, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 9, field: 'changeDesc', title: '变更说明', name: 'TextareaWidget', required: true, hidden: false, options: { placeholder: '请描述本次发布包含的变更内容', minRows: 3 }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 10, field: 'row_10', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 11, field: 'rollbackPlan', title: '回滚方案', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请描述回滚步骤和预计耗时', minRows: 2 }, children: [], model: { update: false, value: null } },
              { id: 12, field: 'riskNote', title: '风险说明', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如影响用户登录、可能增加延迟', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '审批流程',
          formConfig: { title: '审批流程', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'row_1', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 2, field: 'qaLed', title: '测试负责人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择测试负责人', options: [{ value: 'u3', label: '王五' }, { value: 'u5', label: '孙七' }] }, children: [], model: { update: false, value: null } },
              { id: 3, field: 'approver', title: '审批人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择审批人', options: [{ value: 'u4', label: '赵六' }, { value: 'u6', label: '周八' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 4, field: 'approvalNote', title: '审批备注', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请输入审批意见或注意事项', minRows: 2 }, children: [], model: { update: false, value: null } },
          ],
        },
      ],
    },
    // ========== 线上问题反馈 ==========
    {
      id: 'tpl_007', templateName: '线上问题反馈', description: '线上用户反馈问题的收集与处理',
      category: 'bug', status: true, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '问题详情',
          formConfig: { title: '线上问题', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'issueTitle', title: '问题标题', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请简明描述问题现象', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'row_2', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 3, field: 'severityLevel', title: '紧急程度', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择', options: [{ value: 'P0', label: 'P0-紧急' }, { value: 'P1', label: 'P1-高' }, { value: 'P2', label: 'P2-中' }, { value: 'P3', label: 'P3-低' }] }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'impactScope', title: '影响范围', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择', options: [{ value: 'all', label: '全部用户' }, { value: 'partial', label: '部分用户' }, { value: 'single', label: '个别用户' }] }, children: [], model: { update: false, value: null } },
              { id: 5, field: 'source', title: '反馈渠道', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择', options: [{ value: 'user', label: '用户反馈' }, { value: 'monitor', label: '监控告警' }, { value: 'internal', label: '内部发现' }, { value: 'customer', label: '客户投诉' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 6, field: 'row_6', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 7, field: 'occurTime', title: '发生时间', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择发生时间' }, children: [], model: { update: false, value: null } },
              { id: 8, field: 'handler', title: '处理人', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择处理人', options: [{ value: 'u1', label: '张三' }, { value: 'u2', label: '李四' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 9, field: 'issueDesc', title: '问题描述', name: 'TextareaWidget', required: true, hidden: false, options: { placeholder: '请详细描述问题现象、复现路径和影响', minRows: 4 }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 10, field: 'row_10', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 11, field: 'serviceName', title: '所属服务', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 user-service', maxLength: 100, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 12, field: 'affectedUsers', title: '影响用户数', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '如 1000+', maxLength: 50, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 13, field: 'isRecovered', title: '是否已恢复', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择', options: [{ value: 'yes', label: '已恢复' }, { value: 'no', label: '未恢复' }, { value: 'partial', label: '部分恢复' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '处理记录',
          formConfig: { title: '处理记录', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'rootCause', title: '根因分析', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请分析问题根本原因', minRows: 3 }, children: [], model: { update: false, value: null } },
            { id: 2, field: 'fixMethod', title: '修复方案', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请描述修复方案', minRows: 3 }, children: [], model: { update: false, value: null } },
            { id: 3, field: 'row_3', title: '一行一列', name: 'row', required: false, hidden: false, options: { colSize: 1, colSpan: '24' }, children: [
              { id: 4, field: 'fixAttachment', title: '处理截图', name: 'UploadImageWidget', required: false, hidden: false, options: { multiple: true, limitCount: 5 }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
          ],
        },
      ],
    },
    // ========== 请假申请 ==========
    {
      id: 'tpl_008', templateName: '请假申请', description: '员工请假审批流程',
      category: 'other', status: true, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '请假信息',
          formConfig: { title: '请假申请', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'row_1', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 2, field: 'applicant', title: '请假人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择请假人', options: [{ value: 'u1', label: '张三' }, { value: 'u2', label: '李四' }, { value: 'u3', label: '王五' }] }, children: [], model: { update: false, value: null } },
              { id: 3, field: 'leaveType', title: '请假类型', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择类型', options: [{ value: 'annual', label: '年假' }, { value: 'sick', label: '病假' }, { value: 'personal', label: '事假' }, { value: 'marriage', label: '婚假' }, { value: 'maternity', label: '产假' }] }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 4, field: 'row_4', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 5, field: 'leaveStart', title: '开始时间', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择开始时间' }, children: [], model: { update: false, value: null } },
              { id: 6, field: 'leaveEnd', title: '结束时间', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择结束时间' }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 7, field: 'leaveDays', title: '请假天数', name: 'InputWidget', required: true, hidden: false, options: { placeholder: '请输入请假天数', maxLength: 20, clearable: true }, children: [], model: { update: false, value: null } },
            { id: 8, field: 'reason', title: '请假事由', name: 'TextareaWidget', required: true, hidden: false, options: { placeholder: '请详细说明请假事由', minRows: 3 }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 9, field: 'row_9', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 10, field: 'handoverTo', title: '工作交接人', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择交接人', options: [{ value: 'u2', label: '李四' }, { value: 'u3', label: '王五' }] }, children: [], model: { update: false, value: null } },
              { id: 11, field: 'contact', title: '紧急联系方式', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '请输入手机号或微信', maxLength: 50, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 12, field: 'attachment', title: '证明材料', name: 'UploadImageWidget', required: false, hidden: false, options: { multiple: true, limitCount: 5 }, children: [], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '审批记录',
          formConfig: { title: '审批记录', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'row_1', title: '一行两列', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 2, field: 'approver', title: '审批人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择审批人', options: [{ value: 'u4', label: '赵六' }, { value: 'u5', label: '孙七' }] }, children: [], model: { update: false, value: null } },
              { id: 3, field: 'approvalDate', title: '审批日期', name: 'DateDatePickerWidget', required: false, hidden: false, options: { placeholder: '请选择审批日期' }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 4, field: 'approvalResult', title: '审批结果', name: 'SelectWidget', required: false, hidden: false, options: { placeholder: '请选择', options: [{ value: 'approved', label: '同意' }, { value: 'rejected', label: '驳回' }] }, children: [], model: { update: false, value: null } },
            { id: 5, field: 'approvalComment', title: '审批意见', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请输入审批意见', minRows: 2 }, children: [], model: { update: false, value: null } },
          ],
        },
      ],
    },
    // ========== 周报提交 ==========
    {
      id: 'tpl_009', templateName: '周报提交', description: '团队周报提交与汇总',
      category: 'other', status: true, createdAt: now, updatedAt: now,
      tabs: [
        {
          id: generateId(), name: '本周总结',
          formConfig: { title: '周报', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'row_1', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 2, field: 'reporter', title: '汇报人', name: 'SelectWidget', required: true, hidden: false, options: { placeholder: '请选择汇报人', options: [{ value: 'u1', label: '张三' }, { value: 'u2', label: '李四' }, { value: 'u3', label: '王五' }] }, children: [], model: { update: false, value: null } },
              { id: 3, field: 'weekStart', title: '周开始日期', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择' }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'weekEnd', title: '周结束日期', name: 'DateDatePickerWidget', required: true, hidden: false, options: { placeholder: '请选择' }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 5, field: 'completedWork', title: '本周完成', name: 'WangEditorWidget', required: true, hidden: false, options: { placeholder: '请列出本周完成的工作内容' }, children: [], model: { update: false, value: null } },
            { id: 6, field: 'nextPlan', title: '下周计划', name: 'TextareaWidget', required: true, hidden: false, options: { placeholder: '请列出下周的工作计划', minRows: 3 }, children: [], model: { update: false, value: null } },
            // 团队自定义信息
            { id: 7, field: 'row_7', title: '团队自定义信息', name: 'row', required: false, hidden: false, options: { colSize: 2, colSpan: '12,12' }, children: [
              { id: 8, field: 'risks', title: '风险和阻塞', name: 'TextareaWidget', required: false, hidden: false, options: { placeholder: '请描述遇到的风险或阻塞问题', minRows: 2 }, children: [], model: { update: false, value: null } },
              { id: 9, field: 'needHelp', title: '需要协助', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '请输入需要哪位同事或资源协助', maxLength: 200, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
            { id: 10, field: 'attachment', title: '相关文档', name: 'UploadImageWidget', required: false, hidden: false, options: { multiple: true, limitCount: 5 }, children: [], model: { update: false, value: null } },
          ],
        },
        {
          id: generateId(), name: '数据统计',
          formConfig: { title: '数据统计', ...baseFormConfig() },
          widgetData: [
            { id: 1, field: 'row_1', title: '一行三列', name: 'row', required: false, hidden: false, options: { colSize: 3, colSpan: '8,8,8' }, children: [
              { id: 2, field: 'newReqs', title: '新增需求', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '数量', maxLength: 10, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 3, field: 'closedReqs', title: '关闭需求', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '数量', maxLength: 10, clearable: true }, children: [], model: { update: false, value: null } },
              { id: 4, field: 'fixedBugs', title: '修复缺陷', name: 'InputWidget', required: false, hidden: false, options: { placeholder: '数量', maxLength: 10, clearable: true }, children: [], model: { update: false, value: null } },
            ], model: { update: false, value: null } },
          ],
        },
      ],
    },
  ]
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
