<template>
  <div :class="['template-list-page', { embedded: !!props.spaceCode }]">
    <!-- 筛选与操作栏：问题类型 / 组织 / 模板名称 -->
    <div class="toolbar">
      <div class="filter-bar">
        <div class="filter-field">
          <span class="filter-label">问题类型</span>
          <a-select
            v-model:value="tabIssueType"
            :options="issueTypeFilterOptions"
            placeholder="全部"
            :loading="filterIssueTypeLoading"
            allow-clear
            show-search
            option-filter-prop="label"
            class="filter-ctrl"
            @change="handleQuery"
          />
        </div>
        <div class="filter-field">
          <span class="filter-label">模板名称</span>
          <a-input
            v-model:value="searchValue"
            placeholder="输入模板名称"
            allow-clear
            class="filter-ctrl"
            @press-enter="handleQuery"
          />
        </div>
        <a-button type="primary" @click="handleQuery">查询</a-button>
        <a-button @click="resetFilters">重置</a-button>
      </div>
      <button class="create-btn" @click="handleCreate">
        <PlusOutlined /><span>新建模板</span>
      </button>
    </div>

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ totalCount }}</span><span class="stat-label">模板总数</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-green">{{ enabledCount }}</span><span class="stat-label">已启用</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-blue">{{ totalTabs }}</span><span class="stat-label">表单配置</span></div>
    </div>

    <!-- 模板列表 -->
    <div class="table-card">
      <a-table
        :columns="visibleColumns"
        :data-source="filteredTemplates"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="middle"
        class="tpl-table"
        :row-class-name="(r: Template) => (r.status ? '' : 'row-disabled')"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'templateName'">
            <div class="tpl-name-cell">
              <span class="tpl-icon" :style="{ background: issueTypeColorOf(record.issueTypeCode) }"><FormOutlined /></span>
              <div class="tpl-name-text">
                <a class="tpl-name" @click="handleEdit(record as Template)">{{ record.templateName }}</a>
                <div class="tpl-desc" :title="record.description">{{ record.description || '暂无描述' }}</div>
              </div>
              <a-tag v-if="record.isDefault" color="gold" class="tpl-default-tag"><StarFilled /> 默认</a-tag>
            </div>
          </template>
          <template v-else-if="column.key === 'issueType'">
            <a-tag v-if="record.issueTypeCode" :color="issueTypeColorOf(record.issueTypeCode)" class="tpl-tag">{{ issueTypeNameOf(record as Template) }}</a-tag>
            <span v-else class="tpl-muted">-</span>
          </template>
          <template v-else-if="column.key === 'space'">
            <SpaceTag :code="record.spaceCode" :name="record.spaceName" />
          </template>
          <template v-else-if="column.key === 'tabs'">
            {{ record.tabs?.length || 0 }}
          </template>
          <template v-else-if="column.key === 'status'">
            <span :class="['tpl-status', record.status ? 'on' : 'off']">{{ record.status ? '已启用' : '已停用' }}</span>
          </template>
          <template v-else-if="column.key === 'updatedAt'">
            <span class="tpl-muted" :title="record.updatedAt">{{ relativeTime(record.updatedAt) }}</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="tpl-actions">
              <a @click="handlePreview(record as Template)">预览</a>
              <a @click="handleEdit(record as Template)">编辑</a>
              <a-dropdown trigger="click">
                <a class="tpl-more"><MoreOutlined /></a>
                <template #overlay>
                  <a-menu @click="handleMenuClick($event, record as Template)">
                    <a-menu-item key="copy"><CopyOutlined /> 创建副本</a-menu-item>
                    <a-menu-item v-if="!record.isDefault" key="setDefault"><StarOutlined /> 设为默认</a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="delete" danger><DeleteOutlined /> 删除</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>
        </template>
        <template #emptyText>
          <div class="empty-state">
            <div class="empty-icon-box"><InboxOutlined class="empty-icon" /></div>
            <h3 class="empty-title">{{ hasFilter ? '未找到匹配的模板' : '还没有模板' }}</h3>
            <p class="empty-desc">{{ hasFilter ? '尝试更换筛选条件' : '创建第一个模板，开始构建你的表单' }}</p>
            <button v-if="!hasFilter" class="create-btn-empty" @click="handleCreate">
              <PlusOutlined /> 新建模板
            </button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 分页 -->
    <div v-if="!loading && totalCount > 0" class="pagination-bar">
      <a-pagination
        v-model:current="page"
        v-model:page-size="pageSize"
        :total="totalCount"
        :show-size-changer="true"
        :show-quick-jumper="true"
        :page-size-options="['10', '20', '50', '100']"
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
              <a-col :span="8">
                <a-form-item label="模板名称" required>
                  <a-input v-model:value="editForm.templateName" placeholder="输入模板名称" size="large" />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="问题类型" required>
                  <a-select
                    v-model:value="editForm.issueTypeCode"
                    :placeholder="editForm.spaceCode ? '选择该空间下的问题类型' : '请先选择所属空间'"
                    :disabled="!editForm.spaceCode"
                    :loading="editIssueTypeLoading"
                    :options="editIssueTypeOptions"
                    size="large"
                  />
                </a-form-item>
              </a-col>
              <!-- 空间内管理时空间固定为当前空间，不再选择 -->
              <a-col v-if="!props.spaceCode" :span="8">
                <a-form-item label="所属空间" required>
                  <SpaceSelect v-model="editForm.spaceCode" @update:model-value="onEditSpaceChange" />
                </a-form-item>
              </a-col>
              <a-col :span="4">
                <a-form-item label="状态">
                  <a-switch v-model:checked="editForm.status" checked-children="启用" un-checked-children="停用" />
                </a-form-item>
              </a-col>
              <a-col :span="4">
                <a-form-item label="默认模板">
                  <a-switch v-model:checked="editForm.isDefault" checked-children="是" un-checked-children="否" />
                </a-form-item>
              </a-col>
            </a-row>
            <div v-if="editForm.isDefault && replacedDefaultName" class="default-replace-hint">
              每个问题类型只能有一个默认模板，保存后将替换当前默认模板「{{ replacedDefaultName }}」
            </div>
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
                  <span class="afp-title-actions">
                    <a-button type="text" size="small" @click="openCreateField()">
                      <PlusOutlined /> 新建字段
                    </a-button>
                    <a-button type="text" size="small" @click="loadAvailableFields(true)">
                      <ReloadOutlined /> 刷新
                    </a-button>
                  </span>
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
                    :class="{ 'is-dragging': dragTabId === '' && dragIndex === idx, 'is-drag-over': dragOverTabId === '' && dragOverIndex === idx }"
                    draggable="true"
                    @dragstart="onDragStart(null, idx, $event)"
                    @dragover.prevent="onDragOver(null, idx, $event)"
                    @dragleave="onDragLeave(null, idx)"
                    @drop.prevent="onDrop(null, idx)"
                    @dragend="onDragEnd"
                  >
                    <HolderOutlined class="added-drag-handle" />
                    <span class="added-sort">{{ idx + 1 }}</span>
                    <span class="added-title">
                      <span v-if="w.required" class="afp-required">*</span>
                      {{ w.title || w.field || '未命名字段' }}
                    </span>
                    <span class="added-type-tag" :title="w.type || w.name">{{ typeLabel(w.type) }}</span>
                    <a-button type="text" size="small" danger class="added-remove" @click="removeAddedWidget(idx)">
                      <CloseCircleFilled />
                    </a-button>
                  </div>
                </div>
                <button type="button" class="add-custom-field-btn" @click="openCreateField()">
                  <PlusOutlined /> 新增自定义字段
                </button>
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

              <!-- 表单字段（可拖拽排序 / 删除） -->
              <div v-if="tab.widgetData?.length" class="tab-form-preview">
                <div class="form-summary">
                  <span class="summary-count">{{ countWidgets(tab.widgetData) }} 个控件</span>
                  <a-button size="small" danger type="link" @click="clearTabFields(idx)">清空</a-button>
                </div>
                <div class="added-list tab-sort-list">
                  <div
                    v-for="(w, wi) in tab.widgetData"
                    :key="w.id || wi"
                    class="added-item"
                    :class="{
                      'is-dragging': dragTabId === String(tab.id) && dragIndex === wi,
                      'is-drag-over': dragOverTabId === String(tab.id) && dragOverIndex === wi,
                    }"
                    draggable="true"
                    @dragstart="onDragStart(tab.id, wi, $event)"
                    @dragover.prevent="onDragOver(tab.id, wi, $event)"
                    @dragleave="onDragLeave(tab.id, wi)"
                    @drop.prevent="onDrop(tab.id, wi)"
                    @dragend="onDragEnd"
                  >
                    <HolderOutlined class="added-drag-handle" />
                    <span class="added-sort">{{ wi + 1 }}</span>
                    <span class="added-title">
                      <span v-if="w.required" class="afp-required">*</span>
                      {{ w.title || w.field || '未命名字段' }}
                    </span>
                    <span class="added-type-tag" :title="w.type || w.name">{{ typeLabel(w.type) }}</span>
                    <a-button type="text" size="small" danger class="added-remove" @click="removeWidgetFromTab(idx, wi)">
                      <CloseCircleFilled />
                    </a-button>
                  </div>
                </div>
              </div>
              <div v-else class="tab-empty">
                <p>暂无表单配置</p>
                <p class="tab-empty-hint">在下方勾选可选字段 → 点击添加</p>
              </div>
              <button type="button" class="add-custom-field-btn" @click="openCreateField(tab.id)">
                <PlusOutlined /> 新增自定义字段
              </button>

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
                  <a-button size="small" @click="openCreateField(tab.id)">
                    <PlusOutlined /> 新建字段
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
                        <a-tag v-else-if="f.isRequired" color="red" :bordered="false">必填</a-tag>
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
    <!-- 模板编辑里新建字段：固定在「新建」展示，保存后自动加入表单 -->
    <FieldEditModal
      v-model:open="fieldCreateOpen"
      :api="systemFieldEditApi"
      force-custom
      :space-code="props.spaceCode"
      :preset-issue-type-codes="editForm.issueTypeCode ? [editForm.issueTypeCode] : []"
      lock-shown-scene="CREATE"
      lock-shown-hint="模板即新建事项表单，模板里新建的字段必须在「新建」中展示"
      @saved="onFieldCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch, nextTick, h } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  PlusOutlined, SearchOutlined, CloseCircleFilled, FormOutlined,
  DeleteOutlined, CopyOutlined,
  MoreOutlined, InboxOutlined, CheckOutlined, ReloadOutlined,
  HolderOutlined, StarFilled, StarOutlined,
} from '@ant-design/icons-vue'
import type { AvailableFieldItem, EnumOptionItem } from '@/types/faiz'
import { queryTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, copyTemplate, queryAvailableFieldList, queryIssueTypes, type IssueTypeItem } from '@/api/faiz'
import SpaceSelect from '@/components/SpaceSelect.vue'
import SpaceTag from '@/components/SpaceTag.vue'
import { useSpaces } from '@/utils/space-store'
import { FIELD_TYPE, normalizeFieldType } from '@/types/fieldType'
import TemplatePreviewModal from '@/components/TemplatePreviewModal.vue'
import FieldEditModal from '@/components/FieldEditModal.vue'
import { systemFieldEditApi, type FieldRow } from '@/utils/fieldConfig'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'

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
  /** 问题类型编码（如 TYPE10001），来自 /issue-type/list */
  issueTypeCode: string
  issueTypeName?: string
  /** 所属组织编码 */
  organizationCode?: string
  organizationName?: string
  /** 组织路径名称，如 SPEEDX/研发中心（tooltip 展示） */
  organizationPathName?: string
  /** 所属空间编码 / 名称 */
  spaceCode?: string
  spaceName?: string
  status: boolean
  /** 是否为该问题类型的默认模板（每个问题类型最多一个） */
  isDefault: boolean
  tabs: TemplateTab[]
  createdAt: string
  updatedAt: string
}

