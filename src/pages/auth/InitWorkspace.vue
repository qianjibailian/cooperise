<template>
  <AuthLayout class="init-page" no-visual hide-lang title="选择使用方式">
    <!-- 选择 -->
    <div v-if="mode === 'choose'" class="init-options">
      <button type="button" class="init-option" :disabled="submitting" @click="choosePersonal">
        <span class="init-icon init-icon--person"><UserOutlined /></span>
        <span class="init-text">
          <span class="init-option-title">个人模式</span>
          <span class="init-option-desc">仅自己使用，无需创建组织</span>
        </span>
      </button>
      <button type="button" class="init-option" :disabled="submitting" @click="mode = 'enterprise'">
        <span class="init-icon init-icon--enterprise"><TeamOutlined /></span>
        <span class="init-text">
          <span class="init-option-title">创建企业</span>
          <span class="init-option-desc">新建组织，你将成为管理员</span>
        </span>
      </button>
    </div>

    <!-- 企业名称 -->
    <form v-else novalidate @submit.prevent="createEnterprise">
      <button type="button" class="init-back" @click="mode = 'choose'">← 返回</button>
      <AuthField v-model="orgName" placeholder="企业名称" />
      <button type="submit" class="auth-btn" :disabled="!orgName.trim() || submitting">
        {{ submitting ? '创建中…' : '创建' }}
      </button>
    </form>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { TeamOutlined, UserOutlined } from '@ant-design/icons-vue'
import AuthLayout from './AuthLayout.vue'
import AuthField from './AuthField.vue'
import { createSelfOrganization, getCurrentUser, startInitConfig } from '@/api/faiz'
import { setAuthUser } from '@/utils/auth'

const router = useRouter()

/** choose：二选一；enterprise：填写企业名称 */
const mode = ref<'choose' | 'enterprise'>('choose')
const orgName = ref('')
const submitting = ref(false)

/**
 * 个人模式：选定后才开始同步个人空间数据（独立接口，不在注册流程中），然后进入进度页
 */
async function choosePersonal() {
  if (submitting.value) return
  submitting.value = true
  try {
    const res = await startInitConfig({})
    if (!res?.success) return
    router.push({ name: 'InitProgress', query: { ws: 'personal' } })
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}

/**
 * 创建企业：先创建组织，再为该企业开始同步（企业默认空间），然后进入进度页
 */
async function createEnterprise() {
  const name = orgName.value.trim()
  if (!name) {
    message.warning('请输入企业名称')
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const res = await createSelfOrganization({ organizationName: name })
    if (res?.success === false || !res?.data) return
    const org = res.data
    const profile = await getCurrentUser()
    if (profile?.success && profile.data) setAuthUser({ organizations: profile.data.organizations })
    const started = await startInitConfig({ organizationCode: org.organizationCode })
    if (!started?.success) return
    router.push({
      name: 'InitProgress',
      query: { org: org.organizationCode, ws: org.id ? String(org.id) : 'personal' },
    })
  } catch {
    // 错误提示由 request 拦截器统一处理
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* 标题比认证页默认尺寸小一号 */
.init-page :deep(.auth-title) {
  font-size: clamp(24px, 2.2vw, 30px);
  letter-spacing: -0.3px;
}

.init-options {
  display: grid;
  gap: 10px;
}

.init-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  text-align: left;
  color: #1d1d1f;
  background: #fff;
  border: 1px solid #e5e5ea;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.init-option:hover:not(:disabled) {
  border-color: #1a1a1a;
  background: #fafafc;
}

.init-option:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.init-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 20px;
  color: #fff;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
}

.init-icon--person {
  background: linear-gradient(135deg, #34c759, #30d158);
}

.init-icon--enterprise {
  background: linear-gradient(135deg, #0052cc, #2684ff);
}

.init-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.init-option-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.init-option-desc {
  font-size: 12px;
  color: #86868b;
}

.init-back {
  display: block;
  margin: 0 0 12px;
  padding: 0;
  font-size: 13px;
  color: #6e6e73;
  background: none;
  border: none;
  cursor: pointer;
}
</style>
