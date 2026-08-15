<template>
  <div class="template-list-page">
    <!-- 搜索与操作栏 -->
    <div class="toolbar">
      <div class="search-box">
        <SearchOutlined class="search-icon" />
        <input v-model="searchValue" class="search-input" placeholder="搜索模板…" @keyup.enter="handleQuery" />
        <div v-if="searchValue" class="search-clear" @click="clearSearch">
          <CloseCircleFilled />
        </div>
      </div>
      <button class="search-btn" @click="handleQuery"><SearchOutlined /> 查询</button>
      <div class="toolbar-actions">
        <div class="filter-group">
          <button
            v-for="f in filters" :key="f.value"
            :class="['filter-chip', { active: filterStatus === f.value }]"
            @click="onFilterStatusClick(f.value)"
          >{{ f.label }}</button>
        </div>
        <button class="create-btn" @click="handleCreate">
          <PlusOutlined /><span>新建模板</span>
        </button>
      </div>
    </div>

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ totalCount }}</span><span class="stat-label">模板总数</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-green">{{ enabledCount }}</span><span class="stat-label">已启用</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-blue">{{ totalTabs }}</span><span class="stat-label">表单配置</span></div>
    </div>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <button v-for="tab in TAB_NAV_OPTIONS" :key="tab.value"
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

    <!-- 分页 -->
    <div v-if="!loading && totalCount > 0" class="pagination-bar">
      <a-pagination
        v-model:current="page"
        v-model:page-size="perPage"
        :total="totalCount"
        :show-size-changer="true"
        :show-quick-jumper="true"
        :page-size-options="['12', '24', '48', '96']"
        :show-total="(t: number) => `共 ${t} 条`"
        @change="handlePageChange"
        @showSizeChange="handleSizeChange"
      />
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
                <a-form-item label="问题类型">
                  <a-select v-model:value="issueTypeValue" placeholder="选择" size="large">
                    <a-select-option v-for="t in ISSUE_TYPE_OPTIONS" :key="t.issueTypeId" :value="t.issueTypeId">{{ t.issueTypeName }}</a-select-option>
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
            <span class="tabs-title">表单配置</span>
            <div class="tabs-header-right">
              <span class="enable-tab-label">启用多表单 Tab</span>
              <a-switch v-model:checked="editForm.useTabs" />
              <button v-if="editForm.useTabs" class="add-tab-btn" @click="addTab">
                <PlusOutlined /> 添加表单
              </button>
            </div>
          </div>

          <!-- 单表单模式（默认）：直接展示一个表单，无 Tab 页签 -->
          <div v-if="!editForm.useTabs" class="single-form-panel">
            <div class="single-form-header">
              <div class="single-form-stats">
                <span class="stat-chip stat-chip-added">已添加 {{ countWidgets(singleFormTab.widgetData) }} 个字段</span>
                <span class="stat-chip stat-chip-selected">已勾选 {{ selectedAvailableFieldIds.length }} 个</span>
              </div>
            </div>

            <div class="single-form-split">
              <!-- 左：可选字段勾选面板 -->
              <div class="available-fields-panel">
                <div class="afp-title-row">
                  <span class="afp-title">可用字段</span>
                  <a-button type="text" size="small" @click="loadAvailableFields(true)">
                    <ReloadOutlined /> 刷新
                  </a-button>
                </div>
                <div class="afp-filter-row">
                  <a-input
                    v-model:value="availableFieldKeyword"
                    size="small"
                    placeholder="搜索字段名称/ID"
                    allow-clear
                  >
                    <template #prefix><SearchOutlined /></template>
                  </a-input>
                  <a-select
                    v-model:value="availableFieldTypeFilter"
                    size="small"
                    placeholder="全部类型"
                    allow-clear
                    style="min-width: 120px; flex-shrink: 0"
                  >
                    <a-select-option v-for="t in FIELD_TYPE_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
                  </a-select>
                </div>
                <a-tabs
                  v-model:activeKey="availableFieldTypeFilter"
                  class="afp-type-tabs"
                  type="line"
                  size="small"
                  @change="(key: string) => availableFieldTypeFilter = key"
                >
                  <a-tab-pane key="" tab="全部" />
                  <a-tab-pane v-for="t in FIELD_TYPE_OPTIONS" :key="t.value" :tab="t.label" />
                </a-tabs>
                <div class="afp-list">
                  <a-spin :spinning="availableFieldsLoading" size="small">
                    <a-empty v-if="!availableFieldsLoading && filteredAvailableFields.length === 0" description="暂无匹配字段" />
                    <a-checkbox-group
                      v-else
                      v-model:value="selectedAvailableFieldIds"
                    >
                      <div class="afp-list-grid">
                        <div
                          v-for="f in filteredAvailableFields"
                          :key="f.fieldId"
                          class="afp-item"
                          :class="{ 'is-added': addedFieldIds.has(String(f.fieldId)) }"
                        >
                          <a-checkbox :value="String(f.fieldId)" :disabled="addedFieldIds.has(String(f.fieldId))">
                            <span class="afp-item-name">
                              <span v-if="f.isRequired" class="afp-required">*</span>
                              {{ f.fieldName || f.fieldId }}
                            </span>
                          </a-checkbox>
                          <span class="afp-item-type-tag" :title="f.type">{{ typeLabel(f.type) }}</span>
                          <CheckOutlined v-if="addedFieldIds.has(String(f.fieldId))" class="afp-item-added-mark" title="已添加" />
                        </div>
                      </div>
                    </a-checkbox-group>
                  </a-spin>
                </div>
                <div class="afp-footer">
                  <a-checkbox
                    :checked="isAllFilteredChecked"
                    :indeterminate="isFilteredIndeterminate"
                    :disabled="filteredAvailableFields.length === 0"
                    @change="toggleSelectAllFiltered"
                  >全选当前</a-checkbox>
                  <a-button type="primary" size="small" :disabled="selectedAvailableFieldIds.length === 0" @click="addSelectedFieldsToForm">
                    <PlusOutlined /> 添加选中字段
                  </a-button>
                </div>
              </div>

              <!-- 右：已添加字段摘要（可移除） -->
              <div class="added-fields-panel">
                <div class="afp-title-row">
                  <span class="afp-title">表单字段</span>
                  <a-button v-if="(singleFormTab.widgetData || []).length > 0" type="text" size="small" danger @click="clearAddedFields">清空</a-button>
                </div>
                <div v-if="!singleFormTab.widgetData?.length" class="added-empty">
                  <InboxOutlined class="added-empty-icon" />
                  <p>从左侧勾选字段，点击「添加选中字段」添加到表单</p>
                </div>
                <div v-else class="added-list">
                  <div
                    v-for="(w, idx) in singleFormTab.widgetData"
                    :key="w.id || idx"
                    class="added-item"
                    :class="{ 'is-dragging': dragIndex === idx, 'is-drag-over': dragOverIndex === idx }"
                    draggable="true"
                    @dragstart="onDragStart(idx, $event)"
                    @dragover.prevent="onDragOver(idx, $event)"
                    @dragleave="onDragLeave(idx)"
                    @drop.prevent="onDrop(idx)"
                    @dragend="onDragEnd"
                  >
                    <HolderOutlined class="added-drag-handle" />
                    <span class="added-sort">{{ idx + 1 }}</span>
                    <span class="added-title">
                      <span v-if="w.required" class="afp-required">*</span>
                      {{ w.title || w.field || '未命名字段' }}
                    </span>
                    <span class="added-type-tag" :title="w.componentKey || w.name">{{ componentLabel(w) }}</span>
                    <a-button type="text" size="small" danger class="added-remove" @click="removeAddedWidget(idx)">
                      <CloseCircleFilled />
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 多表单 Tab 模式 -->
          <a-tabs v-else v-model:activeKey="activeEditTab" type="card" class="form-tabs" @change="onTabSwitch">
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

              <!-- 表单字段（可删除） -->
              <div v-if="tab.widgetData?.length" class="tab-form-preview">
                <div class="form-summary">
                  <span class="summary-count">{{ countWidgets(tab.widgetData) }} 个控件</span>
                  <a-button size="small" danger type="link" @click="clearTabFields(idx)">清空</a-button>
                </div>
                <div class="widget-chips">
                  <a-tag
                    v-for="(w, wi) in tab.widgetData"
                    :key="w.id"
                    color="default"
                    closable
                    @close="removeWidgetFromTab(idx, wi)"
                  >
                    {{ w.title }}
                  </a-tag>
                </div>
              </div>
              <div v-else class="tab-empty">
                <p>暂无表单配置</p>
                <p class="tab-empty-hint">在下方勾选可选字段 → 点击添加</p>
              </div>

              <!-- 当前 Tab 可选字段面板 -->
              <div class="tab-available-fields">
                <div class="tab-available-header">
                  <span class="section-title">可选字段</span>
                  <div class="section-tools">
                    <a-input
                      size="small"
                      :allow-clear="true"
                      v-model:value="tabFieldKeywordMap[tab.id]"
                      placeholder="搜索字段名/编码"
                      style="width: 200px"
                    >
                      <template #prefix><SearchOutlined /></template>
                    </a-input>
                    <a-select
                      size="small"
                      v-model:value="tabFieldTypeMap[tab.id]"
                      allow-clear
                      placeholder="类型"
                      style="width: 130px"
                    >
                      <a-select-option v-for="o in FIELD_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</a-select-option>
                    </a-select>
                  </div>
                </div>
                <div class="tab-available-toolbar">
                  <label class="check-all-label">
                    <input
                      type="checkbox"
                      :checked="isTabAllChecked(tab.id)"
                      :indeterminate.prop="isTabIndeterminate(tab.id)"
                      @change="(ev: any) => toggleTabSelectAll(tab.id, ev)"
                    />
                    全选
                  </label>
                  <a-button
                    size="small"
                    type="primary"
                    :disabled="(tabSelectedIdsMap[tab.id] || []).length === 0"
                    @click="addTabSelectedFields(tab.id)"
                  >
                    <CheckOutlined /> 添加选中
                  </a-button>
                  <a-button
                    size="small"
                    :disabled="tabFilteredAvailable(tab.id).length === 0"
                    @click="addTabAllAvailable(tab.id)"
                  >
                    全部添加
                  </a-button>
                  <span class="toolbar-count">
                    可添加 {{ tabFilteredAvailable(tab.id).filter((f: any) => !tabAddedFieldIds(tab.id).has(String(f.fieldId))).length }} / 总 {{ availableFieldsList.length }}
                  </span>
                </div>
                <a-spin :spinning="availableFieldsLoading" size="small">
                  <div class="tab-available-list">
                    <a-empty v-if="!availableFieldsLoading && tabFilteredAvailable(tab.id).length === 0" description="暂无匹配字段" />
                    <div
                      v-else
                      v-for="f in tabFilteredAvailable(tab.id)"
                      :key="f.fieldId || f.id"
                      class="available-field-row"
                    >
                      <div class="field-check">
                        <input
                          type="checkbox"
                          :value="String(f.fieldId)"
                          :checked="(tabSelectedIdsMap[tab.id] || []).includes(String(f.fieldId))"
                          :disabled="tabAddedFieldIds(tab.id).has(String(f.fieldId))"
                          @change="(ev: any) => onTabFieldCheckChange(tab.id, String(f.fieldId), ev.target.checked)"
                        />
                      </div>
                      <div class="field-main">
                        <div class="field-name">
                          {{ f.fieldName }}
                          <span class="field-type-badge" :class="'ft-' + f.type">{{ typeLabel(f.type) }}</span>
                        </div>
                        <div class="field-id">{{ f.fieldId }}</div>
                      </div>
                      <div class="field-right">
                        <a-tag v-if="tabAddedFieldIds(tab.id).has(String(f.fieldId))" color="success">已添加</a-tag>
                        <a-tag v-else-if="f.isRequired" color="red" bordered="false">必填</a-tag>
                      </div>
                    </div>
                  </div>
                </a-spin>
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
    <template-preview-modal v-model:open="showPreviewModal" :template="previewTemplate" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch, nextTick } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, SearchOutlined, CloseCircleFilled, FormOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, CopyOutlined,
  MoreOutlined, AppstoreOutlined, InboxOutlined, CheckOutlined, ReloadOutlined,
  HolderOutlined,
} from '@ant-design/icons-vue'
import type { AvailableFieldItem, EnumOptionItem } from '@/types/faiz'
import { queryTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, copyTemplate, queryAvailableFields } from '@/api/faiz'
import TemplatePreviewModal from '@/components/TemplatePreviewModal.vue'

