<template>
  <div class="ipc">
    <a-spin :spinning="loading && !loaded" size="small">
      <!-- ========== 父工单 ========== -->
      <section class="ipc-group">
        <header class="ipc-head">
          <span class="ipc-label">父工单</span>
          <div v-if="!pickingParent && !relations.parent" class="ipc-actions">
            <button type="button" class="ipc-btn" @click="startPickParent"><PlusOutlined /><span>设置</span></button>
          </div>
          <div v-if="!pickingParent && relations.parent" class="ipc-actions">
            <button type="button" class="ipc-btn" @click="startPickParent"><SwapOutlined /><span>更换</span></button>
            <a-popconfirm title="解除与父工单的关系？" ok-text="解除" cancel-text="取消" @confirm="removeParent">
              <button type="button" class="ipc-btn ipc-btn-danger"><DisconnectOutlined /><span>解除</span></button>
            </a-popconfirm>
          </div>
        </header>

        <div v-if="pickingParent" class="ipc-picker">
          <a-select
            v-model:value="parentPick"
            show-search
            :filter-option="false"
            :options="parentOptions"
            :loading="searching"
            :not-found-content="searching ? '搜索中…' : searchKeyword ? '没有匹配的事项' : '输入单号或概要搜索'"
            placeholder="搜索单号或概要"
            class="ipc-picker-select"
            autofocus
            @search="onSearch"
          >
            <template #option="opt">
              <div class="ipc-opt" :class="{ 'is-disabled': opt.disabled }">
                <span class="ipc-opt-key" :style="{ color: opt.typeColor }">{{ opt.value }}</span>
                <span class="ipc-opt-summary" :title="opt.summary">{{ opt.summary || '（无概要）' }}</span>
                <span v-if="opt.typeName" class="ipc-opt-type" :style="tintStyle(opt.typeColor)">
                  <component :is="issueTypeIconOf(opt.typeIcon)" />{{ opt.typeName }}
                </span>
                <span v-if="opt.statusName" class="ipc-opt-status" :style="tintStyle(opt.statusColor)">{{ opt.statusName }}</span>
                <span v-if="opt.disabled" class="ipc-opt-tag">{{ opt.tag }}</span>
              </div>
            </template>
            <template #suffixIcon><SearchOutlined /></template>
          </a-select>
          <div class="ipc-picker-actions">
            <button type="button" class="ipc-pill" @click="cancelPick">取消</button>
            <button type="button" class="ipc-pill ipc-pill-primary" :disabled="!parentPick || saving" @click="confirmParent">
              <LoadingOutlined v-if="saving" />确定
            </button>
          </div>
        </div>

        <div v-if="relations.parent" class="ipc-list">
          <IssueRow :item="relations.parent" @open="openIssue" />
        </div>
        <div v-else-if="!pickingParent" class="ipc-empty">暂无</div>
      </section>

      <!-- ========== 子工单 ========== -->
      <section class="ipc-group">
        <header class="ipc-head">
          <span class="ipc-label">
            子工单
            <span v-if="relations.children.length" class="ipc-count">{{ relations.children.length }}</span>
          </span>
          <div v-if="!pickingChildren" class="ipc-actions">
            <button type="button" class="ipc-btn" @click="startPickChildren"><LinkOutlined /><span>关联已有</span></button>
            <button type="button" class="ipc-btn" @click="splitOpen = true"><PlusOutlined /><span>新建</span></button>
          </div>
        </header>

        <!-- 完成进度：细进度条 + 百分比（苹果式的克制信息密度） -->
        <div v-if="relations.children.length" class="ipc-progress" :aria-label="`已完成 ${relations.doneCount} / ${relations.children.length}`">
          <div class="ipc-progress-track">
            <div class="ipc-progress-bar" :class="{ 'is-complete': progress === 100 }" :style="{ width: `${progress}%` }" />
          </div>
          <span class="ipc-progress-text">
            <b>{{ relations.doneCount }}</b>/{{ relations.children.length }} 已完成
          </span>
        </div>

        <div v-if="pickingChildren" class="ipc-picker">
          <a-select
            v-model:value="childPicks"
            mode="multiple"
            show-search
            :filter-option="false"
            :options="childOptions"
            :loading="searching"
            :not-found-content="searching ? '搜索中…' : searchKeyword ? '没有匹配的事项' : '输入单号或概要搜索'"
            placeholder="搜索单号或概要，可多选"
            class="ipc-picker-select"
            :max-tag-count="3"
            autofocus
            @search="onSearch"
          >
            <template #option="opt">
              <div class="ipc-opt" :class="{ 'is-disabled': opt.disabled }">
                <span class="ipc-opt-key" :style="{ color: opt.typeColor }">{{ opt.value }}</span>
                <span class="ipc-opt-summary" :title="opt.summary">{{ opt.summary || '（无概要）' }}</span>
                <span v-if="opt.typeName" class="ipc-opt-type" :style="tintStyle(opt.typeColor)">
                  <component :is="issueTypeIconOf(opt.typeIcon)" />{{ opt.typeName }}
                </span>
                <span v-if="opt.statusName" class="ipc-opt-status" :style="tintStyle(opt.statusColor)">{{ opt.statusName }}</span>
                <span v-if="opt.disabled" class="ipc-opt-tag">{{ opt.tag }}</span>
              </div>
            </template>
          </a-select>
          <div class="ipc-picker-actions">
            <button type="button" class="ipc-pill" @click="cancelPick">取消</button>
            <button type="button" class="ipc-pill ipc-pill-primary" :disabled="!childPicks.length || saving" @click="confirmChildren">
              <LoadingOutlined v-if="saving" />关联{{ childPicks.length ? ` ${childPicks.length} 项` : '' }}
            </button>
          </div>
        </div>

        <div v-if="relations.children.length" class="ipc-list">
          <IssueRow
            v-for="c in relations.children"
            :key="c.issueKey"
            :item="c"
            removable
            @open="openIssue"
            @remove="removeChild(c)"
          />
        </div>
        <div v-else-if="!pickingChildren" class="ipc-empty">暂无</div>
      </section>

      <!-- ========== 同级工单（同一父工单下的其它事项） ========== -->
      <section class="ipc-group">
        <header class="ipc-head">
          <span class="ipc-label">
            同级工单
            <span v-if="relations.siblings.length" class="ipc-count">{{ relations.siblings.length }}</span>
          </span>
          <!-- 有父工单才有同级：关联已有 = 把所选事项挂到同一父工单下 -->
          <div v-if="relations.parent && !pickingSiblings" class="ipc-actions">
            <button type="button" class="ipc-btn" @click="startPickSiblings"><LinkOutlined /><span>关联已有</span></button>
          </div>
        </header>

        <div v-if="pickingSiblings" class="ipc-picker">
          <a-select
            v-model:value="siblingPicks"
            mode="multiple"
            show-search
            :filter-option="false"
            :options="siblingOptions"
            :loading="searching"
            :not-found-content="searching ? '搜索中…' : searchKeyword ? '没有匹配的事项' : '输入单号或概要搜索'"
            placeholder="搜索单号或概要，可多选"
            class="ipc-picker-select"
            :max-tag-count="3"
            autofocus
            @search="onSearch"
          >
            <template #option="opt">
              <div class="ipc-opt" :class="{ 'is-disabled': opt.disabled }">
                <span class="ipc-opt-key" :style="{ color: opt.typeColor }">{{ opt.value }}</span>
                <span class="ipc-opt-summary" :title="opt.summary">{{ opt.summary || '（无概要）' }}</span>
                <span v-if="opt.typeName" class="ipc-opt-type" :style="tintStyle(opt.typeColor)">
                  <component :is="issueTypeIconOf(opt.typeIcon)" />{{ opt.typeName }}
                </span>
                <span v-if="opt.statusName" class="ipc-opt-status" :style="tintStyle(opt.statusColor)">{{ opt.statusName }}</span>
                <span v-if="opt.disabled" class="ipc-opt-tag">{{ opt.tag }}</span>
              </div>
            </template>
          </a-select>
          <div class="ipc-picker-actions">
            <button type="button" class="ipc-pill" @click="cancelPick">取消</button>
            <button type="button" class="ipc-pill ipc-pill-primary" :disabled="!siblingPicks.length || saving" @click="confirmSiblings">
              <LoadingOutlined v-if="saving" />关联{{ siblingPicks.length ? ` ${siblingPicks.length} 项` : '' }}
            </button>
          </div>
        </div>

        <div v-if="relations.siblings.length" class="ipc-list">
          <IssueRow v-for="c in relations.siblings" :key="c.issueKey" :item="c" @open="openIssue" />
        </div>
        <div v-else-if="!pickingSiblings" class="ipc-empty">暂无</div>
      </section>
    </a-spin>

    <SplitIssueModal v-model:open="splitOpen" :issue-key="issueKey" @submitted="onChanged" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch, type PropType } from 'vue'
