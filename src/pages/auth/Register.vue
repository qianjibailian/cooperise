<template>
  <AuthLayout logo-above-card>
    <form novalidate @submit.prevent="handleSubmit">
      <AuthField v-model="form.email" placeholder="电子邮箱" type="email" autocomplete="email" :error="errors.email" />

      <div class="code-row">
        <AuthField
          v-model="form.code"
          placeholder="邮箱验证码"
          autocomplete="one-time-code"
          :error="errors.code"
          class="code-field"
        />
        <button type="button" class="code-btn" :disabled="sending || countdown > 0" @click="handleSendCode">
          {{ countdown > 0 ? `${countdown} 秒后重发` : '获取验证码' }}
        </button>
      </div>

      <div class="terms-row">
        <a-config-provider :theme="{ token: { colorPrimary: '#1a1a1a' } }">
          <a-checkbox v-model:checked="agreed" />
        </a-config-provider>
        <span>我已阅读并同意<a href="/terms" target="_blank" rel="noopener">《服务协议》</a>和<a href="/privacy" target="_blank" rel="noopener">《隐私政策》</a></span>
      </div>

      <button type="submit" class="auth-btn" :disabled="verifying">{{ verifying ? '校验中…' : '下一步' }}</button>
      <div class="register-row">
        已有账号？<a class="register-link" @click="router.push('/login')">立即登录</a>
      </div>
    </form>
  </AuthLayout>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import AuthLayout from './AuthLayout.vue'
import AuthField from './AuthField.vue'
import { sendRegisterCode, verifyRegisterCode } from '@/api/faiz'
import { savePendingRegister } from './register-pending'

const router = useRouter()

const form = reactive({ email: '', code: '' })
const errors = reactive({ email: '', code: '' })
const sending = ref(false)
/** 「下一步」时后端校验验证码中 */
const verifying = ref(false)
/** 已阅读并同意服务协议 / 隐私政策 */
const agreed = ref(false)
/** 验证码重发倒计时（秒） */
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(): boolean {
  const email = form.email.trim()
  errors.email = !email ? '请输入邮箱' : EMAIL_RE.test(email) ? '' : '邮箱格式不正确'
  return !errors.email
}

/** 发送后 30 秒内不可再次发送，与后端 RegisterCodeService 的冷却时间一致 */
function startCountdown(seconds = 30) {
  countdown.value = seconds
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function handleSendCode() {
  if (!validateEmail()) return
  sending.value = true
  try {
    const res = await sendRegisterCode({ email: form.email.trim() })
    if (res?.success === false) return
    startCountdown()
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    sending.value = false
  }
}

function validate(): boolean {
  errors.code = /^\d{6}$/.test(form.code.trim()) ? '' : '请输入 6 位验证码'
  const emailOk = validateEmail()
  return emailOk && !errors.code
}

async function handleSubmit() {
  if (!agreed.value) {
    message.warning('请先勾选同意《服务协议》和《隐私政策》')
    return
  }
  if (!validate()) return
  const email = form.email.trim()
  const code = form.code.trim()
  verifying.value = true
  try {
    // 先在后端校验验证码（不作废），通过后才进入第二步
    const res = await verifyRegisterCode({ email, code })
    if (res?.success === false) return
    savePendingRegister({ email, code })
    router.push('/register/password')
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    verifying.value = false
  }
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
/* 验证码行：与上下字段保持同样的 12px 间距，按钮高度与输入框一致（48px） */
.code-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 12px 0;
}

.code-field {
  flex: 1;
  min-width: 0;
}

.code-btn {
  flex-shrink: 0;
  height: 48px;
  min-width: 120px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  background: #f4f3ef;
  border: 1px solid #e8e7e2;
  border-radius: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.code-btn:hover:not(:disabled) {
  background: #ebeae4;
}

.code-btn:disabled {
  color: #9a9890;
  cursor: not-allowed;
}

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
  text-decoration: none;
  cursor: pointer;
}

.terms-row a:hover {
  text-decoration: underline;
}

/* 底部登录入口：与登录页底部注册入口一致，居中 */
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
  text-decoration: none;
}

.register-link:hover {
  text-decoration: underline;
}
</style>
