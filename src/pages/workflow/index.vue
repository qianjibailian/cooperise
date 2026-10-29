<template>
  <div :class="['component-list-page', { embedded: !!props.spaceCode }]">
    <!-- 顶部：标题（空间内嵌入时由空间首页 Tab 承担标题） -->
    <div v-if="!props.spaceCode" class="wf-header">
      <div class="wf-title">工作流</div>
    </div>

    <a-tabs v-model:activeKey="activeTab" class="wf-tabs" @change="handleTabChange">
      <!-- ============ 流程定义 ============ -->
      <a-tab-pane key="definition" tab="流程定义">
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-box">
              <SearchOutlined class="search-icon" />
              <input v-model="defKeyword" class="search-input" placeholder="搜索流程名称 / 标识…" @keyup.enter="loadDefinitions()" />
              <div v-if="defKeyword" class="search-clear" @click="defKeyword = ''; loadDefinitions()">
                <CloseCircleFilled />
              </div>
            </div>
            <button class="search-btn" @click="loadDefinitions()"><SearchOutlined /> 查询</button>
          </div>
          <div class="toolbar-actions">
            <button class="create-btn" @click="openDefModal()"><PlusOutlined /><span>新增流程</span></button>
          </div>
        </div>

        <div class="table-wrapper">
          <a-table
            :columns="visibleDefColumns"
            :data-source="filteredDefs"
            :loading="defLoading"
            :pagination="false"
            row-key="id"
            size="middle"
            :scroll="{ x: 'max-content' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'processKey'">
                <span class="cell-strong">{{ record.processKey }}</span>
              </template>
              <template v-else-if="column.key === 'space'">
                <SpaceTag :code="record.spaceCode" :name="record.spaceName" />
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.status === 1 ? 'green' : 'default'">{{ record.status === 1 ? '启用' : '停用' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'createTime' || column.key === 'updateTime'">
                <span>{{ formatTime(record[column.key]) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="4">
                  <a-button type="link" size="small" :loading="defDetailLoading" @click="openDefModal(record)"><EditOutlined /> 编辑</a-button>
                  <a-button type="link" size="small" :style="{ color: record.status === 1 ? '#ff4d4f' : '#52c41a' }" @click="toggleDefStatus(record)">
                    {{ record.status === 1 ? '停用' : '启用' }}
                  </a-button>
                  <a-button type="link" size="small" :loading="defDetailLoading" @click="openFlowSetting(record)"><SettingOutlined /> 设置流程</a-button>
                  <!-- 仅停用的流程可删除 -->
                  <a-tooltip :title="record.status === 1 ? '请先停用该流程再删除' : ''">
                    <a-button type="link" size="small" danger :disabled="record.status === 1" @click="handleDeleteDef(record)"><DeleteOutlined /> 删除</a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </a-tab-pane>

    </a-tabs>

    <!-- ============ 流程信息弹窗：新增 / 编辑，只保存流程基本信息 ============ -->
    <a-modal v-model:open="defModal.open" :title="defModal.isEdit ? '编辑流程' : '新增流程'" width="980px" :footer="null" destroy-on-close class="wf-modal">
      <a-form :model="defForm" layout="vertical">
        <!-- 流程标识由后端自动生成：新增不展示，编辑时只读置灰 -->
        <a-form-item v-if="defModal.isEdit" label="流程标识 processKey">
          <a-input v-model:value="defForm.processKey" disabled size="large" />
        </a-form-item>
        <a-form-item label="流程名称" required>
          <a-input v-model:value="defForm.processName" placeholder="输入流程名称" size="large" />
        </a-form-item>
        <!-- 空间内管理时空间固定为当前空间，不再选择 -->
        <a-form-item v-if="!props.spaceCode" label="所属空间" required>
          <SpaceSelect v-model="defForm.spaceCode" @update:model-value="handleDefSpaceChange" />
        </a-form-item>
        <a-form-item label="绑定问题类型" required>
          <div class="issue-type-row">
            <a-select
              v-model:value="defForm.issueTypeId"
              :placeholder="defForm.spaceCode ? '选择该空间下的问题类型' : '请先选择所属空间'"
              :disabled="!defForm.spaceCode"
              :loading="defIssueTypeLoading"
              size="large"
              style="flex: 1"
              @change="handleIssueTypeChange"
            >
              <a-select-option v-for="opt in defIssueTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
              <template #notFoundContent>
                <div class="issue-type-empty">该组织暂无可用问题类型，请先在「问题类型」中添加</div>
              </template>
            </a-select>
            <a-button size="large" class="preset-btn" @click="applyPresetTemplate"><ThunderboltOutlined /> 应用预置模板</a-button>
          </div>
          <div class="preset-tip">预置模板：任务（待处理 → 处理中 → 后续节点：已完成 / 取消 / 暂停）；需求（待产品经理处理 → 待需求评审 → 待技术排期 → 开发中 → 已提测 → 测试中 → 待验收 → 待发布 → 已发布）</div>
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="defForm.remark" placeholder="备注说明" />
        </a-form-item>
        <div class="modal-footer">
          <a-button @click="defModal.open = false">取消</a-button>
          <a-button type="primary" :loading="defSaving" @click="handleSaveDef">保存</a-button>
        </div>
      </a-form>
    </a-modal>

    <!-- ============ 流程设置抽屉：只编辑流程节点 ============ -->
    <a-drawer
      v-model:open="flowSettingModal.open"
      title="流程设置"
      :width="'clamp(1000px, 94vw, 1180px)'"
      :content-wrapper-style="{ '--drawer-min-width': '1000px' }"
      destroy-on-close
      class="wf-setting-drawer"
      :body-style="{ padding: '16px 20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }"
    >
      <div class="fs-tip">配置「{{ flowSettingModal.processName || defForm.processName }}」的流程节点：一个节点可延伸出多个后续节点（如 处理中 → 已完成 / 取消 / 暂停）</div>

      <div class="fs-body">
        <!-- LogicFlow 可视化编辑 -->
        <WorkflowFlowCanvas ref="flowCanvasRef" :model-value="defForm.nodes" :status-options="flowStatusOptions" :position-options="flowPositionOptions" />

      </div>

      <template #footer>
        <div class="modal-footer">
          <a-button @click="flowSettingModal.open = false">取消</a-button>
          <a-button type="primary" :loading="flowSettingSaving" @click="saveFlowSetting">保存流程设置</a-button>
        </div>
      </template>
    </a-drawer>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  SearchOutlined,
  CloseCircleFilled,
  PlusOutlined,
  EditOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import {
  listWorkflowDefinitions,
  deployWorkflowDefinition,
  saveWorkflowDefinition,
  queryIssueTypes,
  queryIssueTypeStatuses,
  queryPositions,
  deleteWorkflowDefinition,
  getWorkflowDefinition,
  updateWorkflowDefinitionStatus,
} from '@/api/faiz'
import type {
  WorkflowDefinition,
  WorkflowNode,
} from '@/types/faiz'
import WorkflowFlowCanvas from '@/components/WorkflowFlowCanvas.vue'
import { normalizeLegacyNodes, genNodeId, ensureNodeIds } from '@/components/workflow-flow-layout'
import SpaceSelect from '@/components/SpaceSelect.vue'
import SpaceTag from '@/components/SpaceTag.vue'
import { useSpaces } from '@/utils/space-store'

// ---------- Tabs ----------
const activeTab = ref('definition')
function handleTabChange() {
  if (activeTab.value === 'definition') loadDefinitions()
}

// ---------- 通用 ----------
function formatTime(v?: string | null): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ==================== 流程定义 ====================
/** 问题类型选项：value 为问题类型编码 issueTypeCode（如 TYPE10001），id 为数字主键（查询状态用） */
interface IssueTypeOption {
  value: string
  label: string
  id: number
}

/** 接口问题类型 → 选项：value 取 issueTypeCode，缺失时退回 id */
function toIssueTypeOption(t: { id: number; issueTypeName: string; issueTypeCode?: string }): IssueTypeOption {
  return { value: t.issueTypeCode || String(t.id), label: t.issueTypeName, id: t.id }
}

/** 全部启用的问题类型（不限组织）：用于发起工作流、列表名称回显 */
const allIssueTypeOptions = ref<IssueTypeOption[]>([])
async function loadAllIssueTypes() {
  try {
    const res = await queryIssueTypes({ page: 1, pageSize: 999, status: 1 })
    if (res?.success) allIssueTypeOptions.value = (res.data?.list || []).map(toIssueTypeOption)
  } catch {
    // 请求层已统一提示
  }
}

/** 按编码（兼容历史数字 ID）查找问题类型选项 */
function findIssueTypeOption(v?: string | number | null): IssueTypeOption | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const key = String(v)
  const lists = [defIssueTypeOptions.value, allIssueTypeOptions.value]
  for (const list of lists) {
    const opt = list.find((o) => o.value === key) || list.find((o) => String(o.id) === key)
    if (opt) return opt
  }
  return undefined
}

interface PresetWorkflow {
  processName: string
  nodes: WorkflowNode[]
}

/** 预置工作流模板：问题类型 → 默认流程节点 */
const PRESET_WORKFLOWS: Record<string, PresetWorkflow> = {
  // 任务：待处理 → 处理中 → 后续节点（已完成 / 取消 / 暂停）
  任务: {
    processName: '任务流程',
    nodes: [
      { nodeId: 'task_pending', nodeName: '待处理' },
      {
        nodeId: 'task_doing',
        nodeName: '处理中',
        nextNodes: [
          { nodeId: 'task_done', nodeName: '已完成', branchName: '已完成' },
          { nodeId: 'task_cancel', nodeName: '取消', branchName: '取消' },
          { nodeId: 'task_pause', nodeName: '暂停', branchName: '暂停' },
        ],
      },
    ],
  },
  // 需求：待产品经理处理 → 待需求评审 → 待技术排期 → 开发中 → 已提测 → 测试中 → 待验收 → 待发布 → 已发布
  需求: {
    processName: '需求流程',
    nodes: [
      { nodeId: 'demand_pm_pending', nodeName: '待产品经理处理' },
      { nodeId: 'demand_review', nodeName: '待需求评审' },
      { nodeId: 'demand_schedule', nodeName: '待技术排期' },
      { nodeId: 'demand_dev', nodeName: '开发中' },
      { nodeId: 'demand_submit_test', nodeName: '已提测' },
      { nodeId: 'demand_testing', nodeName: '测试中' },
      { nodeId: 'demand_acceptance', nodeName: '待验收' },
      { nodeId: 'demand_release', nodeName: '待发布' },
      { nodeId: 'demand_published', nodeName: '已发布' },
    ],
  },
}

/** 问题类型编码 → 名称 */
function issueTypeNameOf(v?: string | number | null): string {
  if (v === undefined || v === null || v === '') return '-'
  return findIssueTypeOption(v)?.label ?? String(v)
}

const { spaceNameOf, orgCodeOfSpace } = useSpaces()

/** 在空间内管理（空间首页嵌入）时传入：列表只看该空间，新增 / 编辑固定归属该空间 */
const props = defineProps<{ spaceCode?: string }>()

// ---------- 流程绑定：空间 → 空间下的问题类型（不单独选组织，组织取所属空间的组织） ----------
const defIssueTypeOptions = ref<IssueTypeOption[]>([])
const defIssueTypeLoading = ref(false)
let defIssueTypeSeq = 0

/** 拉取所属空间下启用的问题类型（按 spaceCode 查询） */
async function loadDefIssueTypes(spaceCode?: string) {
  const seq = ++defIssueTypeSeq
  if (!spaceCode) {
    defIssueTypeOptions.value = []
    return
  }
  defIssueTypeLoading.value = true
  try {
    const res = await queryIssueTypes({ page: 1, pageSize: 999, status: 1, spaceCode })
    if (seq !== defIssueTypeSeq) return
    const list = res?.success ? res.data?.list || [] : []
    defIssueTypeOptions.value = list.filter((t) => !t.spaceCode || t.spaceCode === spaceCode).map(toIssueTypeOption)
  } catch {
    if (seq === defIssueTypeSeq) defIssueTypeOptions.value = []
  } finally {
    if (seq === defIssueTypeSeq) defIssueTypeLoading.value = false
  }
}

/** 切换所属空间（独立页面时可选）：重新加载问题类型，原选择不属于该空间则清空 */
async function handleDefSpaceChange(spaceCode?: string) {
  await loadDefIssueTypes(spaceCode)
  const cur = defForm.value.issueTypeId
  if (cur != null && !defIssueTypeOptions.value.some((o) => o.value === String(cur))) {
    defForm.value.issueTypeId = undefined
    defForm.value.issueTypeName = ''
  }
}

const defList = ref<WorkflowDefinition[]>([])
const defLoading = ref(false)
const defKeyword = ref('')

const defColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '流程标识', dataIndex: 'processKey', key: 'processKey' },
  { title: '流程名称', dataIndex: 'processName', key: 'processName' },
  { title: '所属空间', key: 'space', width: 180 },
  {
    title: '问题类型',
    key: 'issueType',
    width: 110,
    customRender: ({ record }: { record: WorkflowDefinition }) => record.issueTypeName || issueTypeNameOf(record.issueTypeId),
  },
  { title: '节点数', key: 'nodeCount', width: 80, customRender: ({ record }: { record: WorkflowDefinition }) => countNodes(record.nodes) },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 160 },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime', width: 160 },
  { title: '操作', key: 'action', width: 300, fixed: 'right' },
]

