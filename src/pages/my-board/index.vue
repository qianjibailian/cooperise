<template>
  <div class="my-board">
    <header class="mb-header">
      <div class="mb-heading">
        <h2 class="mb-title">我的看板</h2>
      </div>
      <div class="mb-actions">
        <a-tooltip title="刷新">
          <button type="button" class="mb-icon-btn" :disabled="loading" @click="reloadAll"><ReloadOutlined /></button>
        </a-tooltip>
        <a-button type="primary" class="mb-add-btn" @click="openCreate"><PlusOutlined /> 添加看板</a-button>
      </div>
    </header>

    <!-- 初次加载：骨架占位，数据回来后渲染整页 -->
    <div v-if="!initialized" class="mb-skeleton">
      <a-skeleton active :paragraph="{ rows: 8 }" />
    </div>

    <a-spin v-else :spinning="loading">
      <!-- 空状态：一键添加推荐看板 -->
      <div v-if="!panels.length" class="mb-empty">
        <AppstoreOutlined class="mb-empty-icon" />
        <div class="mb-empty-title">还没有看板</div>
        <div class="mb-empty-desc">添加看板，把「我的需求」「我的任务」「待我处理」放在一起看</div>
        <div class="mb-empty-actions">
          <a-button :loading="creatingPresets" @click="addPresets">添加推荐看板</a-button>
          <a-button type="primary" @click="openCreate"><PlusOutlined /> 添加看板</a-button>
        </div>
      </div>

      <div v-else class="mb-grid">
        <section v-for="(p, idx) in panels" :key="p.id" class="mb-card">
          <div class="mb-card-head">
            <div class="mb-card-title-wrap">
              <span class="mb-card-title">{{ p.title }}</span>
              <span class="mb-card-count">{{ dataOf(p.id)?.total ?? '-' }}</span>
            </div>
            <a-dropdown :trigger="['click']" placement="bottomRight">
              <button type="button" class="mb-icon-btn mb-card-more"><MoreOutlined /></button>
              <template #overlay>
                <a-menu @click="onPanelMenu($event, p, idx)">
                  <a-menu-item key="edit"><EditOutlined /> 编辑</a-menu-item>
                  <a-menu-item key="up" :disabled="idx === 0"><ArrowUpOutlined /> 上移</a-menu-item>
                  <a-menu-item key="down" :disabled="idx === panels.length - 1"><ArrowDownOutlined /> 下移</a-menu-item>
                  <a-menu-item key="delete" danger><DeleteOutlined /> 删除</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
          <div class="mb-card-cond">{{ conditionText(p) }}</div>

          <a-spin :spinning="!!panelLoading[p.id]" size="small">
            <ul v-if="dataOf(p.id)?.list?.length" class="mb-list">
              <li v-for="it in dataOf(p.id)!.list" :key="it.issueKey" class="mb-item" @click="openIssue(it.issueKey)">
                <span class="mb-type" :style="{ background: it.issueTypeColor || '#8c8c8c' }" :title="it.issueTypeName">
                  <component :is="issueTypeIconOf(it.issueTypeIcon)" />
                </span>
                <span class="mb-key">{{ it.issueKey }}</span>
                <span class="mb-summary" :title="it.summary">{{ it.summary || '（无概要）' }}</span>
                <span v-if="it.statusName" class="mb-status" :style="statusStyle(it.statusColor)">{{ it.statusName }}</span>
              </li>
            </ul>
            <div v-else-if="dataOf(p.id)" class="mb-card-empty">暂无事项</div>
            <div v-else class="mb-card-empty">&nbsp;</div>
          </a-spin>

          <div v-if="(dataOf(p.id)?.total ?? 0) > (dataOf(p.id)?.list?.length ?? 0)" class="mb-card-foot">
            共 {{ dataOf(p.id)!.total }} 条，展示最近更新的 {{ dataOf(p.id)!.list.length }} 条
          </div>
        </section>
      </div>
    </a-spin>

    <!-- 新增 / 编辑看板 -->
    <a-modal
      v-model:open="modalOpen"
      :title="form.id ? '编辑看板' : '添加看板'"
      :width="720"
      centered
      destroy-on-close
      :ok-text="form.id ? '保存' : '添加'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="submit"
    >
      <a-form layout="vertical">
        <a-form-item label="看板标题" required>
          <a-input v-model:value="form.title" placeholder="如 我的需求 / 我的任务" :maxlength="64" />
        </a-form-item>
        <a-form-item label="问题类型">
          <a-select
            v-model:value="form.issueTypeCodes"
            mode="multiple"
            :options="issueTypeOptions"
            :loading="typesLoading"
            option-filter-prop="label"
            placeholder="全部类型"
            allow-clear
            @change="onTypesChange"
          />
        </a-form-item>
        <a-form-item label="与我的关系">
          <a-radio-group v-model:value="form.relation" button-style="solid">
            <a-radio-button v-for="o in RELATION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="状态">
          <a-radio-group v-model:value="form.statusScope" button-style="solid">
            <a-radio-button v-for="o in SCOPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</a-radio-button>
          </a-radio-group>
          <a-select
            v-if="form.statusScope === 'SPECIFIC'"
            v-model:value="form.statusCodes"
            mode="multiple"
            :options="statusOptions"
            :loading="statusesLoading"
            option-filter-prop="label"
            placeholder="选择状态"
            class="mb-status-select"
          />
        </a-form-item>
        <a-form-item label="自定义条件" class="mb-custom-filter">
          <template #extra>与上面的条件同时满足；可按任意字段筛选，如优先级、迭代、自定义字段</template>
          <FilterPanel
            :visible="modalOpen"
            v-model="customConditions"
            v-model:logic="customLogic"
            embedded
          />
        </a-form-item>
        <a-form-item label="展示条数">
          <a-select v-model:value="form.pageSize" :options="PAGE_SIZE_OPTIONS" style="width: 120px" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 事项详情抽屉 -->
    <IssueDetailDrawer v-model:open="drawerOpen" :issue-key="drawerIssueKey" @changed="reloadAllData" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  PlusOutlined, ReloadOutlined, MoreOutlined, EditOutlined, DeleteOutlined,
  ArrowUpOutlined, ArrowDownOutlined, AppstoreOutlined,
} from '@ant-design/icons-vue'
import {
  queryMyBoardPanels, saveMyBoardPanel, deleteMyBoardPanel, sortMyBoardPanels, queryMyBoardPanelData,
  queryIssueTypes, queryIssueTypeStatuses,
  type MyBoardPanel, type MyBoardPanelData, type MyBoardRelation, type MyBoardStatusScope, type IssueTypeItem,
} from '@/api/faiz'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'
import IssueDetailDrawer from '@/components/IssueDetailDrawer.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import { currentSpaceCode } from '@/utils/current-space'
import {
  buildGlobalFilter,
  parseGlobalFilter,
  isConditionComplete,
  type FilterCondition,
  type FilterLogic,
} from '@/utils/issueFilter'
import type { GlobalFilter } from '@/types/faiz'