const { spaceNameOf, findSpace } = useSpaces()

/** 在空间内管理（空间首页嵌入）时传入：列表只看该空间，新建 / 编辑固定归属该空间 */
const props = defineProps<{ spaceCode?: string }>()

/** 空间下启用的问题类型（筛选 / 编辑弹窗共用，按 spaceCode 查询） */
async function querySpaceIssueTypes(spaceCode?: string): Promise<IssueTypeItem[]> {
  const res = await queryIssueTypes({ page: 1, pageSize: 999, status: 1, spaceCode })
  const list = res?.success ? res.data?.list || [] : []
  return spaceCode ? list.filter(t => !t.spaceCode || t.spaceCode === spaceCode) : list
}

/** 全部启用的问题类型（卡片颜色 / 名称、Tab 导航用） */
const allIssueTypes = ref<IssueTypeItem[]>([])
async function loadAllIssueTypes() {
  try {
    const res = await queryIssueTypes({ page: 1, pageSize: 999, status: 1 })
    if (res?.success) allIssueTypes.value = res.data?.list || []
  } catch { /* 请求层已提示 */ }
}

/** 历史模板只存了 issueTypeId（如 10001），按 TYPE{id} 规则换算成编码 */
function legacyTypeCode(id?: number | string | null): string {
  return id == null || id === '' ? '' : `TYPE${id}`
}
function issueTypeMetaOf(code?: string) {
  if (!code) return undefined
  return allIssueTypes.value.find(t => t.issueTypeCode === code) || editIssueTypes.value.find(t => t.issueTypeCode === code)
}
function issueTypeColorOf(code?: string) {
  return issueTypeMetaOf(code)?.color || '#8c8c8c'
}
function issueTypeNameOf(tpl: Template) {
  return issueTypeMetaOf(tpl.issueTypeCode)?.issueTypeName || tpl.issueTypeName || tpl.issueTypeCode
}
// ---- 列表筛选：问题类型（空间内只列该空间的问题类型） ----
const filterIssueTypes = ref<IssueTypeItem[]>([])
const filterIssueTypeLoading = ref(false)
async function loadFilterIssueTypes() {
  filterIssueTypeLoading.value = true
  try {
    filterIssueTypes.value = await querySpaceIssueTypes(props.spaceCode)
  } catch { /* 请求层已提示 */ } finally {
    filterIssueTypeLoading.value = false
  }
}
const issueTypeFilterOptions = computed(() =>
  filterIssueTypes.value
    .filter(t => t.issueTypeCode)
    .map(t => ({ value: t.issueTypeCode as string, label: t.issueTypeName })),
)
const hasFilter = computed(() => !!(searchValue.value.trim() || tabIssueType.value))
/** 重置筛选条件并查询 */
function resetFilters() {
  tabIssueType.value = undefined
  searchValue.value = ''
  handleQuery()
}

