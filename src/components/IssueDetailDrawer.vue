<template>
  <a-drawer
    :open="open"
    placement="right"
    :width="drawerWidth"
    :body-style="{ padding: 0, height: '100vh' }"
    :header-style="{ display: 'none' }"
    :mask-style="{ background: 'transparent' }"
    @close="handleClose"
  >
    <div class="drawer-inner">
      <!-- Loading -->
      <div v-if="loading" class="detail-loading">
        <a-spin size="large">
          <template #indicator>
            <component :is="LoadingOutlined" spin style="font-size: 36px; color: #1677ff" />
          </template>
        </a-spin>
        <div class="loading-text">正在加载事项详情…</div>
      </div>

      <!-- Empty -->
      <div v-else-if="!detailData" class="detail-empty">
        <div class="empty-illustration">
          <component :is="FileUnknownOutlined" />
        </div>
        <div class="empty-title">未找到数据</div>
        <div class="empty-desc">请尝试刷新页面或重新打开</div>
      </div>

      <!-- Content -->
      <div v-else class="detail-body">
        <!-- ========== 顶部工具栏（带玻璃质感渐变） ========== -->
        <header class="top-bar">
          <div class="top-bar-left">
            <div class="tb-crumb-icon">
              <component :is="FolderOutlined" />
            </div>
            <span class="tb-project">{{ projectLabel || '未命名项目' }}</span>
            <span class="tb-divider">/</span>
            <span class="tb-key">{{ issueKey }}</span>
          </div>
          <div class="top-bar-right">
            <div class="tb-icon-btn" title="查看"><component :is="FileOutlined" /></div>
            <div class="tb-icon-btn" title="关注"><component :is="StarOutlined" /></div>
            <div class="tb-icon-btn" title="复制链接"><component :is="LinkOutlined" /></div>
            <div class="tb-icon-btn" title="分享"><component :is="ShareAltOutlined" /></div>
            <div class="tb-vdiv" />
            <div class="tb-icon-btn" title="全屏"><component :is="FullscreenOutlined" /></div>
            <div class="tb-icon-btn tb-close" title="关闭" @click="handleClose">
              <component :is="CloseOutlined" />
            </div>
          </div>
        </header>

        <!-- ========== 标题区 ========== -->
        <section class="title-section">
          <div class="title-accent" />
          <h1 class="issue-title">{{ heroSummary || '（未填写标题）' }}</h1>
        </section>

        <!-- ========== 内联属性卡 ========== -->
        <section class="attr-card">
          <div class="attr-item attr-item-type">
            <span class="attr-label">问题类型</span>
            <span class="attr-value-block">
              <component v-if="issueTypeLabel" :is="CheckSquareFilled" class="attr-check" />
              <span class="attr-value">{{ issueTypeLabel || '—' }}</span>
            </span>
          </div>

          <div class="attr-item">
            <span class="attr-label">状态</span>
            <span class="attr-value-block">
              <a-tag
                v-if="statusLabel"
                :color="statusTagColor"
                :bordered="false"
                class="attr-tag"
              >
                <span class="attr-dot" :style="{ background: statusDotColor }" />
                {{ statusLabel }}
              </a-tag>
              <span v-else class="attr-empty">—</span>
              <a v-if="statusLabel" class="attr-workflow">查看工作流</a>
            </span>
          </div>

          <div class="attr-item">
            <span class="attr-label">优先级</span>
            <span class="attr-value-block">
              <span class="priority-chip" :class="'pc-' + (priorityStatusColor || 'default')">
                <component :is="SwapOutlined" class="pc-icon" />
                <span class="pc-text">{{ priorityLabel || '—' }}</span>
              </span>
            </span>
          </div>

          <div class="attr-item">
            <span class="attr-label">版本</span>
            <span class="attr-value-block">
              <span class="attr-empty">—</span>
            </span>
          </div>

          <div class="attr-item">
            <span class="attr-label">Sprint</span>
            <span class="attr-value-block">
              <span class="attr-empty">—</span>
            </span>
          </div>
        </section>

        <!-- ========== 操作按钮栏 ========== -->
        <section class="action-bar">
          <div class="action-bar-left">
            <a-button size="small" class="action-btn">
              <component :is="EditOutlined" />
              编辑
            </a-button>
            <a-button size="small" class="action-btn">
              <component :is="UserOutlined" />
              分配
            </a-button>
            <a-dropdown>
              <a-button size="small" class="action-btn">
                更多操作 <component :is="DownOutlined" />
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="copy"><component :is="CopyOutlined" />复制</a-menu-item>
                  <a-menu-item key="delete" danger><component :is="DeleteOutlined" />删除</a-menu-item>
                  <a-menu-item key="convert"><component :is="SwapOutlined" />转换类型</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>

            <div class="action-divider" />

            <a-button type="primary" size="small" class="action-btn action-primary">
              <component :is="PlayCircleOutlined" />
              开始处理
            </a-button>
            <a-button size="small" class="action-btn">取消</a-button>
            <a-button size="small" class="action-btn">暂停</a-button>
            <a-dropdown>
              <a-button size="small" class="action-btn">
                同步任务处...
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item>同步到飞书</a-menu-item>
                  <a-menu-item>同步到 Jira</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <a-button size="small" type="primary" ghost class="action-btn action-groupchat">
              <component :is="TeamOutlined" />
              一键拉群
            </a-button>
          </div>
          <div class="action-bar-right">
            <a-switch v-model:checked="onlyShowValued" size="small" />
            <span class="switch-label">仅展示有值字段</span>
          </div>
        </section>

        <!-- ========== 主体内容，可滚动 ========== -->
        <main class="detail-scroll">
          <div class="scroll-inner">

            <!-- 概要信息卡片 -->
            <section v-if="hasSummaryPanel" class="panel-card">
              <div class="panel-card-header">
                <div class="pch-left">
                  <span class="pch-dot pch-dot-blue" />
                  <span class="pch-title">概要信息</span>
                </div>
                <div class="pch-meta">
                  <component :is="InfoCircleOutlined" />
                </div>
              </div>
              <div class="panel-card-body">
                <template
                  v-if="customFieldTabGroup && customFieldTabGroup.structureType === 'TAB_CONTAINER' && customFieldTabGroup.tabItems.length > 0"
                >
                  <a-tabs
                    v-model:active-key="activeTab"
                    class="panel-tabs"
                    size="small"
                  >
                    <a-tab-pane
                      v-for="tab in customFieldTabGroup.tabItems"
                      :key="tab.title"
                      :tab="tab.title"
                    >
                      <div
                        v-if="filteredFields(tab.issueFields).length > 0"
                        class="kv-list"
                      >
                        <template v-for="(f, i) in filteredFields(tab.issueFields)" :key="f.id">
                          <div class="kv-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                            <div class="kv-label">
                              <span class="kv-label-inner">{{ f.name }}</span>
                            </div>
                            <div class="kv-value">
                              <UserAvatar v-if="isUserField(f)" :user="f.value" />
                              <ValueWithBadge v-else :field="f" />
                            </div>
                          </div>
                        </template>
                      </div>
                      <MiniEmpty v-else text="暂无该分类下数据" />
                    </a-tab-pane>
                  </a-tabs>
                </template>

                <template v-else>
                  <div v-if="filteredSummaryGrid.length > 0" class="kv-list">
                    <template v-for="(f, i) in filteredSummaryGrid" :key="f.id">
                      <div class="kv-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                        <div class="kv-label">
                          <span class="kv-label-inner">{{ f.name }}</span>
                        </div>
                        <div class="kv-value">
                          <UserAvatar v-if="isUserField(f)" :user="f.value" />
                          <ValueWithBadge v-else :field="f" />
                        </div>
                      </div>
                    </template>
                  </div>

                  <div
                    v-if="customFieldPlain && customFieldPlain.fields.length > 0 && filteredFields(customFieldPlain.fields).length > 0"
                    class="kv-list kv-list-extra"
                  >
                    <div class="kv-subtitle">
                      <component :is="AppstoreOutlined" /> 自定义字段
                    </div>
                    <template v-for="(f, i) in filteredFields(customFieldPlain.fields)" :key="f.id">
                      <div class="kv-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                        <div class="kv-label">
                          <span class="kv-label-inner">{{ f.name }}</span>
                        </div>
                        <div class="kv-value">
                          <UserAvatar v-if="isUserField(f)" :user="f.value" />
                          <ValueWithBadge v-else :field="f" />
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </section>

            <!-- 描述卡片 -->
            <section
              v-if="!onlyShowValued ? true : descriptionFields.length > 0"
              class="panel-card"
            >
              <div class="panel-card-header">
                <div class="pch-left">
                  <span class="pch-dot pch-dot-green" />
                  <span class="pch-title">描述</span>
                </div>
                <div class="pch-actions">
                  <div class="pch-action-btn" title="全屏查看">
                    <component :is="FullscreenOutlined" />
                  </div>
                </div>
              </div>
              <div class="panel-card-body">
                <div
                  v-if="descriptionFields.length > 0"
                  v-for="(f, i) in descriptionFields"
                  :key="i"
                  class="desc-content"
                  v-html="formatRichText(f.value)"
                />
                <MiniEmpty v-else text="还没有填写描述" />
              </div>
            </section>

            <!-- 人员信息卡片 -->
            <section
              v-if="!onlyShowValued ? true : filteredUserFields.length > 0"
              class="panel-card"
            >
              <div class="panel-card-header">
                <div class="pch-left">
                  <span class="pch-dot pch-dot-purple" />
                  <span class="pch-title">人员信息</span>
                </div>
                <div class="pch-meta">
                  <component :is="UserOutlined" />
                </div>
              </div>
              <div class="panel-card-body">
                <div v-if="filteredUserFields.length > 0" class="kv-list">
                  <template v-for="(f, i) in filteredUserFields" :key="f.id">
                    <div class="kv-row user-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                      <div class="kv-label">
                        <span class="kv-label-inner">{{ f.name }}</span>
                      </div>
                      <div class="kv-value">
                        <div class="user-cell-pretty">
                          <UserAvatar :user="f.value" :size="26" />
                          <div class="ucp-share" title="转派给其他人">
                            <component :is="ShareAltOutlined" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
                <MiniEmpty v-else text="暂无人员信息" />
              </div>
            </section>

            <!-- 研发活动卡片 -->
            <section class="panel-card panel-card-dim">
              <div class="panel-card-header">
                <div class="pch-left">
                  <span class="pch-dot pch-dot-orange" />
                  <span class="pch-title">研发活动</span>
                </div>
                <div class="pch-meta dim">
                  <component :is="CodeOutlined" />
                </div>
              </div>
              <div class="panel-card-body">
                <MiniEmpty text="暂无提交记录 / 分支 / MR" />
              </div>
            </section>

            <!-- 关联 OKR -->
            <section class="panel-card panel-card-dim">
              <div class="panel-card-header">
                <div class="pch-left">
                  <span class="pch-dot pch-dot-cyan" />
                  <span class="pch-title">关联的 OKR</span>
                </div>
                <div class="pch-actions">
                  <a class="pch-add" @click.stop>
                    <component :is="PlusOutlined" />
                    <span>添加关联</span>
                  </a>
                </div>
              </div>
              <div class="panel-card-body">
                <MiniEmpty text="暂无关联 OKR，点击右上角添加" />
              </div>
            </section>

            <div class="footer-spacer" />
          </div>
        </main>
      </div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { h, ref, computed, watch } from 'vue'