// ---- 类型 ----
interface TemplateTab {
  id: string
  name: string
  widgetData: any[]
}

interface Template {
  id: string
  templateName: string
  description: string
  /** 前端内部使用的分类 key（requirement/task/bug/other），读写时双向映射到 issue_type */
  category: string
  status: boolean
  tabs: TemplateTab[]
  createdAt: string
  updatedAt: string
  /** 后端返回的原始 issue_type（详情回填、列表展示时透传） */
  issue_type?: { issue_type_id: number; issue_type_name: string } | null
}

/** 问题类型常量（下拉 value=issueTypeId, label=issueTypeName；同时承载分类 value/label） */
const ISSUE_TYPE_OPTIONS = [
  { issueTypeId: 10001, issueTypeName: '需求', value: 'requirement', label: '需求' },
  { issueTypeId: 10002, issueTypeName: '任务', value: 'task', label: '任务' },
  { issueTypeId: 10003, issueTypeName: '缺陷', value: 'bug', label: '缺陷' },
  { issueTypeId: 10004, issueTypeName: '其他', value: 'other', label: '其他' },
]
/** Tab 导航选项（含「全部」） */
const TAB_NAV_OPTIONS = [{ label: '全部', value: '' }, ...ISSUE_TYPE_OPTIONS]
const filters = [
  { label: '全部', value: '' },
  { label: '已启用', value: '1' },
  { label: '已停用', value: '0' },
]
const categoryMap: Record<string, string> = ISSUE_TYPE_OPTIONS
  .reduce((acc, t) => { acc[t.value] = t.label; return acc }, {} as Record<string, string>)
