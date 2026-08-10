<template>
  <div class="component-list-page">
    <!-- 搜索与操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="search-box">
          <SearchOutlined class="search-icon" />
          <input v-model="searchValue" class="search-input" placeholder="搜索组件…" @keyup.enter="handleQuery()" />
          <div v-if="searchValue" class="search-clear" @click="searchValue = ''">
            <CloseCircleFilled />
          </div>
        </div>
        <div class="status-filter">
          <span class="filter-label">状态：</span>
          <a-radio-group v-model:value="statusFilter" button-style="solid" @change="handleQuery">
            <a-radio-button :value="undefined">全部</a-radio-button>
            <a-radio-button :value="1">已启用</a-radio-button>
            <a-radio-button :value="0">已禁用</a-radio-button>
          </a-radio-group>
        </div>
        <button class="search-btn" @click="handleQuery"><SearchOutlined /> 查询</button>
      </div>
      <div class="toolbar-actions">
        <button class="create-btn" @click="handleCreate">
          <PlusOutlined /><span>新建组件</span>
        </button>
      </div>
    </div>

    <!-- 统计行 -->
    <div class="stats-row">
      <div class="stat-item"><span class="stat-value">{{ totalCount }}</span><span class="stat-label">组件总数</span></div>
      <div class="stat-divider" />
      <div class="stat-item"><span class="stat-value stat-green">{{ enabledCount }}</span><span class="stat-label">已启用</span></div>
    </div>

    <!-- 卡片列表 -->
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="components.length > 0" class="card-grid">
      <div v-for="comp in components" :key="comp.id"
        :class="['component-card', { disabled: comp.status !== 1 }]"
      >
        <div class="card-header">
          <div class="card-icon">
            <component :is="getIcon(comp.componentKey)" />
          </div>
          <div class="card-header-right">
            <span :class="['status-dot', comp.status === 1 ? 'on' : 'off']" />
            <a-dropdown trigger="click" @click.stop>
              <button class="card-more" @click.stop><MoreOutlined /></button>
              <template #overlay>
                <a-menu @click="handleMenuClick($event, comp)">
                  <a-menu-item key="edit"><EditOutlined /> 编辑</a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="delete" danger><DeleteOutlined /> 删除</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title">{{ comp.name }}</h3>
          <p class="card-desc">{{ comp.description || '暂无描述' }}</p>
        </div>
        <div class="card-footer">
          <div class="card-tags">
            <a-tag color="blue" class="card-tag">{{ getTypeLabel(comp.componentKey) }}</a-tag>
            <a-tag v-if="comp.required === 1" color="red" class="card-tag tag-required">必填</a-tag>
            <a-tag v-else color="default" class="card-tag">选填</a-tag>
          </div>
          <div class="card-meta">
            <span class="meta-item"><AppstoreOutlined /> {{ comp.componentKey }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon-box"><InboxOutlined class="empty-icon" /></div>
      <h3 class="empty-title">{{ searchValue || statusFilter !== undefined ? '未找到匹配的组件' : '还没有组件' }}</h3>
      <p class="empty-desc">{{ searchValue || statusFilter !== undefined ? '尝试更换搜索条件或筛选' : '创建第一个组件' }}</p>
      <button v-if="!searchValue && statusFilter === undefined" class="create-btn-empty" @click="handleCreate">
        <PlusOutlined /> 新建组件
      </button>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar" v-if="!loading && totalCount > 0">
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

    <!-- 新增/编辑弹窗 -->
    <a-modal
      v-model:open="showEditModal"
      :title="isEdit ? '编辑组件' : '新建组件'"
      width="600px"
      :footer="null"
      destroy-on-close
      class="edit-modal"
    >
      <a-form :model="editForm" layout="vertical" :disabled="detailLoading">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="组件标题" required>
              <a-input v-model:value="editForm.name" placeholder="输入组件名称" size="large" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="组件类型" required>
              <a-select v-model:value="editForm.componentKey" placeholder="选择类型" size="large">
                <a-select-option v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="是否必填">
              <a-switch :checked="editForm.required === 1" checked-children="必填" un-checked-children="选填" @change="(v: boolean) => (editForm.required = v ? 1 : 0)" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-switch :checked="editForm.status === 1" checked-children="启用" un-checked-children="停用" @change="(v: boolean) => (editForm.status = v ? 1 : 0)" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="描述">
          <a-textarea v-model:value="editForm.description" placeholder="简要描述组件用途" :rows="3" />
        </a-form-item>
        <a-form-item v-if="isEnumType" label="枚举值配置">
          <div class="enum-config">
            <template v-if="isCascader">
              <CascaderNodeEditor
                v-for="(opt, idx) in enumOptions"
                :key="idx"
                :node="opt"
                @remove="removeEnumOption(idx)"
              />
            </template>
            <template v-else>
              <div v-for="(opt, idx) in enumOptions" :key="idx" class="enum-row">
                <a-input v-model:value="opt.label" placeholder="显示名称" size="small" />
                <a-input v-model:value="opt.value" placeholder="存储值" size="small" />
                <a-button size="small" danger @click="removeEnumOption(idx)"><DeleteOutlined /></a-button>
              </div>
            </template>
            <a-button size="small" type="dashed" block @click="addEnumOption"><PlusOutlined /> 添加选项</a-button>
          </div>
        </a-form-item>
        <a-form-item label="组件样式预览">
          <div class="style-preview">
            <div v-if="!editForm.componentKey" class="preview-empty">
              <AppstoreOutlined /><span>请先选择组件类型查看预览</span>
            </div>
            <div v-else class="preview-field">
              <span class="preview-field-label">
                <span v-if="editForm.required === 1" class="required-star">*</span>
                {{ editForm.name || '组件标题' }}
              </span>
              <div class="preview-field-control">
                <a-input v-if="editForm.componentKey === 'input_text'" placeholder="请输入" size="small" />
                <a-textarea v-else-if="editForm.componentKey === 'textarea'" placeholder="请输入" :rows="2" />
                <a-input-number v-else-if="editForm.componentKey === 'input_number'" placeholder="请输入数字" style="width:100%" size="small" />
                <a-select v-else-if="editForm.componentKey === 'select_single'" placeholder="请选择" size="small">
                  <a-select-option v-for="(opt, i) in enumOptions" :key="i" :value="opt.value">{{ opt.label || opt.value }}</a-select-option>
                </a-select>
                <a-select v-else-if="editForm.componentKey === 'select_multiple'" mode="multiple" placeholder="请选择" size="small">
                  <a-select-option v-for="(opt, i) in enumOptions" :key="i" :value="opt.value">{{ opt.label || opt.value }}</a-select-option>
                </a-select>
                <a-checkbox-group v-else-if="editForm.componentKey === 'checkbox_group'" :options="[{ label: '选项A', value: 'a' }, { label: '选项B', value: 'b' }]" />
                <a-radio-group v-else-if="editForm.componentKey === 'radio_group'" :options="[{ label: '选项A', value: 'a' }, { label: '选项B', value: 'b' }]" />
                <a-date-picker v-else-if="editForm.componentKey === 'date_picker'" style="width:100%" size="small" placeholder="请选择日期" />
                <a-date-picker v-else-if="editForm.componentKey === 'datetime_picker'" show-time style="width:100%" size="small" placeholder="请选择日期时间" />
                <a-time-picker v-else-if="editForm.componentKey === 'time'" style="width:100%" size="small" placeholder="请选择时间" />
                <div v-else-if="editForm.componentKey === 'image'" class="preview-image">
                  <PictureOutlined /><span>示例图片</span>
                </div>
                <a-upload v-else-if="editForm.componentKey === 'upload'" :before-upload="() => false" :max-count="1">
                  <a-button size="small"><UploadOutlined /> 点击上传</a-button>
                </a-upload>
                <a-input v-else-if="editForm.componentKey === 'location'" placeholder="请选择位置" size="small" readonly>
                  <template #prefix><EnvironmentOutlined /></template>
                </a-input>
                <a-select
                  v-else-if="editForm.componentKey === 'member'"
                  v-model:value="memberPreviewValue"
                  mode="multiple"
                  placeholder="搜索姓名/拼音/账号"
                  size="small"
                  show-search
                  :filter="false"
                  :options="memberOptions"
                  :field-names="{ label: 'userEnName', value: 'userNo' }"
                  :loading="memberLoading"
                  @search="handleMemberSearch"
                />
                <a-input v-else-if="editForm.componentKey === 'link'" placeholder="请输入链接" size="small">
                  <template #prefix><LinkOutlined /></template>
                </a-input>
                <WangEditor v-else-if="editForm.componentKey === 'rich_text'" placeholder="请输入富文本内容" :height="380" class="preview-rich" />
                <a-cascader v-else-if="editForm.componentKey === 'cascader'" :options="enumOptions" placeholder="请选择" size="small" style="width:100%" />
              </div>
            </div>
          </div>
        </a-form-item>
      </a-form>
      <div class="modal-footer">
        <a-space>
          <a-button @click="showEditModal = false">取消</a-button>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">保存</a-button>
        </a-space>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  SearchOutlined, CloseCircleFilled, AppstoreOutlined, InboxOutlined, PlusOutlined,
  MoreOutlined, EditOutlined, DeleteOutlined,
  FontSizeOutlined, CheckSquareOutlined, DownCircleOutlined,
  CalendarOutlined, ClockCircleOutlined, NumberOutlined,
  PictureOutlined, UploadOutlined, EnvironmentOutlined,
  TeamOutlined, LinkOutlined, BlockOutlined, ApartmentOutlined,
} from '@ant-design/icons-vue'
import type { Component } from 'vue'
import { WangEditor } from '@vxe-ui/plugin-render-wangeditor'
import CascaderNodeEditor from '@/components/CascaderNodeEditor.vue'
import type { CascaderOption } from '@/components/CascaderNodeEditor.vue'
import { queryComponents, getComponent, createComponent, updateComponent, deleteComponent, queryUsers } from '@/api/faiz'
import type { ComponentItem, UserItem } from '@/types/faiz'