const visibleDefColumns = computed(() => props.spaceCode ? defColumns.filter((c) => c.key !== 'space') : defColumns)

const filteredDefs = computed(() => {
  const kw = defKeyword.value.trim().toLowerCase()
  // 列表接口不支持筛选：空间内排除明确属于其他空间的流程，未关联空间的历史流程照常展示
  const list = props.spaceCode ? defList.value.filter((d) => !d.spaceCode || d.spaceCode === props.spaceCode) : defList.value
  if (!kw) return list
  return list.filter((d) => {
    const typeName = issueTypeNameOf(d.issueTypeId ?? d.issueTypeName).toLowerCase()
    return (
      (d.processKey || '').toLowerCase().includes(kw) ||
      (d.processName || '').toLowerCase().includes(kw) ||
      (d.issueTypeName || '').toLowerCase().includes(kw) ||
      typeName.includes(kw)
    )
  })
})

async function loadDefinitions() {
  defLoading.value = true
  try {
    const res = await listWorkflowDefinitions()
    if (res.data) defList.value = Array.isArray(res.data) ? res.data : []
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    defLoading.value = false
  }
}

// 流程信息弹窗（新增 / 编辑）
const defModal = reactive({ open: false, isEdit: false })
const defSaving = ref(false)
const defDetailLoading = ref(false)