// ---- 状态 ----
const searchValue = ref('')
/** 列表问题类型筛选（问题类型编码） */
const tabIssueType = ref<string>()
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
  { value: FIELD_TYPE.TEXT_BOX_SINGLE_LINE, label: '文本输入框' },
  { value: FIELD_TYPE.TEXT_BOX_MULTI_LINE, label: '多行文本' },
  { value: FIELD_TYPE.TEXT_BOX_NUMBER, label: '数字输入框' },
  { value: FIELD_TYPE.DATE_PICKER, label: '日期' },
  { value: FIELD_TYPE.TIME_PICKER, label: '日期时间' },
  { value: FIELD_TYPE.SELECT_LIST_SINGLE, label: '单选下拉' },
  { value: FIELD_TYPE.SELECT_LIST_MULTI, label: '多选下拉' },
  { value: FIELD_TYPE.CASCADER_SINGLE, label: '级联' },
  { value: FIELD_TYPE.SELECT_USER_SINGLE, label: '人员单选' },
  { value: FIELD_TYPE.SELECT_USER_MULTI, label: '人员多选' },
  { value: FIELD_TYPE.RICH_TEXT, label: '富文本' },
  { value: FIELD_TYPE.LABEL, label: '只读文本' },
]

/** 模板可选字段的展示场景：新建 */
const TEMPLATE_FIELD_SCENE = 'CREATE'

// ---- 模板编辑里直接新建字段：建好后刷新可用字段，并加入当前表单 / tab ----
const fieldCreateOpen = ref(false)
/** 新建字段要加入的 tab；为空表示单表单 */
const fieldCreateTabId = ref<string | number | null>(null)

function openCreateField(tabId?: string | number) {
  fieldCreateTabId.value = tabId ?? null
  fieldCreateOpen.value = true
}

async function onFieldCreated({ field }: { isEdit: boolean; field: FieldRow | null }) {
  await loadAvailableFields(true)
  const key = field?.fieldId ? String(field.fieldId) : ''
  const row = key ? availableFieldsList.value.find(f => String(f.fieldId) === key) : undefined
  if (!row) {
    // 接口未返回新字段（旧版本后端）或已停用：只刷新列表，由用户手动勾选
    message.success('字段已创建，可在左侧「可用字段」中勾选添加')
    return
  }
  const widget = availableFieldToWidget(row)
  if (fieldCreateTabId.value == null) {
    singleFormTab.value.widgetData = [...(singleFormTab.value.widgetData || []), widget]
  } else {
    const tab = editForm.tabs.find((x: TemplateTab) => String(x.id) === String(fieldCreateTabId.value))
    if (tab) tab.widgetData = [...(tab.widgetData || []), widget]
  }
  message.success(`已新建字段「${row.fieldName}」并加入表单`)
}