import {
  FolderOutlined,
  FileOutlined,
  StarOutlined,
  LinkOutlined,
  ShareAltOutlined,
  FullscreenOutlined,
  CloseOutlined,
  CheckSquareFilled,
  SwapOutlined,
  EditOutlined,
  UserOutlined,
  TeamOutlined,
  PlusOutlined,
  FileUnknownOutlined,
  LoadingOutlined,
  DownOutlined,
  CopyOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
  CodeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons-vue'
import { queryDetail } from '@/api/faiz'
import type { DetailData, DetailField } from '@/types/faiz'

// ============================================================
// 子组件：MiniEmpty 小型空状态
// ============================================================
const MiniEmpty = {
  name: 'MiniEmpty',
  props: {
    text: { type: String, default: '暂无数据' },
  },
  setup(props: { text: string }) {
    return () => h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '24px 16px',
        color: '#8c8c8c',
        fontSize: '12px',
        background: 'linear-gradient(180deg, #fafbfc 0%, #fff 100%)',
        borderRadius: '6px',
        border: '1px dashed #e6e8eb',
      },
    }, [
      h(ExclamationCircleOutlined, { style: { fontSize: '14px', opacity: 0.6 } }),
      h('span', props.text),
    ])
  },
}

// ============================================================
// 子组件：UserAvatar 用户头像+名字
// ============================================================
const UserAvatar = {
  name: 'UserAvatar',
  props: {
    user: { type: null, default: null },
    size: { type: Number, default: 22 },
  },
  setup(props: { user: unknown; size?: number }) {
    const info = computed(() => {
      const v = props.user
      if (!v || typeof v !== 'object') return { name: '', id: '', firstLetter: '?', color: '#d9d9d9', textColor: '#595959' }
      const obj = v as Record<string, unknown>
      const name = String(obj.userEnName ?? obj.userCoAccount ?? obj.displayName ?? obj.name ?? '')
      const idPart = obj.id || obj.userId ? String(obj.id ?? obj.userId ?? '') : ''
      const firstLetter = (name || '?').trim().charAt(0).toUpperCase()
      const palette = [
        { bg: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)', solid: '#1677ff' },
        { bg: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)', solid: '#52c41a' },
        { bg: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)', solid: '#fa8c16' },
        { bg: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)', solid: '#722ed1' },
        { bg: 'linear-gradient(135deg, #eb2f96 0%, #f759ab 100%)', solid: '#eb2f96' },
        { bg: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)', solid: '#13c2c2' },
        { bg: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)', solid: '#faad14' },
        { bg: 'linear-gradient(135deg, #2f54eb 0%, #597ef7 100%)', solid: '#2f54eb' },
      ]
      const item = name ? palette[name.charCodeAt(0) % palette.length] : palette[0]
      return {
        name: name || '—',
        id: idPart,
        firstLetter,
        bg: item.bg,
        solid: item.solid,
      }
    })
    const size = computed(() => props.size ?? 22)
    return () => {
      const { name, id, firstLetter, bg } = info.value
      const s = size.value
      const wrap = h('div', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: '100%',
        },
      }, [
        // 渐变头像
        h('span', {
          style: {
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${s}px`,
            height: `${s}px`,
            borderRadius: '50%',
            background: bg,
            color: '#fff',
            fontSize: `${Math.max(10, Math.round(s * 0.5))}px`,
            fontWeight: 700,
            letterSpacing: '-0.2px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.06)',
            flexShrink: 0,
            userSelect: 'none',
          },
        }, firstLetter),
        // 名字
        h('span', {
          style: {
            color: '#1f1f1f',
            fontSize: '13px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 'calc(100% - 50px)',
          },
        }, name),
        // 工号
        id
          ? h('span', {
              style: {
                color: '#8c8c8c',
                fontSize: '11px',
                fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                padding: '1px 6px',
                background: '#f5f5f5',
                borderRadius: '10px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              },
            }, `#${id}`)
          : null,
      ].filter(Boolean))
      return wrap
    }
  },
}

// ============================================================
// 子组件：ValueWithBadge 字段值 + 数字绿标
// ============================================================
const ValueWithBadge = {
  name: 'ValueWithBadge',
  props: {
    field: { type: Object as () => DetailField, required: true },
  },
  setup(props: { field: DetailField }) {
    const displayValue = computed(() => formatFieldValue(props.field))
    const badgeId = computed(() => {
      const v = props.field.value
      if (v == null) return ''
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>
        if (obj.id && typeof obj.id === 'number') return String(obj.id)
      }
      return ''
    })
    const shouldShowBadge = computed(() =>
      !!badgeId.value &&
      !!props.field.type &&
      props.field.type.startsWith('SELECT_LIST_SINGLE') &&
      /^\d{5,}$/.test(badgeId.value),
    )
    return () => {
      const txt = displayValue.value
      const textSpan = h('span', {
        style: {
          color: '#1f1f1f',
          fontSize: '13px',
          lineHeight: '22px',
          wordBreak: 'break-word',
        },
      }, txt)
      if (shouldShowBadge.value) {
        return h('div', {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            maxWidth: '100%',
            flexWrap: 'wrap',
          },
        }, [
          textSpan,
          h('span', {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 7px',
              height: '18px',
              lineHeight: '18px',
              background: 'linear-gradient(135deg, #f6ffed 0%, #eafce0 100%)',
              color: '#389e0d',
              border: '1px solid #b7eb8f',
              borderRadius: '10px',
              fontSize: '10.5px',
              fontWeight: 600,
              fontFamily: "'SF Mono', Menlo, Consolas, monospace",
              letterSpacing: '0.2px',
              boxShadow: 'inset 0 -1px 0 rgba(0, 0, 0, 0.02)',
            },
          }, badgeId.value),
        ])
      }
      return textSpan
    }
  },
}

