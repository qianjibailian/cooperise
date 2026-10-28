<template>
  <div class="org-page">
    <!-- 页头 -->
    <header class="org-header">
      <h2 class="org-title">组织管理</h2>
      <a-button type="primary" class="org-create-btn" @click="openCreate(null)">
        <PlusOutlined /> 新增
      </a-button>
    </header>

    <!-- 统计 -->
    <div class="org-stats">
      <div v-for="st in stats" :key="st.label" class="org-stat">
        <span :class="['org-stat-dot', st.cls]" />
        <span class="org-stat-label">{{ st.label }}</span>
        <span class="org-stat-value">{{ st.value }}</span>
      </div>
    </div>

    <section class="org-card">
      <!-- 工具栏 -->
      <div class="org-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索组织名称 / 编码"
          allow-clear
          class="org-search"
        >
          <template #prefix><SearchOutlined class="org-search-icon" /></template>
        </a-input>
        <span v-if="keyword.trim()" class="org-drag-tip">搜索时不可拖动排序</span>
        <span v-else-if="treeData.length" class="org-drag-tip">按住 <HolderOutlined /> 上下拖动调整同级顺序</span>
        <button class="org-ghost-btn" :disabled="!treeData.length" @click="toggleExpandAll">
          <component :is="allExpanded ? ShrinkOutlined : ArrowsAltOutlined" />
          {{ allExpanded ? '全部收起' : '全部展开' }}
        </button>
      </div>

      <a-spin :spinning="loading">
        <div v-if="!loading && !filteredTree.length" class="org-empty">
          <div class="org-empty-icon"><component :is="keyword ? ApartmentOutlined : BankOutlined" /></div>
          <div class="org-empty-title">{{ keyword ? '没有匹配的组织' : '还没有公司' }}</div>
          <div class="org-empty-desc">{{ keyword ? '换个关键词试试' : '请先新增公司，再在公司下添加部门' }}</div>
          <a-button v-if="!keyword" type="primary" @click="openCreate(null)"><PlusOutlined /> 新增公司</a-button>
        </div>
        <!-- 捕获阶段拦截：只有按住六点手柄才能开始拖动 -->
        <div v-else class="org-tree-wrap" @mousedown.capture="onTreeMouseDown" @dragstart.capture="onTreeDragStart">
        <a-tree
          v-model:expandedKeys="expandedKeys"
          :tree-data="filteredTree"
          :field-names="{ key: 'id', title: 'organizationName', children: 'children' }"
          block-node
          :selectable="false"
          :draggable="dragEnabled"
          :allow-drop="allowDrop"
          class="org-tree"
          :class="{ 'is-sorting': sorting }"
          @drop="handleDrop"
        >
          <template #switcherIcon="{ expanded }">
            <RightOutlined :class="['org-switcher', { expanded }]" />
          </template>
          <template #title="node">
            <div class="org-node" :class="{ 'is-disabled': node.status === 0 }">
              <a-tooltip v-if="dragEnabled" title="按住拖动排序" :mouse-enter-delay="0.6">
                <HolderOutlined class="org-drag-handle" />
              </a-tooltip>
              <span
                :class="['org-node-avatar', { 'is-company': isCompanyNode(node) }]"
                :style="{ background: levelColor(node.orgLevel ?? String(node.pos ?? '0-0').split('-').length - 1) }"
              >
                <BankOutlined v-if="isCompanyNode(node)" />
                <template v-else>{{ (node.organizationName || '组').slice(0, 1) }}</template>
              </span>
              <a-tooltip :title="node.pathName || node.organizationName" placement="topLeft" :mouse-enter-delay="0.4">
                <span class="org-node-name">{{ node.organizationName }}</span>
              </a-tooltip>
              <span v-if="isCompanyNode(node)" class="org-node-company">公司</span>
              <span v-if="node.organizationCode" class="org-node-code">{{ node.organizationCode }}</span>
              <span v-if="node.status === 0" class="org-node-badge">已停用</span>
              <span v-if="node.children?.length" class="org-node-count">{{ node.children.length }} 个子组织</span>
              <span class="org-node-actions" @click.stop>
                <a-tooltip :title="canAddChild(node) ? (isCompanyNode(node) ? '新增部门' : '新增子组织') : `最多 ${MAX_LEVEL} 层（含公司）`">
                  <span
                    :class="['org-action', { disabled: !canAddChild(node) }]"
                    @click="canAddChild(node) && openCreate(node)"
                  ><PlusOutlined /></span>
                </a-tooltip>
                <a-tooltip title="编辑">
                  <span class="org-action" @click="openEdit(node)"><EditOutlined /></span>
                </a-tooltip>
                <a-tooltip :title="node.children?.length ? '请先删除子组织' : '删除'">
                  <span
                    :class="['org-action', 'danger', { disabled: node.children?.length }]"
                    @click="!node.children?.length && confirmDelete(node)"
                  ><DeleteOutlined /></span>
                </a-tooltip>
              </span>
            </div>
          </template>
        </a-tree>
        </div>
      </a-spin>
    </section>

    <!-- 新建 / 编辑弹窗 -->
    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :width="480"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="org-form">
        <a-form-item v-if="!isCompanyForm" label="上级组织" name="parentId">
          <a-tree-select
            v-model:value="form.parentId"
            :tree-data="parentOptions"
            :field-names="{ label: 'organizationName', value: 'id', children: 'children' }"
            tree-default-expand-all
            show-search
            tree-node-filter-prop="organizationName"
            placeholder="选择上级组织"
          />
        </a-form-item>
        <a-form-item :label="isCompanyForm ? '公司名称' : '组织名称'" name="organizationName">
          <a-input
            v-model:value="form.organizationName"
            :placeholder="isCompanyForm ? '请输入公司名称' : '请输入组织名称'"
            :maxlength="64"
          />
        </a-form-item>
        <a-form-item :label="isCompanyForm ? '公司编码' : '组织编码'" name="organizationCode">
          <a-input v-model:value="form.organizationCode" placeholder="业务唯一编码，如 Jira 部门 ID" :maxlength="64" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-switch v-model:checked="statusChecked" checked-children="启用" un-checked-children="停用" />
        </a-form-item>
        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="form.remark" placeholder="选填" :rows="2" :maxlength="200" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { AntTreeNodeDropEvent } from 'ant-design-vue/es/tree'