async function loadAvailableFields(force = false) {
  if (availableFieldsList.value.length > 0 && !force) return
  availableFieldsLoading.value = true
  try {
    // 模板即新建事项表单：只提供展示位置包含「新建」的字段
    const res = await queryAvailableFieldList({ page: 1, pageSize: 999, searchKey: '', displayScene: TEMPLATE_FIELD_SCENE })
    // 接口返回的 filedType 可能是旧枚举（INPUT_TEXT / CASCADER / USER_SINGLE_SELECT 等），
    // 统一归一化为新枚举，保证左侧类型标签、过滤与右侧组件映射（availableFieldToWidget）一致
    availableFieldsList.value = (res?.data?.list || [])
      // 前端再兜底过滤一次：接口未按场景过滤（旧版本）时也只留新建展示的字段
      .filter(f => (f.displayScene || []).some(s => String(s).toUpperCase() === TEMPLATE_FIELD_SCENE))
      .map(f => ({ ...f, type: normalizeFieldType(f.type || f.filedType) }))
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

/** 可用字段 → widget 对象（vxe 兼容结构）
 *  type 与可用字段 type 一一映射（新枚举体系），不再使用 componentKey
 *  name 仅作为 vxe-table row key 标识符，后缀保留小写 componentKey 风格仅用于唯一性
 */
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
    case FIELD_TYPE.TEXT_BOX_SINGLE_LINE:
      return { ...base, type: FIELD_TYPE.TEXT_BOX_SINGLE_LINE, name: `Comp_00000000_${id}_input_text` }
    case FIELD_TYPE.TEXT_BOX_MULTI_LINE:
      return { ...base, type: FIELD_TYPE.TEXT_BOX_MULTI_LINE, name: `Comp_00000000_${id}_textarea` }
    case FIELD_TYPE.TEXT_BOX_NUMBER:
      return { ...base, type: FIELD_TYPE.TEXT_BOX_NUMBER, name: `Comp_00000000_${id}_input_number` }
    case FIELD_TYPE.DATE_PICKER:
      return { ...base, type: FIELD_TYPE.DATE_PICKER, name: `Comp_00000000_${id}_date_picker`, options: { ...base.options, format: 'YYYY-MM-DD' } }
    case FIELD_TYPE.TIME_PICKER:
      return { ...base, type: FIELD_TYPE.TIME_PICKER, name: `Comp_00000000_${id}_date_picker`, options: { ...base.options, format: 'YYYY-MM-DD HH:mm:ss', hasTime: true } }
    case FIELD_TYPE.SELECT_LIST_SINGLE:
      return { ...base, type: FIELD_TYPE.SELECT_LIST_SINGLE, name: `Comp_00000000_${id}_select_single`, options: { ...base.options, options: opts, multiple: false } }
    case FIELD_TYPE.SELECT_LIST_MULTI:
      return { ...base, type: FIELD_TYPE.SELECT_LIST_MULTI, name: `Comp_00000000_${id}_select_multiple`, options: { ...base.options, options: opts, multiple: true } }
    case FIELD_TYPE.CASCADER_SINGLE:
      return { ...base, type: FIELD_TYPE.CASCADER_SINGLE, name: `Comp_00000000_${id}_cascader`, options: { ...base.options, options: opts } }
    case FIELD_TYPE.SELECT_USER_SINGLE:
      return { ...base, type: FIELD_TYPE.SELECT_USER_SINGLE, name: `Comp_00000000_${id}_member`, options: { ...base.options, multiple: false } }
    case FIELD_TYPE.SELECT_USER_MULTI:
      return { ...base, type: FIELD_TYPE.SELECT_USER_MULTI, name: `Comp_00000000_${id}_member`, options: { ...base.options, multiple: true } }
    case FIELD_TYPE.RICH_TEXT:
      return { ...base, type: FIELD_TYPE.RICH_TEXT, name: `Comp_00000000_${id}_rich_text` }
    case FIELD_TYPE.LABEL:
      return { ...base, type: FIELD_TYPE.LABEL, name: `Comp_00000000_${id}_display_text`, required: false, options: { ...base.options, required: false } }
    default:
      return { ...base, type: FIELD_TYPE.TEXT_BOX_SINGLE_LINE, name: `Comp_00000000_${id}_input_text` }
  }
}

function addSelectedFieldsToForm() {
  const target = selectedAvailableFieldIds.value.filter(id => !addedFieldIds.value.has(String(id)))
  if (target.length === 0) { return }
  const rows = availableFieldsList.value.filter(f => target.includes(String(f.fieldId)) || target.includes(String(f.id)))
  if (rows.length === 0) { return }
  const widgets = rows.map(r => availableFieldToWidget(r))
  singleFormTab.value.widgetData = [...(singleFormTab.value.widgetData || []), ...widgets]
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
  if (!target.length) { return }
  const rows = availableFieldsList.value.filter((f) =>
    target.includes(String(f.fieldId)) || target.includes(String(f.id)),
  )
  if (!rows.length) { return }
  const widgets = rows.map((r) => availableFieldToWidget(r))
  tab.widgetData = [...(tab.widgetData || []), ...widgets]
}
/** Tab：一键添加当前过滤结果里所有未添加字段 */
function addTabAllAvailable(tabId: string | number) {
  const k = String(tabId)
  const tab = editForm.tabs.find((x: TemplateTab) => String(x.id) === k)
  if (!tab) return
  const added = tabAddedFieldIds(k)
  const target = tabFilteredAvailable(k)
    .filter((f) => !added.has(String(f.fieldId)))
  if (!target.length) { return }
  const widgets = target.map((f) => availableFieldToWidget(f))
  tab.widgetData = [...(tab.widgetData || []), ...widgets]
  const sel = new Set(tabSelectedIdsMap[k] || [])
  target.forEach((f) => sel.add(String(f.fieldId)))
  tabSelectedIdsMap[k] = Array.from(sel)
}

/** 拖拽排序：支持单表单模式与多 Tab 模式。tabId 为 null 时操作单表单 singleFormTab，否则操作对应 tab.widgetData */
const dragTabId = ref<string | number | null>(null)
const dragIndex = ref<number | null>(null)
const dragOverTabId = ref<string | number | null>(null)
const dragOverIndex = ref<number | null>(null)

