<template>
  <AuthLayout logo-above-card>
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
      <div class="terms-row">
        <a-config-provider :theme="{ token: { colorPrimary: '#1a1a1a' } }">
          <a-checkbox v-model:checked="agreed" />
        </a-config-provider>
        <span>我已阅读并同意<a href="/terms" target="_blank" rel="noopener">《服务协议》</a>和<a href="/privacy" target="_blank" rel="noopener">《隐私政策》</a></span>
      </div>
      <div class="register-row">
        还没有账号？<a class="register-link" @click="router.push('/register')">立即注册</a>
      </div>
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
/** 已阅读并同意服务协议 / 隐私政策 */
const agreed = ref(false)

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
  if (!agreed.value) {
    message.warning('请先勾选同意《服务协议》和《隐私政策》')
    return
  }
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

    // 登录接口常不返回 message，全局拦截器不会提示；此处补上成功提示（后端有消息时由拦截器统一展示，避免重复）
    if (!res?.message) message.success('登录成功')
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

/* 服务协议勾选行：复选框 + 文案，文案里的协议名可点 */
.terms-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.6;
  color: #6b6a65;
}

.terms-row a {
  color: #1a1a1a;
  cursor: pointer;
}

/* 底部注册入口：居中，与「忘记密码」同一套灰色，只把链接文字加深 */
.register-row {
  margin-top: 18px;
  text-align: center;
  font-size: 13px;
  color: #6b6a65;
}

.register-link {
  margin-left: 4px;
  font-weight: 500;
  color: #1a1a1a;
  cursor: pointer;
}

.register-link:hover {
  text-decoration: underline;
}
</style>