const ISSUE_TYPE_ID_TO_CATEGORY: Record<number, string> = ISSUE_TYPE_OPTIONS
  .reduce((acc, t) => { acc[t.issueTypeId] = t.value; return acc }, {} as Record<number, string>)
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
const previewTemplate = ref<Template | null>(null)

const templates = ref<Template[]>([])

// ---- 可选字段（单表单模式） ----
const availableFieldsLoading = ref(false)
const availableFieldsList = ref<AvailableFieldItem[]>([])
const availableFieldKeyword = ref('')
const availableFieldTypeFilter = ref('')
const selectedAvailableFieldIds = ref<string[]>([])
const FIELD_TYPE_OPTIONS = [
  { value: 'STRING', label: '文本' },
  { value: 'NUMBER', label: '数字' },
  { value: 'DATE', label: '日期' },
  { value: 'DATETIME', label: '日期时间' },
  { value: 'BOOLEAN', label: '布尔' },
  { value: 'SINGLE_SELECT', label: '单选下拉' },
  { value: 'MULTI_SELECT', label: '多选下拉' },
  { value: 'CASCADER', label: '级联' },
  { value: 'USER', label: '成员' },
  { value: 'RICH_TEXT', label: '富文本' },
]

async function loadAvailableFields(force = false) {
  if (availableFieldsList.value.length > 0 && !force) return
  availableFieldsLoading.value = true
  try {
    const res = await queryAvailableFields({ page: 1, perPage: 999, searchKey: '' })
    availableFieldsList.value = res?.data?.list || []
  } catch {
    availableFieldsList.value = []
  } finally {
    availableFieldsLoading.value = false
  }
}

const filteredAvailableFields = computed(() => {
  const kw = availableFieldKeyword.value.trim().toLowerCase()
  const t = availableFieldTypeFilter.value
  return availableFieldsList.value.filter(f => {
    if (t && f.type !== t) return false
    if (kw && !(`${f.fieldName ?? ''} ${f.fieldId ?? ''}`.toLowerCase().includes(kw))) return false
    return true
  })
})

/** 已添加到单表单中的 fieldId 集合（避免重复） */
const addedFieldIds = computed(() => {
  const set = new Set<string>()
  const widgets = singleFormTab.value.widgetData || []
  const walk = (arr: any[]) => arr.forEach((w: any) => {
    if (w?.fieldId) set.add(String(w.fieldId))
    if (w?.children?.length) walk(w.children)
  })
  walk(widgets)
  return set
})

/** 解析 fieldValue（JSON 字符串）为 EnumOptionItem 数组 */
function parseFieldValue(raw: string | null | undefined): EnumOptionItem[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v as EnumOptionItem[]
  } catch { /* ignore */ }
  return []
}