const props = defineProps<{
  open: boolean
  issueKey: string
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const loading = ref(false)
const detailData = ref<DetailData | null>(null)
const activeTab = ref<string>('')
const onlyShowValued = ref(true)

// 抽屉宽度 = 系统视口宽度的 50%
const drawerWidth = ref(Math.floor(window.innerWidth * 0.5))

// ======================= helpers to get specific known fields =======================

const allSummaryFields = computed<DetailField[]>(() => {
  if (!detailData.value) return []
  const g = detailData.value.layoutGroup.find((x) => x.type === 'SUMMARY')
  if (!g || g.fieldGroupStructure.type !== 'COMMON_LIST') return []
  return g.fieldGroupStructure.data as DetailField[]
})

function findField(id: string): DetailField | undefined {
  return allSummaryFields.value.find((f) => f.id === id)
}

const heroSummary = computed<string>(() => {
  const f = findField('summary')
  if (!f) return ''
  return String(f.exportValue ?? f.value ?? '')
})

const projectLabel = computed<string>(() => {
  const f = findField('project')
  if (!f?.value) return ''
  const v = f.value as Record<string, unknown>
  return String(v.name ?? v.key ?? '')
})

// status
const statusField = computed(() => findField('status'))
const statusValue = computed(() => statusField.value?.value)
const statusLabel = computed(() => {
  const v = statusValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).name ?? '')
  }
  return ''
})
const statusCategory = computed(() => {
  const v = statusValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).statusCategory ?? '')
  }
  return ''
})
const statusTagColor = computed(() => {
  switch (statusCategory.value) {
    case 'IN_PROGRESS':
      return 'blue'
    case 'DONE':
      return 'green'
    case 'TO_DO':
    default:
      return 'default'
  }
})
const statusDotColor = computed(() => {
  switch (statusCategory.value) {
    case 'IN_PROGRESS':
      return '#1677ff'
    case 'DONE':
      return '#52c41a'
    case 'TO_DO':
      return '#8c8c8c'
    default:
      return '#1677ff'
  }
})