function resolveWidgetArr(tabId: string | number | null) {
  if (tabId == null || tabId === '') {
    // 单表单模式
    return singleFormTab.value.widgetData = singleFormTab.value.widgetData || []
  }
  const tab = editForm.tabs.find(t => String(t.id) === String(tabId))
  if (!tab) return [] as any[]
  tab.widgetData = tab.widgetData || []
  return tab.widgetData
}

function onDragStart(tabId: string | number | null, idx: number, e: DragEvent) {
  // 统一转为字符串，避免 null !== '' 导致单表单模式拖拽失效
  dragTabId.value = String(tabId ?? '')
  dragIndex.value = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Firefox 需要 setData 才能触发拖拽
    e.dataTransfer.setData('text/plain', `${String(tabId ?? '')}::${idx}`)
  }
}

function onDragOver(tabId: string | number | null, idx: number, e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (dragTabId.value !== String(tabId ?? '')) return
  if (dragIndex.value === null || dragIndex.value === idx) {
    dragOverTabId.value = null
    dragOverIndex.value = null
    return
  }
  dragOverTabId.value = String(tabId ?? '')
  dragOverIndex.value = idx
}

function onDragLeave(tabId: string | number | null, idx: number) {
  if (dragOverTabId.value === String(tabId ?? '') && dragOverIndex.value === idx) {
    dragOverTabId.value = null
    dragOverIndex.value = null
  }
}

function onDrop(tabId: string | number | null, idx: number) {
  const from = dragIndex.value
  if (dragTabId.value !== String(tabId ?? '')) { resetDrag(); return }
  if (from === null || from === idx) { resetDrag(); return }
  const arr = resolveWidgetArr(tabId)
  if (!Array.isArray(arr) || from >= arr.length || idx > arr.length) { resetDrag(); return }
  const moved = arr.splice(from, 1)[0]
  arr.splice(idx, 0, moved)
  // 触发响应式更新（单表单模式 singleFormTab 是 computed set 路径，需重新赋值）
  if (tabId == null || tabId === '') {
    singleFormTab.value.widgetData = [...arr]
  } else {
    const tab = editForm.tabs.find(t => String(t.id) === String(tabId))
    if (tab) tab.widgetData = [...arr]
  }
  resetDrag()
}

function onDragEnd() { resetDrag() }

function resetDrag() {
  dragTabId.value = null
  dragIndex.value = null
  dragOverTabId.value = null
  dragOverIndex.value = null
}

const editForm = reactive<{
  id: string; templateName: string; description: string
  /** 原组织编码：提交时优先取所属空间的组织，空间未关联组织时用它兜底 */
  organizationCode?: string
  /** 所属空间编码 */
  spaceCode?: string
  issueTypeCode?: string; issueTypeName?: string
  status: boolean; isDefault: boolean; tabs: TemplateTab[]; useTabs: boolean;
}>({ id: '', templateName: '', description: '', status: true, isDefault: false, tabs: [], useTabs: false })

// ---- 编辑弹窗：所属空间下的问题类型 ----
const editIssueTypes = ref<IssueTypeItem[]>([])
const editIssueTypeLoading = ref(false)
let editIssueTypeSeq = 0
/** 问题类型选项：颜色图标 + 名称（与问题类型页一致） */
function issueTypeOptionLabel(name: string, color?: string, iconUri?: string | null) {
  return h('span', { class: 'it-option' }, [
    h('span', { class: 'it-option-icon', style: { background: color || '#8c8c8c' } }, [h(issueTypeIconOf(iconUri))]),
    h('span', { class: 'it-option-name' }, name),
  ])
}
const editIssueTypeOptions = computed(() => {
  const opts = editIssueTypes.value
    .filter(t => t.issueTypeCode)
    .map(t => ({ value: t.issueTypeCode as string, label: issueTypeOptionLabel(t.issueTypeName, t.color, t.iconUri) }))
  // 回填的问题类型不在当前组织列表中（历史数据）：补一个选项保证回显
  const cur = editForm.issueTypeCode
  if (cur && !opts.some(o => o.value === cur)) {
    const meta = issueTypeMetaOf(cur)
    opts.unshift({ value: cur, label: issueTypeOptionLabel(meta?.issueTypeName || editForm.issueTypeName || cur, meta?.color, meta?.iconUri) })
  }
  return opts
})
async function loadEditIssueTypes(spaceCode?: string) {
  const seq = ++editIssueTypeSeq
  editIssueTypes.value = []
  if (!spaceCode) return
  editIssueTypeLoading.value = true
  try {
    const list = await querySpaceIssueTypes(spaceCode)
    if (seq === editIssueTypeSeq) editIssueTypes.value = list
  } catch { /* 请求层已提示 */ } finally {
    if (seq === editIssueTypeSeq) editIssueTypeLoading.value = false
  }
}
/** 切换所属空间（独立页面时可选）：重新拉取问题类型，原问题类型不属于新空间时清空 */
async function onEditSpaceChange(spaceCode?: string) {
  await loadEditIssueTypes(spaceCode)
  if (editForm.issueTypeCode && !editIssueTypes.value.some(t => t.issueTypeCode === editForm.issueTypeCode)) {
    editForm.issueTypeCode = undefined
  }
}

/** 同问题类型下除当前编辑模板外的其他默认模板（全量，不受分页/筛选影响） */
const otherDefaultTemplates = ref<Template[]>([])
const replacedDefaultName = computed(() => otherDefaultTemplates.value.map(t => t.templateName).join('」「'))
// 打开弹窗 / 切换问题类型时刷新，用于提示「将替换的默认模板」
watch(() => [showEditModal.value, editForm.issueTypeCode] as const, async ([open]) => {
  if (open) otherDefaultTemplates.value = await findOtherDefaults(editForm.issueTypeCode, editForm.id)
})