import { useRouter } from 'vue-router'
import { message, Popconfirm, Tooltip } from 'ant-design-vue'
import {
  CheckOutlined,
  CloseOutlined,
  DisconnectOutlined,
  LinkOutlined,
  LoadingOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import {
  queryIssueRelations,
  setIssueParent,
  addIssueChildren,
  fuzzyQueryIssues,
  type IssueRelations,
  type IssueRelationItem,
  type FuzzyIssueItem,
} from '@/api/faiz'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'
import SplitIssueModal from '@/components/SplitIssueModal.vue'

/**
 * 关联工单：展示父工单 + 子工单（含完成进度）+ 同级工单。支持设置 / 更换 / 解除父工单、关联已有事项为子工单、
 * 新建子工单（复用「拆分任务」）、移除子工单、把已有事项挂到同一父工单下成为同级。数据走 /issue/relations。
 */
const props = withDefaults(defineProps<{
  issueKey: string
  /** 外层详情刷新时传入新值（如详情数据对象），触发重新加载 */
  reloadTrigger?: unknown
  /** 点击关联事项：route 在当前页跳转（详情页）；tab 新标签页打开（抽屉内） */
  openMode?: 'route' | 'tab'
}>(), {
  reloadTrigger: undefined,
  openMode: 'route',
})

const emit = defineEmits<{
  /** 父子关系变化（外层可刷新详情 / 列表） */
  (e: 'changed'): void
}>()

const router = useRouter()

// ---------- 数据 ----------
const emptyRelations = (): IssueRelations => ({ parent: null, children: [], doneCount: 0, siblings: [] })
const relations = ref<IssueRelations>(emptyRelations())
const loading = ref(false)
const loaded = ref(false)
let loadSeq = 0

async function load() {
  const key = props.issueKey
  if (!key) return
  const seq = ++loadSeq
  loading.value = true
  try {
    const res = await queryIssueRelations(key)
    if (seq !== loadSeq) return
    relations.value = res?.success && res.data
      ? {
          parent: res.data.parent ?? null,
          children: res.data.children ?? [],
          doneCount: res.data.doneCount ?? 0,
          siblings: res.data.siblings ?? [],
        }
      : emptyRelations()
    loaded.value = true
  } catch {
    // 请求层已统一提示
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

const progress = computed(() => {
  const total = relations.value.children.length
  return total ? Math.round((relations.value.doneCount / total) * 100) : 0
})

/** 新建子工单：复用「拆分任务」弹窗（子任务父级工单为当前事项） */
const splitOpen = ref(false)

function onChanged() {
  load()
  emit('changed')
}

function openIssue(key: string) {
  if (props.openMode === 'tab') {
    window.open(`${window.location.origin}/jira/browse/${encodeURIComponent(key)}`, '_blank', 'noopener')
  } else {
    router.push(`/jira/browse/${encodeURIComponent(key)}`)
  }
}

// ---------- 搜索（单号 / 概要模糊匹配，合并去重；不受顶部空间限制，父子工单可跨空间） ----------
const searching = ref(false)
const searchKeyword = ref('')
const searchResults = ref<FuzzyIssueItem[]>([])
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0

function onSearch(v: string) {
  searchKeyword.value = v.trim()
  if (searchTimer) clearTimeout(searchTimer)
  if (!searchKeyword.value) {
    searchSeq++
    searchResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(() => runSearch(searchKeyword.value), 300)
}

async function runSearch(kw: string) {
  const seq = ++searchSeq
  try {
    const [byKey, bySummary] = await Promise.all([
      fuzzyQueryIssues({ issueKey: kw, page: 1, pageSize: 10 }).catch(() => null),
      fuzzyQueryIssues({ summary: kw, page: 1, pageSize: 10 }).catch(() => null),
    ])
    if (seq !== searchSeq) return
    const merged = new Map<string, FuzzyIssueItem>()
    for (const it of [...(byKey?.data?.list ?? []), ...(bySummary?.data?.list ?? [])]) {
      if (it?.issueKey && !merged.has(it.issueKey)) merged.set(it.issueKey, it)
    }
    searchResults.value = [...merged.values()]
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

/** 下拉选项：label 用于选中后回显；其余字段供 #option 插槽渲染单号（问题类型色）、概要、问题类型与状态 */
function optionOf(it: FuzzyIssueItem, disabledTag = '') {
  return {
    value: it.issueKey,
    label: `${it.issueKey} ${it.summary ?? ''}`.trim(),
    /** 不可选时的原因标签（如「已是子工单」），空串表示可选 */
    disabled: !!disabledTag,
    tag: disabledTag,
    summary: it.summary,
    typeName: it.issueTypeName,
    typeColor: hexOr(it.issueTypeColor, '#0a84ff'),
    typeIcon: (it as FuzzyIssueItem & { issueTypeIcon?: string | null }).issueTypeIcon ?? null,
    statusName: it.statusName,
    statusColor: hexOr(it.statusColor, '#8e8e93'),
  }
}
function hexOr(color: string | undefined, fallback: string) {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback
}
/** 文字用原色、底色用 12% 透明度 */
function tintStyle(color: string) {
  return { color, background: `color-mix(in srgb, ${color} 12%, transparent)` }
}
const childKeys = computed(() => new Set(relations.value.children.map(c => c.issueKey)))
const siblingKeys = computed(() => new Set(relations.value.siblings.map(c => c.issueKey)))
/** 候选通用排除：自己、当前父工单 */
const candidates = computed(() => searchResults.value
  .filter(it => it.issueKey !== props.issueKey && it.issueKey !== relations.value.parent?.issueKey))
/** 父工单候选：子工单置灰（子工单设为父会成环，后端也会校验） */
const parentOptions = computed(() => candidates.value
  .map(it => optionOf(it, childKeys.value.has(it.issueKey) ? '已是子工单' : '')))
/** 子工单候选：已是子工单的置灰 */
const childOptions = computed(() => candidates.value
  .map(it => optionOf(it, childKeys.value.has(it.issueKey) ? '已是子工单' : '')))
/** 同级工单候选：已是同级的置灰 */
const siblingOptions = computed(() => candidates.value
  .map(it => optionOf(it, siblingKeys.value.has(it.issueKey) ? '已是同级工单' : '')))

// ---------- 父工单 ----------
const pickingParent = ref(false)
const parentPick = ref<string | undefined>()
const saving = ref(false)

function resetSearch() {
  searchKeyword.value = ''
  searchResults.value = []
}
function startPickParent() {
  pickingChildren.value = false
  pickingSiblings.value = false
  pickingParent.value = true
  parentPick.value = undefined
  resetSearch()
}
function cancelPick() {
  pickingParent.value = false
  pickingChildren.value = false
  pickingSiblings.value = false
  parentPick.value = undefined
  childPicks.value = []
  siblingPicks.value = []
  resetSearch()
}

async function confirmParent() {
  if (!parentPick.value) return
  saving.value = true
  try {
    const res = await setIssueParent(props.issueKey, parentPick.value)
    if (res?.success) {
      message.success('已设置父工单')
      cancelPick()
      onChanged()
    }
  } catch {
    // 请求层已统一提示（如成环、无权限）
  } finally {
    saving.value = false
  }
}

async function removeParent() {
  try {
    const res = await setIssueParent(props.issueKey, '')
    if (res?.success) {
      message.success('已解除父子关系')
      onChanged()
    }
  } catch {
    // 请求层已统一提示
  }
}

// ---------- 子工单 ----------
const pickingChildren = ref(false)
const childPicks = ref<string[]>([])

function startPickChildren() {
  pickingParent.value = false
  pickingSiblings.value = false
  pickingChildren.value = true
  childPicks.value = []
  resetSearch()
}

async function confirmChildren() {
  if (!childPicks.value.length) return
  saving.value = true
  try {
    const res = await addIssueChildren(props.issueKey, childPicks.value)
    if (res?.success) {
      message.success(res.message || '已关联子工单')
      cancelPick()
      onChanged()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

async function removeChild(c: IssueRelationItem) {
  try {
    const res = await setIssueParent(c.issueKey, '')
    if (res?.success) {
      message.success(`已移除子工单 ${c.issueKey}`)
      onChanged()
    }
  } catch {
    // 请求层已统一提示
  }
}

// ---------- 同级工单 ----------
const pickingSiblings = ref(false)
const siblingPicks = ref<string[]>([])

function startPickSiblings() {
  pickingParent.value = false
  pickingChildren.value = false
  pickingSiblings.value = true
  siblingPicks.value = []
  resetSearch()
}

/** 关联同级 = 把所选事项挂到当前事项的父工单下 */
async function confirmSiblings() {
  const parentKey = relations.value.parent?.issueKey
  if (!parentKey || !siblingPicks.value.length) return
  saving.value = true
  try {
    const res = await addIssueChildren(parentKey, siblingPicks.value)
    if (res?.success) {
      message.success(res.data?.length ? `已关联 ${res.data.length} 个同级工单` : '所选事项已是同级工单')
      cancelPick()
      onChanged()
    }
  } catch {
    // 请求层已统一提示（如成环、无权限）
  } finally {
    saving.value = false
  }
}

// ---------- 加载时机 ----------
// 放在所有状态声明之后：immediate 回调会立即执行 cancelPick()，提前注册会访问到尚未初始化的 ref（TDZ）
watch(() => props.issueKey, () => {
  relations.value = emptyRelations()
  loaded.value = false
  cancelPick()
  load()
}, { immediate: true })
watch(() => props.reloadTrigger, () => load())

// ---------- 单行事项 ----------
/** 状态胶囊：状态色做文字色，12% 透明度做底色（苹果式半透明 tint） */
function statusStyle(color?: string) {
  const c = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#8e8e93'
  return { color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }
}
/** 头像兜底：取姓名首字（英文取前两位大写） */
function initialOf(name?: string) {
  const s = (name || '').trim()
  if (!s) return '?'
  return /^[a-zA-Z]/.test(s) ? s.slice(0, 2).toUpperCase() : s.slice(0, 1)
}

const IssueRow = defineComponent({
  name: 'IssueRow',
  props: {
    item: { type: Object as PropType<IssueRelationItem>, required: true },
    removable: { type: Boolean, default: false },
  },
  emits: ['open', 'remove'],
  setup(p, { emit: rowEmit }) {
    return () => {
      const it = p.item
      const open = () => rowEmit('open', it.issueKey)
      return h('div', {
        class: ['ipc-row', { 'is-done': it.done }],
        role: 'link',
        tabindex: 0,
        onClick: open,
        onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') open() },
      }, [
        h('span', { class: 'ipc-type', style: { background: it.issueTypeColor || '#8e8e93' }, title: it.issueTypeName },
          [h(issueTypeIconOf(it.issueTypeIcon))]),
        h('span', { class: 'ipc-main' }, [
          h('span', { class: 'ipc-summary', title: it.summary }, it.summary || '（无概要）'),
          h('span', { class: 'ipc-meta' }, [
            h('span', { class: 'ipc-key' }, it.issueKey),
            it.spaceName ? h('span', { class: 'ipc-dot' }, '·') : null,
            it.spaceName ? h('span', { class: 'ipc-space' }, it.spaceName) : null,
          ]),
        ]),
        it.statusName
          ? h('span', { class: 'ipc-status', style: statusStyle(it.statusColor) }, [
              it.done ? h(CheckOutlined, { class: 'ipc-status-check' }) : null,
              it.statusName,
            ])
          : null,
        h(Tooltip, { title: it.assigneeName || '未分配', placement: 'top' }, {
          default: () => it.assigneeAvatar
            ? h('img', { class: 'ipc-avatar', src: it.assigneeAvatar, alt: it.assigneeName || '' })
            : h('span', { class: ['ipc-avatar', 'ipc-avatar-text', { 'is-empty': !it.assigneeName }] },
                it.assigneeName ? initialOf(it.assigneeName) : [h(UserOutlined)]),
        }),
        p.removable
          ? h(Popconfirm, {
              title: `移除子工单 ${it.issueKey}？`,
              okText: '移除',
              cancelText: '取消',
              onConfirm: () => rowEmit('remove'),
            }, {
              default: () => h('button', {
                type: 'button',
                class: 'ipc-remove',
                title: '移除子工单',
                'aria-label': `移除子工单 ${it.issueKey}`,
                onClick: (e: MouseEvent) => e.stopPropagation(),
                onKeydown: (e: KeyboardEvent) => e.stopPropagation(),
              }, [h(CloseOutlined)]),
            })
          : h('span', { class: 'ipc-chevron', 'aria-hidden': 'true' }, [h(RightOutlined)]),
      ])
    }
  },
})
</script>

<style scoped>
/*
 * 视觉参考：
 * - Apple：分组列表（白底圆角容器 + 内缩细分隔线）、SF 字重层次、半透明状态色、克制的进度条
 * - Google：带图标的文字按钮（悬停 8% 底色）、清晰的焦点环、空状态带图标与主操作
 */
.ipc {
  --ipc-text: #1d1d1f;
  --ipc-text-2: #6e6e73;
  --ipc-text-3: #aeaeb2;
  --ipc-fill: #f5f5f7;
  --ipc-fill-hover: #ececf0;
  --ipc-sep: rgba(60, 60, 67, 0.1);
  --ipc-primary: var(--c-primary, #0a84ff);
  --ipc-danger: #ff3b30;
  --ipc-success: #34c759;
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue',
    'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  color: var(--ipc-text);
  -webkit-font-smoothing: antialiased;
}
/* 分组包在 a-spin 里，间距要加在 spin 容器上，否则父工单 / 子工单之间没有间隔 */
.ipc :deep(.ant-spin-container) {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ---------- 分组 ---------- */
.ipc-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ipc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 26px;
}
.ipc-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ipc-text-2);
}
.ipc-count {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--ipc-text-2);
  background: var(--ipc-fill);
  border-radius: 9px;
  font-variant-numeric: tabular-nums;
}

/* ---------- 文字按钮（Google text button） ---------- */
.ipc-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.ipc-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--ipc-primary);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.ipc-btn:hover {
  background: color-mix(in srgb, var(--ipc-primary) 8%, transparent);
}
.ipc-btn:active {
  background: color-mix(in srgb, var(--ipc-primary) 14%, transparent);
}
.ipc-btn-danger {
  color: var(--ipc-danger);
}
.ipc-btn-danger:hover {
  background: color-mix(in srgb, var(--ipc-danger) 8%, transparent);
}
.ipc-btn:focus-visible,
.ipc-pill:focus-visible,
.ipc :deep(.ipc-row:focus-visible),
.ipc :deep(.ipc-remove:focus-visible) {
  outline: 2px solid color-mix(in srgb, var(--ipc-primary) 60%, transparent);
  outline-offset: 2px;
}

/* ---------- 分组列表（Apple grouped list） ---------- */
.ipc-list {
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--ipc-sep);
  border-radius: 12px;
}
.ipc :deep(.ipc-row) {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}
/* 内缩分隔线：从图标右侧开始，与 iOS 列表一致 */
.ipc :deep(.ipc-row + .ipc-row)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 44px;
  right: 0;
  height: 1px;
  background: var(--ipc-sep);
}
.ipc :deep(.ipc-row:hover) {
  background: var(--ipc-fill);
}
.ipc :deep(.ipc-row:active) {
  background: var(--ipc-fill-hover);
}
.ipc :deep(.ipc-type) {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  border-radius: 6px;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.08);
}
.ipc :deep(.ipc-main) {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ipc :deep(.ipc-summary) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ipc-text);
}
.ipc :deep(.ipc-row.is-done .ipc-summary) {
  color: var(--ipc-text-3);
  text-decoration: line-through;
}
.ipc :deep(.ipc-meta) {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 11px;
  line-height: 15px;
  color: var(--ipc-text-2);
}
.ipc :deep(.ipc-key) {
  flex-shrink: 0;
  font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: -0.01em;
}
.ipc :deep(.ipc-dot) {
  color: var(--ipc-text-3);
}
.ipc :deep(.ipc-space) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ipc :deep(.ipc-status) {
  flex-shrink: 0;
  max-width: 96px;
  height: 20px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
}
.ipc :deep(.ipc-status-check) {
  font-size: 10px;
}
.ipc :deep(.ipc-avatar) {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px #fff, 0 0 0 2px var(--ipc-sep);
}
.ipc :deep(.ipc-avatar-text) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #8e8e93, #636366);
}
.ipc :deep(.ipc-avatar-text.is-empty) {
  color: var(--ipc-text-3);
  background: var(--ipc-fill);
}
.ipc :deep(.ipc-chevron) {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--ipc-text-3);
  transition: transform 0.15s, color 0.15s;
}
.ipc :deep(.ipc-row:hover .ipc-chevron) {
  color: var(--ipc-text-2);
  transform: translateX(2px);
}
.ipc :deep(.ipc-remove) {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 10px;
  color: var(--ipc-text-2);
  background: var(--ipc-fill);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.15s, transform 0.15s, color 0.15s, background 0.15s;
}
.ipc :deep(.ipc-row:hover .ipc-remove),
.ipc :deep(.ipc-remove:focus-visible) {
  opacity: 1;
  transform: scale(1);
}
.ipc :deep(.ipc-remove:hover) {
  color: #fff;
  background: var(--ipc-danger);
}
/* 触屏没有 hover：移除按钮常显 */
@media (hover: none) {
  .ipc :deep(.ipc-remove) {
    opacity: 1;
    transform: none;
  }
}