// ---- 常量 ----
const typeOptions = [
  { value: 'input_text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'input_number', label: '数字输入框' },
  { value: 'select_single', label: '单选下拉' },
  { value: 'select_multiple', label: '多选下拉' },
  { value: 'date_picker', label: '日期' },
  { value: 'datetime_picker', label: '日期时间' },
  { value: 'radio_group', label: '单选框组' },
  { value: 'checkbox_group', label: '复选框组' },
  { value: 'time', label: '时间' },
  { value: 'image', label: '图片' },
  { value: 'upload', label: '附件' },
  { value: 'location', label: '定位' },
  { value: 'member', label: '成员' },
  { value: 'link', label: '链接' },
  { value: 'rich_text', label: '富文本' },
  { value: 'cascader', label: '级联选择器' },
]

const iconMap: Record<string, Component> = {
  input_text: FontSizeOutlined,
  textarea: BlockOutlined,
  input_number: NumberOutlined,
  select_single: DownCircleOutlined,
  select_multiple: DownCircleOutlined,
  date_picker: CalendarOutlined,
  datetime_picker: ClockCircleOutlined,
  radio_group: CheckSquareOutlined,
  checkbox_group: CheckSquareOutlined,
  time: ClockCircleOutlined,
  image: PictureOutlined,
  upload: UploadOutlined,
  location: EnvironmentOutlined,
  member: TeamOutlined,
  link: LinkOutlined,
  rich_text: EditOutlined,
  cascader: ApartmentOutlined,
}

function getIcon(componentKey: string): Component {
  return iconMap[componentKey] || AppstoreOutlined
}

function getTypeLabel(componentKey: string): string {
  return typeOptions.find(t => t.value === componentKey)?.label || componentKey
}

// ---- 成员预览：远程搜索 ----
const memberPreviewValue = ref<string[]>([])
const memberOptions = ref<UserItem[]>([])
const memberLoading = ref(false)
let memberSearchTimer: ReturnType<typeof setTimeout> | null = null
function handleMemberSearch(keyword: string) {
  if (memberSearchTimer) clearTimeout(memberSearchTimer)
  memberSearchTimer = setTimeout(async () => {
    memberLoading.value = true
    try {
      const res = await queryUsers({ keyword, isActive: 1, page: 1, pageSize: 20 })
      if (res.success && res.data) {
        memberOptions.value = res.data.list || []
      }
    } catch {
      memberOptions.value = []
    } finally {
      memberLoading.value = false
    }
  }, 300)
}

// ---- 状态 ----
const searchValue = ref('')
const statusFilter = ref<number | undefined>(undefined)
const components = ref<ComponentItem[]>([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

const showEditModal = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const detailLoading = ref(false)

const editForm = ref<Partial<ComponentItem>>({
  id: 0, name: '', componentKey: '', description: '', required: 0, status: 1,
})

const enumOptions = ref<CascaderOption[]>([])

const isEnumType = computed(() => {
  const k = editForm.value.componentKey
  return k === 'select_single' || k === 'select_multiple' || k === 'cascader'
})
const isCascader = computed(() => editForm.value.componentKey === 'cascader')

function addEnumOption() {
  enumOptions.value.push({ label: '', value: '' })
}
function removeEnumOption(idx: number) {
  enumOptions.value.splice(idx, 1)
}
function syncEnumOptionsFromConfig() {
  const raw = editForm.value.configSchema
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        enumOptions.value = parsed.map((o: unknown) => {
          const item = o as CascaderOption
          const opt: CascaderOption = { label: item?.label ?? '', value: item?.value ?? '' }
          if (Array.isArray(item?.children) && item.children.length) {
            opt.children = cloneChildren(item.children)
          }
          return opt
        })
        return
      }
    } catch {
      // configSchema 非合法 JSON，忽略
    }
  }
  enumOptions.value = []
}
function cloneChildren(list: CascaderOption[]): CascaderOption[] {
  return list.map((c) => {
    const node: CascaderOption = { label: c.label ?? '', value: c.value ?? '' }
    if (Array.isArray(c.children) && c.children.length) {
      node.children = cloneChildren(c.children)
    }
    return node
  })
}
function cleanEnumTree(list: CascaderOption[], currentDepth = 1): CascaderOption[] {
  const maxDepth = 3
  return list
    .filter(o => o.label || o.value)
    .map(o => {
      const node: CascaderOption = { label: o.label, value: o.value }
      if (currentDepth < maxDepth && o.children && o.children.length) {
        const cleaned = cleanEnumTree(o.children, currentDepth + 1)
        if (cleaned.length) node.children = cleaned
      }
      return node
    })
}

