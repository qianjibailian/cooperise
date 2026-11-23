<template>
  <AuthLayout logo-above-card>
    <form novalidate @submit.prevent="handleSubmit">
      <label class="field-label" for="register-email">电子邮箱</label>
      <div class="email-row">
        <AuthField
          v-model="form.email"
          input-id="register-email"
          placeholder="请输入电子邮箱"
          type="email"
          autocomplete="email"
          :error="errors.email"
          :disabled="!!sentTo || sending"
        />
        <button v-if="sentTo" type="button" class="email-edit" @click="editEmail">修改</button>
      </div>

      <!-- 发送成功后才展开验证码区域 -->
      <template v-if="sentTo">
        <div class="section-divider"><span>输入验证码</span></div>

        <p class="code-hint">验证码已发送至 {{ sentTo }}</p>

        <!-- 6 位方格验证码：支持逐格输入、退格回退、方向键与整段粘贴 -->
        <div class="otp-row" :class="{ 'has-error': !!errors.code }">
          <input
            v-for="(_, i) in digits"
            :key="i"
            :ref="(el) => setOtpRef(el, i)"
            class="otp-cell"
            :value="digits[i]"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder=" "
            :aria-label="`验证码第 ${i + 1} 位`"
            @input="onOtpInput(i, $event)"
            @keydown="onOtpKeydown(i, $event)"
            @paste="onOtpPaste(i, $event)"
            @focus="errors.code = ''"
          />
        </div>

        <div class="code-actions">
          <button type="button" class="resend" :disabled="sending || countdown > 0" @click="handleSendCode">
            {{ countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送' }}
          </button>
        </div>
        <div v-if="errors.code" class="code-msg">{{ errors.code }}</div>
      </template>

      <button
        type="submit"
        class="auth-btn"
        :disabled="verifying || sending"
      >{{ verifying ? '校验中…' : sending ? '发送中…' : (sentTo ? '下一步' : '获取验证码') }}</button>

      <div class="terms-row">
        <a-config-provider :theme="{ token: { colorPrimary: '#1a1a1a' } }">
          <a-checkbox v-model:checked="agreed" />
        </a-config-provider>
        <span>我已阅读并同意<a href="/terms" target="_blank" rel="noopener">《服务协议》</a>和<a href="/privacy" target="_blank" rel="noopener">《隐私政策》</a></span>
      </div>

      <div class="register-row">
        已有账号？<a class="register-link" @click="router.push('/login')">立即登录</a>
      </div>
    </form>
  </AuthLayout>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
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
/** 已发送到的掩码邮箱（如 zha****@qq.com），未发送时为空 */
const sentTo = ref('')
let timer: ReturnType<typeof setInterval> | undefined

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OTP_LENGTH = 6

// ---------- 6 格验证码 ----------
const digits = ref<string[]>(Array(OTP_LENGTH).fill(''))
const otpRefs = ref<(HTMLInputElement | null)[]>([])

function setOtpRef(el: unknown, i: number) {
  otpRefs.value[i] = (el as HTMLInputElement) || null
}

function syncCode() {
  form.code = digits.value.join('')
}

function onOtpInput(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const raw = el.value.replace(/\D/g, '')
  // iOS 短信自动填充会一次填入整串验证码：按粘贴逻辑分发到各格
  if (raw.length > 1) {
    fillFrom(i, raw)
    return
  }
  const val = raw.slice(-1)
  digits.value[i] = val
  el.value = val
  syncCode()
  errors.code = ''
  if (val && i < OTP_LENGTH - 1) otpRefs.value[i + 1]?.focus()
}

/** 从指定格起填入一串数字 */
function fillFrom(i: number, text: string) {
  const next = [...digits.value]
  text.slice(0, OTP_LENGTH - i).split('').forEach((ch, k) => { next[i + k] = ch })
  digits.value = next
  syncCode()
  errors.code = ''
  otpRefs.value[Math.min(i + text.length, OTP_LENGTH - 1)]?.focus()
}

function onOtpKeydown(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !digits.value[i] && i > 0) {
    digits.value[i - 1] = ''
    syncCode()
    otpRefs.value[i - 1]?.focus()
    e.preventDefault()
  } else if (e.key === 'ArrowLeft' && i > 0) {
    otpRefs.value[i - 1]?.focus()
    e.preventDefault()
  } else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) {
    otpRefs.value[i + 1]?.focus()
    e.preventDefault()
  } else if (/^\d$/.test(e.key) && digits.value[i]) {
    // 已有数字的格再次输入时先清空，避免 maxlength 之外的旧值残留
    digits.value[i] = ''
    syncCode()
  }
}