// ========== 流程设置弹窗：只编辑流程节点 ==========
const flowSettingModal = reactive<{ open: boolean; processName: string }>({ open: false, processName: '' })
const flowSettingSaving = ref(false)
/** 流程绑定问题类型下的全部状态：节点直接选择状态，节点名称取状态名称 */
const flowStatusOptions = ref<{ value: string; label: string }[]>([])
/** 状态 ID → 状态编码：历史流程节点只存了 statusId，打开时换算为 statusCode */
const flowStatusCodeById = ref<Record<string, string>>({})

/** 历史数据兼容：节点无 statusCode 但有 statusId 时，按状态 ID 换算为编码 */
function migrateStatusCodes(list: WorkflowNode[]) {
  for (const n of list) {
    if (!n.statusCode && n.statusId) n.statusCode = flowStatusCodeById.value[String(n.statusId)] ?? null
    delete n.statusId
    if (n.nextNodes?.length) migrateStatusCodes(n.nextNodes)
  }
}

/** 清理回退引用：目标节点已删除的引用去掉，避免保存后指向不存在的节点 */
function pruneBackRefs(list: WorkflowNode[]): WorkflowNode[] {
  const ids = new Set<string>()
  const collect = (l: WorkflowNode[]) => l.forEach((n) => { ids.add(n.nodeId); if (n.nextNodes) collect(n.nextNodes) })
  collect(list)
  const walk = (n: WorkflowNode): WorkflowNode => {
    const refs = (n.backToNodeIds ?? []).filter((id) => ids.has(id))
    return {
      ...n,
      backToNodeIds: refs.length ? refs : undefined,
      nextNodes: n.nextNodes?.map(walk),
    }
  }
  return list.map(walk)
}

