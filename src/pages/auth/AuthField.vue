<template>
  <div class="auth-field" :class="{ 'has-error': !!error }">
    <div class="field-box">
      <input
        :value="modelValue"
        :type="inputType"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :aria-label="placeholder"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="toggle-btn"
        :aria-label="visible ? '隐藏密码' : '显示密码'"
        @click="visible = !visible"
      >
        <EyeOutlined v-if="visible" />
        <EyeInvisibleOutlined v-else />
      </button>
    </div>
    <div v-if="error" class="field-msg">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons-vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder: string
  type?: string
  autocomplete?: string
  error?: string
}>(), {
  type: 'text',
  autocomplete: 'off',
  error: '',
})

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const visible = ref(false)
const inputType = computed(() => (props.type === 'password' && visible.value ? 'text' : props.type))
</script>

<style scoped>
.auth-field + .auth-field {
  margin-top: 12px;
}

.field-box {
  position: relative;
}

input {
  width: 100%;
  height: 48px;
  padding: 0 44px 0 16px;
  border: 1px solid #e3e3e1;
  border-radius: 10px;
  font-size: 16px;
  color: #1a1a1a;
  background: #fff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

input::placeholder {
  color: #8a8985;
}

input:focus {
  border-color: #9a9994;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
}

.toggle-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #8a8985;
  font-size: 16px;
  cursor: pointer;
}

.toggle-btn:hover {
  background: #f3f3f2;
}

.field-msg {
  margin: 6px 4px 0;
  font-size: 12px;
  color: #c4372b;
}

.has-error input {
  border-color: #e0786f;
}
</style>
