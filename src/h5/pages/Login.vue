<template>
  <div class="h5-login">
    <div class="lg-brand">
      <AuthLogo :size="56" />
      <div class="lg-name">Cooperise</div>
    </div>

    <van-form class="lg-form" @submit="handleLogin">
      <van-cell-group inset>
        <van-field
          v-model="email"
          name="email"
          type="email"
          placeholder="邮箱"
          autocomplete="username"
          left-icon="envelop-o"
          clearable
          :rules="[{ required: true, message: '请输入邮箱' }]"
        />
        <van-field
          v-model="password"
          name="password"
          :type="showPwd ? 'text' : 'password'"
          placeholder="密码"
          autocomplete="current-password"
          left-icon="lock"
          :right-icon="showPwd ? 'eye-o' : 'closed-eye'"
          :rules="[{ required: true, message: '请输入密码' }]"
          @click-right-icon="showPwd = !showPwd"
        />
      </van-cell-group>

      <div class="lg-remember">
        <van-checkbox v-model="rememberAccount" shape="square" icon-size="16px">记住账号</van-checkbox>
      </div>

      <div class="lg-submit">
        <van-button type="primary" block round native-type="submit" :loading="loading" loading-text="登录中">登录</van-button>
      </div>
    </van-form>

    <div class="lg-lang" data-no-i18n>
      <span :class="{ active: locale === 'zh' }" @click="setLocale('zh')">中文</span>
      <i>/</i>
      <span :class="{ active: locale === 'en' }" @click="setLocale('en')">English</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showFailToast } from 'vant'
import { login } from '@/api/faiz'
import { useAuth, setLoginInfo } from '@/utils/auth'
import { loadRememberedLogin, saveRememberedLogin } from '@/utils/remember-login'
import { useLocale } from '@/i18n'
import AuthLogo from '@/pages/auth/AuthLogo.vue'

const route = useRoute()
const router = useRouter()
const { locale, setLocale } = useLocale()
const { isLoggedIn, refresh } = useAuth()

const email = ref('')
const password = ref('')
const showPwd = ref(false)
const rememberAccount = ref(true)
const loading = ref(false)

onMounted(async () => {
  try {
    const saved = await loadRememberedLogin()
    if (saved.email) email.value = saved.email
    rememberAccount.value = saved.rememberAccount !== false
  } catch {
    // 读取失败不影响登录
  }
})

async function handleLogin() {
  loading.value = true
  try {
    const account = email.value.trim()
    const res = await login({ email: account, password: password.value })
    if (!res?.success) return
    const data = (res.data || {}) as Record<string, unknown>
    const user = data.user as Record<string, unknown> | undefined
    if (data.token) {
      setLoginInfo({
        token: String(data.token),
        username: String(user?.email || data.username || account),
        realName: String(data.realName || user?.realName || ''),
        user: user as never,
        raw: data,
      })
    } else {
      refresh()
    }
    if (!isLoggedIn.value) {
      showFailToast('登录失败，请重试')
      return
    }
    // 手机端不保存密码，只记账号
    await saveRememberedLogin({ email: account, password: '', rememberAccount: rememberAccount.value, rememberPassword: false })
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/issues'
    router.replace(redirect)
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.h5-login {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: calc(env(safe-area-inset-top, 0px) + 14vh) 0 calc(24px + env(safe-area-inset-bottom, 0px));
  background:
    radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, var(--van-primary-color) 12%, transparent) 0%, transparent 70%),
    var(--h5-bg);
}

.lg-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 36px;
}

.lg-name {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.lg-remember {
  margin: 14px 32px 0;
  font-size: 14px;
  color: var(--h5-text-2);
}

.lg-submit {
  margin: 24px 16px 0;
}

.lg-submit :deep(.van-button) {
  height: 48px;
  font-size: 16px;
}

.lg-lang {
  margin-top: auto;
  padding-top: 32px;
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: var(--h5-text-3);
}

.lg-lang span.active {
  color: var(--h5-text);
  font-weight: 600;
}

.lg-lang i {
  font-style: normal;
  color: #c7c7cc;
}
</style>