/** 可用字段 → widget 对象（vxe 兼容结构） */
function availableFieldToWidget(f: AvailableFieldItem): any {
  const id = generateId()
  const opts = parseFieldValue(f.fieldValue)
  const base: any = {
    id,
    fieldId: f.fieldId,
    title: f.fieldName,
    field: f.fieldId,
    required: !!f.isRequired,
    options: {
      title: f.fieldName,
      placeholder: f.fieldName ? `请输入${f.fieldName}` : '请输入',
      required: !!f.isRequired,
    },
  }
  switch (f.type) {
    case 'STRING':
      return { ...base, name: `Comp_00000000_${id}_input_text`, componentKey: 'input_text' }
    case 'NUMBER':
      return { ...base, name: `Comp_00000000_${id}_input_number`, componentKey: 'input_number' }
    case 'DATE':
      return { ...base, name: `Comp_00000000_${id}_date_picker`, componentKey: 'date_picker', options: { ...base.options, format: 'YYYY-MM-DD' } }
    case 'DATETIME':
      return { ...base, name: `Comp_00000000_${id}_date_picker`, componentKey: 'date_picker', options: { ...base.options, format: 'YYYY-MM-DD HH:mm:ss', hasTime: true } }
    case 'BOOLEAN':
      return { ...base, name: `Comp_00000000_${id}_boolean_switch`, componentKey: 'switch' }
    case 'SINGLE_SELECT':
      return { ...base, name: `Comp_00000000_${id}_select_single`, componentKey: 'select_single', options: { ...base.options, options: opts, multiple: false } }
    case 'MULTI_SELECT':
      return { ...base, name: `Comp_00000000_${id}_select_multiple`, componentKey: 'select_multiple', options: { ...base.options, options: opts, multiple: true } }
    case 'CASCADER':
      return { ...base, name: `Comp_00000000_${id}_cascader`, componentKey: 'cascader', options: { ...base.options, options: opts } }
    case 'USER':
      return { ...base, name: `Comp_00000000_${id}_member`, componentKey: 'member', options: { ...base.options, multiple: false } }
    case 'RICH_TEXT':
      return { ...base, name: `Comp_00000000_${id}_rich_text`, componentKey: 'rich_text' }
    case 'OBJECT':
      return { ...base, name: `Comp_00000000_${id}_input_text`, componentKey: 'input_text' }
    case 'ARRAY':
      return { ...base, name: `Comp_00000000_${id}_select_multiple`, componentKey: 'select_multiple', options: { ...base.options, options: opts } }
    default:
      return { ...base, name: `Comp_00000000_${id}_input_text`, componentKey: 'input_text' }
  }
}

function addSelectedFieldsToForm() {
  const target = selectedAvailableFieldIds.value.filter(id => !addedFieldIds.value.has(String(id)))
  if (target.length === 0) { message.info('勾选的字段已全部添加'); return }
  const rows = availableFieldsList.value.filter(f => target.includes(String(f.fieldId)) || target.includes(String(f.id)))
  if (rows.length === 0) { message.warning('未找到勾选的字段'); return }
  const widgets = rows.map(r => availableFieldToWidget(r))
  singleFormTab.value.widgetData = [...(singleFormTab.value.widgetData || []), ...widgets]
  message.success(`已添加 ${widgets.length} 个字段`)
}

/** 根据单表单已有 widgetData 回显勾选状态（仅新增阶段自动勾选一次） */
function syncSelectedFromWidgetData() {
  const ids: string[] = []
  const walk = (arr: any[]) => arr.forEach((w: any) => {
    if (w?.fieldId) ids.push(String(w.fieldId))
    if (w?.children?.length) walk(w.children)
  })
  walk(singleFormTab.value.widgetData || [])
  selectedAvailableFieldIds.value = ids
}

// 弹窗打开时加载字段（若尚未加载）
watch(showEditModal, (open) => {
  if (open) { loadAvailableFields(); nextTick(syncSelectedFromWidgetData) }
})

/** 字段类型 value → 中文标签 */
const TYPE_LABEL_MAP: Record<string, string> = FIELD_TYPE_OPTIONS.reduce(
  (acc, t) => { acc[t.value] = t.label; return acc },
  {} as Record<string, string>,
)
function typeLabel(t: string | undefined | null): string { return TYPE_LABEL_MAP[t ?? ''] || (t ? String(t) : '未知') }

/** componentKey / widget.name → 中文标签 */
function componentLabel(w: any): string {
  if (!w) return '未知'
  const key: string = (w.componentKey || '').toLowerCase()
  if (key.includes('textarea')) return '多行文本'
  if (key.includes('number') || key.includes('amount')) return '数字'
  if (key.includes('date_picker') || key.includes('datepicker')) return w.options?.hasTime ? '日期时间' : '日期'
  if (key.includes('switch') || key.includes('boolean')) return '布尔'
  if (key.includes('select')) return key.includes('multi') || w.options?.multiple ? '多选下拉' : '单选下拉'
  if (key.includes('cascader')) return '级联'
  if (key.includes('member') || key.includes('user')) return '成员'
  if (key.includes('richtext') || key.includes('rich_text')) return '富文本'
  if (key.includes('uploadimage') || key.includes('image')) return '图片'
  if (key.includes('uploadfile') || key.includes('upload')) return '附件'
  return '单行文本'
}

/** 全选当前筛选状态 */
const isAllFilteredChecked = computed(() => {
  const target = filteredAvailableFields.value
  if (target.length === 0) return false
  const sel = new Set(selectedAvailableFieldIds.value)
  return target.every(f => sel.has(String(f.fieldId)) || addedFieldIds.value.has(String(f.fieldId)))
})
const isFilteredIndeterminate = computed(() => {
  const target = filteredAvailableFields.value
  if (target.length === 0) return false
  const sel = new Set(selectedAvailableFieldIds.value)
  let selected = 0, total = 0
  target.forEach(f => { if (!addedFieldIds.value.has(String(f.fieldId))) { total++; if (sel.has(String(f.fieldId))) selected++ } })
  if (total === 0) return false
  return selected > 0 && selected < total
})
function toggleSelectAllFiltered(ev: any) {
  const checked = !!ev.target?.checked
  const target = filteredAvailableFields.value.filter(f => !addedFieldIds.value.has(String(f.fieldId))).map(f => String(f.fieldId))
  const cur = new Set(selectedAvailableFieldIds.value)
  if (checked) target.forEach(id => cur.add(id))
  else target.forEach(id => cur.delete(id))
  selectedAvailableFieldIds.value = Array.from(cur)
}