/** 经办岗位选项：启用的岗位，标签带组织路径便于区分同名岗位 */
const flowPositionOptions = ref<{ value: string; label: string }[]>([])

async function loadFlowPositions() {
  try {
    const res = await queryPositions({ page: 1, pageSize: 999, status: 1 })
    if (res?.success) {
      flowPositionOptions.value = (res.data?.list || []).map((p) => {
        const org = p.organizationPathName || p.organizationName
        return { value: String(p.id), label: org ? `${p.positionName}（${org}）` : p.positionName }
      })
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  }
}

async function loadFlowStatuses(issueType?: string | number | null) {
  flowStatusOptions.value = []
  flowStatusCodeById.value = {}
  if (issueType == null || issueType === '') return
  // 状态接口按问题类型编码查询；历史数据为数字 ID 时先换算成编码
  if (!findIssueTypeOption(issueType)) await loadAllIssueTypes()
  const code = findIssueTypeOption(issueType)?.value ?? String(issueType)
  try {
    const res = await queryIssueTypeStatuses(code)
    if (res?.success) {
      const list = res.data || []
      // 节点提交状态编码 statusCode（如 STATUS00003），不再提交状态 ID
      flowStatusOptions.value = list.map((s) => ({ value: s.statusCode || String(s.id), label: s.statusName }))
      flowStatusCodeById.value = Object.fromEntries(list.filter((s) => s.id != null && s.statusCode).map((s) => [String(s.id), String(s.statusCode)]))
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  }
}

/** 打开"流程设置"：拉取最新详情并只展示节点编辑区 */
async function openFlowSetting(record: WorkflowDefinition) {
  flowSettingModal.processName = record.processName || ''
  flowSettingModal.open = true
  if (record.id) {
    defDetailLoading.value = true
    try {
      const res = await getWorkflowDefinition(record.id)
      if (res?.data) record = res.data
    } catch {
      // 错误提示由请求拦截器统一展示后端 message
    } finally {
      defDetailLoading.value = false
    }
  }
  defForm.value = {
    id: record.id,
    processKey: record.processKey,
    processName: record.processName || '',
    organizationCode: record.organizationCode,
    spaceCode: record.spaceCode || props.spaceCode,
    spaceName: record.spaceName || undefined,
    issueTypeId: record.issueTypeCode ?? record.issueTypeId ?? record.issueTypeName ?? undefined,
    issueTypeName: record.issueTypeName || issueTypeNameOf(record.issueTypeId),
    remark: record.remark || '',
    nodes: record.nodes?.length ? normalizeLegacyNodes(record.nodes).map((n) => cloneNode(n)) : [emptyNode()],
  }
  await Promise.all([loadFlowStatuses(record.issueTypeId), loadFlowPositions()])
  // 历史数据保存的是数字 ID：保存流程设置时统一提交编码
  const matchedType = findIssueTypeOption(defForm.value.issueTypeId)
  if (matchedType) defForm.value.issueTypeId = matchedType.value
  migrateStatusCodes(defForm.value.nodes)
  if (!flowStatusOptions.value.length) message.warning('该问题类型暂未配置状态，请先在「问题类型」中维护状态')
}

/** 保存流程设置：导出画布并提交节点（携带该流程的完整定义字段） */
async function saveFlowSetting() {
  applyCanvasToForm()
  const f = defForm.value
  if (!f.processKey.trim()) return message.warning('流程标识缺失，请重试')
  ensureNodeIds(f.nodes)
  if (!f.nodes.some(nodeValid)) return message.warning('请至少选择一个节点状态')
  flowSettingSaving.value = true
  try {
    const res = await deployWorkflowDefinition({
      id: f.id,
      processKey: f.processKey.trim(),
      processName: f.processName.trim(),
      // 不单独选组织：取所属空间的组织，空间未关联组织时用原组织兜底
      organizationCode: (await orgCodeOfSpace(f.spaceCode)) ?? f.organizationCode,
      spaceCode: f.spaceCode || undefined,
      spaceName: spaceNameOf(f.spaceCode) || f.spaceName || undefined,
      issueTypeCode: String(f.issueTypeId),
      issueTypeName: f.issueTypeName || issueTypeNameOf(f.issueTypeId),
      remark: f.remark || '',
      nodes: pruneBackRefs(f.nodes.filter(nodeValid).map((n) => sanitizeNode(n))),
    })
    if (res?.data || res?.success) {
      flowSettingModal.open = false
      loadDefinitions()
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    flowSettingSaving.value = false
  }
}
const flowCanvasRef = ref<InstanceType<typeof WorkflowFlowCanvas> | null>(null)

/** 保存前把画板内容应用到表单 */
function applyCanvasToForm() {
  if (flowCanvasRef.value) {
    defForm.value.nodes = flowCanvasRef.value.exportNodes()
  }
}
const defForm = ref<WorkflowDefinition & { nodes: WorkflowNode[] }>({
  processKey: '',
  processName: '',
  issueTypeId: undefined,
  issueTypeName: '',
  remark: '',
  nodes: [],
})

function emptyNode(): WorkflowNode {
  return { nodeId: genNodeId(), nodeName: '', assigneeType: 'CREATOR', assigneeValue: null, statusCode: null }
}

/** 深拷贝节点（含后续节点），避免编辑时污染列表数据 */
function cloneNode(n: WorkflowNode): WorkflowNode {
  return {
    ...n,
    branchName: n.branchName,
    nextNodes: n.nextNodes?.map((nn) => cloneNode(nn)),
  }
}

/** 节点（含后续节点）是否配置完整：自身标识+名称完整即有效，后续节点不完整会在保存时被过滤 */
function nodeValid(n: WorkflowNode): boolean {
  return !!(n.nodeId?.trim() && n.nodeName?.trim())
}

/** 递归裁剪：过滤不完整的后续节点，保留完整节点树与出口名称 */
function sanitizeNode(n: WorkflowNode): WorkflowNode {
  const base: WorkflowNode = {
    nodeId: n.nodeId.trim(),
    nodeName: n.nodeName.trim(),
    assigneeType: n.assigneeType || 'CREATOR',
    assigneeValue: n.assigneeValue?.trim() || null,
    statusCode: n.statusCode?.trim() || null,
    branchName: n.branchName?.trim() || undefined,
    // 回退引用：去重 + 去空白 + 排除指向自身
    backToNodeIds: (() => {
      const refs = (n.backToNodeIds ?? [])
        .map((s) => s.trim())
        .filter((s) => !!s && s !== n.nodeId.trim())
        .filter((s, i, arr) => arr.indexOf(s) === i)
      return refs.length ? refs : undefined
    })(),
  }
  const next = (n.nextNodes ?? [])
    .filter((nn) => nn.nodeId?.trim() && nn.nodeName?.trim())
    .map((nn) => sanitizeNode(nn))
  return next.length ? { ...base, nextNodes: next } : base
}

/** 节点总数（含多级后续节点） */
function countNodes(nodes?: WorkflowNode[]): number {
  if (!nodes) return 0
  let c = 0
  for (const n of nodes) {
    c += 1
    if (n.nextNodes?.length) c += countNodes(n.nextNodes)
  }
  return c
}

/** 旧数据兼容：把历史分支模型（branches）归一化为树形后续节点（nextNodes） */
async function openDefModal(record?: WorkflowDefinition) {
  if (!record) {
    defModal.isEdit = false
    defForm.value = { processKey: '', processName: '', spaceCode: props.spaceCode, issueTypeId: undefined, issueTypeName: '', remark: '', nodes: [emptyNode()] }
    defIssueTypeOptions.value = []
    defModal.open = true
    loadDefIssueTypes(props.spaceCode)
    return
  }
  defModal.isEdit = true
  defModal.open = true
  // 编辑：先拉取服务端最新详情（GET /workflow/definition/{id}），失败回退列表缓存数据
  if (record.id) {
    defDetailLoading.value = true
    try {
      const res = await getWorkflowDefinition(record.id)
      if (res?.data) record = res.data
    } catch {
      // 错误提示由请求拦截器统一展示后端 message
    } finally {
      defDetailLoading.value = false
    }
  }
  defForm.value = {
    id: record.id,
    processKey: record.processKey,
    processName: record.processName || '',
    organizationCode: record.organizationCode,
    spaceCode: record.spaceCode || props.spaceCode,
    spaceName: record.spaceName || undefined,
    issueTypeId: record.issueTypeCode ?? (record.issueTypeId != null ? String(record.issueTypeId) : undefined),
    issueTypeName: record.issueTypeName || issueTypeNameOf(record.issueTypeId),
    remark: record.remark || '',
    nodes: record.nodes?.length ? normalizeLegacyNodes(record.nodes).map((n) => cloneNode(n)) : [emptyNode()],
  }
  await loadDefIssueTypes(defForm.value.spaceCode)
  // 历史数据的问题类型不在当前组织列表中：补一个选项，保证回显名称
  const curId = defForm.value.issueTypeId
  const matched = findIssueTypeOption(curId)
  if (matched) defForm.value.issueTypeId = matched.value
  else if (curId != null && curId !== '') {
    defIssueTypeOptions.value = [
      ...defIssueTypeOptions.value,
      { value: String(curId), label: defForm.value.issueTypeName || String(curId), id: Number(curId) },
    ]
  }
}

/** 问题类型切换：同步名称 */
function handleIssueTypeChange() {
  const v = defForm.value.issueTypeId
  defForm.value.issueTypeName = v ? issueTypeNameOf(v) : ''
}

/** 应用预置模板：按问题类型自动填充流程名称与节点 */
function applyPresetTemplate() {
  const v = defForm.value.issueTypeId
  if (!v) return message.warning('请先选择问题类型')
  // 问题类型来自接口，ID 与预置模板不一致时按名称匹配（需求 / 任务）
  const typeName = issueTypeNameOf(v)
  const preset = PRESET_WORKFLOWS[typeName]
  if (!preset) return message.info('该问题类型暂无预置模板，请手动配置节点')
  defForm.value.processName = preset.processName
  defForm.value.nodes = preset.nodes.map((n) => cloneNode(n))
  message.success(`已应用「${typeName}」预置模板`)
}

async function handleSaveDef() {
  const f = defForm.value
  if (!f.processName.trim()) return message.warning('请输入流程名称')
  if (!f.spaceCode) return message.warning('请选择所属空间')
  if (!f.issueTypeId) return message.warning('请选择绑定的问题类型')
  // 只保存流程基本信息（独立接口，不部署）；流程节点在"流程设置"中配置
  defSaving.value = true
  try {
    const res = await saveWorkflowDefinition({
      id: f.id,
      // 新增时由后端生成流程标识，编辑时原样回传
      processKey: defModal.isEdit ? f.processKey : undefined,
      processName: f.processName.trim(),
      // 不单独选组织：取所属空间的组织，空间未关联组织时用原组织兜底
      organizationCode: (await orgCodeOfSpace(f.spaceCode)) ?? f.organizationCode,
      spaceCode: f.spaceCode || undefined,
      spaceName: spaceNameOf(f.spaceCode) || f.spaceName || undefined,
      issueTypeCode: String(f.issueTypeId),
      issueTypeName: f.issueTypeName || issueTypeNameOf(f.issueTypeId),
      remark: f.remark || '',
    })
    if (res.success || res.data) {
      defModal.open = false
      loadDefinitions()
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    defSaving.value = false
  }
}

async function toggleDefStatus(record: WorkflowDefinition) {
  const next = record.status === 1 ? 0 : 1
  try {
    const res = await updateWorkflowDefinitionStatus(Number(record.id), next)
    if (res.success || res.data !== undefined) {
      loadDefinitions()
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  }
}

/** 删除流程：仅停用状态可删除，二次确认 */
function handleDeleteDef(record: WorkflowDefinition) {
  if (record.status === 1) return message.warning('请先停用该流程再删除')
  Modal.confirm({
    title: `删除流程「${record.processName || record.processKey}」？`,
    content: '删除后不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        const res = await deleteWorkflowDefinition(Number(record.id))
        if (res?.success) {
          loadDefinitions()
        }
      } catch {
        // 错误提示由请求拦截器统一展示后端 message
      }
    },
  })
}

onMounted(() => {
  loadAllIssueTypes()
  loadDefinitions()
})
</script>

<style scoped>
.component-list-page {
  padding: 0 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
}

.component-list-page.embedded {
  padding: 0;
}

.wf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}
.wf-title {
  font-size: 20px;
  font-weight: 700;
  color: #1d1d1f;
}

.issue-type-empty {
  padding: 8px 4px;
  font-size: 12px;
  color: #8e8e93;
  text-align: center;
}

.wf-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 16px;
}
.wf-tabs :deep(.ant-tabs-tab) {
  font-size: 15px;
  font-weight: 500;
}

/* ---- toolbar ---- */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}
.search-box {
  flex: 1;
  min-width: 260px;
  position: relative;
  display: flex;
  align-items: center;
  background: #f5f5f7;
  border-radius: 14px;
  transition: background 0.2s, box-shadow 0.2s;
}
.search-box:focus-within {
  background: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
.search-icon {
  font-size: 16px;
  color: #86868b;
  margin-left: 14px;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 11px 12px 11px 10px;
  font-size: 15px;
  color: #1d1d1f;
  outline: none;
  font-family: inherit;
}
.search-input::placeholder {
  color: #aeaeb2;
}
.search-clear {
  padding: 0 12px;
  cursor: pointer;
  color: #aeaeb2;
  font-size: 16px;
  display: flex;
  align-items: center;
}
.search-clear:hover {
  color: #6e6e73;
}
.search-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: #3b82f6;
  color: #fff;
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
  white-space: nowrap;
}
.search-btn:hover {
  background: #2563eb;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: none;
  background: #1d1d1f;
  color: #fff;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  white-space: nowrap;
}
.create-btn:hover {
  background: #333;
  transform: scale(1.02);
}

