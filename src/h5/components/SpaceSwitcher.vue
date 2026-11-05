<template>
  <!-- 空间切换（与网页版顶栏一致：事项、视图、看板都只看当前空间） -->
  <div class="space-switcher" @click="open = true">
    <span class="ss-icon" :style="{ background: current?.color || 'var(--van-primary-color)' }">{{ spaceAvatarText(current?.spaceName) }}</span>
    <span class="ss-name h5-ellipsis" data-no-i18n>{{ current?.spaceName || '选择空间' }}</span>
    <van-icon name="arrow-down" class="ss-arrow" />
  </div>

  <van-action-sheet
    v-model:show="open"
    title="切换空间"
    :actions="actions"
    cancel-text="取消"
    close-on-click-action
    @select="onSelect"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { spaceAvatarText } from '@/utils/space-store'
import { useMySpaces } from '../utils'

const { mySpaces, current, currentSpaceCode, setCurrentSpace, load } = useMySpaces()
const open = ref(false)

const actions = computed(() => mySpaces.value.map((s) => ({
  name: s.spaceName,
  subname: s.spaceCode === currentSpaceCode.value ? '当前空间' : undefined,
  color: s.spaceCode === currentSpaceCode.value ? 'var(--van-primary-color)' : undefined,
  code: s.spaceCode,
})))

function onSelect(a: { code: string }) {
  setCurrentSpace(a.code)
}

onMounted(load)
</script>

<style scoped>
.space-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 60vw;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.ss-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
}

.ss-name {
  font-size: 14px;
  font-weight: 600;
}

.ss-arrow {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--h5-text-3);
}
</style>