/** 操作已添加字段（单表单模式） */
function removeAddedWidget(idx: number) {
  const removed = (singleFormTab.value.widgetData || [])[idx]
  singleFormTab.value.widgetData = (singleFormTab.value.widgetData || []).filter((_, i) => i !== idx)
  if (removed?.fieldId) {
    selectedAvailableFieldIds.value = selectedAvailableFieldIds.value.filter(id => String(id) !== String(removed.fieldId))
  }
}
function clearAddedFields() {
  Modal.confirm({
    title: '确认清空表单字段？',
    content: '将移除表单中已添加的全部字段',
    okType: 'danger',
    onOk: () => {
      singleFormTab.value.widgetData = []
      selectedAvailableFieldIds.value = []
    },
  })
}

// ================================================================
// 多表单 Tab 模式：每个 Tab 独立的可选字段状态（关键字/类型过滤、勾选选中、已添加集合）
// ================================================================
/** 按 tabId 为 key 的搜索关键字 */
const tabFieldKeywordMap = reactive<Record<string, string>>({})
/** 按 tabId 为 key 的类型过滤值 */
const tabFieldTypeMap = reactive<Record<string, string>>({})
/** 按 tabId 为 key 的勾选 fieldId 列表 */
const tabSelectedIdsMap = reactive<Record<string, string[]>>({})

function ensureTabMapKeys(tab: TemplateTab) {
  const k = String(tab.id)
  if (!(k in tabFieldKeywordMap)) tabFieldKeywordMap[k] = ''
  if (!(k in tabFieldTypeMap)) tabFieldTypeMap[k] = ''
  if (!(k in tabSelectedIdsMap)) tabSelectedIdsMap[k] = []
}

/** 同步 per-tab 状态映射：新增 Tab 时建 key，已删除 Tab 时回收 */
function syncTabMaps() {
  try {
    const keep = new Set<string>()
    for (const t of editForm.tabs) {
      keep.add(String(t.id))
      ensureTabMapKeys(t)
    }
    for (const k of Object.keys(tabFieldKeywordMap)) if (!keep.has(k)) delete tabFieldKeywordMap[k]
    for (const k of Object.keys(tabFieldTypeMap)) if (!keep.has(k)) delete tabFieldTypeMap[k]
    for (const k of Object.keys(tabSelectedIdsMap)) if (!keep.has(k)) delete tabSelectedIdsMap[k]
  } catch { /* editForm.tabs 可能在卸载瞬间不可用，忽略 */ }
}

/** 当前 Tab：已添加字段 fieldId 集合 */
function tabAddedFieldIds(tabId: string | number): Set<string> {
  const t = editForm.tabs.find((x: TemplateTab) => String(x.id) === String(tabId))
  const set = new Set<string>()
  if (!t) return set
  const walk = (arr: any[]) => arr.forEach((w: any) => {
    if (w?.fieldId) set.add(String(w.fieldId))
    if (w?.children?.length) walk(w.children)
  })
  walk(t.widgetData || [])
  return set
}

/** 当前 Tab：过滤后的可选字段（关键字 + 类型） */
function tabFilteredAvailable(tabId: string | number): AvailableFieldItem[] {
  const k = String(tabId)
  const kw = (tabFieldKeywordMap[k] || '').trim().toLowerCase()
  const tp = tabFieldTypeMap[k] || ''
  return availableFieldsList.value.filter((f) => {
    if (tp && f.type !== tp) return false
    if (kw && !(`${f.fieldName ?? ''} ${f.fieldId ?? ''}`.toLowerCase().includes(kw))) return false
    return true
  })
}

/** 当前 Tab：全选/半选状态 */
function isTabAllChecked(tabId: string | number): boolean {
  const list = tabFilteredAvailable(tabId)
  if (!list.length) return false
  const added = tabAddedFieldIds(tabId)
  const sel = new Set(tabSelectedIdsMap[String(tabId)] || [])
  return list.every((f) => added.has(String(f.fieldId)) || sel.has(String(f.fieldId)))
}
function isTabIndeterminate(tabId: string | number): boolean {
  const list = tabFilteredAvailable(tabId)
  if (!list.length) return false
  const added = tabAddedFieldIds(tabId)
  const sel = new Set(tabSelectedIdsMap[String(tabId)] || [])
  let selectable = 0, checked = 0
  list.forEach((f) => {
    if (added.has(String(f.fieldId))) return
    selectable++
    if (sel.has(String(f.fieldId))) checked++
  })
  return checked > 0 && checked < selectable
}
function toggleTabSelectAll(tabId: string | number, ev: any) {
  const k = String(tabId)
  const checked = !!ev.target?.checked
  const added = tabAddedFieldIds(k)
  const ids = tabFilteredAvailable(k)
    .filter((f) => !added.has(String(f.fieldId)))
    .map((f) => String(f.fieldId))
  const cur = new Set(tabSelectedIdsMap[k] || [])
  if (checked) ids.forEach((id) => cur.add(id))
  else ids.forEach((id) => cur.delete(id))
  tabSelectedIdsMap[k] = Array.from(cur)
}
function onTabFieldCheckChange(tabId: string | number, fieldId: string, checked: boolean) {
  const k = String(tabId)
  const cur = new Set(tabSelectedIdsMap[k] || [])
  if (checked) cur.add(fieldId)
  else cur.delete(fieldId)
  tabSelectedIdsMap[k] = Array.from(cur)
}