// ---- 数据加载 ----
async function loadComponents() {
  loading.value = true
  try {
    const res = await queryComponents({
      keyword: searchValue.value.trim(),
      status: statusFilter.value,
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res.success) {
      components.value = res.data?.list || []
      totalCount.value = res.data?.total || 0
    }
  } catch {
    message.error('加载组件列表失败')
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  page.value = 1
  loadComponents()
}

function handlePageChange(cur: number, size: number) {
  page.value = cur
  pageSize.value = size
  loadComponents()
}

function handleSizeChange(_cur: number, size: number) {
  page.value = 1
  pageSize.value = size
  loadComponents()
}

// ---- 计算属性 ----
const enabledCount = computed(() => {
  if (statusFilter.value === 1) return components.value.length
  return components.value.filter(c => c.status === 1).length
})

// ---- CRUD ----
function handleCreate() {
  isEdit.value = false
  editForm.value = { id: 0, name: '', componentKey: '', description: '', required: 0, status: 1, configSchema: null }
  enumOptions.value = []
  showEditModal.value = true
}

async function handleEdit(comp: ComponentItem) {
  isEdit.value = true
  showEditModal.value = true
  detailLoading.value = true
  try {
    const res = await getComponent(comp.id)
    if (res.success && res.data) {
      editForm.value = { ...res.data }
      syncEnumOptionsFromConfig()
    } else {
      message.error(res.message || '获取详情失败')
      showEditModal.value = false
    }
  } catch {
    message.error('获取详情失败')
    showEditModal.value = false
  } finally {
    detailLoading.value = false
  }
}

async function handleSubmit() {
  if (!editForm.value.name?.trim()) { message.warning('请输入组件标题'); return }
  if (!editForm.value.componentKey) { message.warning('请选择组件类型'); return }
  submitting.value = true
  try {
    const payload: Record<string, unknown> = {
      name: editForm.value.name,
      componentKey: editForm.value.componentKey,
      description: editForm.value.description || '',
      required: editForm.value.required ?? 0,
      status: editForm.value.status ?? 1,
      configSchema: isEnumType.value ? JSON.stringify(cleanEnumTree(enumOptions.value)) : null,
    }
    if (isEdit.value && editForm.value.id) {
      const res = await updateComponent(Number(editForm.value.id), payload)
      if (res.success) message.success('更新成功')
      else message.error(res.message || '更新失败')
    } else {
      const res = await createComponent(payload)
      if (res.success) message.success('创建成功')
      else message.error(res.message || '创建失败')
    }
    showEditModal.value = false
    loadComponents()
  } catch {
    message.error(isEdit.value ? '更新失败' : '创建失败')
  } finally {
    submitting.value = false
  }
}

function handleDelete(comp: ComponentItem) {
  Modal.confirm({
    title: '删除组件',
    content: `确定要删除「${comp.name}」吗？删除后不可恢复。`,
    okText: '删除', cancelText: '取消', okType: 'danger',
    onOk: async () => {
      try {
        const res = await deleteComponent(comp.id)
        if (res.success) { message.success('已删除'); loadComponents() }
        else message.error(res.message || '删除失败')
      } catch { message.error('删除失败') }
    },
  })
}

function handleMenuClick({ key }: { key: string }, comp: ComponentItem) {
  if (key === 'edit') handleEdit(comp)
  else if (key === 'delete') handleDelete(comp)
}

onMounted(loadComponents)
</script>

<style scoped>
.component-list-page {
  padding: 0 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
}

/* ---- toolbar ---- */
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.toolbar-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; flex-wrap: wrap; }
.search-box { flex: 1; min-width: 260px; position: relative; display: flex; align-items: center; background: #f5f5f7; border-radius: 14px; transition: background 0.2s, box-shadow 0.2s; }
.search-box:focus-within { background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
.search-icon { font-size: 16px; color: #86868b; margin-left: 14px; flex-shrink: 0; }
.search-input { flex: 1; border: none; background: transparent; padding: 11px 12px 11px 10px; font-size: 15px; color: #1d1d1f; outline: none; font-family: inherit; }
.search-input::placeholder { color: #aeaeb2; }
.search-clear { padding: 0 12px; cursor: pointer; color: #aeaeb2; font-size: 16px; display: flex; align-items: center; }
.search-clear:hover { color: #6e6e73; }
.status-filter { display: flex; align-items: center; gap: 4px; }
.filter-label { font-size: 14px; color: #6e6e73; flex-shrink: 0; }
.search-btn { display: inline-flex; align-items: center; gap: 6px; border: none; background: #3b82f6; color: #fff; padding: 9px 18px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s; font-family: inherit; white-space: nowrap; }
.search-btn:hover { background: #2563eb; }
.toolbar-actions { display: flex; align-items: center; gap: 12px; }
.create-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; background: #1d1d1f; color: #fff; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; white-space: nowrap; }
.create-btn:hover { background: #333; transform: scale(1.02); }

/* ---- stats ---- */
.stats-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.stat-item { display: flex; align-items: baseline; gap: 6px; }
.stat-value { font-size: 22px; font-weight: 700; color: #1d1d1f; letter-spacing: -0.3px; }
.stat-label { font-size: 13px; color: #86868b; font-weight: 500; }
.stat-green { color: #34c759; }
.stat-blue { color: #007aff; }
.stat-divider { width: 1px; height: 20px; background: #e5e5ea; }

/* ---- card grid ---- */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; width: 100%; }
.component-card { background: #fff; border-radius: 18px; padding: 22px; border: 1.5px solid transparent; box-shadow: 0 1px 3px rgba(0,0,0,.04); transition: all 0.25s cubic-bezier(.4,0,.2,1); display: flex; flex-direction: column; gap: 14px; }
.component-card:hover { border-color: #e5e5ea; box-shadow: 0 8px 24px rgba(0,0,0,.08); transform: translateY(-2px); }
.component-card.disabled { opacity: 0.6; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; }
.card-icon { width: 44px; height: 44px; border-radius: 13px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff; flex-shrink: 0; background: linear-gradient(135deg, #3b82f6, #2563eb); }
.card-header-right { display: flex; align-items: center; gap: 8px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.on { background: #34c759; box-shadow: 0 0 0 3px rgba(52,199,89,.2); }
.status-dot.off { background: #aeaeb2; }
.card-more { width: 32px; height: 32px; border-radius: 10px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #aeaeb2; font-size: 16px; transition: all 0.15s; }
.card-more:hover { background: #f5f5f7; color: #1d1d1f; }
.card-body { flex: 1; }
.card-title { font-size: 16px; font-weight: 600; color: #1d1d1f; margin: 0 0 4px; line-height: 1.3; }
.card-desc { font-size: 13px; color: #86868b; margin: 0; line-height: 1.5; }
.card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
.card-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.card-tag { font-size: 12px; border-radius: 6px; line-height: 1; }
.card-tag.tag-required { font-weight: 600; }
.card-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #aeaeb2; }
.meta-item { display: flex; align-items: center; gap: 3px; }

/* ---- loading / empty ---- */
.loading-state { text-align: center; color: #86868b; padding: 60px 0; font-size: 14px; }
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
.modal-footer { display: flex; justify-content: flex-end; padding-top: 20px; border-top: 1px solid #f5f5f7; }

/* ---- enum config ---- */
.enum-config { display: flex; flex-direction: column; gap: 8px; }
.enum-row { display: flex; gap: 8px; align-items: center; }
.enum-row .ant-input { flex: 1; }

/* ---- style preview ---- */
.style-preview { background: #f9f9fb; border: 1px dashed #e5e5ea; border-radius: 10px; padding: 16px; min-height: 56px; }
.preview-empty { display: flex; align-items: center; justify-content: center; gap: 6px; color: #aeaeb2; font-size: 13px; padding: 8px 0; }
.preview-field { display: flex; align-items: flex-start; gap: 12px; }
.preview-field-label { font-size: 13px; color: #1d1d1f; font-weight: 500; line-height: 28px; flex-shrink: 0; width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; align-items: center; gap: 2px; }
.required-star { color: #ff4d4f; font-weight: 600; }
.preview-field-control { flex: 1; min-width: 0; }
.preview-field-control :deep(.ant-checkbox-wrapper),
.preview-field-control :deep(.ant-radio-wrapper) { font-size: 13px; }
.preview-image { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; height: 80px; background: #f5f5f7; border-radius: 8px; color: #aeaeb2; font-size: 12px; }
.preview-rich { border: 1px solid #e5e5ea; border-radius: 6px; overflow: hidden; }
.preview-rich :deep(.vxe-wang-editor--toolbar) { border-bottom: 1px solid #e5e5ea; }
.preview-image :deep(.anticon) { font-size: 22px; }
</style>