/** 查询某问题类型下的默认模板（排除 exceptId） */
async function findOtherDefaults(issueTypeCode: string | undefined, exceptId: string): Promise<Template[]> {
  if (!issueTypeCode) return []
  try {
    const res = await queryTemplates({ page: 1, pageSize: 999, includeCustom: true })
    if (!res.success) return []
    return (res.data.list || [])
      .map(adaptBackendTemplate)
      .filter(t => t.isDefault && t.issueTypeCode === issueTypeCode && t.id !== exceptId)
  } catch {
    return []
  }
}

/** 模板详情 → 提交 payload（覆盖 isDefault） */
function detailToPayload(detail: Template, isDefault: boolean) {
  const anyMarked = (detail.tabs || []).some((x: any) => x.is_tab === true || x.is_tab === 'true' || x.is_tab === 1)
  return serializeTemplatePayload({ ...detail, isDefault, useTabs: anyMarked || (detail.tabs || []).length > 1 })
}

/** 取消同问题类型下其他模板的默认状态，保证一个类型只有一个默认模板 */
async function unsetOtherDefaults(issueTypeCode: string | undefined, exceptId: string) {
  const others = await findOtherDefaults(issueTypeCode, exceptId)
  await Promise.all(others.map(async (t) => {
    const res = await getTemplate(Number(t.id))
    const detail = res.success ? adaptBackendTemplate(res.data) : t
    return updateTemplate(Number(t.id), detailToPayload(detail, false))
  }))
}

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
// 关键词/状态/组织筛选由服务端分页查询处理；此处仅做问题类型（tabIssueType）的当前页内过滤
const filteredTemplates = computed(() =>
  templates.value.filter(t => !tabIssueType.value || t.issueTypeCode === tabIssueType.value)
)
const enabledCount = ref(0)
const totalTabs = ref(0)

// ---- 数据适配 ----
function adaptBackendTemplate(t: any): Template {
  // 问题类型以 issueTypeCode 为准；历史数据只有 issueTypeId（flat 或嵌套 issue_type.issue_type_id）时按 TYPE{id} 换算
  const issueTypeCode: string = t.issueTypeCode || legacyTypeCode(t.issueTypeId ?? t.issue_type?.issue_type_id)
  const issueTypeName: string | undefined = t.issueTypeName ?? t.issue_type?.issue_type_name
  return {
    ...t,
    id: String(t.id),
    status: t.status === 1,
    isDefault: t.isDefault === 1 || t.isDefault === true,
    issueTypeCode,
    issueTypeName,
    organizationCode: t.organizationCode || undefined,
    organizationName: t.organizationName || undefined,
    organizationPathName: t.organizationPathName || undefined,
    spaceCode: t.spaceCode || undefined,
    spaceName: t.spaceName || undefined,
    tabs: (t.tabs || []).map((tab: any) => ({
      ...tab,
      id: String(tab.id),
      templateId: String(tab.templateId ?? ''),
      widgetData: normalizeWidgets(typeof tab.widgetData === 'string' ? JSON.parse(tab.widgetData || '[]') : tab.widgetData),
    })),
  }
}

function serializeTemplatePayload(form: any) {
  // 提交组织编码 + 问题类型编码（均来自后端数据，不再写死）
  const is_tab = !!form.useTabs
  return {
    templateName: form.templateName,
    description: form.description,
    // 不单独选组织：取所属空间的组织，空间未关联组织时用原组织兜底
    organizationCode: findSpace(form.spaceCode)?.organizationCode || form.organizationCode || undefined,
    spaceCode: form.spaceCode || undefined,
    spaceName: spaceNameOf(form.spaceCode) || form.spaceName || undefined,
    issueTypeCode: form.issueTypeCode,
    issueTypeName: issueTypeMetaOf(form.issueTypeCode)?.issueTypeName ?? form.issueTypeName,
    status: form.status ? 1 : 0,
    isDefault: form.isDefault ? 1 : 0,
    tabs: (form.tabs || []).map((tab: any, idx: number) => ({
      name: tab.name ?? '',
      is_tab,
      tabOrder: tab.tabOrder ?? idx + 1,
      widgetData: serializeWidgetData(tab.widgetData),
    })),
  }
}

/**
 * 序列化 widgetData：
 * 去掉 field（与 fieldId 重复），保留 fieldId
 * 去掉顶层 name（Comp_xxx 组件名），把字段标题统一放到 name
 * 兼容旧格式（field + title + name=Comp_xxx）与新格式（fieldId + name=字段标题）
 */
function serializeWidgetData(widgetData: any): string {
  let arr: any[] = []
  if (typeof widgetData === 'string') {
    try { arr = JSON.parse(widgetData || '[]') } catch { arr = [] }
  } else if (Array.isArray(widgetData)) {
    arr = widgetData
  }
  return JSON.stringify(arr.map((w: any) => {
    if (!w || typeof w !== 'object') return w
    const fieldId = w.fieldId ?? w.field
    // name 以 Comp_ 开头时为旧格式组件名，取 title 作为字段名；否则 name 即字段名
    const isCompName = typeof w.name === 'string' && w.name.startsWith('Comp_')
    const widgetName = isCompName ? (w.title ?? w.name) : (w.name ?? w.title)
    const { field: _f, title: _t, name: _n, ...rest } = w
    return { ...rest, fieldId, name: widgetName }
  }))
}

/** 规范化 widget：确保 field/title 存在（兼容新格式 fieldId/name 与旧格式 field/title） */
function normalizeWidgets(ws: any): any[] {
  if (!Array.isArray(ws)) return []
  return ws.map((w: any) => {
    if (!w || typeof w !== 'object') return w
    const isCompName = typeof w.name === 'string' && w.name.startsWith('Comp_')
    return {
      ...w,
      field: w.fieldId ?? w.field,
      title: isCompName ? (w.title ?? w.name) : (w.name ?? w.title),
      // 兼容历史数据中的旧版类型值（INPUT_TEXT / CASCADER / USER_SINGLE_SELECT 等）
      type: normalizeFieldType(w.type ?? w.filedType ?? w.fieldType),
    }
  })
}

// ---- 持久化 ----
const loading = ref(false)

