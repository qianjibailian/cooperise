<template>
  <div class="h5-page h5-reg">
    <van-nav-bar title="注册" left-arrow fixed placeholder @click-left="goBack" />

    <div class="reg-brand">
      <AuthLogo :size="48" />
      <div class="reg-name">创建 Cooperise 账号</div>
    </div>

    <!-- 第一步：邮箱 + 验证码（与网页版一致） -->
    <template v-if="step === 'verify'">
      <van-cell-group inset class="reg-group">
        <van-field
          v-model="form.email"
          type="email"
          placeholder="电子邮箱"
          autocomplete="email"
          left-icon="envelop-o"
          :disabled="!!sentTo || sending"
          :error-message="errors.email"
        >
          <template v-if="sentTo" #button>
            <van-button size="small" plain hairline @click="editEmail">修改</van-button>
          </template>
        </van-field>
      </van-cell-group>

      <template v-if="sentTo">
        <div class="reg-section">输入验证码</div>
        <p class="reg-hint">验证码已发送至 {{ sentTo }}</p>

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
            :aria-label="`验证码第 ${i + 1} 位`"
            @input="onOtpInput(i, $event)"
            @keydown="onOtpKeydown(i, $event)"
            @paste="onOtpPaste(i, $event)"
            @focus="errors.code = ''"
          />
        </div>
        <div v-if="errors.code" class="reg-error">{{ errors.code }}</div>

        <div class="reg-resend">
          <button type="button" class="link-btn" :disabled="sending || countdown > 0" @click="sendCode">
            {{ countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送' }}
          </button>
        </div>
      </template>

      <div class="reg-submit">
        <van-button type="primary" block round :loading="sending || verifying" @click="onPrimary">
          {{ sentTo ? '下一步' : '获取验证码' }}
        </van-button>
      </div>
    </template>

    <!-- 第二步：设置密码 / 姓名（与网页版一致） -->
    <van-form v-else class="reg-form" @submit="submitRegister">
      <div class="reg-email">{{ pendingEmail }}</div>
      <van-cell-group inset class="reg-group">
        <van-field v-model="form.realName" placeholder="姓名（选填）" autocomplete="name" left-icon="contact" />
        <van-field
          v-model="form.password"
          type="password"
          placeholder="密码（6-32 位）"
          autocomplete="new-password"
          left-icon="lock"
          :error-message="errors.password"
        />
        <van-field
          v-model="form.confirm"
          type="password"
          placeholder="确认密码"
          autocomplete="new-password"
          left-icon="lock"
          :error-message="errors.confirm"
        />
      </van-cell-group>
      <div class="reg-submit">
        <van-button type="primary" block round native-type="submit" :loading="submitting">注册</van-button>
      </div>
      <div class="reg-resend">
        <button type="button" class="link-btn" @click="step = 'verify'">上一步</button>
      </div>
    </van-form>

    <!-- 服务协议（与网页版注册页一致，需勾选） -->
    <label class="reg-terms" :class="{ 'is-error': termsError }">
      <van-checkbox v-model="agreed" shape="square" icon-size="16px" />
      <span>我已阅读并同意<a href="/terms" target="_blank" rel="noopener">《服务协议》</a>和<a href="/privacy" target="_blank" rel="noopener">《隐私政策》</a></span>
    </label>

    <div class="reg-footer">
      已有账号？<button type="button" class="link-btn" @click="router.replace('/login')">立即登录</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showFailToast } from 'vant'
import { registerAccount, sendRegisterCode, verifyRegisterCode } from '@/api/faiz'
import type { LoginResult } from '@/api/types'
import { applyLogin } from '../auth-flow'
import AuthLogo from '@/pages/auth/AuthLogo.vue'

const router = useRouter()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OTP_LENGTH = 6

type Step = 'verify' | 'password'
const step = ref<Step>('verify')

const form = reactive({ email: '', realName: '', password: '', confirm: '' })
const errors = reactive({ email: '', code: '', password: '', confirm: '' })
const agreed = ref(false)
const termsError = ref(false)

const sending = ref(false)
const verifying = ref(false)
const submitting = ref(false)
/** 验证码已发送到的掩码邮箱 */
const sentTo = ref('')
/** 第二步使用的邮箱与已校验通过的验证码 */
const pendingEmail = ref('')
const pendingCode = ref('')
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

// ---------- 6 格验证码 ----------
const digits = ref<string[]>(Array(OTP_LENGTH).fill(''))
const otpRefs = ref<(HTMLInputElement | null)[]>([])

function setOtpRef(el: unknown, i: number) {
  otpRefs.value[i] = (el as HTMLInputElement) || null
}

function code(): string {
  return digits.value.join('')
}

function fillFrom(i: number, text: string) {
  const next = [...digits.value]
  text.slice(0, OTP_LENGTH - i).split('').forEach((ch, k) => { next[i + k] = ch })
  digits.value = next
  errors.code = ''
  otpRefs.value[Math.min(i + text.length, OTP_LENGTH - 1)]?.focus()
}

function onOtpInput(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const raw = el.value.replace(/\D/g, '')
  // 短信自动填充会一次给出整串验证码
  if (raw.length > 1) {
    fillFrom(i, raw)
    el.value = digits.value[i] || ''
    return
  }
  const val = raw.slice(-1)
  digits.value[i] = val
  el.value = val
  errors.code = ''
  if (val && i < OTP_LENGTH - 1) otpRefs.value[i + 1]?.focus()
}

function onOtpKeydown(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !digits.value[i] && i > 0) {
    digits.value[i - 1] = ''
    otpRefs.value[i - 1]?.focus()
    e.preventDefault()
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

function validateEmail(): boolean {
  const email = form.email.trim()
  errors.email = !email ? '请输入邮箱' : EMAIL_RE.test(email) ? '' : '邮箱格式不正确'
  return !errors.email
}

function startCountdown(seconds = 30) {
  countdown.value = seconds
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) clearInterval(timer)
  }, 1000)
}

