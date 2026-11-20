<template>
  <a-modal
    :open="open"
    :footer="null"
    :width="540"
    centered
    destroy-on-close
    class="org-setup-modal"
    @update:open="(v: boolean) => emit('update:open', v)"
    @cancel="close"
  >
    <div class="org-setup">
      <template v-if="mode === 'choose'">
        <div class="org-setup-head">
          <h3 class="org-setup-title">创建或加入组织</h3>
        </div>

        <div class="org-options">
          <button type="button" class="org-option" @click="mode = 'create'">
            <span class="org-option-icon org-option-icon--create"><PlusOutlined /></span>
            <span class="org-option-title">创建组织</span>
            <span class="org-option-desc">新建一个组织，你将成为它的管理员</span>
            <span class="org-option-go"><RightOutlined /></span>
          </button>
          <button type="button" class="org-option" @click="mode = 'join'">
            <span class="org-option-icon org-option-icon--join"><UserAddOutlined /></span>
            <span class="org-option-title">加入组织</span>
            <span class="org-option-desc">输入邀请码，加入已有的组织</span>
            <span class="org-option-go"><RightOutlined /></span>
          </button>
        </div>
      </template>

      <template v-else>
        <button type="button" class="org-back" @click="mode = 'choose'">
          <ArrowLeftOutlined /> 返回
        </button>
        <div class="org-setup-head">
          <h3 class="org-setup-title">{{ mode === 'create' ? '创建组织' : '加入组织' }}</h3>
          <p class="org-setup-desc">
            {{ mode === 'create' ? '为你的团队起一个名字，之后可以邀请成员加入。' : '向组织管理员获取邀请码，粘贴后即可加入。' }}
          </p>
        </div>

        <label class="org-field-label">{{ mode === 'create' ? '组织名称' : '邀请码' }}</label>
        <a-input
          v-model:value="value"
          size="large"
          :maxlength="mode === 'create' ? 50 : 32"
          :placeholder="mode === 'create' ? '例如：某某科技' : '请输入邀请码'"
          @press-enter="submit"
        />

        <div class="org-actions">
          <a-button size="large" @click="mode = 'choose'">取消</a-button>
          <a-button
            size="large"
            type="primary"
            :disabled="!value.trim()"
            :loading="loading"
            @click="submit"
          >
            {{ mode === 'create' ? '创建组织' : '加入组织' }}
          </a-button>
        </div>
      </template>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { PlusOutlined, UserAddOutlined, RightOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'

const props = defineProps<{ open: boolean; loading?: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'create', name: string): void
  (e: 'join', code: string): void
}>()

type Mode = 'choose' | 'create' | 'join'
const mode = ref<Mode>('choose')
const value = ref('')

watch(
  () => props.open,
  (v) => {
    if (!v) {
      mode.value = 'choose'
      value.value = ''
    }
  },
)

function close() {
  emit('update:open', false)
}

function submit() {
  const v = value.value.trim()
  if (!v) return
  if (mode.value === 'create') emit('create', v)
  else if (mode.value === 'join') emit('join', v)
}
</script>

<style scoped>
.org-setup {
  padding: 4px 4px 0;
}

.org-setup-head {
  margin-bottom: 20px;
}

.org-setup-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
}

.org-setup-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #86868b;
}

/* 两个入口卡片：纵向排列，图标 + 标题描述 + 右侧箭头 */
.org-options {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.org-option {
  display: grid;
  grid-template-columns: 40px 1fr 18px;
  grid-template-rows: auto auto;
  column-gap: 14px;
  align-items: center;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.org-option:hover {
  background: #fafbfc;
  border-color: color-mix(in srgb, var(--c-primary) 35%, #eef0f3);
}

.org-option:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 22%, transparent);
}

.org-option-icon {
  grid-column: 1;
  grid-row: 1 / span 2;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

/* 浅色底 + 主题色图标，比渐变块更克制 */
.org-option-icon--create {
  color: var(--c-primary);
  background: color-mix(in srgb, var(--c-primary) 12%, #fff);
}

.org-option-icon--join {
  color: #0f9f6e;
  background: #e8f7f0;
}

.org-option-title {
  grid-column: 2;
  grid-row: 1;
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.org-option-desc {
  grid-column: 2;
  grid-row: 2;
  display: block;
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.5;
  color: #86868b;
}

.org-option-go {
  grid-column: 3;
  grid-row: 1 / span 2;
  display: flex;
  justify-content: flex-end;
  color: #c7c7cc;
  transition: color 0.15s, transform 0.15s;
}

.org-option:hover .org-option-go {
  color: var(--c-primary);
  transform: translateX(2px);
}

.org-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  padding: 0;
  font-size: 13px;
  color: #6e6e73;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
}

.org-back:hover {
  color: var(--c-primary);
}

.org-field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
}

.org-setup :deep(.ant-input-affix-wrapper),
.org-setup :deep(.ant-input) {
  border-radius: 10px;
}

.org-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.org-actions :deep(.ant-btn) {
  min-width: 96px;
  border-radius: 10px;
  font-weight: 500;
}

@media (max-width: 560px) {
  .org-actions :deep(.ant-btn) {
    flex: 1;
    min-width: 0;
  }
}
</style>
