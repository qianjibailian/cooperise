<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <h2 class="mgmt-title">国际化翻译</h2>
      <div class="header-actions">
        <a-button type="primary" class="mgmt-create-btn" @click="openCreate">
          <PlusOutlined /> 新增
        </a-button>
      </div>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索中文原词 / 英文译文 / 备注"
          allow-clear
          class="mgmt-search"
          @press-enter="handleSearch"
          @change="onKeywordChange"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <span class="lang-chip">中文 → English</span>
        <a-tooltip title="刷新">
          <button class="mgmt-icon-btn" :disabled="loading" @click="loadList"><ReloadOutlined /></button>
        </a-tooltip>
      </div>

      <a-table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 960 }"
        class="mgmt-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <!-- 原词 / 译文都是要原样展示的数据，不参与页面的运行时翻译 -->
          <template v-if="column.key === 'sourceText'">
            <span class="source-text" data-no-i18n :title="record.sourceText">{{ record.sourceText }}</span>
          </template>
          <template v-else-if="column.key === 'targetText'">
            <span class="target-text" data-no-i18n :title="record.targetText">{{ record.targetText }}</span>
          </template>
          <template v-else-if="column.key === 'remark'">
            <span class="ellipsis text-muted" :title="record.remark">{{ record.remark || '-' }}</span>
          </template>
          <template v-else-if="column.key === 'updatedAt'">
            <span class="text-muted">{{ formatTime(record.updatedAt) }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-tooltip title="编辑">
                <span class="row-action" @click="openEdit(record as I18nItem)"><EditOutlined /></span>
              </a-tooltip>
              <a-tooltip title="删除">
                <span class="row-action danger" @click="confirmDelete(record as I18nItem)"><DeleteOutlined /></span>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? '编辑翻译' : '新增翻译'"
      :width="880"
      class="modal-landscape"
      centered
      destroy-on-close
      :ok-text="editingId ? '保存' : '创建'"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="中文原词" name="sourceText" extra="与页面上显示的中文完全一致；可用 {0} {1} 表示变化的部分，如「共 {0} 条」">
          <a-textarea v-model:value="form.sourceText" placeholder="如 新建空间" :auto-size="{ minRows: 1, maxRows: 4 }" :maxlength="500" />
        </a-form-item>
        <a-form-item label="英文译文" name="targetText" extra="原词里有 {0} {1} 时，译文里用同样的占位，如「{0} items in total」">
          <a-textarea v-model:value="form.targetText" placeholder="如 New space" :auto-size="{ minRows: 1, maxRows: 4 }" :maxlength="1000" />
        </a-form-item>
        <a-form-item label="备注" name="remark">
          <a-input v-model:value="form.remark" placeholder="选填，如使用位置" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, type FormInstance, type TablePaginationConfig } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import dayjs from 'dayjs'
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { queryI18n, createI18n, updateI18n, deleteI18n, type I18nItem } from '@/api/faiz'
import { loadRemoteDictionary } from '@/i18n'

const LANG = 'en'

const columns = [
  { title: '中文原词', key: 'sourceText', width: 300 },
  { title: '英文译文', key: 'targetText', width: 340 },
  { title: '备注', key: 'remark', ellipsis: true },
  { title: '更新时间', key: 'updatedAt', width: 170 },
  { title: '操作', key: 'action', width: 100, fixed: 'right' as const },
]

// ---- 列表 ----
const loading = ref(false)
const list = ref<I18nItem[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`,
}))

async function loadList() {
  loading.value = true
  try {
    const res = await queryI18n({
      keyword: keyword.value.trim() || undefined,
      lang: LANG,
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res?.success) {
      list.value = res.data?.list || []
      total.value = Number(res.data?.total || 0)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadList()
}

/** 清空搜索框时立即刷新 */
function onKeywordChange() {
  if (!keyword.value) handleSearch()
}

function handleTableChange(p: TablePaginationConfig) {
  page.value = p.current || 1
  pageSize.value = p.pageSize || 20
  loadList()
}

function formatTime(v?: string) {
  return v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
}

/** 翻译有变动：刷新列表，并让当前页面立即用上新译文 */
function afterChange() {
  loadList()
  loadRemoteDictionary()
}

// ---- 新增 / 编辑 ----
const modalOpen = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const emptyForm = () => ({ sourceText: '', targetText: '', remark: '' })
const form = reactive(emptyForm())

const rules: Record<string, Rule[]> = {
  sourceText: [{ required: true, whitespace: true, message: '请输入中文原词' }],
  targetText: [{ required: true, whitespace: true, message: '请输入英文译文' }],
}

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  modalOpen.value = true
}

function openEdit(r: I18nItem) {
  editingId.value = r.id
  Object.assign(form, { sourceText: r.sourceText ?? '', targetText: r.targetText ?? '', remark: r.remark ?? '' })
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
    const payload = {
      sourceText: form.sourceText.trim(),
      targetText: form.targetText.trim(),
      remark: form.remark.trim(),
      lang: LANG,
    }
    const res = editingId.value
      ? await updateI18n({ ...payload, id: editingId.value })
      : await createI18n(payload)
    if (res?.success) {
      modalOpen.value = false
      if (!editingId.value) page.value = 1
      afterChange()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

// ---- 删除 ----
function confirmDelete(r: I18nItem) {
  Modal.confirm({
    title: `删除「${r.sourceText}」的翻译？`,
    content: '删除后英文模式下该文案显示中文原文。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      try {
        const res = await deleteI18n(r.id)
        if (res?.success) {
          if (list.value.length === 1 && page.value > 1) page.value--
          afterChange()
        }
      } catch {
        // 请求层已统一提示
      }
    },
  })
}

onMounted(loadList)
</script>

<style scoped>
.mgmt-page {
  padding: 20px 24px 32px;
}

.mgmt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.mgmt-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
}

.mgmt-create-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-weight: 500;
  box-shadow: 0 2px 8px transparent;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--c-primary) 24%, transparent);
}

.mgmt-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mgmt-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mgmt-search {
  width: 300px;
  height: 34px;
  border-radius: 10px;
  background: #f5f5f7;
  border-color: transparent;
}

.mgmt-search:hover,
.mgmt-search:focus-within {
  background: #fff;
  border-color: #d2d2d7;
}

.mgmt-search :deep(.ant-input) {
  background: transparent;
}

.mgmt-search-icon {
  color: #aeaeb2;
}

.mgmt-icon-btn {
  margin-left: auto;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6e6e73;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.mgmt-icon-btn:hover:not(:disabled) {
  background: #f2f2f5;
}

.mgmt-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 500;
  color: #86868b;
  background: #fafafc;
}

.mgmt-table :deep(.ant-table-tbody > tr > td) {
  font-size: 13px;
}




.code-chip {
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 6px;
}

.text-muted {
  color: #6e6e73;
}




.ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: inline-flex;
  gap: 2px;
}

.row-action {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #6e6e73;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.row-action:hover {
  color: #1d1d1f;
  background: #e9e9ee;
}

.row-action.danger {
  color: #ff453a;
}

.row-action.danger:hover {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.1);
}

@media (max-width: 768px) {
  .mgmt-page {
    padding: 16px;
  }

  .mgmt-toolbar {
    flex-wrap: wrap;
  }

  .mgmt-search {
    flex: 1 1 100%;
    width: auto;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  background: #f2f4f7;
  color: #5c6370;
  font-size: 12px;
}

.source-text,
.target-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  white-space: pre-wrap;
}

.source-text {
  color: #1f2329;
  font-weight: 500;
}

.target-text {
  color: #3d4757;
}
</style>
