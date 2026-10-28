<template>
  <AuthLayout title="协作，" highlight="更有序" subtitle="需求到上线 · 一站掌控">
    <form novalidate @submit.prevent="handleSubmit">
      <AuthField v-model="form.email" placeholder="电子邮箱" type="email" autocomplete="email" :error="errors.email" />
      <AuthField v-model="form.password" placeholder="密码" type="password" autocomplete="current-password" :error="errors.password" />

      <div class="forgot-row">
        <a class="forgot" @click="handleForgot">忘记密码？</a>
      </div>

      <button type="submit" class="auth-btn" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
      <p class="auth-terms">继续即表示你同意<a>《服务协议》</a>和<a>《隐私政策》</a>。</p>
    </form>

  </AuthLayout>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import AuthLayout from './AuthLayout.vue'
import AuthField from './AuthField.vue'
import { login, type LoginResult } from '@/api/faiz'
import { setLoginInfo, useAuth } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const { isLoggedIn, refresh } = useAuth()

const form = reactive({
  email: (route.query.email as string) || '',
  password: '',
})
const errors = reactive({ email: '', password: '' })
const loading = ref(false)

function validate() {
  const email = form.email.trim()
  errors.email = !email ? '请输入邮箱' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : '邮箱格式不正确'
  errors.password = form.password ? '' : '请输入密码'
  return !errors.email && !errors.password
}

async function handleSubmit() {
  if (!validate()) return
  loading.value = true
  try {
    const email = form.email.trim()
    const res = await login({ email, password: form.password })
    if (res?.success === false) return

    const data = res?.data as LoginResult | undefined
    if (data?.token) {
      setLoginInfo({
        token: data.token,
        username: data.user?.email || data.username || email,
        realName: data.user?.realName || data.realName,
        user: data.user,
        raw: data as unknown as Record<string, unknown>,
      })
    } else {
      // 后端通过 Set-Cookie 写入登录态
      refresh()
    }
    if (!isLoggedIn.value) {
      message.error('登录失败，请稍后重试')
      return
    }

    const redirect = route.query.redirect as string | undefined
    router.replace(redirect && redirect.startsWith('/') ? redirect : '/')
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    loading.value = false
  }
}

function handleForgot() {
  message.info('请联系管理员重置密码')
}
</script>

<style scoped>
.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.forgot {
  font-size: 13px;
  color: #6b6a65;
  cursor: pointer;
}

.forgot:hover {
  color: #1a1a1a;
}
</style>
