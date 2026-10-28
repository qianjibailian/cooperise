<template>
  <div class="component-list-page">
    <!-- 顶部：标题 -->
    <div class="wf-header">
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
            :columns="defColumns"
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
              <template v-else-if="column.key === 'organization'">
                <span :title="record.organizationPathName || record.organizationName">{{ record.organizationPathName || record.organizationName || '-' }}</span>
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

      <!-- ============ 实例监控 ============ -->
      <a-tab-pane key="instance" tab="实例监控">
        <div class="toolbar">
          <div class="toolbar-left">
            <select v-model="insQuery.status" class="wf-select">
              <option value="">全部状态</option>
              <option value="RUNNING">运行中</option>
              <option value="END">已结束</option>
              <option value="CANCELED">已撤销</option>
            </select>
            <input v-model="insQuery.initiator" class="wf-input" placeholder="发起人账号" />
            <input v-model="insQuery.issueKey" class="wf-input" placeholder="单号" @keyup.enter="loadInstances()" />
            <button class="search-btn" @click="loadInstances()"><SearchOutlined /> 查询</button>
            <button class="create-btn" @click="openStartModal()"><PlayCircleOutlined /><span>发起工作流</span></button>
          </div>
        </div>

        <div class="table-wrapper">
          <a-table :columns="insColumns" :data-source="insList" :loading="insLoading" :pagination="false" row-key="id" size="middle" :scroll="{ x: 'max-content' }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="insStatusColor(record.status)">{{ insStatusText(record.status) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'createTime' || column.key === 'endTime'">
                <span>{{ formatTime(record[column.key]) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="4">
                  <a-button type="link" size="small" @click="openInsDetail(record)"><EyeOutlined /> 详情</a-button>
                  <a-button v-if="record.status === 'RUNNING'" type="link" size="small" danger @click="handleCancelIns(record)"><StopOutlined /> 撤销</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>

        <div class="pagination-bar" v-if="!insLoading && insTotal > 0">
          <a-pagination
            v-model:current="insPageNum"
            v-model:page-size="pageSize"
            :total="insTotal"
            :show-size-changer="true"
            :page-size-options="['10', '20', '50']"
            :show-total="(t: number) => `共 ${t} 条`"
            @change="loadInstances()"
            @showSizeChange="loadInstances()"
          />
        </div>
      </a-tab-pane>

      <!-- ============ 我的待办 ============ -->
      <a-tab-pane key="todo" tab="我的待办">
        <div class="table-wrapper">
          <a-table :columns="todoColumns" :data-source="todoList" :loading="todoLoading" :pagination="false" row-key="id" size="middle" :scroll="{ x: 'max-content' }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'createTime' || column.key === 'finishTime'">
                <span>{{ formatTime(record[column.key]) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="4">
                  <a-button type="link" size="small" style="color: #52c41a" @click="openApproveModal(record, 'APPROVE')"><CheckCircleOutlined /> 通过</a-button>
                  <a-button type="link" size="small" danger @click="openApproveModal(record, 'REJECT')"><CloseCircleOutlined /> 驳回</a-button>
                  <a-button type="link" size="small" @click="openTransferModal(record)"><SwapOutlined /> 转办</a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>

        <div class="pagination-bar" v-if="!todoLoading && todoTotal > 0">
          <a-pagination
            v-model:current="todoPageNum"
            v-model:page-size="pageSize"
            :total="todoTotal"
            :show-size-changer="true"
            :page-size-options="['10', '20', '50']"
            :show-total="(t: number) => `共 ${t} 条`"
            @change="loadTodo()"
            @showSizeChange="loadTodo()"
          />
        </div>
      </a-tab-pane>

      <!-- ============ 我的已办 ============ -->
      <a-tab-pane key="done" tab="我的已办">
        <div class="table-wrapper">
          <a-table :columns="doneColumns" :data-source="doneList" :loading="doneLoading" :pagination="false" row-key="id" size="middle" :scroll="{ x: 'max-content' }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action'">
                <a-tag :color="taskActionColor(record.action)">{{ taskActionText(record.action) }}</a-tag>
              </template>
              <template v-else-if="column.key === 'finishTime' || column.key === 'createTime'">
                <span>{{ formatTime(record[column.key]) }}</span>
              </template>
            </template>
          </a-table>
        </div>

        <div class="pagination-bar" v-if="!doneLoading && doneTotal > 0">
          <a-pagination
            v-model:current="donePageNum"
            v-model:page-size="pageSize"
            :total="doneTotal"
            :show-size-changer="true"
            :page-size-options="['10', '20', '50']"
            :show-total="(t: number) => `共 ${t} 条`"
            @change="loadDone()"
            @showSizeChange="loadDone()"
          />
        </div>
      </a-tab-pane>

      <!-- ============ 我的抄送 ============ -->
      <a-tab-pane key="cc" tab="我的抄送">
        <div class="table-wrapper">
          <a-table :columns="ccColumns" :data-source="ccList" :loading="ccLoading" :pagination="false" row-key="id" size="middle" :scroll="{ x: 'max-content' }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'READ' ? 'default' : 'orange'">{{ record.status === 'READ' ? '已读' : '未读' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'createTime'">
                <span>{{ formatTime(record.createTime) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button v-if="record.status !== 'READ'" type="link" size="small" @click="markRead(record)"><CheckOutlined /> 标记已读</a-button>
                <span v-else class="cell-muted">-</span>
              </template>
            </template>
          </a-table>
        </div>

        <div class="pagination-bar" v-if="!ccLoading && ccTotal > 0">
          <a-pagination
            v-model:current="ccPageNum"
            v-model:page-size="pageSize"
            :total="ccTotal"
            :show-size-changer="true"
            :page-size-options="['10', '20', '50']"
            :show-total="(t: number) => `共 ${t} 条`"
            @change="loadCc()"
            @showSizeChange="loadCc()"
          />
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
        <a-form-item label="所属组织" required>
          <OrgTreeSelect
            v-model="defForm.organizationId"
            :tree-data="defOrgTree"
            placeholder="选择组织，问题类型按组织筛选"
            @update:model-value="handleDefOrgChange"
          />
        </a-form-item>
        <a-form-item label="绑定问题类型" required>
          <div class="issue-type-row">
            <a-select
              v-model:value="defForm.issueTypeId"
              :placeholder="defForm.organizationId ? '选择该组织下的问题类型' : '请先选择所属组织'"
              :disabled="!defForm.organizationId"
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
      :width="'min(1180px, 94vw)'"
      destroy-on-close
      class="wf-setting-drawer"
      :body-style="{ padding: '16px 20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }"
    >
      <div class="fs-tip">配置「{{ flowSettingModal.processName || defForm.processName }}」的流程节点：一个节点可延伸出多个后续节点（如 处理中 → 已完成 / 取消 / 暂停）</div>
      <a-segmented
        v-model:value="defMode"
        :options="[{ label: '画板编辑', value: 'canvas' }, { label: '列表编辑', value: 'list' }]"
        block
        style="margin: 4px 0 10px"
        @change="switchDefMode"
      />

      <div class="fs-body">
        <!-- 画板模式：LogicFlow 可视化编辑 -->
        <WorkflowFlowCanvas v-if="defMode === 'canvas'" ref="flowCanvasRef" :model-value="defForm.nodes" :status-options="flowStatusOptions" :position-options="flowPositionOptions" />

        <!-- 列表模式：树形表单编辑，一个节点可延伸多个后续节点 -->
        <template v-else>
          <div class="node-list-toolbar">
            <span class="node-list-summary">共 {{ countNodes(defForm.nodes) }} 个节点</span>
            <span class="node-list-legend"><i class="legend-bar" />已配置<i class="legend-bar is-empty" />待选择状态</span>
            <a-button size="small" @click="toggleAllNodes(true)"><PlusSquareOutlined /> 全部展开</a-button>
            <a-button size="small" @click="toggleAllNodes(false)"><MinusSquareOutlined /> 全部收起</a-button>
          </div>
          <div class="node-list">
            <WorkflowNodeEditor v-for="(n, idx) in defForm.nodes" :key="idx" :node="n" :depth="0" :status-options="flowStatusOptions" :position-options="flowPositionOptions" :expand-signal="nodeExpandSignal" @remove="removeNode(idx)" @insert-after="insertNodeAfter(idx)" />
          </div>
          <a-button v-if="!defForm.nodes.length" type="dashed" size="small" class="node-add" @click="addNode"><PlusOutlined /> 添加节点</a-button>
        </template>
      </div>

      <template #footer>
        <div class="modal-footer">
          <a-button @click="flowSettingModal.open = false">取消</a-button>
          <a-button type="primary" :loading="flowSettingSaving" @click="saveFlowSetting">保存流程设置</a-button>
        </div>
      </template>
    </a-drawer>

    <!-- ============ 发起工作流弹窗 ============ -->
    <a-modal v-model:open="startModal.open" title="发起工作流" width="560px" :footer="null" destroy-on-close class="wf-modal">
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 19 }">
        <a-form-item label="单号" required>
          <a-input v-model:value="startForm.issueKey" placeholder="如 UG-000001" size="large" />
        </a-form-item>
        <a-form-item label="问题类型" required>
          <a-select v-model:value="startForm.issueTypeId" placeholder="选择后按问题类型自动匹配启用流程" size="large">
            <a-select-option v-for="opt in allIssueTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="指定流程">
          <a-input v-model:value="startForm.processKey" placeholder="选填，填写后优先使用该流程标识" size="large" />
        </a-form-item>
        <a-form-item label="发起人">
          <a-input v-model:value="startForm.initiator" size="large" />
        </a-form-item>
        <a-form-item label="抄送人">
          <a-input v-model:value="startForm.ccUsers" placeholder="多个用逗号分隔，如 10001,10002" />
        </a-form-item>
      </a-form>
      <div class="modal-footer">
        <a-button @click="startModal.open = false">取消</a-button>
        <a-button type="primary" :loading="startSaving" @click="handleStartWorkflow">发起</a-button>
      </div>
    </a-modal>

    <!-- ============ 审批弹窗（通过/驳回） ============ -->
    <a-modal
      v-model:open="approveModal.open"
      :title="approveModal.action === 'APPROVE' ? '审批通过' : '审批驳回'"
      :confirm-loading="approveSaving"
      @ok="handleApprove"
      @cancel="approveModal.open = false"
      class="wf-modal"
    >
      <p class="approve-tip">单号：<b>{{ approveModal.task?.issueKey }}</b>，节点：<b>{{ approveModal.task?.nodeName }}</b></p>
      <a-input v-model:value="approveComment" placeholder="审批意见（可选）" />
    </a-modal>

    <!-- ============ 转办弹窗 ============ -->
    <a-modal
      v-model:open="transferModal.open"
      title="转办"
      :confirm-loading="transferSaving"
      @ok="handleTransfer"
      @cancel="transferModal.open = false"
      class="wf-modal"
    >
      <p class="approve-tip">单号：<b>{{ transferModal.task?.issueKey }}</b></p>
      <a-input v-model:value="transferAssignee" placeholder="转办目标用户账号" />
    </a-modal>

    <!-- ============ 实例详情弹窗 ============ -->
    <a-modal v-model:open="insDetail.open" title="流程实例详情" width="900px" :footer="null" class="wf-modal">
      <a-descriptions :column="2" size="small" bordered class="ins-desc">
        <a-descriptions-item label="实例ID">{{ insCore.instanceId }}</a-descriptions-item>
        <a-descriptions-item label="单号">{{ insCore.issueKey }}</a-descriptions-item>
        <a-descriptions-item label="流程名称">{{ insCore.processName }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="insStatusColor(insCore.status)">{{ insStatusText(insCore.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="发起人">{{ insCore.initiator }}</a-descriptions-item>
        <a-descriptions-item label="发起时间">{{ formatTime(insCore.startTime) }}</a-descriptions-item>
        <a-descriptions-item v-if="insCore.issueSummary" label="概要" :span="2">{{ insCore.issueSummary }}</a-descriptions-item>
        <a-descriptions-item v-if="insCore.currentNode" label="当前节点">{{ insCore.currentNode }}</a-descriptions-item>
        <a-descriptions-item v-if="insCore.endTime" label="结束时间">{{ formatTime(insCore.endTime) }}</a-descriptions-item>
      </a-descriptions>

      <!-- 流程节点图：展示全部节点，高亮当前节点、标记历史节点 -->
      <template v-if="insDetail.nodes.length">
        <div class="ins-flow-title">
          <span>流程节点</span>
          <span class="ins-legend">
            <a-tag color="green">已完成</a-tag>
            <a-tag color="orange">当前</a-tag>
            <a-tag>未开始</a-tag>
          </span>
        </div>
        <WorkflowFlowViewer
          :nodes="insDetail.nodes"
          :node-states="insDetail.nodeStates"
          height="300px"
          class="ins-flow-viewer"
        />
      </template>

      <div class="ins-records-title">审批记录</div>
      <div class="ins-records">
        <div v-if="!insDetail.records || insDetail.records.length === 0" class="cell-muted">暂无审批记录</div>
        <div v-for="(r, idx) in insDetail.records" :key="idx" class="ins-record-item">
          <div class="ins-record-head">
            <span class="ins-record-op">{{ r.operator || r.userNo || r.assignee || '-' }}</span>
            <a-tag :color="taskActionColor(r.action)" size="small">{{ taskActionText(r.action) }}</a-tag>
            <span class="ins-record-time">{{ formatTime(r.createTime || r.finishTime) }}</span>
          </div>
          <div v-if="r.comment" class="ins-record-comment">{{ r.comment }}</div>
        </div>
      </div>

      <!-- 接口返回数据明细：workflow/instance/{id} 的全部字段（折叠，兜底展示未归类数据） -->
      <a-collapse v-if="insExtraFields.length" class="ins-extra" :bordered="false">
        <a-collapse-panel key="extra" header="接口返回数据明细（workflow/instance/{{ insDetail.data?.id }}）">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item
              v-for="f in insExtraFields"
              :key="f.key"
              :label="f.label"
              :span="f.span"
            >
              <pre v-if="!f.isSimple" class="ins-json">{{ f.text }}</pre>
              <span v-else>{{ f.text }}</span>
            </a-descriptions-item>
          </a-descriptions>
        </a-collapse-panel>
      </a-collapse>
    </a-modal>
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
  PlayCircleOutlined,
  EyeOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SwapOutlined,
  CheckOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  PlusSquareOutlined,
  MinusSquareOutlined,
} from '@ant-design/icons-vue'
import {
  listWorkflowDefinitions,
  deployWorkflowDefinition,
  saveWorkflowDefinition,
  getOrganizationTree,
  queryIssueTypes,
  queryIssueTypeStatuses,
  queryPositions,
  type OrganizationNode,
  deleteWorkflowDefinition,
  getWorkflowDefinition,
  updateWorkflowDefinitionStatus,
  listWorkflowInstances,
  getWorkflowInstance,
  cancelWorkflowInstance,
  listWorkflowTodo,
  listWorkflowDone,
  approveWorkflowTask,
  rejectWorkflowTask,
  transferWorkflowTask,
  listWorkflowCc,
  markWorkflowCcRead,
  startWorkflow,
} from '@/api/faiz'
import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowTask,
  WorkflowCc,
  WorkflowNode,
} from '@/types/faiz'
import WorkflowFlowCanvas from '@/components/WorkflowFlowCanvas.vue'
import WorkflowFlowViewer from '@/components/WorkflowFlowViewer.vue'
import { normalizeLegacyNodes, genNodeId, ensureNodeIds } from '@/components/workflow-flow-layout'
import type { WfFlowNodeState } from '@/components/workflow-flow-layout'
import WorkflowNodeEditor from '@/components/WorkflowNodeEditor.vue'
import OrgTreeSelect from '@/components/OrgTreeSelect.vue'
import { getLoginUsername, useAuth } from '@/utils/auth'

// ---------- 当前用户：取登录用户（memberId / 工号），不再手动输入 ----------
const { user: authUser } = useAuth()
const currentUser = computed(() => authUser.value?.memberId || authUser.value?.coAccount || getLoginUsername())

// ---------- Tabs ----------
const activeTab = ref('definition')
function handleTabChange() {
  if (activeTab.value === 'definition') loadDefinitions()
  else if (activeTab.value === 'instance') loadInstances()
  else if (activeTab.value === 'todo') loadTodo()
  else if (activeTab.value === 'done') loadDone()
  else if (activeTab.value === 'cc') loadCc()
}

// ---------- 通用 ----------
const pageSize = ref(10)
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

// ---------- 流程绑定：组织 → 组织下的问题类型 ----------
const defOrgTree = ref<OrganizationNode[]>([])
const defIssueTypeOptions = ref<IssueTypeOption[]>([])
const defIssueTypeLoading = ref(false)
let defIssueTypeSeq = 0

async function loadDefOrgTree() {
  try {
    const res = await getOrganizationTree()
    if (res?.success) defOrgTree.value = res.data || []
  } catch {
    // 请求层已统一提示
  }
}

/** 拉取所选组织下启用的问题类型 */
async function loadDefIssueTypes(orgId?: number | string) {
  const seq = ++defIssueTypeSeq
  if (orgId == null || orgId === '') {
    defIssueTypeOptions.value = []
    return
  }
  defIssueTypeLoading.value = true
  try {
    const res = await queryIssueTypes({ page: 1, pageSize: 999, status: 1, organizationId: Number(orgId) })
    if (seq !== defIssueTypeSeq) return
    defIssueTypeOptions.value = res?.success ? (res.data?.list || []).map(toIssueTypeOption) : []
  } catch {
    if (seq === defIssueTypeSeq) defIssueTypeOptions.value = []
  } finally {
    if (seq === defIssueTypeSeq) defIssueTypeLoading.value = false
  }
}

/** 切换组织：重新加载问题类型，原选择不属于该组织则清空 */
async function handleDefOrgChange(orgId?: number | string) {
  await loadDefIssueTypes(orgId)
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
  { title: '所属组织', key: 'organization', width: 160, ellipsis: true },
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

const filteredDefs = computed(() => {
  const kw = defKeyword.value.trim().toLowerCase()
  if (!kw) return defList.value
  return defList.value.filter((d) => {
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

/** 列表模式一键展开 / 收起：seq 自增触发各层节点同步 */
const nodeExpandSignal = reactive({ open: false, seq: 0 })
function toggleAllNodes(open: boolean) {
  nodeExpandSignal.open = open
  nodeExpandSignal.seq++
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
  if (issueType == null || issueType === '') return
  // 流程绑定的是问题类型编码，状态接口需要数字 ID：先按编码换算，历史数据为数字 ID 时直接使用
  if (!findIssueTypeOption(issueType)) await loadAllIssueTypes()
  const id = findIssueTypeOption(issueType)?.id ?? Number(issueType)
  if (!id || Number.isNaN(id)) return
  try {
    const res = await queryIssueTypeStatuses(id)
    if (res?.success) flowStatusOptions.value = (res.data || []).map((s) => ({ value: String(s.id), label: s.statusName }))
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  }
}

/** 打开"流程设置"：拉取最新详情并只展示节点编辑区 */
async function openFlowSetting(record: WorkflowDefinition) {
  defMode.value = 'canvas'
  flowSettingModal.processName = record.processName || ''
  flowSettingModal.open = true
  nodeExpandSignal.open = false
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
    organizationId: record.organizationId,
    issueTypeId: record.issueTypeId ?? record.issueTypeName ?? undefined,
    issueTypeName: record.issueTypeName || issueTypeNameOf(record.issueTypeId),
    remark: record.remark || '',
    nodes: record.nodes?.length ? normalizeLegacyNodes(record.nodes).map((n) => cloneNode(n)) : [emptyNode()],
  }
  await Promise.all([loadFlowStatuses(record.issueTypeId), loadFlowPositions()])
  // 历史数据保存的是数字 ID：保存流程设置时统一提交编码
  const matchedType = findIssueTypeOption(defForm.value.issueTypeId)
  if (matchedType) defForm.value.issueTypeId = matchedType.value
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
      organizationId: f.organizationId,
      issueTypeId: String(f.issueTypeId),
      issueTypeName: f.issueTypeName || issueTypeNameOf(f.issueTypeId),
      remark: f.remark || '',
      nodes: f.nodes.filter(nodeValid).map((n) => sanitizeNode(n)),
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
const defMode = ref<'canvas' | 'list'>('canvas')
const flowCanvasRef = ref<InstanceType<typeof WorkflowFlowCanvas> | null>(null)

/** 画板 ↔ 列表切换：切回列表前先把画板内容应用到表单 */
function switchDefMode(mode: string | number) {
  if (mode === 'list' && defMode.value === 'canvas' && flowCanvasRef.value) {
    defForm.value.nodes = flowCanvasRef.value.exportNodes()
  }
  defMode.value = mode as 'canvas' | 'list'
}

/** 保存前若处于画板模式，先把画板内容应用到表单 */
function applyCanvasToForm() {
  if (defMode.value === 'canvas' && flowCanvasRef.value) {
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
  return { nodeId: genNodeId(), nodeName: '', assigneeType: 'CREATOR', assigneeValue: null, statusId: null }
}
function addNode() {
  defForm.value.nodes.push(emptyNode())
}
function insertNodeAfter(idx: number) {
  defForm.value.nodes.splice(idx + 1, 0, emptyNode())
}
function removeNode(idx: number) {
  defForm.value.nodes.splice(idx, 1)
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
    statusId: n.statusId?.trim() || null,
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
  defMode.value = 'canvas'
  if (!record) {
    defModal.isEdit = false
    defForm.value = { processKey: '', processName: '', organizationId: undefined, issueTypeId: undefined, issueTypeName: '', remark: '', nodes: [emptyNode()] }
    defIssueTypeOptions.value = []
    defModal.open = true
    loadDefOrgTree()
    return
  }
  defModal.isEdit = true
  defModal.open = true
  loadDefOrgTree()
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
    organizationId: record.organizationId,
    issueTypeId: record.issueTypeId != null ? String(record.issueTypeId) : undefined,
    issueTypeName: record.issueTypeName || issueTypeNameOf(record.issueTypeId),
    remark: record.remark || '',
    nodes: record.nodes?.length ? normalizeLegacyNodes(record.nodes).map((n) => cloneNode(n)) : [emptyNode()],
  }
  await loadDefIssueTypes(record.organizationId)
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
  if (f.organizationId == null) return message.warning('请选择所属组织')
  if (!f.issueTypeId) return message.warning('请选择绑定的问题类型')
  // 只保存流程基本信息（独立接口，不部署）；流程节点在"流程设置"中配置
  defSaving.value = true
  try {
    const res = await saveWorkflowDefinition({
      id: f.id,
      // 新增时由后端生成流程标识，编辑时原样回传
      processKey: defModal.isEdit ? f.processKey : undefined,
      processName: f.processName.trim(),
      organizationId: Number(f.organizationId),
      issueTypeId: String(f.issueTypeId),
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

// ==================== 实例监控 ====================
const insQuery = reactive({ status: '', initiator: '', issueKey: '' })
const insList = ref<WorkflowInstance[]>([])
const insLoading = ref(false)
const insPageNum = ref(1)
const insTotal = ref(0)

const insColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '单号', dataIndex: 'issueKey', key: 'issueKey' },
  { title: '流程名称', dataIndex: 'processName', key: 'processName' },
  { title: '当前节点', dataIndex: 'currentNodeName', key: 'currentNodeName' },
  { title: '发起人', dataIndex: 'initiator', key: 'initiator' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 160 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' },
]

function insStatusColor(s?: string) {
  return s === 'END' ? 'green' : s === 'CANCELED' ? 'red' : 'blue'
}
function insStatusText(s?: string) {
  return s === 'END' ? '已结束' : s === 'CANCELED' ? '已撤销' : '运行中'
}

async function loadInstances() {
  insLoading.value = true
  try {
    const res = await listWorkflowInstances({
      status: insQuery.status || undefined,
      initiator: insQuery.initiator.trim() || undefined,
      issueKey: insQuery.issueKey.trim() || undefined,
      pageNum: insPageNum.value,
      pageSize: pageSize.value,
    })
    const data = res.data
    insList.value = data?.list ?? []
    insTotal.value = data?.total ?? 0
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    insLoading.value = false
  }
}

// 发起工作流
const startModal = reactive<{ open: boolean }>({ open: false })
const startForm = reactive<{
  issueKey: string
  issueTypeId?: string
  processKey: string
  initiator: string
  ccUsers: string
}>({
  issueKey: '',
  issueTypeId: undefined,
  processKey: '',
  initiator: currentUser.value,
  ccUsers: '',
})
const startSaving = ref(false)

function openStartModal() {
  startForm.issueKey = ''
  startForm.issueTypeId = undefined
  startForm.processKey = ''
  startForm.initiator = currentUser.value
  startForm.ccUsers = ''
  startModal.open = true
  loadAllIssueTypes()
}

async function handleStartWorkflow() {
  if (!startForm.issueKey.trim()) return message.warning('请输入单号')
  if (!startForm.issueTypeId && !startForm.processKey.trim()) return message.warning('请选择问题类型或填写指定流程')
  startSaving.value = true
  try {
    const res = await startWorkflow({
      issueKey: startForm.issueKey.trim(),
      initiator: startForm.initiator.trim() || currentUser.value,
      issueTypeId: startForm.issueTypeId,
      processKey: startForm.processKey.trim() || undefined,
      ccUsers: startForm.ccUsers.trim()
        ? startForm.ccUsers
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    })
    if (res.success || res.data) {
      startModal.open = false
      loadInstances()
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    startSaving.value = false
  }
}

// 实例详情
const insDetail = reactive<{
  open: boolean
  data: Record<string, any> | null
  records: any[]
  /** 流程定义节点树（用于图形展示全部节点） */
  nodes: WorkflowNode[]
  /** 节点状态：nodeId → current(当前) / done(历史已完成) / pending(未开始) */
  nodeStates: Record<string, WfFlowNodeState>
}>({
  open: false,
  data: null,
  records: [],
  nodes: [],
  nodeStates: {},
})

/** 从实例详情中提取各节点运行状态（真实字段：nodeTraces + currentNodeId + histories，兼容常见字段名） */
function extractInsNodeStates(d: Record<string, any>): Record<string, WfFlowNodeState> {
  const map: Record<string, WfFlowNodeState> = {}
  // 1) 节点运行轨迹：真实字段 nodeTraces（每项含 nodeId/nodeName/status(PENDING|WAITING)），兼容其他字段名
  const traces =
    d.nodeTraces ??
    d.nodeStatusList ??
    d.nodeStatuses ??
    d.nodeTrajectory ??
    d.trajectory ??
    d.nodeList ??
    d.nodes ??
    []
  if (Array.isArray(traces)) {
    for (const n of traces) {
      const id = String(n.nodeId ?? n.nodeKey ?? n.name ?? '')
      if (!id || id === 'undefined') continue
      const st = String(n.status ?? n.nodeStatus ?? '').toUpperCase()
      const finished = n.finishTime || n.endTime || n.completedTime || n.finishedTime
      if (finished || ['DONE', 'COMPLETED', 'FINISHED', 'SUCCESS', 'APPROVED', 'PASSED', 'REJECTED', 'REJECT', 'END'].includes(st)) {
        map[id] = 'done'
      } else if (['RUNNING', 'ACTIVE', 'PROCESSING', 'HANDLING', 'IN_PROGRESS', 'TODO', 'CURRENT'].includes(st)) {
        map[id] = 'current'
      } else {
        // PENDING / WAITING / 未开始：先记为 pending，最后会被 currentNodeId / 审批记录覆盖
        map[id] = 'pending'
      }
    }
  }
  // 2) 审批记录（histories）中出现过的节点 → 历史已完成
  const records =
    d.histories ??
    d.records ??
    d.approvalRecords ??
    d.approvals ??
    d.auditRecords ??
    d.approveRecords ??
    d.taskList ??
    d.tasks ??
    d.nodeLogs ??
    d.approvalList ??
    []
  if (Array.isArray(records)) {
    for (const r of records) {
      const id = String(r.nodeId ?? r.nodeKey ?? r.taskNodeId ?? '')
      if (id && id !== 'undefined') map[id] = 'done'
    }
  }
  // 3) 当前节点：真实字段 currentNodeId（权威），兼容 currentNode
  const cur = d.currentNodeId ?? d.currentNode ?? d.currentNodeKey ?? ''
  if (cur) map[String(cur)] = 'current'
  return map
}

// 流程定义列表缓存（按 processKey 匹配实例对应的定义节点树）
let defListCache: WorkflowDefinition[] | null = null

/** 按 processKey 匹配流程定义，取出全部节点用于图形展示 */
async function loadInsDefinition(record: WorkflowInstance) {
  try {
    if (!defListCache) {
      const res = await listWorkflowDefinitions()
      defListCache = Array.isArray(res.data) ? res.data : null
    }
    const def = (defListCache ?? []).find((x) => x.processKey === record.processKey)
    const list = def?.nodes ?? []
    if (Array.isArray(list) && list.length) {
      insDetail.nodes = normalizeLegacyNodes(list).map((n) => cloneNode(n))
    }
    // 兜底：后端未返回节点状态列表时，至少把当前节点标为当前
    if (Object.keys(insDetail.nodeStates).length === 0) {
      const cur = (record as any).currentNodeId ?? record.currentNode ?? (insDetail.data as any)?.currentNodeId
      if (cur) insDetail.nodeStates[String(cur)] = 'current'
    }
  } catch {
    // 定义加载失败：仅展示"暂无流程节点图"
  }
}

async function openInsDetail(record: WorkflowInstance) {
  insDetail.data = record
  insDetail.records = []
  insDetail.nodes = []
  insDetail.nodeStates = {}
  insDetail.open = true
  try {
    const res = await getWorkflowInstance(Number(record.id))
    const d = res.data
    if (d && typeof d === 'object') {
      insDetail.data = { ...record, ...d }
      // 审批记录：真实字段 histories（如 审批人/操作/意见/时间），兼容常见返回字段名
      const list =
        d.histories ??
        d.records ??
        d.approvalRecords ??
        d.approvals ??
        d.auditRecords ??
        d.approveRecords ??
        d.taskList ??
        d.tasks ??
        d.nodeLogs ??
        d.approvalList ??
        []
      insDetail.records = Array.isArray(list) ? list : []
      insDetail.nodeStates = extractInsNodeStates(d)
      // 真实接口 data.nodes 即为完整节点树（含 nodeId/nodeName/nextNodes/backToNodeIds），直接渲染
      const nd = d.nodes ?? d.nodeTree ?? d.definitionNodes ?? []
      if (Array.isArray(nd) && nd.length) {
        insDetail.nodes = normalizeLegacyNodes(nd).map((n) => cloneNode(n))
      }
    }
  } catch {
    // 详情加载失败时仍展示列表基础信息
  }
  // 兜底：详情未返回完整节点树时，按 processKey 拉流程定义节点
  if (!insDetail.nodes.length) await loadInsDefinition(record)
}

/** 核心描述区字段：真实接口字段优先，兼容列表记录字段 */
const insCore = computed(() => {
  const d = (insDetail.data ?? {}) as Record<string, any>
  const curId = String(d.currentNodeId ?? '')
  let curName = d.currentNodeName ?? d.currentNode ?? ''
  // currentNodeId 是节点 id（如 n1），从完整节点树解析出节点名称展示
  if (curId && (!curName || curName === curId)) {
    const flat: WorkflowNode[] = []
    const walk = (list: WorkflowNode[]) => {
      for (const n of list) {
        flat.push(n)
        if (n.nextNodes?.length) walk(n.nextNodes)
      }
    }
    walk(insDetail.nodes)
    curName = flat.find((n) => n.nodeId === curId)?.nodeName ?? curId
  }
  return {
    instanceId: d.instanceId ?? d.id ?? '-',
    issueKey: d.issueKey ?? '-',
    processName: d.processName ?? d.processDefinitionName ?? '-',
    status: d.status ?? '-',
    initiator: d.initiator ?? d.creatorName ?? d.creator ?? '-',
    startTime: d.startTime ?? d.createTime ?? '',
    endTime: d.endTime ?? '',
    currentNode: curName,
    issueSummary: d.issueSummary ?? '',
  }
})

/** 已在上方核心描述区展示的字段，明细区不再重复 */
const INS_CORE_FIELDS = new Set([
  'id',
  'instanceId',
  'issueId',
  'issueKey',
  'issueSummary',
  'processKey',
  'processName',
  'processDefinitionId',
  'processDefinitionName',
  'status',
  'initiator',
  'creatorName',
  'creator',
  'createTime',
  'startTime',
  'endTime',
  'currentNodeId',
  'currentNode',
  'currentNodeName',
  'result',
])

/** 接口返回 data 中未归类展示的全部字段（标量直接展示，数组/对象折叠 JSON 兜底） */
const insExtraFields = computed(() => {
  const d = insDetail.data ?? {}
  const out: { key: string; label: string; text: string; span: number; isSimple: boolean }[] = []
  for (const [k, v] of Object.entries(d)) {
    if (INS_CORE_FIELDS.has(k)) continue
    // 节点树 / 节点轨迹已通过流程图与状态着色展示，不重复展示
    if (k === 'nodes' || k === 'nodeTree' || k === 'nodeTraces') continue
    // 已在专门区块展示的大数组不重复展示
    if (Array.isArray(v) && insDetail.records === v) continue
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v) || typeof v === 'object') {
      let json = ''
      try {
        json = JSON.stringify(v, null, 2)
      } catch {
        json = String(v)
      }
      out.push({ key: k, label: k, text: json, span: 2, isSimple: false })
    } else {
      out.push({ key: k, label: k, text: String(v), span: 1, isSimple: true })
    }
  }
  return out
})

async function handleCancelIns(record: WorkflowInstance) {
  try {
    const res = await cancelWorkflowInstance(Number(record.id), currentUser.value)
    if (res.success || res.data !== undefined) {
      loadInstances()
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  }
}

// ==================== 我的待办 ====================
const todoList = ref<WorkflowTask[]>([])
const todoLoading = ref(false)
const todoPageNum = ref(1)
const todoTotal = ref(0)

const todoColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '单号', dataIndex: 'issueKey', key: 'issueKey' },
  { title: '流程名称', dataIndex: 'processName', key: 'processName' },
  { title: '当前节点', dataIndex: 'nodeName', key: 'nodeName' },
  { title: '发起人', dataIndex: 'initiator', key: 'initiator' },
  { title: '接收时间', dataIndex: 'createTime', key: 'createTime', width: 160 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' },
]

async function loadTodo() {
  todoLoading.value = true
  try {
    const res = await listWorkflowTodo({ userNo: currentUser.value, pageNum: todoPageNum.value, pageSize: pageSize.value })
    const data = res.data
    todoList.value = data?.list ?? []
    todoTotal.value = data?.total ?? 0
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    todoLoading.value = false
  }
}

// 审批
const approveModal = reactive<{ open: boolean; action: 'APPROVE' | 'REJECT'; task: WorkflowTask | null }>({
  open: false,
  action: 'APPROVE',
  task: null,
})
const approveComment = ref('')
const approveSaving = ref(false)

function openApproveModal(task: WorkflowTask, action: 'APPROVE' | 'REJECT') {
  approveModal.task = task
  approveModal.action = action
  approveComment.value = ''
  approveModal.open = true
}

async function handleApprove() {
  const task = approveModal.task
  if (!task) return
  approveSaving.value = true
  try {
    const payload = { taskId: Number(task.id), operator: currentUser.value, comment: approveComment.value.trim() || undefined }
    const res = approveModal.action === 'APPROVE' ? await approveWorkflowTask(payload) : await rejectWorkflowTask(payload)
    if (res.success || res.data !== undefined) {
      approveModal.open = false
      loadTodo()
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    approveSaving.value = false
  }
}

// 转办
const transferModal = reactive<{ open: boolean; task: WorkflowTask | null }>({ open: false, task: null })
const transferAssignee = ref('')
const transferSaving = ref(false)

function openTransferModal(task: WorkflowTask) {
  transferModal.task = task
  transferAssignee.value = ''
  transferModal.open = true
}

async function handleTransfer() {
  const task = transferModal.task
  if (!task) return
  if (!transferAssignee.value.trim()) return message.warning('请输入转办目标用户账号')
  transferSaving.value = true
  try {
    const res = await transferWorkflowTask({
      taskId: Number(task.id),
      operator: currentUser.value,
      assignee: transferAssignee.value.trim(),
    })
    if (res.success || res.data !== undefined) {
      transferModal.open = false
      loadTodo()
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    transferSaving.value = false
  }
}

// ==================== 我的已办 ====================
const doneList = ref<WorkflowTask[]>([])
const doneLoading = ref(false)
const donePageNum = ref(1)
const doneTotal = ref(0)

const doneColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '单号', dataIndex: 'issueKey', key: 'issueKey' },
  { title: '流程名称', dataIndex: 'processName', key: 'processName' },
  { title: '节点', dataIndex: 'nodeName', key: 'nodeName' },
  { title: '发起人', dataIndex: 'initiator', key: 'initiator' },
  { title: '处理结果', dataIndex: 'action', key: 'action', width: 110 },
  { title: '处理时间', dataIndex: 'finishTime', key: 'finishTime', width: 160 },
]

function taskActionColor(a?: string) {
  return a === 'APPROVE' ? 'green' : a === 'REJECT' ? 'red' : a === 'TRANSFER' ? 'orange' : 'default'
}
function taskActionText(a?: string) {
  return a === 'APPROVE' ? '通过' : a === 'REJECT' ? '驳回' : a === 'TRANSFER' ? '转办' : a || '-'
}

async function loadDone() {
  doneLoading.value = true
  try {
    const res = await listWorkflowDone({ userNo: currentUser.value, pageNum: donePageNum.value, pageSize: pageSize.value })
    const data = res.data
    doneList.value = data?.list ?? []
    doneTotal.value = data?.total ?? 0
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    doneLoading.value = false
  }
}

// ==================== 我的抄送 ====================
const ccList = ref<WorkflowCc[]>([])
const ccLoading = ref(false)
const ccPageNum = ref(1)
const ccTotal = ref(0)

const ccColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
  { title: '单号', dataIndex: 'issueKey', key: 'issueKey' },
  { title: '流程名称', dataIndex: 'processName', key: 'processName' },
  { title: '发起人', dataIndex: 'initiator', key: 'initiator' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '抄送时间', dataIndex: 'createTime', key: 'createTime', width: 160 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
]

async function loadCc() {
  ccLoading.value = true
  try {
    const res = await listWorkflowCc({ userNo: currentUser.value, pageNum: ccPageNum.value, pageSize: pageSize.value })
    const data = res.data
    ccList.value = data?.list ?? []
    ccTotal.value = data?.total ?? 0
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  } finally {
    ccLoading.value = false
  }
}

async function markRead(record: WorkflowCc) {
  try {
    const res = await markWorkflowCcRead(Number(record.id))
    if (res.success || res.data !== undefined) {
      loadCc()
    }
  } catch {
    // 错误提示由请求拦截器统一展示后端 message
  }
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

/* ---- pagination ---- */
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding-top: 24px;
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
.node-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
  padding: 12px;
  background: #f7f8fa;
  border: 1px solid #ececf2;
  border-radius: 12px;
}
.node-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.node-item {
  border-radius: 8px;
}
.node-key {
  width: 130px;
}
.node-name {
  width: 130px;
}
.node-type {
  width: 110px;
}
.node-value {
  width: 130px;
}
.node-list-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #ececf2;
  border-radius: 10px;
}
.node-list-summary {
  font-size: 13px;
  font-weight: 500;
  color: #262626;
}
.node-list-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  margin-left: 12px;
  font-size: 12px;
  color: #8c8c8c;
}
.legend-bar {
  width: 3px;
  height: 12px;
  margin-left: 6px;
  background: #722ed1;
  border-radius: 2px;
}
.legend-bar.is-empty {
  background: #faad14;
}
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

/* ---- approve modal ---- */
.approve-tip {
  color: #6e6e73;
  font-size: 14px;
  margin-bottom: 12px;
}
.approve-tip b {
  color: #1d1d1f;
}

/* ---- instance detail ---- */
.ins-desc {
  margin-bottom: 20px;
}
.ins-flow-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}
.ins-legend {
  display: inline-flex;
  gap: 6px;
  font-weight: 400;
}
.ins-flow-viewer {
  margin-bottom: 4px;
}
.ins-records-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 12px;
}
.ins-extra {
  margin-top: 14px;
}
.ins-extra :deep(.ant-collapse-header) {
  padding: 8px 4px !important;
  font-weight: 600;
  color: #1d1d1f;
}
.ins-json {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 8px 10px;
  white-space: pre-wrap;
  word-break: break-all;
}
.ins-records {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ins-record-item {
  background: #f9f9fb;
  border-radius: 10px;
  padding: 10px 14px;
}
.ins-record-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ins-record-op {
  font-weight: 600;
  color: #1d1d1f;
}
.ins-record-time {
  margin-left: auto;
  font-size: 12px;
  color: #86868b;
}
.ins-record-comment {
  margin-top: 6px;
  font-size: 13px;
  color: #6e6e73;
}
</style>
