<template>
  <AuthLayout title="协作，" highlight="更有序" subtitle="需求到上线 · 一站掌控">
    <form novalidate @submit.prevent="handleSubmit">
      <AuthField v-model="form.email" placeholder="电子邮箱" type="email" autocomplete="email" :error="errors.email" />
      <AuthField v-model="form.password" placeholder="密码" type="password" autocomplete="current-password" :error="errors.password" />

      <div class="forgot-row">
        <!-- 勾选框跟随登录按钮的黑色，而不是品牌主题色 -->
        <a-config-provider :theme="{ token: { colorPrimary: '#1a1a1a' } }">
          <div class="remember">
            <a-checkbox v-model:checked="rememberAccount" @change="onRememberAccountChange">记住账号</a-checkbox>
            <a-checkbox v-if="passwordRememberable" v-model:checked="rememberPassword" @change="onRememberPasswordChange">记住密码</a-checkbox>
          </div>
        </a-config-provider>
        <a class="forgot" @click="handleForgot">忘记密码？</a>
      </div>

      <button type="submit" class="auth-btn" :disabled="loading">{{ loading ? '登录中…' : '登录' }}</button>
      <p class="auth-terms">继续即表示你同意<a>《服务协议》</a>和<a>《隐私政策》</a>。</p>
    </form>

  </AuthLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import AuthLayout from './AuthLayout.vue'
import AuthField from './AuthField.vue'
import { login, type LoginResult } from '@/api/faiz'
import { setLoginInfo, useAuth } from '@/utils/auth'
import { canRememberPassword, loadRememberedLogin, saveRememberedLogin } from '@/utils/remember-login'

const route = useRoute()
const router = useRouter()
const { isLoggedIn, refresh } = useAuth()

const form = reactive({
  email: (route.query.email as string) || '',
  password: '',
})
const errors = reactive({ email: '', password: '' })
const loading = ref(false)

// ---------- 记住账号 / 密码 ----------
const rememberAccount = ref(false)
const rememberPassword = ref(false)
/** 记住密码仅客户端可用（系统加密保存），浏览器里交给浏览器自带的密码管理 */
const passwordRememberable = ref(false)

/** 勾选记住密码 ⇒ 同时记住账号 */
function onRememberPasswordChange() {
  if (rememberPassword.value) rememberAccount.value = true
}
/** 取消记住账号 ⇒ 密码也不记 */
function onRememberAccountChange() {
  if (!rememberAccount.value) rememberPassword.value = false
}

onMounted(async () => {
  passwordRememberable.value = await canRememberPassword()
  const saved = await loadRememberedLogin()
  rememberAccount.value = saved.rememberAccount
  rememberPassword.value = passwordRememberable.value && saved.rememberPassword
  // 链接上带了 email（如从邀请 / 重置跳转）时以链接为准，不回填记住的密码
  if (form.email && form.email !== saved.email) return
  if (!form.email) form.email = saved.email
  if (rememberPassword.value && !form.password) form.password = saved.password
})

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

    await saveRememberedLogin({
      email,
      password: form.password,
      rememberAccount: rememberAccount.value,
      rememberPassword: passwordRememberable.value && rememberPassword.value,
    })

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
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.remember {
  display: flex;
  align-items: center;
  gap: 4px;
}

.remember :deep(.ant-checkbox-wrapper) {
  font-size: 13px;
  color: #6b6a65;
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