/* ---- filter inputs ---- */
.wf-input {
  width: 200px;
  padding: 9px 12px;
  border: 1px solid #e5e5ea;
  background: #fff;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.wf-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}
.wf-select {
  padding: 9px 12px;
  border: 1px solid #e5e5ea;
  background: #fff;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  color: #1d1d1f;
}

/* ---- table ---- */
.table-wrapper {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  overflow: hidden;
}
.cell-strong {
  font-weight: 600;
  color: #1d1d1f;
}
.cell-muted {
  color: #aeaeb2;
}

/* ---- modal ---- */
.wf-modal :deep(.ant-modal-content) {
  border-radius: 20px;
}
.wf-modal :deep(.ant-modal-header) {
  padding: 24px 28px 0;
  border-bottom: none;
}
.wf-modal :deep(.ant-modal-title) {
  font-size: 18px;
  font-weight: 700;
  color: #1d1d1f;
}
.wf-modal :deep(.ant-modal-body) {
  padding: 20px 28px 28px;
}
.wf-modal :deep(.ant-form-item) {
  margin-bottom: 16px;
}
.wf-modal :deep(.ant-input),
.wf-modal :deep(.ant-select-selector) {
  border-radius: 10px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
/* ---- 流程设置抽屉 ---- */
.wf-setting-drawer :deep(.ant-drawer-header) {
  padding: 18px 20px;
  border-bottom: 1px solid #f0f0f0;
}
.wf-setting-drawer :deep(.ant-drawer-title) {
  font-size: 17px;
  font-weight: 700;
  color: #1d1d1f;
}
.wf-setting-drawer :deep(.ant-drawer-footer) {
  padding: 12px 20px;
  border-top: 1px solid #f0f0f0;
}
.fs-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
.fs-tip {
  margin-bottom: 8px;
  padding: 6px 10px;
  font-size: 13px;
  color: #595959;
  background: #f0f7ff;
  border: 1px solid #bae0ff;
  border-radius: 8px;
}

/* ---- node editor ---- */
.node-status {
  width: 110px;
}
.node-del {
  flex-shrink: 0;
}
.node-add {
  border-radius: 10px;
}
.node-branch-btn {
  flex-shrink: 0;
  color: #722ed1;
}
.node-branch-btn.is-active {
  color: #fff;
  background: #722ed1;
  border-radius: 8px;
}
.branch-area {
  margin: 6px 0 10px 20px;
  padding: 10px 12px;
  background: #faf7ff;
  border: 1px solid #efdbff;
  border-radius: 10px;
}
.branch-row {
  margin-bottom: 10px;
}
.branch-row:last-child {
  margin-bottom: 0;
}
.branch-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.branch-label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #722ed1;
  background: #efdbff;
  border-radius: 6px;
  padding: 2px 8px;
}
.branch-node-row {
  margin: 4px 0;
}
.branch-node-add {
  margin-top: 4px;
  border-color: #efdbff;
  color: #722ed1;
}

/* ---- issue type preset ---- */
.issue-type-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.preset-btn {
  border-radius: 10px;
  flex-shrink: 0;
}
.preset-tip {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #8e8e93;
}
</style>
