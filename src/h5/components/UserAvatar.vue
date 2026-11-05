<template>
  <span class="user-avatar" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.45)}px` }">
    <img v-if="src" :src="src" alt="" @error="broken = true" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { personAvatar, personInitial } from '@/utils/person'

const props = withDefaults(defineProps<{ user?: Record<string, unknown> | null; size?: number }>(), { size: 28, user: null })

const broken = ref(false)
const src = computed(() => (broken.value || !props.user ? '' : personAvatar(props.user)))
const initial = computed(() => (props.user ? personInitial(props.user) : '?'))
</script>

<style scoped>
.user-avatar {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--van-primary-color);
  color: #fff;
  font-weight: 500;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