/**
 * 我的看板：当前用户自己配置的卡片面板（配置存后端，跟着账号走）
 * 每块面板 = 问题类型 + 与我的关系 + 状态范围 + 展示条数，展示命中总数和最近更新的前 N 条事项
 */
const RELATION_OPTIONS: { label: string; value: MyBoardRelation }[] = [
  { label: '我经办的', value: 'ASSIGNEE' },
  { label: '我创建的', value: 'CREATOR' },
  { label: '不限', value: 'ANY' },
]
const SCOPE_OPTIONS: { label: string; value: MyBoardStatusScope }[] = [
  { label: '未结束', value: 'UNRESOLVED' },
  { label: '全部', value: 'ALL' },
  { label: '指定状态', value: 'SPECIFIC' },
]
const PAGE_SIZE_OPTIONS = [5, 10, 20].map(n => ({ label: `${n} 条`, value: n }))

// ---- 面板 ----
const panels = ref<MyBoardPanel[]>([])
const loading = ref(false)
/** 首次数据加载完成前只渲染骨架，避免先出现空页面 */
const initialized = ref(false)
const panelData = reactive<Record<number, MyBoardPanelData>>({})
const panelLoading = reactive<Record<number, boolean>>({})

function dataOf(id: number): MyBoardPanelData | undefined {
  return panelData[id]
}