import {
  SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined, BankOutlined,
  RightOutlined, ArrowsAltOutlined, ShrinkOutlined, HolderOutlined,
} from '@ant-design/icons-vue'
import {
  getOrganizationTree, createOrganization, updateOrganization, deleteOrganization,
  type OrganizationNode, type OrganizationSaveParams,
} from '@/api/faiz'

/** 顶级组织的 parentId */
const ROOT_ID = 0

const loading = ref(false)
const treeData = ref<OrganizationNode[]>([])
const expandedKeys = ref<number[]>([])
const keyword = ref('')

/** 遍历组织树 */
function walk(nodes: OrganizationNode[], fn: (n: OrganizationNode) => void) {
  nodes.forEach((n) => { fn(n); if (n.children?.length) walk(n.children, fn) })
}

/** 组织最多层级（公司算第 1 层） */
const MAX_LEVEL = 4

/** 各节点所在层级（按树结构计算，公司 = 1） */
const levelMap = computed(() => {
  const map = new Map<number, number>()
  const visit = (nodes: OrganizationNode[], level: number) => nodes.forEach((n) => {
    map.set(n.id, level)
    if (n.children?.length) visit(n.children, level + 1)
  })
  visit(treeData.value, 1)
  return map
})

/** 子树高度（自身算 1 层） */
function subtreeHeight(node: OrganizationNode): number {
  return 1 + Math.max(0, ...(node.children || []).map(subtreeHeight))
}

function canAddChild(node: { id: number }) {
  return (levelMap.value.get(node.id) ?? MAX_LEVEL) < MAX_LEVEL
}

const allIds = computed(() => {
  const ids: number[] = []
  walk(treeData.value, n => ids.push(n.id))
  return ids
})
const totalCount = computed(() => allIds.value.length)