// priority
const priorityField = computed(() => findField('priority'))
const priorityValue = computed(() => priorityField.value?.value)
const priorityLabel = computed(() => {
  const v = priorityValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).pname ?? (v as Record<string, unknown>).name ?? '')
  }
  return ''
})
const priorityStatusColor = computed(() => {
  const v = priorityValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).statusColor ?? '')
  }
  return ''
})

// issue type
const issueTypeField = computed(() => findField('issuetype'))
const issueTypeValue = computed(() => issueTypeField.value?.value)
const issueTypeLabel = computed(() => {
  const v = issueTypeValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).name ?? '')
  }
  return ''
})

// ======================= Summary / Custom / User 分组 =======================

const SUMMARY_EXCLUDED_IDS = new Set(['summary', 'status', 'priority', 'issuetype', 'project'])

function isUserField(f: DetailField): boolean {
  const t = f.type || ''
  if (t === 'SELECT_USER_SINGLE' || t === 'SELECT_USER_MULTIPLE') return true
  if (f.id === 'assignee' || f.id === 'reporter' || f.id === 'creator') return true
  return false
}

const rawSummaryGrid = computed<DetailField[]>(() =>
  allSummaryFields.value.filter((f) => !SUMMARY_EXCLUDED_IDS.has(f.id) && !isUserField(f)),
)