/** 模板列表列 */
const columns = [
  { title: '模板名称', key: 'templateName', ellipsis: true },
  { title: '问题类型', key: 'issueType', width: 140 },
  { title: '所属空间', key: 'space', width: 200 },
  { title: '表单数', key: 'tabs', width: 90, align: 'center' as const },
  { title: '状态', key: 'status', width: 100 },
  { title: '更新时间', key: 'updatedAt', width: 120 },
  { title: '操作', key: 'actions', width: 150 },
]
const visibleColumns = computed(() => props.spaceCode ? columns.filter(c => c.key !== 'space') : columns)
const page = ref(1)
const pageSize = ref(10)
const totalCount = ref(0)

async function loadTemplates() {
  loading.value = true
  try {
    const res = await queryTemplates({
      page: page.value,
      pageSize: pageSize.value,
      keyword: searchValue.value.trim() || undefined,
      issueTypeCode: tabIssueType.value || undefined,
      spaceCode: props.spaceCode,
      // 模板管理页：该空间下所有模板都可见（含他人自定义）
      includeCustom: true,
    })
    if (res.success) {
      const list = (res.data.list || []).map(adaptBackendTemplate)
      // 后端按 spaceCode 筛选就绪前兜底：只排除明确属于其他空间的数据，未关联空间的历史数据照常展示
      templates.value = props.spaceCode ? list.filter(t => !t.spaceCode || t.spaceCode === props.spaceCode) : list
      totalCount.value = res.data.total || 0
      enabledCount.value = res.data.enabledCount || 0
      totalTabs.value = res.data.totalTabs || 0
    }
  } catch {
  } finally {
    loading.value = false
  }
}

function handlePageChange(cur: number, size: number) {
  page.value = cur
  pageSize.value = size
  loadTemplates()
}

function handleSizeChange(_cur: number, size: number) {
  page.value = 1
  pageSize.value = size
  loadTemplates()
}

/** 重置到第一页后查询（搜索/筛选触发） */
function handleQuery() {
  page.value = 1
  loadTemplates()
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
  if (editForm.tabs.length <= 1) { return }
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
    id: '', templateName: '', description: '', status: true, isDefault: false,
    tabs: [], useTabs: false,
    // 新建：所属空间默认为当前空间，问题类型默认带出列表当前筛选
    organizationCode: undefined, spaceCode: props.spaceCode,
    issueTypeCode: tabIssueType.value || undefined, issueTypeName: undefined,
  })
  loadEditIssueTypes(props.spaceCode)
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
  }
}

async function fillEditForm(record: Template) {
  editForm.id = record.id
  editForm.templateName = record.templateName
  editForm.description = record.description
  editForm.issueTypeCode = record.issueTypeCode || undefined
  editForm.issueTypeName = record.issueTypeName
  editForm.spaceCode = record.spaceCode || props.spaceCode
  // 原组织编码仅作提交兜底；模板未带组织时用问题类型所属组织
  editForm.organizationCode = record.organizationCode ?? issueTypeMetaOf(record.issueTypeCode)?.organizationCode
  loadEditIssueTypes(editForm.spaceCode)
  editForm.status = record.status
  editForm.isDefault = !!record.isDefault
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
  if (!editForm.issueTypeCode) return message.warning('请选择问题类型')
  if (!editForm.spaceCode) return message.warning('请选择所属空间')
  // Tab 模式下所有表单命名；单表单模式下 tabs 至少有 1 个（singleFormTab lazy 生成），不强制命名（空时不显示标题）
  editForm.tabs.forEach((t, i) => { if (!t.name?.trim()) t.name = editForm.useTabs ? `表单 ${i + 1}` : '' })
  const payload = serializeTemplatePayload(editForm)
  const save = isEdit.value ? updateTemplate(Number(editForm.id), payload) : createTemplate(payload)
  save.then(async (res) => {
    // 设为默认：取消同类型其他模板的默认状态
    if (editForm.isDefault) {
      const savedId = isEdit.value ? editForm.id : String((res?.data as any)?.id ?? '')
      await unsetOtherDefaults(editForm.issueTypeCode, savedId).catch(() => {})
    }
    loadTemplates(); showEditModal.value = false
  }).catch(() => {})
}

/** 卡片菜单「设为默认」：更新当前模板并取消同类型其他默认模板 */
async function handleSetDefault(record: Template) {
  try {
    const res = await getTemplate(Number(record.id))
    const detail = res.success ? adaptBackendTemplate(res.data) : record
    const saved = await updateTemplate(Number(record.id), detailToPayload(detail, true))
    if (!saved.success) return
    await unsetOtherDefaults(detail.issueTypeCode, detail.id)
    message.success(`已将「${record.templateName}」设为${issueTypeNameOf(detail) || ''}默认模板`)
    loadTemplates()
  } catch { /* 请求层已提示 */ }
}

function handleCopy(record: Template) {
  const tplId = Number(record.id)
  copyTemplate(tplId).then(res => {
    if (res.success) { loadTemplates() }
  }).catch(() => {})
}

function handleDelete(record: Template) {
  Modal.confirm({
    title: '删除模板',
    content: `确定要删除「${record.templateName}」吗？删除后不可恢复。`,
    okText: '删除', cancelText: '取消', okType: 'danger',
    onOk: () => {
      const tplId = Number(record.id)
      deleteTemplate(tplId).then(res => {
        if (res.success) { loadTemplates() }
      }).catch(() => {})
    },
  })
}

function handleMenuClick({ key }: { key: string }, record: Template) {
  const map: Record<string, () => void> = {
    preview: () => handlePreview(record),
    edit: () => handleEdit(record),
    copy: () => handleCopy(record),
    setDefault: () => handleSetDefault(record),
    delete: () => handleDelete(record),
  }
  map[key]?.()
}

// ---- 预览：只负责把 record 传给 TemplatePreviewModal，弹窗内部自行解析 widgetData / 初始化数据 / 切表格拉事项 ----
function handlePreview(record: Template) {
  previewTemplate.value = record
  showPreviewModal.value = true
}