/** 顶部统计：总数 / 启用 / 停用 / 层级 */
const stats = computed(() => {
  let enabled = 0
  let disabled = 0
  let maxLevel = 0
  const visit = (nodes: OrganizationNode[], level: number) => nodes.forEach((n) => {
    if (n.status === 0) disabled++
    else enabled++
    maxLevel = Math.max(maxLevel, level)
    if (n.children?.length) visit(n.children, level + 1)
  })
  visit(treeData.value, 1)
  return [
    { label: '公司', value: treeData.value.length, cls: 'dot-blue' },
    { label: '组织总数', value: totalCount.value, cls: 'dot-teal' },
    { label: '启用', value: enabled, cls: 'dot-green' },
    { label: '停用', value: disabled, cls: 'dot-gray' },
    { label: '层级', value: maxLevel, cls: 'dot-purple' },
  ]
})

/** 按层级区分头像底色（Apple 系统色） */
const LEVEL_COLORS = ['#0A84FF', '#5E5CE6', '#30B0C7', '#34C759', '#FF9F0A', '#FF375F']
function levelColor(level?: number) {
  return LEVEL_COLORS[(Math.max(level ?? 1, 1) - 1) % LEVEL_COLORS.length]
}
/** 有子节点的组织（展开 / 收起只关心这些） */
const parentIds = computed(() => {
  const ids: number[] = []
  walk(treeData.value, (n) => { if (n.children?.length) ids.push(n.id) })
  return ids
})
const allExpanded = computed(() => parentIds.value.length > 0 && parentIds.value.every(id => expandedKeys.value.includes(id)))

function toggleExpandAll() {
  expandedKeys.value = allExpanded.value ? [] : [...parentIds.value]
}

/** 按关键字过滤：命中节点保留其祖先链；命中节点的子树完整保留 */
const filteredTree = computed<OrganizationNode[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return treeData.value
  const match = (n: OrganizationNode) =>
    `${n.organizationName ?? ''} ${n.organizationCode ?? ''}`.toLowerCase().includes(kw)
  const filter = (nodes: OrganizationNode[]): OrganizationNode[] =>
    nodes.reduce<OrganizationNode[]>((acc, n) => {
      if (match(n)) {
        acc.push(n)
      } else {
        const children = filter(n.children || [])
        if (children.length) acc.push({ ...n, children })
      }
      return acc
    }, [])
  return filter(treeData.value)
})