async function loadPanelData(id: number) {
  panelLoading[id] = true
  try {
    const res = await queryMyBoardPanelData(id)
    if (res?.success && res.data) panelData[id] = res.data
  } catch {
    // 请求层已统一提示
  } finally {
    panelLoading[id] = false
  }
}

async function reloadAllData() {
  await Promise.all(panels.value.map(p => loadPanelData(p.id)))
}

async function reloadAll() {
  loading.value = true
  try {
    const res = await queryMyBoardPanels()
    panels.value = res?.success ? res.data || [] : []
    await reloadAllData()
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
    initialized.value = true
  }
}

// ---- 问题类型 / 状态（配置下拉 + 条件说明） ----
const issueTypes = ref<IssueTypeItem[]>([])
const typesLoading = ref(false)
async function loadIssueTypes() {
  typesLoading.value = true
  try {
    // 顶部选了空间时只列该空间的问题类型
    const res = await queryIssueTypes({ page: 1, pageSize: 999, status: 1, spaceCode: currentSpaceCode.value || undefined })
    issueTypes.value = (res?.success ? res.data?.list || [] : []).filter(t => t.issueTypeCode)
  } catch {
    issueTypes.value = []
  } finally {
    typesLoading.value = false
  }
}
/** 不同空间可能有同名问题类型：同名时带上空间名区分 */
const issueTypeOptions = computed(() => {
  const nameCount = new Map<string, number>()
  issueTypes.value.forEach(t => nameCount.set(t.issueTypeName, (nameCount.get(t.issueTypeName) ?? 0) + 1))
  return issueTypes.value.map(t => ({
    value: t.issueTypeCode as string,
    label: (nameCount.get(t.issueTypeName) ?? 0) > 1 && t.spaceName ? `${t.issueTypeName}（${t.spaceName}）` : t.issueTypeName,
  }))
})
function typeName(code: string) {
  return issueTypes.value.find(t => t.issueTypeCode === code)?.issueTypeName ?? code
}

/** 指定状态的选项：所选问题类型下的状态（未选类型时为全部类型），按编码去重 */
const statusOptions = ref<{ value: string; label: string }[]>([])
const statusesLoading = ref(false)
const statusNames = reactive<Record<string, string>>({})
async function loadStatuses(typeCodes: string[]) {
  const codes = typeCodes.length ? typeCodes : issueTypes.value.map(t => t.issueTypeCode as string)
  statusesLoading.value = true
  try {
    const lists = await Promise.all(codes.map(c => queryIssueTypeStatuses(c).then(r => r?.data || []).catch(() => [])))
    const seen = new Map<string, string>()
    for (const list of lists) {
      for (const s of list) {
        if (s.statusCode && !seen.has(s.statusCode)) seen.set(s.statusCode, s.statusName)
      }
    }
    seen.forEach((name, code) => { statusNames[code] = name })
    statusOptions.value = [...seen].map(([value, label]) => ({ value, label }))
  } finally {
    statusesLoading.value = false
  }
}

function conditionText(p: MyBoardPanel) {
  const types = p.issueTypeCodes.length ? p.issueTypeCodes.map(typeName).join('、') : '全部类型'
  const relation = RELATION_OPTIONS.find(o => o.value === p.relation)?.label ?? ''
  const scope = p.statusScope === 'SPECIFIC'
    ? p.statusCodes.map(c => statusNames[c] ?? c).join('、')
    : SCOPE_OPTIONS.find(o => o.value === p.statusScope)?.label ?? ''
  const customCount = customConditionCount(p)
  return [types, relation, scope, customCount ? `${customCount} 个自定义条件` : ''].filter(Boolean).join(' · ')
}

// ---- 自定义条件：复用全局筛选的条件编辑器，存为 globalFilter JSON ----
const customConditions = ref<FilterCondition[]>([])
const customLogic = ref<FilterLogic>('AND')