onMounted(() => {
  loadFilterIssueTypes()
  loadAllIssueTypes()
  loadTemplates()
})
</script>

<style scoped>
.template-list-page {
  padding: 0 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
}
.template-list-page.embedded { padding: 0; }

/* ---- toolbar ---- */
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.filter-bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.filter-field { display: flex; align-items: center; gap: 8px; }
.filter-label { font-size: 13px; color: #6e6e73; white-space: nowrap; }
.filter-ctrl { width: 200px; }
.create-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; background: #1d1d1f; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.create-btn:hover { background: #333; transform: scale(1.02); }
.create-btn:active { transform: scale(0.98); }

/* ---- stats ---- */
.stats-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.stat-item { display: flex; align-items: baseline; gap: 6px; }
.stat-value { font-size: 22px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.3px; }
.stat-label { font-size: 13px; color: #86868b; font-weight: 500; }
.stat-green { color: #34c759; }
.stat-blue { color: var(--c-primary); }
.stat-divider { width: 1px; height: 20px; background: #e5e5ea; }

/* ---- tab nav ---- */

.default-replace-hint { margin: -8px 0 12px; padding: 6px 10px; font-size: 12px; color: #ad6800; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; }

/* ---- table ---- */
.table-card { background: #fff; border-radius: 14px; padding: 4px 4px 0; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
.tpl-table :deep(.ant-table-thead > tr > th) { font-size: 12px; font-weight: 500; color: #86868b; background: #fafafc; }
.tpl-table :deep(.row-disabled) { opacity: 0.6; }
.tpl-name-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
.tpl-icon { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 15px; color: #fff; flex-shrink: 0; }
.tpl-name-text { min-width: 0; flex: 1; }
.tpl-name { display: block; font-size: 14px; font-weight: 500; color: #1d1d1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tpl-name:hover { color: var(--c-primary); }
.tpl-desc { font-size: 12px; color: #86868b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tpl-default-tag { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; margin-inline-end: 0; }
.tpl-tag { margin-inline-end: 0; }
.tpl-muted { color: #aeaeb2; }
.tpl-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.tpl-status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }
.tpl-status.on { color: #1d1d1f; }
.tpl-status.on::before { background: #34c759; }
.tpl-status.off { color: #86868b; }
.tpl-status.off::before { background: #aeaeb2; }
.tpl-actions { display: flex; align-items: center; gap: 14px; }
.tpl-more { color: #86868b; }

/* ---- empty state ---- */
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 20px; text-align: center; }
.empty-icon-box { width: 80px; height: 80px; border-radius: 22px; background: #f5f5f7; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
.empty-icon { font-size: 36px; color: #aeaeb2; }
.empty-title { font-size: 18px; font-weight: 600; color: #1d1d1f; margin: 0 0 6px; }
.empty-desc { font-size: 14px; color: #86868b; margin: 0 0 24px; }
.create-btn-empty { display: flex; align-items: center; gap: 6px; padding: 11px 24px; border: none; background: var(--c-primary); color: #fff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
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
/* 表单字段面板去掉底部内边距，让列表展示得更靠下 */
.added-fields-panel { padding-bottom: 0; }
.afp-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.afp-title-actions { display: inline-flex; align-items: center; gap: 2px; }
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

/* 表单字段列表下方：新增自定义字段（建好后自动加入当前表单） */
.add-custom-field-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 40px; margin-top: 10px;
  border: 1px dashed #c7c7cc; border-radius: 10px; background: transparent; color: var(--c-primary);
  font-size: 13px; font-family: inherit; cursor: pointer; transition: background 0.15s, border-color 0.15s;
}
.add-custom-field-btn:hover { border-color: var(--c-primary); background: color-mix(in srgb, var(--c-primary) 6%, transparent); }
.added-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; text-align: center; color: #aeaeb2; min-height: 320px; padding: 10px; }
.added-empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.55; }
.added-empty p { font-size: 13px; margin: 0; max-width: 260px; line-height: 1.5; }

/* 填满面板剩余高度（min-height: 0 保证内容超出时在内部滚动而非撑高面板），
   面板高度由 grid stretch 与左侧可用字段面板保持一致 */
.added-list { display: flex; flex-direction: column; gap: 6px; flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-right: 2px; }
.added-item { display: grid; grid-template-columns: 16px 22px 1fr auto auto; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; background: #fff; border: 1px solid #eef0f3; transition: all 0.15s; cursor: grab; }
.added-item:hover { border-color: #d6dee9; background: #f7faff; }
.added-item.is-dragging { opacity: 0.4; cursor: grabbing; }
.added-item.is-drag-over { border-color: var(--c-primary); background: #eaf4ff; box-shadow: 0 0 0 1px var(--c-primary); }
.added-drag-handle { color: #c5c8cc; font-size: 14px; cursor: grab; flex-shrink: 0; transition: color 0.15s; }
.added-item:hover .added-drag-handle { color: #86868b; }
.added-drag-handle:active { cursor: grabbing; }
.added-sort { width: 20px; height: 20px; border-radius: 6px; background: #f0f3f7; color: #6e6e73; text-align: center; font-size: 11px; font-weight: 600; line-height: 20px; }
.added-title { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; color: #1d1d1f; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.added-type-tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: #e7efff; color: #1f6feb; }
.added-remove { opacity: 0.5; transition: opacity 0.15s; padding: 0 !important; }
.added-remove:hover { opacity: 1; }
.add-tab-btn { display: flex; align-items: center; gap: 5px; border: 1.5px dashed #d1d1d6; background: transparent; padding: 7px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; color: #6e6e73; cursor: pointer; font-family: inherit; transition: all 0.2s; }
.add-tab-btn:hover { border-color: var(--c-primary); color: var(--c-primary); }

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
.tab-sort-list { max-height: 300px; }

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

<style>
/* 问题类型下拉选项（h() 渲染且弹层挂在 body，需非 scoped） */
.it-option { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; vertical-align: middle; }
.it-option-icon { width: 20px; height: 20px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; color: #fff; }
.it-option-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