/** Tab：移除单个字段（从 chip × 触发） */
function removeWidgetFromTab(tabIdx: number, widgetIdx: number) {
  const tab = editForm.tabs[tabIdx]
  if (!tab) return
  const removed = (tab.widgetData || [])[widgetIdx]
  tab.widgetData = (tab.widgetData || []).filter((_: any, i: number) => i !== widgetIdx)
  if (removed?.fieldId) {
    const k = String(tab.id)
    tabSelectedIdsMap[k] = (tabSelectedIdsMap[k] || []).filter((id) => id !== String(removed.fieldId))
  }
}
/** Tab：清空全部字段 */
function clearTabFields(tabIdx: number) {
  const tab = editForm.tabs[tabIdx]
  if (!tab) return
  Modal.confirm({
    title: '确认清空当前表单？',
    content: `将移除「${tab.name || `表单 ${tabIdx + 1}`}」中已添加的全部字段`,
    okType: 'danger',
    onOk: () => {
      tab.widgetData = []
      tabSelectedIdsMap[String(tab.id)] = []
    },
  })
}

/** Tab：添加选中的字段到当前 Tab widgetData */
function addTabSelectedFields(tabId: string | number) {
  const k = String(tabId)
  const tab = editForm.tabs.find((x: TemplateTab) => String(x.id) === k)
  if (!tab) return
  const added = tabAddedFieldIds(k)
  const target = (tabSelectedIdsMap[k] || []).filter((id) => !added.has(String(id)))
  if (!target.length) { message.info('勾选的字段已全部添加'); return }
  const rows = availableFieldsList.value.filter((f) =>
    target.includes(String(f.fieldId)) || target.includes(String(f.id)),
  )
  if (!rows.length) { message.warning('未找到勾选的字段'); return }
  const widgets = rows.map((r) => availableFieldToWidget(r))
  tab.widgetData = [...(tab.widgetData || []), ...widgets]
  message.success(`已添加 ${widgets.length} 个字段`)
}
/** Tab：一键添加当前过滤结果里所有未添加字段 */
function addTabAllAvailable(tabId: string | number) {
  const k = String(tabId)
  const tab = editForm.tabs.find((x: TemplateTab) => String(x.id) === k)
  if (!tab) return
  const added = tabAddedFieldIds(k)
  const target = tabFilteredAvailable(k)
    .filter((f) => !added.has(String(f.fieldId)))
  if (!target.length) { message.info('没有可添加的字段'); return }
  const widgets = target.map((f) => availableFieldToWidget(f))
  tab.widgetData = [...(tab.widgetData || []), ...widgets]
  const sel = new Set(tabSelectedIdsMap[k] || [])
  target.forEach((f) => sel.add(String(f.fieldId)))
  tabSelectedIdsMap[k] = Array.from(sel)
  message.success(`已添加 ${widgets.length} 个字段`)
}

/** 拖拽排序：上下拖动已添加字段调整顺序 */
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(idx: number, e: DragEvent) {
  dragIndex.value = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Firefox 需要 setData 才能触发拖拽
    e.dataTransfer.setData('text/plain', String(idx))
  }
}

function onDragOver(idx: number, e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (dragIndex.value === null || dragIndex.value === idx) {
    dragOverIndex.value = null
    return
  }
  dragOverIndex.value = idx
}

function onDragLeave(idx: number) {
  if (dragOverIndex.value === idx) dragOverIndex.value = null
}

function onDrop(idx: number) {
  const from = dragIndex.value
  if (from === null || from === idx) { resetDrag(); return }
  const arr = singleFormTab.value.widgetData
  const moved = arr.splice(from, 1)[0]
  arr.splice(idx, 0, moved)
  // 触发响应式更新
  singleFormTab.value.widgetData = [...arr]
  resetDrag()
}

function onDragEnd() { resetDrag() }

function resetDrag() {
  dragIndex.value = null
  dragOverIndex.value = null
}

const editForm = reactive<{
  id: string; templateName: string; description: string; category: string; status: boolean; tabs: TemplateTab[]; useTabs: boolean;
}>({ id: '', templateName: '', description: '', category: 'requirement', status: true, tabs: [], useTabs: false })

/** 问题类型下拉：value=issueTypeId ↔ 内部 category 字符串双向映射 */
const issueTypeValue = computed<number>({
  get() {
    return ISSUE_TYPE_OPTIONS.find(t => t.value === editForm.category)?.issueTypeId ?? 10004
  },
  set(val: number) {
    editForm.category = ISSUE_TYPE_ID_TO_CATEGORY[val] || 'other'
  },
})

/** 单表单模式：取 tabs[0] 作为唯一表单，tabs 不存在则补一个默认值；响应式地与 tabs 联动 */
const singleFormTab = computed<TemplateTab>({
  get() {
    if (editForm.tabs.length === 0) {
      const t = { id: generateId(), name: '', widgetData: [] as any[] }
      editForm.tabs.push(t)
    }
    return editForm.tabs[0]
  },
  set(val: TemplateTab) {
    editForm.tabs.splice(0, editForm.tabs.length, val)
  },
})

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
// 关键词/状态筛选已由服务端分页查询处理；此处仅做问题类型（tabCategory）的当前页内过滤
const filteredTemplates = computed(() =>
  templates.value.filter(t => !tabCategory.value || t.category === tabCategory.value)
)
const enabledCount = ref(0)
const totalTabs = ref(0)

