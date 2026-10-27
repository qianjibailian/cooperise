<template>
  <a-modal
    v-model:open="visible"
    :title="modalTitle"
    :width="480"
    centered
    destroy-on-close
    :confirm-loading="submitting"
    :ok-text="action === 'renameGroup' || action === 'editView' ? '保存' : '创建'"
    cancel-text="取消"
    class="create-view-modal"
    @ok="handleSubmit"
  >
    <a-segmented v-if="action === 'create'" v-model:value="mode" :options="modeOptions" block class="cv-mode" />
    <!-- 文件夹内新建：以标签形式展示所属文件夹 -->
    <div v-if="action === 'createInGroup' && group" class="cv-folder-hint">
      <span class="cv-folder-hint-label">所属文件夹</span>
      <span class="cv-folder-chip">
        <FolderOutlined />
        <span class="cv-folder-chip-name">{{ group.groupName }}</span>
      </span>
    </div>
    <a-form ref="formRef" :model="form" layout="vertical" class="cv-form">
      <template v-if="mode === 'view'">
        <a-form-item label="视图名称" name="filterName" :rules="[{ required: true, whitespace: true, message: '请输入视图名称' }]">
          <a-input v-model:value="form.filterName" placeholder="请输入视图名称" :maxlength="50" show-count />
        </a-form-item>
        <a-form-item label="视图类型" name="viewType">
          <a-radio-group v-model:value="form.viewType" class="cv-type-group">
            <a-radio-button v-for="t in viewTypeOptions" :key="t.value" :value="t.value">
              <ViewTypeIcon :type="t.value" />
              <span>{{ t.label }}</span>
            </a-radio-button>
          </a-radio-group>
        </a-form-item>
      </template>
      <a-form-item v-else label="文件夹名称" name="groupName" :rules="[{ required: true, whitespace: true, message: '请输入文件夹名称' }]">
        <a-input v-model:value="form.groupName" placeholder="请输入文件夹名称" :maxlength="50" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import { FolderOutlined } from '@ant-design/icons-vue'
import ViewTypeIcon from '@/components/ViewTypeIcon.vue'
import { createView, createViewGroup, updateViewGroup, updateView } from '@/api/faiz'
import type { ViewGroup, ViewItem } from '@/types/faiz'

const props = withDefaults(defineProps<{
  open: boolean
  /** create：顶部「+」新建视图/文件夹；createInGroup：在文件夹内新建视图；renameGroup：编辑文件夹名称；editView：编辑视图 */
  action?: 'create' | 'createInGroup' | 'renameGroup' | 'editView'
  /** createInGroup / renameGroup 时的目标文件夹 */
  group?: ViewGroup | null
  /** editView 时的目标视图 */
  view?: ViewItem | null
}>(), {
  action: 'create',
  group: null,
  view: null,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': []
}>()

const visible = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const mode = ref<'view' | 'folder'>('view')
const modeOptions = [
  { label: '视图', value: 'view' },
  { label: '文件夹', value: 'folder' },
]

/** 视图类型与侧边栏图标映射保持一致 */
const viewTypeOptions = [
  { value: 'list', label: '列表' },
  { value: 'KAN_BAN', label: '看板' },
  { value: 'gantt', label: '甘特' },
  { value: 'CALENDAR_VIEW', label: '日历' },
]

const modalTitle = computed(() => {
  if (props.action === 'createInGroup') return '新建视图'
  if (props.action === 'renameGroup') return '编辑文件夹'
  if (props.action === 'editView') return '编辑视图'
  return '新建'
})

const formRef = ref<FormInstance>()
const form = reactive({
  filterName: '',
  viewType: 'list',
  groupName: '',
})
const submitting = ref(false)

// 每次打开重置为「新建视图」初始状态
watch(
  () => props.open,
  (open) => {
    if (!open) return
    mode.value = props.action === 'renameGroup' ? 'folder' : 'view'
    form.filterName = props.action === 'editView' ? (props.view?.filterName ?? '') : ''
    form.viewType = props.action === 'editView' ? (props.view?.viewType || 'list') : 'list'
    form.groupName = props.action === 'renameGroup' ? (props.group?.groupName ?? '') : ''
  },
)

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    let res
    let okText: string
    if (props.action === 'renameGroup') {
      res = await updateViewGroup({ groupCode: props.group?.groupCode ?? '', groupName: form.groupName.trim() })
      okText = '文件夹已更新'
    } else if (props.action === 'editView') {
      res = await updateView({ filterCode: props.view?.filterCode ?? '', filterName: form.filterName.trim(), viewType: form.viewType })
      okText = '视图已更新'
    } else if (mode.value === 'view') {
      const groupCode = props.action === 'createInGroup' ? (props.group?.groupCode ?? undefined) : undefined
      res = await createView({ filterName: form.filterName.trim(), viewType: form.viewType, groupCode })
      okText = '视图已创建'
    } else {
      res = await createViewGroup({ groupName: form.groupName.trim() })
      okText = '文件夹已创建'
    }
    if (res?.success) {
      message.success(okText)
      emit('created')
      visible.value = false
    } else {
      message.error(res?.message || '操作失败')
    }
  } catch {
    message.error('操作失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style>
.create-view-modal .ant-modal-content {
  border-radius: 14px;
}

.create-view-modal .cv-mode {
  margin: 4px 0 16px;
}

.create-view-modal .cv-folder-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 16px;
}

.create-view-modal .cv-folder-hint-label {
  font-size: 13px;
  color: #64748b;
}

.create-view-modal .cv-folder-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #0f172a;
  font-size: 13px;
  font-weight: 500;
}

.create-view-modal .cv-folder-chip .anticon {
  color: #64748b;
  font-size: 13px;
}

.create-view-modal .cv-folder-chip-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-view-modal .cv-form .ant-form-item {
  margin-bottom: 16px;
}

.create-view-modal .cv-type-group {
  display: flex;
  width: 100%;
}

.create-view-modal .cv-type-group .ant-radio-button-wrapper {
  flex: 1;
  text-align: center;
}

.create-view-modal .cv-type-group .ant-radio-button-wrapper > span:last-child {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
</style>
