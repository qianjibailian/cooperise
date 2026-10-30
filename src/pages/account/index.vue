<template>
  <div class="settings-page">
    <!-- 登录与安全 -->
    <section class="settings-card">
      <div class="card-head">
        <h3 class="card-title">登录与安全</h3>
      </div>
      <div class="setting-row">
        <div class="setting-icon"><MailOutlined /></div>
        <div class="setting-main">
          <div class="setting-label">登录邮箱</div>
          <div class="setting-desc">{{ loginAccount || '-' }}</div>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-icon"><LockOutlined /></div>
        <div class="setting-main">
          <div class="setting-label">登录密码</div>
          <div class="setting-desc password-mask">••••••••</div>
        </div>
        <a-button @click="openPwdModal">修改</a-button>
      </div>
    </section>

    <!-- 通知偏好 -->
    <section class="settings-card">
      <div class="card-head">
        <div>
          <h3 class="card-title">通知偏好</h3>
          <p class="card-sub">仅保存在当前浏览器</p>
        </div>
      </div>
      <div v-for="item in NOTIFY_ITEMS" :key="item.key" class="setting-row">
        <div class="setting-main">
          <div class="setting-label">{{ item.label }}</div>
          <div class="setting-desc">{{ item.desc }}</div>
        </div>
        <a-switch v-model:checked="notify[item.key]" @change="saveNotify" />
      </div>
    </section>

    <!-- 退出登录 -->
    <section class="settings-card danger-card">
      <div class="setting-row">
        <div class="setting-main">
          <div class="setting-label">退出登录</div>
          <div class="setting-desc">退出当前设备上的登录状态</div>
        </div>
        <a-button danger @click="confirmLogout"><LogoutOutlined /> 退出登录</a-button>
      </div>
    </section>

    <!-- 修改密码弹窗 -->
    <a-modal
      v-model:open="pwdModalOpen"
      title="修改密码"
      :width="420"
      centered
      destroy-on-close
      ok-text="确认修改"
      cancel-text="取消"
      :confirm-loading="pwdSaving"
      wrap-class-name="pwd-modal"
      @ok="handleChangePassword"
    >
      <p class="pwd-modal-tip">修改后需使用新密码重新登录</p>
      <a-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" layout="vertical" :required-mark="false">
        <a-form-item label="当前密码" name="oldPassword">
          <a-input-password v-model:value="pwdForm.oldPassword" placeholder="请输入当前密码" autocomplete="current-password" />
        </a-form-item>
        <a-form-item label="新密码" name="newPassword" extra="6-32 位，建议包含字母、数字和符号">
          <a-input-password v-model:value="pwdForm.newPassword" placeholder="请输入新密码" autocomplete="new-password" />
        </a-form-item>
        <a-form-item label="确认新密码" name="confirmPassword">
          <a-input-password v-model:value="pwdForm.confirmPassword" placeholder="请再次输入新密码" autocomplete="new-password" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { LockOutlined, LogoutOutlined, MailOutlined } from '@ant-design/icons-vue'
import { changePassword, logout } from '@/api/faiz'
import { getLoginUsername, useAuth } from '@/utils/auth'

const router = useRouter()
const auth = useAuth()
const loginAccount = getLoginUsername()

// ---- 修改密码 ----
const pwdFormRef = ref<FormInstance>()
const pwdSaving = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const pwdRules: Record<string, Rule[]> = {
  oldPassword: [{ required: true, message: '请输入当前密码' }],
  newPassword: [
    { required: true, message: '请输入新密码' },
    { min: 6, max: 32, message: '密码长度需为 6-32 位' },
    {
      validator: async (_r, v: string) => {
        if (v && v === pwdForm.oldPassword) throw new Error('新密码不能与当前密码相同')
      },
    },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码' },
    {
      validator: async (_r, v: string) => {
        if (v && v !== pwdForm.newPassword) throw new Error('两次输入的密码不一致')
      },
    },
  ],
}

const pwdModalOpen = ref(false)
function openPwdModal() {
  Object.assign(pwdForm, { oldPassword: '', newPassword: '', confirmPassword: '' })
  pwdModalOpen.value = true
}

async function handleChangePassword() {
  try {
    await pwdFormRef.value?.validate()
  } catch {
    return
  }
  pwdSaving.value = true
  try {
    const res = await changePassword({ oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
    if (res?.success) {
      pwdModalOpen.value = false
      Modal.success({
        title: '密码已更新',
        content: '请使用新密码重新登录',
        okText: '重新登录',
        centered: true,
        onOk: () => signOut(false),
      })
    }
  } catch {
    // 请求层已统一提示
  } finally {
    pwdSaving.value = false
  }
}

// ---- 通知偏好（本地存储） ----
const NOTIFY_STORAGE_KEY = 'cooperise_notify_prefs'
const NOTIFY_ITEMS = [
  { key: 'assign', label: '分配给我', desc: '事项负责人变更为我时通知' },
  { key: 'mention', label: '@ 提及', desc: '评论或描述中提及我时通知' },
  { key: 'statusChange', label: '状态变更', desc: '我关注的事项状态变化时通知' },
  { key: 'email', label: '邮件通知', desc: '同时发送邮件到登录邮箱' },
] as const
type NotifyKey = (typeof NOTIFY_ITEMS)[number]['key']

function loadNotify(): Record<NotifyKey, boolean> {
  const defaults: Record<NotifyKey, boolean> = { assign: true, mention: true, statusChange: false, email: false }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(NOTIFY_STORAGE_KEY) || '{}') }
  } catch {
    return defaults
  }
}
const notify = reactive(loadNotify())
function saveNotify() {
  try {
    localStorage.setItem(NOTIFY_STORAGE_KEY, JSON.stringify(notify))
  } catch { /* 存储不可用时忽略 */ }
}

// ---- 退出登录 ----
async function signOut(callApi = true) {
  if (callApi) {
    try { await logout() } catch { /* 接口失败也清除本地登录态 */ }
  }
  auth.logout()
  router.replace({ name: 'Login' })
}

function confirmLogout() {
  Modal.confirm({
    title: '确定退出登录？',
    okText: '退出',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    onOk: () => signOut().catch(() => message.error('退出失败')),
  })
}
</script>

<style scoped>
.settings-page {
  padding: 16px 20px 32px;
}

.settings-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 14px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.card-head {
  margin-bottom: 16px;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.card-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #86868b;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid #f2f2f5;
}

.card-head + .setting-row,
.danger-card .setting-row {
  border-top: none;
  padding-top: 0;
}

.danger-card .setting-row {
  padding-bottom: 0;
}

.setting-main {
  min-width: 0;
}

.setting-label {
  font-size: 14px;
  color: #1d1d1f;
}

.setting-desc {
  margin-top: 2px;
  font-size: 12px;
  color: #86868b;
  word-break: break-all;
}

.setting-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 15px;
  color: var(--c-primary);
  background: var(--c-primary-bg);
}

.setting-row .setting-main {
  flex: 1;
}

.password-mask {
  letter-spacing: 2px;
}
</style>

<style>
/* 弹窗挂载在 body 下，需非 scoped */
.pwd-modal .pwd-modal-tip {
  margin: -4px 0 16px;
  font-size: 13px;
  color: #86868b;
}

.pwd-modal .ant-form-item {
  margin-bottom: 16px;
}

.pwd-modal .ant-form-item-extra {
  font-size: 12px;
  color: #aeaeb2;
}
</style>