// ---- 数据适配 ----
function adaptBackendTemplate(t: any): Template {
  // 兼容两种后端结构：flat（实体直出 issueTypeId/issueTypeName）与嵌套（issue_type.issue_type_id）
  const issueTypeId: number | undefined = t.issueTypeId ?? t.issue_type?.issue_type_id
  const issueTypeName: string | undefined = t.issueTypeName ?? t.issue_type?.issue_type_name
  const category = (issueTypeId && ISSUE_TYPE_ID_TO_CATEGORY[issueTypeId]) || t.category || 'other'
  const issue_type = issueTypeId
    ? { issue_type_id: issueTypeId, issue_type_name: issueTypeName ?? ISSUE_TYPE_OPTIONS.find(o => o.issueTypeId === issueTypeId)?.issueTypeName ?? '' }
    : (t.issue_type ?? null)
  return {
    ...t,
    id: String(t.id),
    status: t.status === 1,
    category,
    issue_type,
    tabs: (t.tabs || []).map((tab: any) => ({
      ...tab,
      id: String(tab.id),
      templateId: String(tab.templateId ?? ''),
      widgetData: typeof tab.widgetData === 'string' ? JSON.parse(tab.widgetData || '[]') : tab.widgetData,
    })),
  }
}

function serializeTemplatePayload(form: any) {
  const found = ISSUE_TYPE_OPTIONS.find(t => t.value === form.category)
  const issue_type = found
    ? { issue_type_id: found.issueTypeId, issue_type_name: found.issueTypeName }
    : { issue_type_id: 10004, issue_type_name: '其他' }
  const is_tab = !!form.useTabs
  return {
    templateName: form.templateName,
    description: form.description,
    issue_type,
    status: form.status ? 1 : 0,
    tabs: (form.tabs || []).map((tab: any, idx: number) => ({
      name: tab.name ?? '',
      is_tab,
      tabOrder: tab.tabOrder ?? idx + 1,
      widgetData: typeof tab.widgetData === 'string' ? tab.widgetData : JSON.stringify(tab.widgetData || []),
    })),
  }
}

// ---- 持久化 ----
const loading = ref(false)
const page = ref(1)
const perPage = ref(12)
const totalCount = ref(0)

async function loadTemplates() {
  loading.value = true
  try {
    const res = await queryTemplates({
      page: page.value,
      perPage: perPage.value,
      keyword: searchValue.value.trim() || undefined,
      status: filterStatus.value === '' ? undefined : Number(filterStatus.value),
    })
    if (res.success) {
      templates.value = (res.data.list || []).map(adaptBackendTemplate)
      totalCount.value = res.data.total || 0
      enabledCount.value = res.data.enabledCount || 0
      totalTabs.value = res.data.totalTabs || 0
    }
  } catch {
    message.error('加载模板列表失败')
  } finally {
    loading.value = false
  }
}

function handlePageChange(cur: number, size: number) {
  page.value = cur
  perPage.value = size
  loadTemplates()
}

function handleSizeChange(_cur: number, size: number) {
  page.value = 1
  perPage.value = size
  loadTemplates()
}

/** 重置到第一页后查询（搜索/筛选触发） */
function handleQuery() {
  page.value = 1
  loadTemplates()
}

/** 清空搜索关键词并重新查询 */
function clearSearch() {
  searchValue.value = ''
  handleQuery()
}

/** 状态筛选切换：重置到第一页后查询 */
function onFilterStatusClick(val: string) {
  if (filterStatus.value === val) return
  filterStatus.value = val
  handleQuery()
}


// ---- 编辑弹窗 Tab 操作 ----
function addTab() {
  const id = generateId()
  editForm.tabs.push({ id, name: '', widgetData: [] })
  activeEditTab.value = id
  syncTabMaps()
}

function removeTab(idx: number) {
  if (!editForm.useTabs) return
  if (editForm.tabs.length <= 1) { message.warning('至少保留一个表单；关闭 Tab 布局可切换为单表单'); return }
  const removed = editForm.tabs[idx]
  editForm.tabs.splice(idx, 1)
  if (activeEditTab.value === removed.id) {
    activeEditTab.value = editForm.tabs[0]?.id || ''
  }
  syncTabMaps()
}

// 占位：Tab 名称通过 v-model 自动更新，@change / @blur 绑定只需要目标可调用
const onTabNameBlur = (..._args: any[]) => {}
const onTabSwitch = (..._args: any[]) => {}

// ---- CRUD ----
function handleCreate() {
  isEdit.value = false
  Object.assign(editForm, {
    id: '', templateName: '', description: '', category: 'requirement', status: true,
    tabs: [], useTabs: false,
  })
  activeEditTab.value = ''
  syncTabMaps()
  showEditModal.value = true
}

async function handleEdit(record: Template) {
  isEdit.value = true
  // 调用详情接口获取完整模板数据
  const tplId = Number(record.id)
  try {
    const res = await getTemplate(tplId)
    const detail = res.success ? adaptBackendTemplate(res.data) : record
    fillEditForm(detail)
  } catch {
    message.error('加载模板详情失败')
  }
}

function fillEditForm(record: Template) {
  editForm.id = record.id
  editForm.templateName = record.templateName
  editForm.description = record.description
  editForm.category = record.category
  editForm.status = record.status
  const tabList = (record.tabs || []).length
    ? JSON.parse(JSON.stringify(record.tabs))
    : []
  editForm.tabs = tabList
  // 优先读后端 is_tab；否则 tab 数>1 也自动识别为 Tab 布局
  const anyMarked = (record.tabs || []).some((t: any) => t.is_tab === true || t.is_tab === 'true' || t.is_tab === 1)
  editForm.useTabs = anyMarked || tabList.length > 1
  activeEditTab.value = editForm.tabs[0]?.id || ''
  syncTabMaps()
  showEditModal.value = true
}

function handleEditSubmit() {
  if (!editForm.templateName.trim()) return message.warning('请输入模板名称')
  // Tab 模式下所有表单命名；单表单模式下 tabs 至少有 1 个（singleFormTab lazy 生成），不强制命名（空时不显示标题）
  editForm.tabs.forEach((t, i) => { if (!t.name?.trim()) t.name = editForm.useTabs ? `表单 ${i + 1}` : '' })
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
  const map: Record<string, () => void> = {
    preview: () => handlePreview(record),
    edit: () => handleEdit(record),
    copy: () => handleCopy(record),
    delete: () => handleDelete(record),
  }
  map[key]?.()
}