interface CustomFieldGroup {
  structureType: string
  tabItems: Array<{ title: string; sequence: number; issueFields: DetailField[] }>
  fields: DetailField[]
}

const customFieldGroups = computed<CustomFieldGroup[]>(() => {
  if (!detailData.value) return []
  const groups: CustomFieldGroup[] = []
  for (const g of detailData.value.layoutGroup) {
    if (g.type !== 'CUSTOM_FIELD') continue
    const s = g.fieldGroupStructure
    if (s.type === 'TAB_CONTAINER') {
      const d = s.data as { tabItems: Array<{ title: string; sequence: number; issueFields: DetailField[] }> }
      if (d?.tabItems && d.tabItems.length > 0) {
        groups.push({ structureType: 'TAB_CONTAINER', tabItems: d.tabItems, fields: [] })
      }
    } else if (s.type === 'COMMON_LIST') {
      groups.push({ structureType: 'COMMON_LIST', tabItems: [], fields: s.data as DetailField[] })
    }
  }
  return groups
})

const customFieldTabGroup = computed<CustomFieldGroup | null>(() =>
  customFieldGroups.value.find((g) => g.structureType === 'TAB_CONTAINER') ?? null,
)

const customFieldPlain = computed<CustomFieldGroup | null>(() =>
  customFieldGroups.value.find((g) => g.structureType === 'COMMON_LIST') ?? null,
)

const descriptionFields = computed<DetailField[]>(() => {
  if (!detailData.value) return []
  const g = detailData.value.layoutGroup.find((x) => x.type === 'DESCRIPTION')
  if (!g || g.fieldGroupStructure.type !== 'COMMON_LIST') return []
  return g.fieldGroupStructure.data as DetailField[]
})

// 人员字段：从 summary 中提取 assignee / reporter / creator / SELECT_USER
const allUserFields = computed<DetailField[]>(() => {
  const fromSummary = allSummaryFields.value.filter(isUserField)
  const fromCustom: DetailField[] = []
  customFieldGroups.value.forEach((g) => {
    g.tabItems?.forEach((t) => t.issueFields?.forEach((f) => isUserField(f) && fromCustom.push(f)))
    g.fields?.forEach((f) => isUserField(f) && fromCustom.push(f))
  })
  return [...fromSummary, ...fromCustom]
})

// 仅展示有值字段过滤
function hasValue(f: DetailField): boolean {
  const v = f.value
  if (v === null || v === undefined) return false
  if (typeof v === 'string' && v.trim() === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  if (typeof v === 'object' && v !== null) {
    const keys = Object.keys(v)
    if (keys.length === 0) return false
  }
  return true
}

function filteredFields(fields: DetailField[]): DetailField[] {
  const userFiltered = fields.filter((f) => !isUserField(f))
  return onlyShowValued.value ? userFiltered.filter(hasValue) : userFiltered
}

const filteredSummaryGrid = computed(() => filteredFields(rawSummaryGrid.value))

const filteredUserFields = computed(() => {
  return onlyShowValued.value ? allUserFields.value.filter(hasValue) : allUserFields.value
})

const hasSummaryPanel = computed(() => {
  if (customFieldTabGroup.value) return true
  if (filteredSummaryGrid.value.length > 0) return true
  if (customFieldPlain.value && filteredFields(customFieldPlain.value.fields).length > 0) return true
  return !onlyShowValued.value
})

// ======================= lifecycle =======================

watch(
  () => props.open,
  (val) => {
    if (val && props.issueKey) {
      fetchDetail()
    }
  },
)

async function fetchDetail() {
  loading.value = true
  detailData.value = null
  activeTab.value = ''
  try {
    const res = await queryDetail({ key: props.issueKey })
    if (res?.success && res.data) {
      detailData.value = res.data
      if (customFieldTabGroup.value && customFieldTabGroup.value.tabItems.length > 0) {
        activeTab.value = customFieldTabGroup.value.tabItems[0].title
      }
    }
  } catch {
    detailData.value = null
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:open', false)
}

// ======================= value formatting =======================

function formatFieldValue(field: DetailField): string {
  const { type, value } = field
  if (!hasValue(field)) return '—'
  switch (type) {
    case 'TEXT_BOX_SINGLE_LINE':
    case 'TEXT_BOX_MULTI_LINE':
    case 'NUMERIC_FIELD':
      return String(value)
    case 'SELECT_LIST_SINGLE':
    case 'SELECT_LIST_SINGLE_PROJECT':
    case 'SELECT_LIST_SINGLE_ISSUETYPE':
    case 'SELECT_LIST_SINGLE_PRIORITY':
    case 'SECURITY_FIELD':
    case 'SPRINT_FIELD':
      return formatObject(value)
    case 'SELECT_USER_SINGLE':
      return formatUser(value)
    case 'VIEW_WATCH_FIELD': {
      const obj = (value ?? {}) as Record<string, unknown>
      const n = obj.numWatchers ?? 0
      return `关注者 ${n} 人`
    }
    case 'RICH_TEXT':
      return stripHtml(value)
    default:
      if (typeof value === 'string') return value
      return formatObject(value)
  }
}

function formatObject(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v || '—'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if (obj.optionName) return String(obj.optionName)
    if (obj.pname) return String(obj.pname)
    if (obj.key && obj.name) return `${obj.key} - ${obj.name}`
    if (obj.name) return String(obj.name)
    if (obj.label) return String(obj.label)
  }
  return '—'
}

function formatUser(v: unknown): string {
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>
    const s = obj.userEnName ?? obj.userCoAccount ?? obj.displayName ?? obj.name
    if (s) return String(s)
  }
  return '—'
}

