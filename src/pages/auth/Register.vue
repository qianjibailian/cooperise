<template>
  <AuthLayout title="开启" highlight="高效协作" subtitle="一分钟 · 创建你的账号">
    <form novalidate @submit.prevent="handleSubmit">
      <AuthField v-model="form.email" placeholder="电子邮箱" type="email" autocomplete="email" :error="errors.email" />
      <AuthField
        v-model="form.password"
        placeholder="密码（至少 8 位，包含字母和数字）"
        type="password"
        autocomplete="new-password"
        :error="errors.password"
      />
      <AuthField
        v-model="form.confirmPassword"
        placeholder="确认密码"
        type="password"
        autocomplete="new-password"
        :error="errors.confirmPassword"
      />

      <button type="submit" class="auth-btn" :disabled="loading">{{ loading ? '注册中…' : '创建账号' }}</button>
      <p class="auth-terms">注册即表示你同意<a>《服务协议》</a>和<a>《隐私政策》</a>。</p>
      <p class="auth-switch">已有账号？<router-link :to="{ name: 'Login', query: route.query }">直接登录</router-link></p>
    </form>

  </AuthLayout>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from './AuthLayout.vue'
import AuthField from './AuthField.vue'
import { register } from '@/api/faiz'

const route = useRoute()
const router = useRouter()

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
})
const errors = reactive({ email: '', password: '', confirmPassword: '' })
const loading = ref(false)

function validate() {
  const email = form.email.trim()
  errors.email = !email ? '请输入邮箱' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : '邮箱格式不正确'
  errors.password = !form.password
    ? '请输入密码'
    : /^(?=.*[A-Za-z])(?=.*\d).{8,32}$/.test(form.password) ? '' : '密码为 8-32 位，需包含字母和数字'
  errors.confirmPassword = !form.confirmPassword
    ? '请再次输入密码'
    : form.confirmPassword === form.password ? '' : '两次输入的密码不一致'
  return !Object.values(errors).some(Boolean)
}

async function handleSubmit() {
  if (!validate()) return
  loading.value = true
  try {
    const res = await register({
      email: form.email.trim(),
      password: form.password,
    })
    if (res?.success === false) return
    // 注册成功后回到登录页并带上邮箱
    router.replace({ name: 'Login', query: { ...route.query, email: form.email.trim() } })
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}
</script>