function parseFilterConfig(raw?: string | null): { conditions: FilterCondition[]; logic: FilterLogic } {
  if (!raw) return { conditions: [], logic: 'AND' }
  try {
    return parseGlobalFilter(JSON.parse(raw) as GlobalFilter)
  } catch {
    return { conditions: [], logic: 'AND' }
  }
}
function customConditionCount(p: MyBoardPanel) {
  return parseFilterConfig(p.filterConfig).conditions.filter(isConditionComplete).length
}
/** 当前编辑的条件 → filterConfig；没有完整条件时传空串（后端存为无） */
function buildFilterConfig(): string {
  const complete = customConditions.value.filter(isConditionComplete)
  return complete.length ? JSON.stringify(buildGlobalFilter(complete, customLogic.value)) : ''
}

function statusStyle(color?: string) {
  const c = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#8c8c8c'
  return { color: c, background: `color-mix(in srgb, ${c} 12%, #fff)` }
}

// ---- 新增 / 编辑 ----
const modalOpen = ref(false)
const saving = ref(false)
const emptyForm = () => ({
  id: undefined as number | undefined,
  title: '',
  issueTypeCodes: [] as string[],
  relation: 'ASSIGNEE' as MyBoardRelation,
  statusScope: 'UNRESOLVED' as MyBoardStatusScope,
  statusCodes: [] as string[],
  pageSize: 10,
})
const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  customConditions.value = []
  customLogic.value = 'AND'
  modalOpen.value = true
  loadStatuses([])
}

function openEdit(p: MyBoardPanel) {
  Object.assign(form, {
    id: p.id,
    title: p.title,
    issueTypeCodes: [...p.issueTypeCodes],
    relation: p.relation,
    statusScope: p.statusScope,
    statusCodes: [...p.statusCodes],
    pageSize: p.pageSize,
  })
  const parsed = parseFilterConfig(p.filterConfig)
  customConditions.value = parsed.conditions
  customLogic.value = parsed.logic
  modalOpen.value = true
  loadStatuses(form.issueTypeCodes)
}

/** 只选了一个类型且没填标题时，自动带出「我的需求」这类标题 */
function onTypesChange() {
  if (!form.title.trim() && form.issueTypeCodes.length === 1) form.title = `我的${typeName(form.issueTypeCodes[0])}`
  // 状态随类型变化：去掉已不在选项里的
  loadStatuses(form.issueTypeCodes).then(() => {
    form.statusCodes = form.statusCodes.filter(c => statusOptions.value.some(o => o.value === c))
  })
}

