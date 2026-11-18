<template>
  <!-- 右下角上传进度小窗：有上传任务时显示，可收起 / 清除已完成 -->
  <div v-if="uploadItems.length" class="up-panel" role="status" aria-live="polite">
    <div class="up-head" @click="uploadPanelCollapsed = !uploadPanelCollapsed">
      <span class="up-title">{{ title }}</span>
      <span class="up-actions">
        <button
          type="button"
          class="up-icon-btn"
          :title="uploadPanelCollapsed ? '展开' : '收起'"
          @click.stop="uploadPanelCollapsed = !uploadPanelCollapsed"
        >
          <UpOutlined v-if="uploadPanelCollapsed" />
          <DownOutlined v-else />
        </button>
        <button type="button" class="up-icon-btn" title="清除已完成" @click.stop="clearFinishedUploads">
          <CloseOutlined />
        </button>
      </span>
    </div>

    <ul v-show="!uploadPanelCollapsed" class="up-list">
      <li v-for="it in uploadItems" :key="it.id" class="up-item" :class="`is-${it.status}`">
        <div class="up-row">
          <span class="up-name" :title="it.name">{{ it.name }}</span>
          <span class="up-state">{{ stateText(it) }}</span>
        </div>
        <div class="up-bar">
          <div class="up-bar-fill" :style="{ width: `${it.progress}%` }" />
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined, DownOutlined, UpOutlined } from '@ant-design/icons-vue'
import {
  clearFinishedUploads,
  uploadItems,
  uploadPanelCollapsed,
  type UploadItem,
} from '@/utils/upload-queue'

const activeCount = computed(() => uploadItems.filter((it) => it.status === 'waiting' || it.status === 'uploading').length)

const title = computed(() => {
  if (activeCount.value) return `正在上传 ${activeCount.value} 个文件`
  const failed = uploadItems.filter((it) => it.status === 'error').length
  return failed ? `上传完成，${failed} 个失败` : '上传完成'
})

function stateText(it: UploadItem): string {
  if (it.stage && it.status === 'uploading') return it.stage
  if (it.status === 'waiting') return '等待中'
  if (it.status === 'uploading') return `${it.progress}%`
  if (it.status === 'done') return '已完成'
  return it.error || '失败'
}
</script>

<style scoped>
.up-panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1500;
  width: 320px;
  max-height: 360px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ebedf0;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  font-size: 13px;
  color: #1f2329;
}
.up-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #ebedf0;
  cursor: pointer;
  user-select: none;
}
.up-title {
  font-weight: 600;
}
.up-actions {
  display: inline-flex;
  gap: 4px;
}
.up-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8f959e;
  cursor: pointer;
}
.up-icon-btn:hover {
  background: #e5e6eb;
  color: #1f2329;
}
.up-list {
  margin: 0;
  padding: 6px 0;
  list-style: none;
  overflow-y: auto;
}
.up-item {
  padding: 8px 12px;
}
.up-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.up-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.up-state {
  flex: none;
  font-size: 12px;
  color: #8f959e;
}
.up-item.is-error .up-state {
  color: #d70015;
}
.up-item.is-done .up-state {
  color: #248a3d;
}
.up-bar {
  margin-top: 6px;
  height: 4px;
  background: #ebedf0;
  border-radius: 2px;
  overflow: hidden;
}
.up-bar-fill {
  height: 100%;
  background: #3370ff;
  border-radius: 2px;
  transition: width 0.2s ease;
}
.up-item.is-done .up-bar-fill {
  background: #34c724;
}
.up-item.is-error .up-bar-fill {
  background: #f54a45;
}
</style>