// ---- 预览：只负责把 record 传给 TemplatePreviewModal，弹窗内部自行解析 widgetData / 初始化数据 / 切表格拉事项 ----
function handlePreview(record: Template) {
  previewTemplate.value = record
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

/* ---- pagination ---- */
.pagination-bar { display: flex; justify-content: flex-end; padding-top: 24px; }

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
.tabs-header-right { display: flex; align-items: center; gap: 14px; }
.enable-tab-label { font-size: 13px; color: #6e6e73; font-weight: 500; }
.single-form-panel { padding: 8px 2px; }
.single-form-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 16px; flex-wrap: wrap; }
.single-form-stats { display: flex; align-items: center; gap: 10px; }
.stat-chip { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
.stat-chip-added { background: #eaf4ff; color: #0066d6; }
.stat-chip-selected { background: #fff4e5; color: #ad6800; }

.single-form-split { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
@media (max-width: 820px) { .single-form-split { grid-template-columns: 1fr; } }

.available-fields-panel, .added-fields-panel {
  display: flex; flex-direction: column;
  border: 1px solid #eef0f3; border-radius: 12px; background: #fcfcfd;
  padding: 14px; min-height: 420px;
}
.afp-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.afp-title { font-size: 13px; font-weight: 600; color: #1d1d1f; }

.afp-filter-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.afp-filter-row :deep(.ant-input-affix-wrapper) { flex: 1; border-radius: 8px; }
.afp-filter-row :deep(.ant-select-selector) { border-radius: 8px; }

.afp-type-tabs { margin-bottom: 6px; }
.afp-type-tabs :deep(.ant-tabs-nav) { margin: 0; }
.afp-type-tabs :deep(.ant-tabs-tab) { padding: 6px 12px !important; font-size: 12px; }

.afp-list { flex: 1 1 auto; min-height: 240px; max-height: 360px; overflow-y: auto; background: #fff; border: 1px solid #eef0f3; border-radius: 10px; padding: 10px; }
.afp-list-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 960px) { .afp-list-grid { grid-template-columns: 1fr; } }

.afp-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 8px; border: 1px solid transparent; background: transparent;
  transition: all 0.15s;
}
.afp-item:hover { background: #f6f8fb; border-color: #e7eaf0; }
.afp-item.is-added { background: #f1f9f1; border-color: #d7ecd8; opacity: 0.9; }
.afp-item-name { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; color: #1d1d1f; font-weight: 500; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.afp-required { color: #ff4d4f; font-weight: 600; }
.afp-item-type-tag { margin-left: auto; font-size: 11px; padding: 1px 7px; border-radius: 999px; background: #eef0f3; color: #595959; flex-shrink: 0; }
.afp-item-added-mark { color: #16a34a; flex-shrink: 0; }

.afp-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; gap: 10px; flex-wrap: wrap; }

.added-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; text-align: center; color: #aeaeb2; min-height: 320px; padding: 10px; }
.added-empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.55; }
.added-empty p { font-size: 13px; margin: 0; max-width: 260px; line-height: 1.5; }

.added-list { display: flex; flex-direction: column; gap: 6px; flex: 1; overflow-y: auto; max-height: 380px; padding-right: 2px; }
.added-item { display: grid; grid-template-columns: 16px 22px 1fr auto auto; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; background: #fff; border: 1px solid #eef0f3; transition: all 0.15s; cursor: grab; }
.added-item:hover { border-color: #d6dee9; background: #f7faff; }
.added-item.is-dragging { opacity: 0.4; cursor: grabbing; }
.added-item.is-drag-over { border-color: #007aff; background: #eaf4ff; box-shadow: 0 0 0 1px #007aff; }
.added-drag-handle { color: #c5c8cc; font-size: 14px; cursor: grab; flex-shrink: 0; transition: color 0.15s; }
.added-item:hover .added-drag-handle { color: #86868b; }
.added-drag-handle:active { cursor: grabbing; }
.added-sort { width: 20px; height: 20px; border-radius: 6px; background: #f0f3f7; color: #6e6e73; text-align: center; font-size: 11px; font-weight: 600; line-height: 20px; }
.added-title { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; color: #1d1d1f; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.added-type-tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: #e7efff; color: #1f6feb; }
.added-remove { opacity: 0.5; transition: opacity 0.15s; padding: 0 !important; }
.added-remove:hover { opacity: 1; }
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

.tab-empty { text-align: center; padding: 20px 0; }
.tab-empty p { font-size: 14px; color: #aeaeb2; margin: 0 0 6px; }
.tab-empty-hint { font-size: 12px !important; color: #c5c8cc !important; }

/* ---- 可选字段面板（Tab 内） ---- */
.tab-available-fields {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px dashed #e5e5ea;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tab-available-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}
.section-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tab-available-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.check-all-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #3c3c43;
  cursor: pointer;
  user-select: none;
}
.toolbar-count {
  font-size: 12px;
  color: #8e8e93;
}
.tab-available-list {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid #f0f2f5;
  border-radius: 10px;
  background: #fafafa;
}
.tab-available-list .available-field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid #f0f2f5;
  background: #fff;
  transition: background 0.15s;
}
.tab-available-list .available-field-row:last-child { border-bottom: none; }
.tab-available-list .available-field-row:hover { background: #f7fafc; }
.field-check { display: flex; align-items: center; flex-shrink: 0; }
.field-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.field-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}
.field-type-badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  background: #eef1f6;
  color: #5b6574;
  font-weight: 500;
}
.field-id {
  font-size: 11px;
  color: #8e8e93;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}
.field-right { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; }

.modal-footer { display: flex; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #f5f5f7; }
</style>