async function submit() {
  if (!form.title.trim()) {
    message.warning('请填写看板标题')
    return
  }
  if (form.statusScope === 'SPECIFIC' && !form.statusCodes.length) {
    message.warning('请至少选择一个状态')
    return
  }
  // 自定义条件里有填了一半的行：提示补全，避免用户以为条件已生效
  if (customConditions.value.some(c => (c.field || c.operator) && !isConditionComplete(c))) {
    message.warning('自定义条件未填写完整，请补全或删除')
    return
  }
  saving.value = true
  try {
    const res = await saveMyBoardPanel({ ...form, title: form.title.trim(), filterConfig: buildFilterConfig() })
    if (res?.success && res.data) {
      const saved = res.data
      const idx = panels.value.findIndex(p => p.id === saved.id)
      if (idx >= 0) panels.value[idx] = saved
      else panels.value.push(saved)
      modalOpen.value = false
      loadPanelData(saved.id)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

/** 空状态一键添加：待我处理 + 我创建的 */
const creatingPresets = ref(false)
async function addPresets() {
  creatingPresets.value = true
  try {
    const presets = [
      { title: '待我处理', issueTypeCodes: [], relation: 'ASSIGNEE' as const, statusScope: 'UNRESOLVED' as const, statusCodes: [], pageSize: 10 },
      { title: '我创建的', issueTypeCodes: [], relation: 'CREATOR' as const, statusScope: 'UNRESOLVED' as const, statusCodes: [], pageSize: 10 },
    ]
    for (const p of presets) await saveMyBoardPanel(p)
  } catch {
    // 请求层已统一提示
  } finally {
    creatingPresets.value = false
  }
  reloadAll()
}

// ---- 面板菜单：编辑 / 上移 / 下移 / 删除 ----
function onPanelMenu(info: { key: string | number }, p: MyBoardPanel, idx: number) {
  const key = String(info.key)
  if (key === 'edit') openEdit(p)
  else if (key === 'up' || key === 'down') move(idx, key === 'up' ? -1 : 1)
  else if (key === 'delete') confirmDelete(p)
}

async function move(idx: number, delta: number) {
  const to = idx + delta
  if (to < 0 || to >= panels.value.length) return
  const list = [...panels.value]
  const [item] = list.splice(idx, 1)
  list.splice(to, 0, item)
  panels.value = list
  try {
    await sortMyBoardPanels(list.map(p => p.id))
  } catch {
    reloadAll()
  }
}

function confirmDelete(p: MyBoardPanel) {
  Modal.confirm({
    title: `删除看板「${p.title}」？`,
    content: '只删除这块看板，不影响事项。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteMyBoardPanel(p.id)
        if (res?.success) panels.value = panels.value.filter(x => x.id !== p.id)
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

// ---- 事项详情 ----
const drawerOpen = ref(false)
const drawerIssueKey = ref('')
function openIssue(key: string) {
  drawerIssueKey.value = key
  drawerOpen.value = true
}

onMounted(async () => {
  // 条件说明里的类型 / 状态名称依赖问题类型列表
  await loadIssueTypes()
  await reloadAll()
  loadStatuses(panels.value.flatMap(p => p.issueTypeCodes))
})
</script>

<style scoped>
.my-board {
  padding: 20px 24px 32px;
}

/* 首次加载占位：保持页面高度稳定，数据回来后整块替换 */
.mb-skeleton {
  min-height: 360px;
  padding: 8px 0;
}

.mb-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.mb-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #1d1d1f;
}

.mb-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.mb-add-btn {
  border-radius: 10px;
}

.mb-icon-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: #6e6e73;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.mb-icon-btn:hover:not(:disabled) {
  background: #f2f2f5;
}

.mb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
  align-items: start;
}

.mb-card {
  display: flex;
  flex-direction: column;
  padding: 14px 16px 12px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mb-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mb-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mb-card-title {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mb-card-count {
  flex-shrink: 0;
  min-width: 22px;
  padding: 0 7px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  color: var(--c-primary);
  text-align: center;
  background: color-mix(in srgb, var(--c-primary) 10%, transparent);
  border-radius: 10px;
}

.mb-card-more {
  width: 28px;
  height: 28px;
}

.mb-card-cond {
  margin: 2px 0 8px;
  overflow: hidden;
  font-size: 12px;
  color: #86868b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mb-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.mb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 6px;
  margin: 0 -6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.mb-item:hover {
  background: #f5f5f7;
}

.mb-type {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
  border-radius: 5px;
}

.mb-key {
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--c-primary);
}

.mb-summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  color: #1d1d1f;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mb-status {
  flex-shrink: 0;
  max-width: 96px;
  padding: 0 8px;
  overflow: hidden;
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 10px;
}

.mb-card-empty {
  padding: 20px 0;
  font-size: 13px;
  color: #aeaeb2;
  text-align: center;
}

.mb-card-foot {
  margin-top: 6px;
  padding-top: 8px;
  font-size: 12px;
  color: #8e8e93;
  border-top: 1px solid #f2f2f5;
}

.mb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72px 16px;
  text-align: center;
  background: #fff;
  border: 1px dashed #d9d9de;
  border-radius: 16px;
}

.mb-empty-icon {
  font-size: 40px;
  color: #c7c7cc;
}

.mb-empty-title {
  margin-top: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #1d1d1f;
}

.mb-empty-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #86868b;
}

.mb-empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.mb-status-select {
  width: 100%;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .my-board {
    padding: 16px;
  }

  .mb-grid {
    grid-template-columns: 1fr;
  }
}
</style>
