<template>
  <AuthLayout logo-above-card>
    <form novalidate @submit.prevent="handleSubmit">
      <div class="step-email">{{ pending?.email || '' }}</div>

      <AuthField v-model="form.realName" placeholder="姓名（选填）" autocomplete="name" />
      <AuthField v-model="form.password" placeholder="密码（6-32 位）" type="password" autocomplete="new-password" :error="errors.password" />
      <AuthField v-model="form.confirm" placeholder="确认密码" type="password" autocomplete="new-password" :error="errors.confirm" />

      <button type="submit" class="auth-btn" :disabled="submitting">{{ submitting ? '注册中…' : '注册' }}</button>
      <div class="register-row">
        <a class="register-link" @click="router.push('/register')">上一步</a>
      </div>
    </form>
  </AuthLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from './AuthLayout.vue'
import AuthField from './AuthField.vue'
import { login, registerAccount, type LoginResult } from '@/api/faiz'
import { setLoginInfo, useAuth } from '@/utils/auth'
import { PENDING_REGISTER_KEY, type PendingRegister } from './register-pending'

const router = useRouter()

/** 第一步（邮箱 + 验证码）传过来的待注册信息 */
const pending = ref<PendingRegister | null>(null)
const form = reactive({ realName: '', password: '', confirm: '' })
const errors = reactive({ password: '', confirm: '' })
const submitting = ref(false)
const { refresh } = useAuth()

function readPending(): PendingRegister | null {
  try {
    const raw = sessionStorage.getItem(PENDING_REGISTER_KEY)
    return raw ? (JSON.parse(raw) as PendingRegister) : null
  } catch {
    return null
  }
}

onMounted(() => {
  pending.value = readPending()
  // 没有第一步的信息（直接访问或刷新后丢失）：回到第一步重新验证邮箱
  if (!pending.value) router.replace('/register')
})

function validate(): boolean {
  errors.password = form.password.length >= 6 && form.password.length <= 32 ? '' : '密码长度需为 6-32 位'
  errors.confirm = form.confirm === form.password ? '' : '两次输入的密码不一致'
  return !errors.password && !errors.confirm
}

/** 写入登录态：优先用接口返回的 token，没有则用同一账号密码登录一次 */
async function applyLogin(email: string, data?: LoginResult) {
  if (data?.token) {
    setLoginInfo({
      token: data.token,
      username: data.user?.email || data.username || email,
      realName: data.user?.realName || data.realName,
      user: data.user,
      raw: data as unknown as Record<string, unknown>,
    })
    return
  }
  const loginRes = await login({ email, password: form.password })
  const ld = loginRes?.data as LoginResult | undefined
  if (ld?.token) {
    setLoginInfo({
      token: ld.token,
      username: ld.user?.email || ld.username || email,
      realName: ld.user?.realName || ld.realName,
      user: ld.user,
      raw: ld as unknown as Record<string, unknown>,
    })
  } else {
    // 后端通过 Set-Cookie 写入登录态
    refresh()
  }
}

async function handleSubmit() {
  if (!pending.value || !validate()) return
  submitting.value = true
  try {
    const email = pending.value.email
    const name = form.realName.trim()
    const res = await registerAccount({
      email,
      code: pending.value.code,
      password: form.password,
      ...(name ? { realName: name } : {}),
    })
    if (res?.success === false) return

    try {
      sessionStorage.removeItem(PENDING_REGISTER_KEY)
    } catch {
      // 忽略
    }
    await applyLogin(email, res?.data as LoginResult | undefined)
    // 注册即登录：进入初始化页，选择个人模式或创建企业
    router.replace({ name: 'InitWorkspace' })
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.step-email {
  margin-bottom: 12px;
  font-size: 13px;
  color: #6b6a65;
  word-break: break-all;
}

/* 底部返回入口：与注册页底部入口一致，居中 */
.register-row {
  margin-top: 18px;
  text-align: center;
  font-size: 13px;
  color: #6b6a65;
}

.register-link {
  font-weight: 500;
  color: #1a1a1a;
  cursor: pointer;
  text-decoration: none;
}

.register-link:hover {
  text-decoration: underline;
}
</style>