/** 发送后 30 秒内不可再次发送，与后端 RegisterCodeService 的冷却时间一致 */
async function sendCode() {
  if (!validateEmail()) return
  sending.value = true
  try {
    const email = form.email.trim()
    const res = await sendRegisterCode({ email })
    if (res?.success === false) return
    sentTo.value = maskEmail(email)
    digits.value = Array(OTP_LENGTH).fill('')
    startCountdown()
    await nextTick()
    otpRefs.value[0]?.focus()
  } catch {
    // 错误提示由请求层统一处理
  } finally {
    sending.value = false
  }
}

/** 「修改」解除邮箱锁定，可以换一个邮箱重新获取验证码 */
function editEmail() {
  sentTo.value = ''
  digits.value = Array(OTP_LENGTH).fill('')
  errors.code = ''
  clearInterval(timer)
  countdown.value = 0
}

async function verify() {
  errors.code = /^\d{6}$/.test(code()) ? '' : '请输入 6 位验证码'
  if (errors.code) return
  const email = form.email.trim()
  verifying.value = true
  try {
    // 只校验、不作废，通过后才进入第二步
    const res = await verifyRegisterCode({ email, code: code() })
    if (res?.success === false) return
    pendingEmail.value = email
    pendingCode.value = code()
    step.value = 'password'
  } catch {
    // 错误提示由请求层统一处理
  } finally {
    verifying.value = false
  }
}

/** 主按钮：未发送 → 获取验证码；已发送 → 校验验证码进入第二步 */
function onPrimary() {
  if (!agreed.value) {
    termsError.value = true
    showFailToast('请先勾选同意《服务协议》和《隐私政策》')
    return
  }
  termsError.value = false
  if (!sentTo.value) return sendCode()
  return verify()
}

function validatePassword(): boolean {
  errors.password = form.password.length >= 6 && form.password.length <= 32 ? '' : '密码长度需为 6-32 位'
  errors.confirm = form.confirm === form.password ? '' : '两次输入的密码不一致'
  return !errors.password && !errors.confirm
}

async function submitRegister() {
  if (!validatePassword()) return
  submitting.value = true
  try {
    const name = form.realName.trim()
    const res = await registerAccount({
      email: pendingEmail.value,
      code: pendingCode.value,
      password: form.password,
      ...(name ? { realName: name } : {}),
    })
    if (res?.success === false) return
    // 注册即登录，然后进入初始化页（选择个人模式或创建企业）
    await applyLogin(pendingEmail.value, res?.data as LoginResult | undefined, form.password)
    router.replace('/init')
  } catch {
    // 错误提示由请求层统一处理
  } finally {
    submitting.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/login')
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.h5-reg {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  background: var(--h5-bg);
}

.reg-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 24px 0 20px;
}

.reg-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--h5-text);
}

.reg-group {
  margin: 0 16px;
}

.reg-section {
  margin: 24px 0 10px;
  font-size: 13px;
  color: var(--h5-text-3);
  text-align: center;
}

.reg-hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--h5-text-2);
  text-align: center;
  word-break: break-all;
}

/* 6 格验证码：每格 ≥ 44px 高，满足触控尺寸；聚焦格加深边框 */
.otp-row {
  display: flex;
  gap: 8px;
  padding: 0 16px;
}

.otp-cell {
  flex: 1 1 0;
  min-width: 0;
  height: 56px;
  padding: 0;
  border: 1px solid var(--h5-border);
  border-radius: var(--h5-radius-sm);
  background: var(--h5-card);
  color: var(--h5-text);
  font-size: 22px;
  font-weight: 600;
  text-align: center;
  caret-color: var(--h5-text);
  outline: none;
}

.otp-cell:focus {
  border: 2px solid var(--h5-text);
}

.otp-row.has-error .otp-cell {
  border-color: var(--h5-danger);
}

.reg-error {
  margin: 8px 16px 0;
  font-size: 12px;
  color: var(--h5-danger);
  text-align: center;
}

.reg-email {
  margin: 0 20px 10px;
  font-size: 13px;
  color: var(--h5-text-2);
  word-break: break-all;
}

.reg-submit {
  margin: 24px 16px 0;
}

.reg-submit :deep(.van-button) {
  height: 48px;
  font-size: 16px;
}

.reg-resend {
  margin-top: 14px;
  text-align: center;
}

.reg-terms {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 20px 24px 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--h5-text-3);
}

.reg-terms.is-error {
  color: var(--h5-danger);
}

.reg-terms a {
  color: var(--h5-text);
}

.reg-footer {
  margin-top: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--h5-text-3);
}

.link-btn {
  padding: 4px 2px;
  border: 0;
  background: none;
  color: var(--h5-text);
  font-size: 14px;
  font-weight: 500;
}

.link-btn:disabled {
  color: var(--h5-text-4);
}
</style>