function onOtpPaste(i: number, e: ClipboardEvent) {
  const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, OTP_LENGTH - i)
  if (!text) return
  e.preventDefault()
  fillFrom(i, text)
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length <= 2) return `${local[0] || ''}****@${domain}`
  return `${local.slice(0, 2)}****${local.slice(-2)}@${domain}`
}

/** 「修改」解除邮箱锁定：清空验证码与倒计时，可对新邮箱重新获取验证码 */
function editEmail() {
  sentTo.value = ''
  digits.value = Array(OTP_LENGTH).fill('')
  syncCode()
  errors.code = ''
  clearInterval(timer)
  countdown.value = 0
  nextTick(() => document.getElementById('register-email')?.focus())
}

// 改动邮箱后旧的验证码与提示失效
watch(() => form.email, () => {
  if (!sentTo.value) return
  sentTo.value = ''
  digits.value = Array(OTP_LENGTH).fill('')
  syncCode()
})

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
    sentTo.value = maskEmail(form.email.trim())
    startCountdown()
    await nextTick()
    otpRefs.value[0]?.focus()
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    sending.value = false
  }
}

function validate(): boolean {
  errors.code = /^\d{6}$/.test(form.code) ? '' : '请输入 6 位验证码'
  const emailOk = validateEmail()
  return emailOk && !errors.code
}

async function handleSubmit() {
  if (!agreed.value) {
    message.warning('请先勾选同意《服务协议》和《隐私政策》')
    return
  }
  // 未发送验证码时，主按钮即「获取验证码」
  if (!sentTo.value) {
    await handleSendCode()
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
.field-label {
  display: block;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
}

/* 邮箱输入框：与参考图的圆角浅描边一致 */
:deep(.field-box input) {
  height: 52px;
  border-radius: 12px;
}

/* 邮箱行：输入框占满，「修改」按钮在右侧 */
.email-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.email-row :deep(.auth-field) {
  flex: 1;
  min-width: 0;
}

.email-edit {
  flex-shrink: 0;
  padding: 4px 2px;
  border: 0;
  background: none;
  color: #1a1a1a;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.email-edit:hover {
  text-decoration: underline;
}

/* 「输入验证码」：左右细线 + 居中灰字 */
.section-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 26px 0 18px;
  font-size: 13px;
  color: #8a8985;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #ececea;
}

.code-hint {
  margin: 0 0 18px;
  font-size: 13px;
  color: #6b6a65;
  text-align: center;
}

/* 6 格验证码：聚焦格黑色粗边框，空格显示居中竖线光标 */
.otp-row {
  display: flex;
  gap: 10px;
}

.otp-cell {
  flex: 1 1 0;
  min-width: 0;
  height: 66px;
  padding: 0;
  border: 1px solid #dcdce0;
  border-radius: 12px;
  background: #fff;
  color: #1a1a1a;
  font-size: 24px;
  font-weight: 500;
  text-align: center;
  caret-color: #1a1a1a;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.otp-cell::placeholder {
  color: transparent;
}

.otp-cell:placeholder-shown:not(:focus) {
  background: linear-gradient(#c9c9ce, #c9c9ce) center / 1px 24px no-repeat;
}

.otp-cell:focus {
  border: 2px solid #1a1a1a;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
}

.otp-row.has-error .otp-cell {
  border-color: #e0786f;
}

.code-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.resend {
  padding: 2px 0;
  border: 0;
  background: none;
  color: #8a8985;
  font-size: 13px;
  cursor: pointer;
}

.resend:hover:not(:disabled) {
  color: #1a1a1a;
}

.resend:disabled {
  cursor: not-allowed;
}

.code-msg {
  margin-top: 6px;
  font-size: 12px;
  color: #c4372b;
  text-align: right;
}

/* 主按钮：更大圆角与高度，黑色实心 */
.auth-btn {
  height: 54px;
  margin-top: 22px;
  border-radius: 14px;
  font-size: 16px;
}

.terms-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
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

@media (max-width: 560px) {
  .otp-row {
    gap: 8px;
  }

  .otp-cell {
    height: 56px;
    font-size: 20px;
  }
}
</style>