function stripHtml(v: unknown): string {
  if (typeof v !== 'string') return v == null ? '—' : String(v)
  return v.replace(/<[^>]*>/g, '').trim() || '—'
}

function formatRichText(v: unknown): string {
  if (!hasValue({ id: '', name: '', type: '', value: v } as DetailField)) {
    return '<p style="color:#8c8c8c">暂无描述</p>'
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return '<p style="color:#8c8c8c">暂无描述</p>'
    if (!s.includes('<')) {
      return `<p style="margin:0">${s.replace(/\n/g, '<br/>')}</p>`
    }
    return s
  }
  return String(v)
}
</script>

<style scoped>
/* ============ Root ============ */
.drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f7fa;
}

/* ============ Loading ============ */
.detail-loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 18px;
  flex: 1;
  background:
    radial-gradient(circle at 20% 10%, #e8f3ff 0%, transparent 55%),
    radial-gradient(circle at 80% 20%, #f5f0ff 0%, transparent 55%),
    #ffffff;
}
.loading-text {
  font-size: 13px;
  color: #8c8c8c;
  letter-spacing: 0.3px;
}

/* ============ Empty ============ */
.detail-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 14px;
  flex: 1;
  padding: 0 40px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 0%, #f0f5ff 0%, transparent 60%),
    #ffffff;
}
.empty-illustration {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f0f5ff 0%, #f9f0ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  font-size: 40px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px rgba(22, 119, 255, 0.08);
}
.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}
.empty-desc {
  font-size: 12px;
  color: #8c8c8c;
}

/* ============ Body ============ */
.detail-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f5f7fa;
}

