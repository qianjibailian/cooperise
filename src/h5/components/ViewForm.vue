<template>
  <!--
    视图 / 文件夹表单（与网页版 CreateViewModal 一致）：
    - create：新建，可在「视图 / 文件夹」间切换
    - createInGroup：在某个文件夹里新建视图
    - editView：编辑视图名称 / 类型
    - renameGroup：重命名文件夹
    新建的视图 / 文件夹归属当前空间（接口层自动带 spaceCode）
  -->
  <van-popup :show="show" position="bottom" round closeable safe-area-inset-bottom class="vf-sheet" @update:show="onShowChange">
    <div class="vf-title">{{ title }}</div>

    <div class="vf-body">
      <div v-if="action === 'create'" class="vf-mode">
        <span :class="{ active: mode === 'view' }" @click="mode = 'view'">视图</span>
        <span :class="{ active: mode === 'folder' }" @click="mode = 'folder'">文件夹</span>
      </div>

      <div v-if="action === 'createInGroup' && group" class="vf-folder">
        <FolderIcon class="vf-folder-icon" /><span class="h5-muted">所属文件夹</span>
        <span class="vf-folder-name h5-ellipsis" data-no-i18n>{{ group.groupName }}</span>
      </div>

      <van-cell-group inset class="vf-group">
        <van-field
          v-if="mode === 'view'"
          v-model="filterName"
          label="视图名称"
          label-align="top"
          placeholder="请输入视图名称"
          maxlength="50"
          show-word-limit
          clearable
        />
        <van-field
          v-else
          v-model="groupName"
          label="文件夹名称"
          label-align="top"
          placeholder="请输入文件夹名称"
          maxlength="50"
          show-word-limit
          clearable
        />
      </van-cell-group>

      <template v-if="mode === 'view'">
        <div class="h5-section-title">视图类型</div>
        <div class="vf-types">
          <div
            v-for="t in VIEW_TYPES"
            :key="t.value"
            class="vf-type"
            :class="{ active: viewType === t.value }"
            @click="viewType = t.value"
          >
            <van-icon :name="t.icon" class="vf-type-icon" />
            <span>{{ t.label }}</span>
          </div>
        </div>
        <p class="vf-tip h5-muted">手机上甘特、日历、上线清单视图以列表形式展示</p>
      </template>
    </div>

    <div class="vf-foot">
      <van-button type="primary" block round :loading="saving" @click="submit">{{ isEdit ? '保存' : '创建' }}</van-button>
    </div>
  </van-popup>
</template>

<script lang="ts">
export type ViewFormAction = 'create' | 'createInGroup' | 'editView' | 'renameGroup'

/** 视图类型（与网页版一致） */
export const VIEW_TYPES = [
  { value: 'list', label: '列表', icon: 'bars' },
  { value: 'KAN_BAN', label: '看板', icon: 'apps-o' },
  { value: 'gantt', label: '甘特', icon: 'chart-trending-o' },
  { value: 'CALENDAR_VIEW', label: '日历', icon: 'calendar-o' },
  { value: 'RELEASE_LIST', label: '上线清单', icon: 'todo-list-o' },
]
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { showSuccessToast, showToast } from 'vant'
import { createView, createViewGroup, updateView, updateViewGroup } from '@/api/faiz'
import FolderIcon from './FolderIcon.vue'
import type { ViewGroup, ViewItem } from '@/types/faiz'

const props = withDefaults(defineProps<{
  show: boolean
  action?: ViewFormAction
  group?: ViewGroup | null
  view?: ViewItem | null
}>(), { action: 'create', group: null, view: null })

const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'saved'): void
}>()

const mode = ref<'view' | 'folder'>('view')
const filterName = ref('')
const viewType = ref('list')
const groupName = ref('')
const saving = ref(false)

const isEdit = computed(() => props.action === 'editView' || props.action === 'renameGroup')
const title = computed(() => ({
  create: '新建',
  createInGroup: '新建视图',
  editView: '编辑视图',
  renameGroup: '编辑文件夹',
}[props.action]))

// 每次打开按场景回填
watch(() => props.show, (v) => {
  if (!v) return
  mode.value = props.action === 'renameGroup' ? 'folder' : 'view'
  filterName.value = props.action === 'editView' ? props.view?.filterName ?? '' : ''
  viewType.value = props.action === 'editView' ? props.view?.viewType || 'list' : 'list'
  groupName.value = props.action === 'renameGroup' ? props.group?.groupName ?? '' : ''
})

function onShowChange(v: boolean) {
  emit('update:show', v)
}

async function submit() {
  const name = (mode.value === 'view' ? filterName.value : groupName.value).trim()
  if (!name) {
    showToast(mode.value === 'view' ? '请输入视图名称' : '请输入文件夹名称')
    return
  }
  saving.value = true
  try {
    let res
    let okText: string
    if (props.action === 'renameGroup') {
      res = await updateViewGroup({ groupCode: props.group?.groupCode ?? '', groupName: name })
      okText = '文件夹已更新'
    } else if (props.action === 'editView') {
      res = await updateView({ filterCode: props.view?.filterCode ?? '', filterName: name, viewType: viewType.value })
      okText = '视图已更新'
    } else if (mode.value === 'view') {
      const groupCode = props.action === 'createInGroup' ? props.group?.groupCode ?? undefined : undefined
      res = await createView({ filterName: name, viewType: viewType.value, groupCode })
      okText = '视图已创建'
    } else {
      res = await createViewGroup({ groupName: name })
      okText = '文件夹已创建'
    }
    if (res?.success) {
      // 接口自带的成功提示为空时补一条
      if (!res.message) showSuccessToast(okText)
      emit('saved')
      emit('update:show', false)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.vf-sheet {
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.vf-title {
  flex-shrink: 0;
  padding: 16px 48px 8px 16px;
  font-size: 16px;
  font-weight: 600;
}

.vf-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.vf-mode {
  display: flex;
  margin: 4px 16px 0;
  padding: 3px;
  border-radius: 10px;
  background: #f2f4f7;
}

.vf-mode span {
  flex: 1;
  height: 34px;
  line-height: 34px;
  text-align: center;
  border-radius: 8px;
  font-size: 14px;
  color: var(--h5-text-2);
}

.vf-mode span.active {
  background: #fff;
  color: var(--h5-text);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.vf-folder {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 16px 0;
  font-size: 13px;
}

.vf-folder-icon {
  font-size: 16px;
  color: #d4a05f;
}

.vf-folder-name {
  min-width: 0;
  padding: 2px 8px;
  border-radius: 6px;
  background: #f2f4f7;
  color: var(--h5-text);
}

.vf-group {
  margin-top: 12px;
}

.vf-group :deep(.van-field__label) {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--h5-text-2);
}

.vf-types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0 16px;
}

.vf-type {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 4px;
  border: 1.5px solid #e3e6eb;
  border-radius: 12px;
  background: #fff;
  font-size: 13px;
  color: var(--h5-text-2);
}

.vf-type.active {
  border-color: var(--van-primary-color);
  background: color-mix(in srgb, var(--van-primary-color) 6%, #fff);
  color: var(--van-primary-color);
  font-weight: 500;
}

.vf-type-icon {
  font-size: 22px;
}

.vf-tip {
  margin: 10px 16px 0;
  font-size: 12px;
}

.vf-foot {
  flex-shrink: 0;
  padding: 10px 16px 12px;
}
</style>