async function loadTree() {
  loading.value = true
  try {
    const res = await getOrganizationTree()
    if (res?.success) {
      treeData.value = res.data || []
      // 首次加载默认展开顶级组织
      if (!expandedKeys.value.length) expandedKeys.value = treeData.value.filter(n => n.children?.length).map(n => n.id)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

// ---- 拖动排序 ----
/** 搜索过滤时树不完整，禁止拖动 */
const dragEnabled = computed(() => !keyword.value.trim())
const sorting = ref(false)

/** 只允许同级之间上下排序：不能放入其他组织内部，也不能跨层级 */
function allowDrop({ dropNode, dragNode, dropPosition }: { dropNode: any; dragNode: any; dropPosition: number }) {
  if (sorting.value || dropPosition === 0) return false
  return (dropNode?.parentId ?? ROOT_ID) === (dragNode?.parentId ?? ROOT_ID)
}

/** 本次按下是否落在六点手柄上 */
let pressedOnHandle = false
function onTreeMouseDown(e: MouseEvent) {
  pressedOnHandle = !!(e.target as HTMLElement | null)?.closest('.org-drag-handle')
}
/** 非手柄处按下时取消拖动（在捕获阶段拦截，antd 内部收不到 dragstart） */
function onTreeDragStart(e: DragEvent) {
  if (pressedOnHandle) return
  e.preventDefault()
  e.stopPropagation()
}

/** 在树中找到节点所在的兄弟数组与下标 */
function locate(nodes: OrganizationNode[], id: number, parentId = ROOT_ID): { list: OrganizationNode[]; index: number; parentId: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { list: nodes, index: i, parentId }
    const found = locate(nodes[i].children || [], id, nodes[i].id)
    if (found) return found
  }
  return null
}

async function handleDrop(info: AntTreeNodeDropEvent) {
  const dragId = Number(info.dragNode.key)
  const dropId = Number(info.node.key)
  const dropPos = String(info.node.pos).split('-')
  // -1：放在目标上方；1：放在目标下方；0：放入目标内部
  const relative = info.dropPosition - Number(dropPos[dropPos.length - 1])

  const tree: OrganizationNode[] = JSON.parse(JSON.stringify(treeData.value))
  const from = locate(tree, dragId)
  if (!from) return
  const [dragNode] = from.list.splice(from.index, 1)

  let targetList: OrganizationNode[]
  let targetParentId: number
  const dropNode = locate(tree, dropId)
  if (!dropNode) return
  const dropItem = dropNode.list[dropNode.index]
  const intoNode = !info.dropToGap
  if (intoNode) {
    // 放入目标内部：作为第一个子组织
    dropItem.children = dropItem.children || []
    dropItem.children.unshift(dragNode)
    targetList = dropItem.children
    targetParentId = dropItem.id
  } else {
    dropNode.list.splice(relative === -1 ? dropNode.index : dropNode.index + 1, 0, dragNode)
    targetList = dropNode.list
    targetParentId = dropNode.parentId
  }

  // 目标层级按新顺序重排 sort，只提交有变化的节点
  const changes: OrganizationSaveParams[] = []
  targetList.forEach((n, i) => {
    const sort = i + 1
    const moved = n.id === dragId && targetParentId !== from.parentId
    if (n.sort !== sort || moved) {
      changes.push({ id: n.id, parentId: n.id === dragId ? targetParentId : n.parentId, sort } as OrganizationSaveParams)
    }
    n.sort = sort
    if (n.id === dragId) n.parentId = targetParentId
  })
  if (!changes.length) return

  // 先乐观更新，失败再以服务端数据为准
  const snapshot = treeData.value
  treeData.value = tree
  if (intoNode && !expandedKeys.value.includes(dropId)) expandedKeys.value = [...expandedKeys.value, dropId]
  sorting.value = true
  try {
    // 先提交被拖动节点（可能涉及换父级），再提交其余兄弟的排序
    changes.sort((a, b) => (a.id === dragId ? -1 : b.id === dragId ? 1 : 0))
    for (const c of changes) {
      const res = await updateOrganization(c)
      if (!res?.success) throw new Error('update failed')
    }
  } catch {
    treeData.value = snapshot
  } finally {
    sorting.value = false
    loadTree()
  }
}

// ---- 新建 / 编辑 ----
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<Required<Omit<OrganizationSaveParams, 'id'>>>({
  parentId: ROOT_ID,
  organizationName: '',
  organizationCode: '',
  sort: 0,
  status: 1,
  remark: '',
})
const statusChecked = computed({
  get: () => form.status === 1,
  set: (v: boolean) => { form.status = v ? 1 : 0 },
})

/** 顶级组织即公司 */
function isCompanyNode(node: { parentId?: number | null }) {
  return (node.parentId ?? ROOT_ID) === ROOT_ID
}

/** 当前弹窗是否在新增 / 编辑公司（公司固定为顶级，不选上级） */
const isCompanyForm = ref(false)
const modalTitle = computed(() => {
  const target = isCompanyForm.value ? '公司' : '组织'
  return editingId.value ? `编辑${target}` : `新增${target}`
})

const rules = computed<Record<string, Rule[]>>(() => ({
  parentId: isCompanyForm.value ? [] : [{
    validator: async (_r, v: number) => {
      if (!v || v === ROOT_ID) throw new Error('请选择所属公司或上级组织')
    },
  }],
  organizationName: [{ required: true, whitespace: true, message: isCompanyForm.value ? '请输入公司名称' : '请输入组织名称' }],
}))

/** 上级组织候选：公司及其下属组织（部门必须挂在某个公司下）；编辑时排除自身及其子孙，避免成环 */
const parentOptions = computed(() => {
  // 挂到某上级后整棵子树不能超过最大层级：新增时高度为 1，编辑时取被编辑组织的子树高度
  const editing = editingId.value != null ? locate(treeData.value, editingId.value) : null
  const height = editing ? subtreeHeight(editing.list[editing.index]) : 1
  const strip = (nodes: OrganizationNode[]): (OrganizationNode & { disabled?: boolean })[] =>
    nodes
      .filter(n => n.id !== editingId.value)
      .map(n => ({
        ...n,
        disabled: (levelMap.value.get(n.id) ?? MAX_LEVEL) + height > MAX_LEVEL,
        children: strip(n.children || []),
      }))
  return strip(treeData.value)
})

function openCreate(parent: OrganizationNode | null) {
  editingId.value = null
  isCompanyForm.value = !parent
  Object.assign(form, {
    parentId: parent?.id ?? ROOT_ID,
    organizationName: '',
    organizationCode: '',
    sort: 0,
    status: 1,
    remark: '',
  })
  modalOpen.value = true
}

function openEdit(node: OrganizationNode) {
  editingId.value = node.id
  isCompanyForm.value = isCompanyNode(node)
  Object.assign(form, {
    parentId: node.parentId ?? ROOT_ID,
    organizationName: node.organizationName ?? '',
    organizationCode: node.organizationCode ?? '',
    sort: node.sort ?? 0,
    status: node.status ?? 1,
    remark: node.remark ?? '',
  })
  modalOpen.value = true
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload: OrganizationSaveParams = {
      ...form,
      organizationName: form.organizationName.trim(),
      organizationCode: form.organizationCode.trim() || undefined,
      remark: form.remark.trim() || undefined,
    }
    // 排序由拖动维护：新增时排到同级最后，编辑时保留原排序
    if (!editingId.value) {
      const parent = payload.parentId === ROOT_ID ? null : locate(treeData.value, payload.parentId)
      const siblings = parent ? parent.list[parent.index].children || [] : treeData.value
      payload.sort = siblings.reduce((max, n) => Math.max(max, n.sort ?? 0), 0) + 1
    }
    const res = editingId.value
      ? await updateOrganization({ ...payload, id: editingId.value })
      : await createOrganization(payload)
    if (res?.success) {
      modalOpen.value = false
      // 新建子组织后展开其上级，便于看到新节点
      if (payload.parentId !== ROOT_ID && !expandedKeys.value.includes(payload.parentId)) {
        expandedKeys.value = [...expandedKeys.value, payload.parentId]
      }
      loadTree()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---- 删除 ----
function confirmDelete(node: OrganizationNode) {
  Modal.confirm({
    title: `删除组织「${node.organizationName}」？`,
    content: '删除后无法恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteOrganization(node.id)
        if (res?.success) loadTree()
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

onMounted(loadTree)
</script>

<style scoped>
.org-page {
  padding: 20px 24px 32px;
}

/* ---- 页头 ---- */
.org-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.org-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
}

.org-create-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(10, 132, 255, 0.24);
}

/* ---- 统计 ---- */
.org-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.org-stat {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 999px;
  font-size: 13px;
}

.org-stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dot-blue { background: #0a84ff; }
.dot-green { background: #34c759; }
.dot-gray { background: #c7c7cc; }
.dot-purple { background: #5e5ce6; }
.dot-teal { background: #30b0c7; }

.org-stat-label {
  color: #86868b;
}

.org-stat-value {
  font-weight: 600;
  color: #1d1d1f;
  font-variant-numeric: tabular-nums;
}

/* ---- 卡片 / 工具栏 ---- */
.org-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 16px 12px 12px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.org-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 12px;
  margin-bottom: 8px;
  border-bottom: 1px solid #f2f2f5;
}

.org-search {
  width: 280px;
  height: 34px;
  border-radius: 10px;
  background: #f5f5f7;
  border-color: transparent;
}

.org-search:hover,
.org-search:focus-within {
  background: #fff;
  border-color: #d2d2d7;
}

.org-search :deep(.ant-input) {
  background: transparent;
}

.org-search-icon {
  color: #aeaeb2;
}

.org-ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  font-size: 13px;
  color: #3a3a3c;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.org-ghost-btn:hover:not(:disabled) {
  background: #f2f2f5;
}

.org-ghost-btn:disabled {
  color: #c7c7cc;
  cursor: not-allowed;
}

/* ---- 树 ---- */
.org-tree {
  background: transparent;
}

.org-tree :deep(.ant-tree-treenode) {
  width: 100%;
  padding: 0;
  margin-bottom: 2px;
  border-radius: 10px;
  transition: background 0.15s;
}

.org-tree :deep(.ant-tree-treenode:hover) {
  background: #f5f7fa;
}

.org-tree :deep(.ant-tree-node-content-wrapper) {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0 8px 0 4px;
  background: transparent !important;
}

.org-tree :deep(.ant-tree-title) {
  display: block;
  min-width: 0;
}

.org-tree :deep(.ant-tree-indent-unit) {
  width: 20px;
}

.org-tree :deep(.ant-tree-switcher) {
  width: 28px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.org-tree :deep(.ant-tree-switcher-noop) {
  visibility: hidden;
}

.org-switcher {
  font-size: 10px !important;
  color: #8e8e93;
  transition: transform 0.2s ease;
}

.org-switcher.expanded {
  transform: rotate(90deg);
}

.org-node {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  height: 44px;
}

.org-drag-handle {
  flex-shrink: 0;
  width: 18px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: -4px;
  font-size: 14px;
  color: #c7c7cc;
  border-radius: 6px;
  cursor: grab;
  transition: color 0.15s, background 0.15s;
}

.org-tree :deep(.ant-tree-treenode:hover) .org-drag-handle {
  color: #8e8e93;
}

.org-drag-handle:hover {
  color: #3a3a3c !important;
  background: #e9e9ee;
}

.org-drag-handle:active {
  cursor: grabbing;
}

/* 整行可拖但只能从手柄发起，其余区域保持普通指针 */
.org-tree :deep(.ant-tree-treenode-draggable) {
  cursor: default;
}

.org-tree.is-sorting {
  pointer-events: none;
  opacity: 0.7;
}

/* 拖动中的落点指示线 / 放入目标高亮 */
.org-tree :deep(.ant-tree-drop-indicator) {
  height: 2px;
  background: #0a84ff;
  border-radius: 1px;
}

.org-tree :deep(.ant-tree-drop-indicator::after) {
  border-color: #0a84ff;
}

.org-tree :deep(.ant-tree-treenode.dragging) {
  opacity: 0.5;
}

.org-tree :deep(.ant-tree-treenode.dragging::after) {
  display: none;
}

.org-drag-tip {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #aeaeb2;
}

.org-node-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.org-node-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

.org-node-code {
  flex-shrink: 0;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 6px;
}

.org-node-company {
  flex-shrink: 0;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #0a84ff;
  background: #eef5ff;
  border-radius: 999px;
}

.org-node-badge {
  flex-shrink: 0;
  padding: 1px 8px;
  font-size: 11px;
  color: #8e8e93;
  background: #f2f2f5;
  border-radius: 999px;
}

.org-node-count {
  flex-shrink: 0;
  font-size: 12px;
  color: #aeaeb2;
}

.org-node.is-disabled .org-node-avatar {
  background: #c7c7cc !important;
}

.org-node.is-disabled .org-node-name {
  color: #aeaeb2;
}

.org-node-actions {
  margin-left: auto;
  padding-left: 12px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.org-action {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 14px;
  color: #aeaeb2;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.org-tree :deep(.ant-tree-treenode:hover) .org-action {
  color: #6e6e73;
}

.org-tree :deep(.ant-tree-treenode:hover) .org-action.danger {
  color: #ff453a;
}

.org-action:hover {
  color: #1d1d1f !important;
  background: #e9e9ee;
}

.org-action.danger:hover {
  color: #ff3b30 !important;
  background: rgba(255, 59, 48, 0.1);
}

.org-action.disabled,
.org-action.disabled:hover,
.org-tree :deep(.ant-tree-treenode:hover) .org-action.disabled {
  color: #d1d1d6 !important;
  background: transparent;
  cursor: not-allowed;
}

/* ---- 空状态 ---- */
.org-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 16px;
  text-align: center;
}

.org-empty-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  font-size: 26px;
  color: #0a84ff;
  background: #eef5ff;
  border-radius: 16px;
}

.org-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.org-empty-desc {
  margin: 4px 0 16px;
  font-size: 13px;
  color: #86868b;
}

@media (max-width: 768px) {
  .org-page {
    padding: 16px;
  }

  .org-header {
    flex-direction: column;
    align-items: stretch;
  }

  .org-search {
    flex: 1;
    width: auto;
  }

  .org-node-code,
  .org-node-count {
    display: none;
  }
}
</style>