/* ============ Top bar（玻璃质感） ============ */
.top-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  height: 48px;
  flex-shrink: 0;
  background:
    linear-gradient(135deg, #f0f5ff 0%, rgba(255, 255, 255, 0.95) 50%, #faf5ff 100%);
  border-bottom: 1px solid #e6e8ec;
  backdrop-filter: saturate(180%) blur(12px);
}
.top-bar::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0%, #1677ff 50%, transparent 100%);
  opacity: 0.12;
  pointer-events: none;
}
.top-bar-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  max-width: 65%;
}
.tb-crumb-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  box-shadow: 0 2px 6px rgba(22, 119, 255, 0.25);
  flex-shrink: 0;
}
.tb-project {
  color: #262626;
  font-weight: 600;
  font-size: 13px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb-divider { color: #bfbfbf; margin: 0 2px; font-weight: 300; }
.tb-key {
  color: #1677ff;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(22, 119, 255, 0.08);
  border-radius: 10px;
}

.top-bar-right {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.tb-icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #595959;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(.4,0,.2,1);
  font-size: 13px;
}
.tb-icon-btn:hover {
  background: #ffffff;
  color: #1677ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.tb-vdiv {
  width: 1px;
  height: 16px;
  background: #e0e0e0;
  margin: 0 4px;
}
.tb-close:hover {
  background: #fff1f0 !important;
  color: #ff4d4f !important;
}

/* ============ Title 区 ============ */
.title-section {
  position: relative;
  padding: 20px 26px 14px;
  flex-shrink: 0;
  background: #ffffff;
  border-bottom: 1px solid #eef0f2;
  overflow: hidden;
}
.title-section::before {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 240px; height: 100%;
  background: radial-gradient(ellipse at right top, rgba(22, 119, 255, 0.05), transparent 60%);
  pointer-events: none;
}
.title-accent {
  width: 3px;
  height: 20px;
  background: linear-gradient(180deg, #1677ff 0%, #9254de 100%);
  border-radius: 2px;
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
}
.issue-title {
  position: relative;
  margin: 0 0 0 6px;
  font-size: 22px;
  line-height: 1.35;
  color: #1a1a1a;
  font-weight: 700;
  word-break: break-word;
  letter-spacing: -0.2px;
  padding-right: 8px;
}

/* ============ 属性卡（横向，标签分组） ============ */
.attr-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  padding: 14px 26px;
  flex-shrink: 0;
  background:
    linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  border-bottom: 1px solid #eef0f2;
}
.attr-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.attr-item-type {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.attr-item-type .attr-label {
  width: auto;
}
.attr-label {
  font-size: 11px;
  color: #8c8c8c;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-weight: 500;
}
.attr-value-block {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.attr-value {
  font-size: 13px;
  color: #1a1a1a;
  font-weight: 600;
}
.attr-empty {
  color: #bfbfbf;
  font-size: 13px;
  font-style: italic;
}
.attr-check {
  color: #52c41a;
  font-size: 14px;
  filter: drop-shadow(0 1px 1px rgba(82, 196, 26, 0.2));
}
.attr-tag {
  display: inline-flex !important;
  align-items: center;
  gap: 5px;
  padding: 2px 10px !important;
  height: 22px !important;
  line-height: 18px !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  border-radius: 11px !important;
  margin: 0 !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.attr-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
}
.attr-workflow {
  color: #1677ff;
  font-size: 11.5px;
  text-decoration: none;
  cursor: pointer;
  padding-left: 2px;
  transition: opacity 0.15s;
}
.attr-workflow:hover { opacity: 0.75; }

/* Priority chip (渐变质感) */
.priority-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 2px 8px;
  height: 22px;
  border-radius: 11px;
  font-size: 11.5px;
  font-weight: 600;
  border: 1px solid transparent;
  background: #f5f5f5;
  color: #595959;
  transition: transform 0.15s;
}
.priority-chip:hover { transform: translateY(-1px); }
.pc-icon { font-size: 10px; opacity: 0.9; }
.pc-text { line-height: 1; }

.pc-red {
  background: linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%);
  color: #cf1322;
  border-color: #ffa39e;
  box-shadow: 0 1px 2px rgba(245, 34, 45, 0.12);
}
.pc-orange {
  background: linear-gradient(135deg, #fff7e6 0%, #ffd591 100%);
  color: #d46b08;
  border-color: #ffc069;
  box-shadow: 0 1px 2px rgba(250, 140, 22, 0.12);
}
.pc-yellow {
  background: linear-gradient(135deg, #feffe6 0%, #fff1b8 100%);
  color: #d48806;
  border-color: #ffe58f;
  box-shadow: 0 1px 2px rgba(250, 173, 20, 0.12);
}
.pc-default {
  background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
  color: #595959;
  border-color: #d9d9d9;
}

/* ============ Action bar ============ */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 26px 12px;
  background: #ffffff;
  border-bottom: 1px solid #eef0f2;
  flex-shrink: 0;
  gap: 10px;
}
.action-bar-left {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.action-btn {
  height: 28px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  border-radius: 6px !important;
  font-weight: 500;
  transition: all 0.18s cubic-bezier(.4,0,.2,1) !important;
}
.action-btn:hover {
  transform: translateY(-1px);
}
.action-divider {
  width: 1px;
  height: 16px;
  background: #e8e8e8;
  margin: 0 6px;
}
.action-primary {
  height: 28px !important;
  font-weight: 600 !important;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%) !important;
  box-shadow: 0 2px 6px rgba(22, 119, 255, 0.28) !important;
  border-color: transparent !important;
}
.action-primary:hover {
  box-shadow: 0 3px 10px rgba(22, 119, 255, 0.38) !important;
}
.action-groupchat {
  height: 28px !important;
  margin-left: 4px;
  background: linear-gradient(135deg, #e6f4ff 0%, #f0e6ff 100%) !important;
  color: #1677ff !important;
  border-color: rgba(22, 119, 255, 0.2) !important;
  font-weight: 500 !important;
}

.action-bar-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.switch-label {
  font-size: 12px;
  color: #595959;
  user-select: none;
}

/* ============ Scroll area ============ */
.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #f5f7fa;
}
.scroll-inner {
  padding: 16px 20px 8px;
  max-width: 100%;
}

/* ============ Panel card 面板卡片 ============ */
.panel-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e9ecf0;
  margin-bottom: 14px;
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 2px 8px rgba(0, 0, 0, 0.025);
  transition:
    box-shadow 0.2s cubic-bezier(.4,0,.2,1),
    transform 0.2s cubic-bezier(.4,0,.2,1),
    border-color 0.2s;
}
.panel-card:hover {
  border-color: #d9e0e8;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.03),
    0 8px 24px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}
.panel-card-dim {
  opacity: 0.92;
  background: linear-gradient(180deg, #ffffff 0%, #fcfcfd 100%);
}

/* 卡片头部 */
.panel-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background:
    linear-gradient(180deg, #fafbfc 0%, #ffffff 100%);
  border-bottom: 1px solid #f0f2f5;
}
.pch-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: 0.2px;
}
.pch-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}
.pch-dot-blue   { background: linear-gradient(135deg, #1677ff, #4096ff); box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12); }
.pch-dot-green  { background: linear-gradient(135deg, #52c41a, #73d13d); box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.12); }
.pch-dot-purple { background: linear-gradient(135deg, #722ed1, #9254de); box-shadow: 0 0 0 3px rgba(114, 46, 209, 0.12); }
.pch-dot-orange { background: linear-gradient(135deg, #fa8c16, #ffa940); box-shadow: 0 0 0 3px rgba(250, 140, 22, 0.12); }
.pch-dot-cyan   { background: linear-gradient(135deg, #13c2c2, #36cfc9); box-shadow: 0 0 0 3px rgba(19, 194, 194, 0.12); }

.pch-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}
.pch-meta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: #8c8c8c;
  background: #f5f6f8;
  font-size: 13px;
  transition: all 0.15s;
  cursor: default;
}
.pch-meta:hover { color: #1677ff; background: #e6f4ff; }
.pch-meta.dim { opacity: 0.55; }
.pch-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pch-action-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
}
.pch-action-btn:hover {
  background: #f0f5ff;
  color: #1677ff;
}
.pch-add {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #1677ff;
  background: linear-gradient(135deg, #e6f4ff 0%, #f0e6ff 100%);
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}
.pch-add:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(22, 119, 255, 0.15);
}

/* 卡片体 */
.panel-card-body {
  padding: 14px 16px 16px;
}

/* Tabs inside panel */
.panel-tabs {
  margin-top: -4px;
}
.panel-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 14px !important;
  padding: 0 !important;
  border-bottom: 1px solid #f0f2f5 !important;
  background: transparent !important;
}
.panel-tabs :deep(.ant-tabs-tab) {
  padding: 8px 16px !important;
  font-size: 13px !important;
  color: #595959 !important;
  font-weight: 500 !important;
  transition: all 0.15s !important;
}
.panel-tabs :deep(.ant-tabs-tab:hover) {
  color: #1677ff !important;
}
.panel-tabs :deep(.ant-tabs-tab-active) {
  color: #1677ff !important;
  font-weight: 600 !important;
}
.panel-tabs :deep(.ant-tabs-ink-bar) {
  background: linear-gradient(90deg, #1677ff 0%, #9254de 100%) !important;
  height: 2.5px !important;
  border-radius: 2px;
}

/* KV 列表（行式，斑马纹） */
.kv-list {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #f0f2f5;
}
.kv-list-extra {
  margin-top: 12px;
}
.kv-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
  padding: 8px 12px 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fafbfc;
  border-bottom: 1px solid #f0f2f5;
}
.kv-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 14px;
  align-items: start;
  padding: 10px 14px;
  background: #ffffff;
  transition: background 0.15s;
}
.kv-row + .kv-row {
  border-top: 1px solid #f5f6f8;
}
.kv-row:hover {
  background: #fafbfd;
}
.kv-row-alt {
  background: #fcfcfd;
}
.kv-label {
  display: flex;
  align-items: flex-start;
  padding-top: 1px;
}
.kv-label-inner {
  font-size: 12.5px;
  color: #6b7280;
  font-weight: 500;
  line-height: 22px;
}
.kv-value {
  font-size: 13px;
  line-height: 22px;
  color: #1a1a1a;
  min-height: 22px;
  word-break: break-word;
  min-width: 0;
  display: flex;
  align-items: center;
}

/* User row */
.user-row .kv-value { min-height: 28px; }
.user-cell-pretty {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}
.ucp-share {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #bfbfbf;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  flex-shrink: 0;
}
.ucp-share:hover {
  color: #1677ff;
  background: #e6f4ff;
}

/* Description content */
.desc-content {
  background:
    linear-gradient(180deg, #fbfcfe 0%, #f7f9fc 100%);
  border: 1px solid #eef2f7;
  border-left: 3px solid #52c41a;
  border-radius: 8px;
  padding: 14px 18px;
  font-size: 13.5px;
  line-height: 1.75;
  color: #262626;
  word-break: break-word;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}
.desc-content :deep(p) { margin: 0 0 10px; }
.desc-content :deep(p:last-child) { margin-bottom: 0; }
.desc-content :deep(a) {
  color: #1677ff;
  text-decoration: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(22, 119, 255, 0.06);
  transition: background 0.15s;
}
.desc-content :deep(a:hover) {
  background: rgba(22, 119, 255, 0.12);
  text-decoration: underline;
}
.desc-content :deep(img) {
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid #e6e8eb;
}
.desc-content :deep(h1),
.desc-content :deep(h2),
.desc-content :deep(h3) {
  margin: 14px 0 8px;
  color: #1f1f1f;
}
.desc-content :deep(ul),
.desc-content :deep(ol) { padding-left: 22px; margin: 0 0 10px; }
.desc-content :deep(li) { margin: 3px 0; }
.desc-content :deep(code) {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  color: #cf1322;
}
.desc-content :deep(pre) {
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
}
.desc-content :deep(pre code) {
  background: transparent;
  border: none;
  color: inherit;
  padding: 0;
}

.footer-spacer { height: 28px; }

/* Scrollbar */
.detail-scroll {
  scrollbar-width: thin;
  scrollbar-color: #cfd3d8 transparent;
}
.detail-scroll::-webkit-scrollbar { width: 8px; }
.detail-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #d9dde1, #cfd3d8);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.detail-scroll::-webkit-scrollbar-thumb:hover {
  background: #a8b0b8;
  background-clip: content-box;
  border: 2px solid transparent;
}
</style>
