<template>
  <!-- 新建 / 编辑空间：字段与校验同网页版「空间」管理 -->
  <van-popup :show="show" position="bottom" round class="sf-sheet" @update:show="onShowChange">
    <van-nav-bar :title="space ? '编辑空间' : '新建空间'" left-text="取消" @click-left="onShowChange(false)" />

    <div class="sf-body">
      <van-form ref="formRef" @submit="submit">
        <van-cell-group inset class="sf-group">
          <van-field
            v-model="form.spaceName"
            name="spaceName"
            label="空间名称"
            label-align="top"
            placeholder="如 研发协作空间"
            maxlength="128"
            required
            :rules="[{ validator: (v: string) => !!v.trim(), message: '请输入空间名称' }]"
          />
          <!-- 空间标识（问题单号前缀）由后端按空间名自动生成：新建不展示，编辑时只读 -->
          <van-field v-if="space" :model-value="form.spaceKey || '-'" label="空间标识" label-align="top" readonly disabled>
            <template #extra>
              <span class="sf-hint">已用于生成单号，不可修改</span>
            </template>
          </van-field>
          <van-field v-if="space" :model-value="space.spaceCode" label="空间编码" label-align="top" readonly disabled />
          <van-field
            :model-value="orgLabel"
            name="organizationId"
            label="所属组织"
            label-align="top"
            placeholder="请选择所属组织"
            required
            readonly
            is-link
            :rules="[{ validator: () => form.organizationId != null, message: '请选择所属组织' }]"
            @click="orgOpen = true"
          />
          <FieldInput v-model="owner" :field="{ id: 'owner', name: '负责人', type: 'SELECT_USER_SINGLE' }" placeholder="选择负责人（选填）" />
        </van-cell-group>

        <van-cell-group inset class="sf-group">
          <van-cell title="颜色" class="sf-color-cell">
            <template #label>
              <div class="sf-colors">
                <span
                  v-for="c in COLOR_OPTIONS"
                  :key="c"
                  class="sf-color"
                  :class="{ active: form.color === c }"
                  :style="{ background: c }"
                  @click="form.color = c"
                >
                  <van-icon v-if="form.color === c" name="success" />
                </span>
                <span class="sf-preview" :style="{ background: form.color }">{{ spaceAvatarText(form.spaceName) || '空' }}</span>
              </div>
            </template>
          </van-cell>
          <van-field
            v-model="form.description"
            label="描述"
            label-align="top"
            type="textarea"
            placeholder="空间用途说明（选填）"
            maxlength="500"
            show-word-limit
            :autosize="{ minHeight: 60, maxHeight: 160 }"
          />
          <van-cell title="启用">
            <template #right-icon>
              <van-switch v-model="enabled" size="22px" />
            </template>
          </van-cell>
        </van-cell-group>

        <div class="sf-submit">
          <van-button type="primary" block round native-type="submit" :loading="saving">{{ space ? '保存' : '创建' }}</van-button>
        </div>
      </van-form>
    </div>

    <OrgPicker ref="orgPickerRef" v-model:show="orgOpen" v-model="form.organizationId" :tree="orgTree" title="所属组织" />
  </van-popup>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { createSpace, updateSpace, type OrganizationNode, type SpaceItem, type SpaceSaveParams } from '@/api/faiz'
import { findOrgCode, findOrgIdByCode } from '@/utils/orgTree'
import { spaceAvatarText } from '@/utils/space-store'
import FieldInput from './FieldInput.vue'
import OrgPicker from './OrgPicker.vue'
import { personValueOf } from '../utils'

/** 空间颜色候选（与网页版一致） */
const COLOR_OPTIONS = ['#0A84FF', '#5E5CE6', '#AF52DE', '#FF375F', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#30B0C7', '#8E8E93']

const props = defineProps<{
  show: boolean
  /** 编辑的空间；null 为新建 */
  space: SpaceItem | null
  orgTree: OrganizationNode[]
}>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'saved'): void
}>()

const formRef = ref()
const orgPickerRef = ref<InstanceType<typeof OrgPicker>>()
const orgOpen = ref(false)
const saving = ref(false)

const empty = () => ({
  spaceName: '',
  spaceKey: '',
  organizationId: undefined as number | undefined,
  color: COLOR_OPTIONS[0],
  description: '',
  sort: undefined as number | undefined,
  status: 1,
})
const form = reactive(empty())
/** 负责人：编辑器用用户对象，提交时取 memberId */
const owner = ref<Record<string, unknown> | null>(null)
const enabled = computed({
  get: () => form.status === 1,
  set: (v: boolean) => { form.status = v ? 1 : 0 },
})
const orgLabel = computed(() => orgPickerRef.value?.labelOf(form.organizationId) || '')

watch(() => props.show, (v) => {
  if (!v) return
  const s = props.space
  Object.assign(form, empty())
  owner.value = null
  if (!s) return
  Object.assign(form, {
    spaceName: s.spaceName ?? '',
    spaceKey: s.spaceKey ?? '',
    organizationId: s.organizationId ?? findOrgIdByCode(props.orgTree, s.organizationCode),
    color: s.color || COLOR_OPTIONS[0],
    description: s.description ?? '',
    sort: s.sort,
    status: s.status ?? 1,
  })
  if (s.ownerMemberId) owner.value = { memberId: s.ownerMemberId, realName: s.ownerName || s.ownerMemberId }
})

function onShowChange(v: boolean) {
  emit('update:show', v)
}

async function submit() {
  saving.value = true
  try {
    const payload: SpaceSaveParams = {
      spaceName: form.spaceName.trim(),
      organizationCode: findOrgCode(props.orgTree, form.organizationId),
      // 允许清空负责人：传空串，后端置空
      ownerMemberId: owner.value ? personValueOf(owner.value) : '',
      color: form.color,
      description: form.description.trim(),
      sort: form.sort,
      status: form.status,
    }
    const res = props.space ? await updateSpace({ ...payload, id: props.space.id }) : await createSpace(payload)
    if (res?.success) {
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
.sf-sheet {
  display: flex;
  flex-direction: column;
  height: 92vh;
  height: 92dvh;
  background: var(--h5-bg);
}

.sf-sheet :deep(.van-nav-bar) {
  flex-shrink: 0;
  background: transparent;
}

.sf-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}

.sf-group {
  margin-top: 12px;
}

.sf-group :deep(.van-field__label) {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--h5-text-2);
}

.sf-hint {
  flex-shrink: 0;
  align-self: center;
  margin-left: 8px;
  font-size: 12px;
  color: var(--h5-text-3);
}

.sf-colors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.sf-color {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.6);
}

/* 选中：白色内圈 + 深色外圈 */
.sf-color.active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #1f2329;
}

.sf-preview {
  margin-left: auto;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.sf-submit {
  margin: 24px var(--h5-gutter) 0;
}

.sf-submit :deep(.van-button) {
  height: 46px;
}
</style>