/* ---------- 进度 ---------- */
.ipc-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ipc-progress-track {
  flex: 1;
  height: 6px;
  overflow: hidden;
  background: var(--ipc-fill);
  border-radius: 3px;
}
.ipc-progress-bar {
  height: 100%;
  background: var(--ipc-primary);
  border-radius: 3px;
  transition: width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), background 0.2s;
}
.ipc-progress-bar.is-complete {
  background: var(--ipc-success);
}
.ipc-progress-text {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--ipc-text-2);
  font-variant-numeric: tabular-nums;
}
.ipc-progress-text b {
  font-weight: 600;
  color: var(--ipc-text);
}

/* ---------- 选择器 ---------- */
.ipc-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--ipc-fill);
  border-radius: 12px;
}
.ipc-picker-select {
  width: 100%;
}
.ipc-picker :deep(.ant-select-selector) {
  border-color: transparent !important;
  border-radius: 8px !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06) !important;
}
.ipc-picker :deep(.ant-select-focused .ant-select-selector) {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ipc-primary) 25%, transparent) !important;
}
.ipc-picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.ipc-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 14px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--ipc-text);
  background: #fff;
  border: none;
  border-radius: 14px;
  box-shadow: 0 0 0 1px var(--ipc-sep);
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.ipc-pill:hover {
  background: var(--ipc-fill-hover);
}
.ipc-pill-primary {
  color: #fff;
  background: var(--ipc-primary);
  box-shadow: none;
}
.ipc-pill-primary:hover {
  background: color-mix(in srgb, var(--ipc-primary) 88%, #000);
}
.ipc-pill:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* ---------- 空状态：朴素的一行灰字 ---------- */
.ipc-empty {
  padding: 2px 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--ipc-text-3);
}

/* ---------- 搜索下拉选项（挂在 body 下，用 :global） ---------- */
:global(.ipc-opt) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
:global(.ipc-opt-key) {
  flex-shrink: 0;
  font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
:global(.ipc-opt-summary) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #1d1d1f;
}
:global(.ipc-opt-type),
:global(.ipc-opt-status),
:global(.ipc-opt-tag) {
  flex-shrink: 0;
  max-width: 96px;
  height: 20px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
}
:global(.ipc-opt-tag) {
  color: #8e8e93;
  background: #f2f2f7;
}
:global(.ipc-opt.is-disabled) {
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .ipc *,
  .ipc :deep(*) {
    transition: none !important;
  }
}
</style>
