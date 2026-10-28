<template>
  <div class="settings-page">
    <a-spin :spinning="loading">
      <!-- 概览卡片 -->
      <section class="settings-card profile-hero">
        <a-avatar :size="72" :src="profile.avatarUrl || undefined" class="hero-avatar">
          {{ initials }}
        </a-avatar>
        <div class="hero-main">
          <div class="hero-name">
            {{ displayName }}
            <span v-if="profile.userEnName" class="hero-en">{{ profile.userEnName }}</span>
            <a-tag v-if="profile.isActive != null" :color="profile.isActive === 1 ? 'green' : 'default'" class="hero-tag hero-status">
              {{ profile.isActive === 1 ? '在职' : '离职' }}
            </a-tag>
          </div>
          <div class="hero-email"><MailOutlined /> {{ profile.email || '-' }}</div>
          <div class="hero-tags">
            <a-tag v-if="profile.deptInfo" class="hero-tag"><ApartmentOutlined /> {{ profile.deptInfo }}</a-tag>
          </div>
        </div>
      </section>

      <!-- 基本资料 -->
      <section class="settings-card">
        <div class="card-head">
          <h3 class="card-title">基本资料</h3>
        </div>
        <a-form ref="formRef" :model="form" :rules="rules" class="info-form">
          <dl class="info-grid">
            <div v-for="row in infoRows" :key="row.label" :class="['info-row', { 'is-editing': row.key && editingKey === row.key }]">
              <dt>{{ row.label }}</dt>
              <dd>
                <a-form-item v-if="row.key && editingKey === row.key" :name="row.key" class="info-form-item">
                  <a-input
                    v-model:value="form[row.key]"
                    :placeholder="row.placeholder"
                    :maxlength="row.maxlength"
                    size="small"
                    allow-clear
                    autofocus
                    @press-enter="handleSave"
                    @keydown.esc="cancelEdit"
                  />
                </a-form-item>
                <template v-else>{{ row.value || '-' }}</template>
              </dd>
              <div v-if="row.key" class="row-actions">
                <template v-if="editingKey === row.key">
                  <a-button size="small" :disabled="saving" @click="cancelEdit">取消</a-button>
                  <a-button size="small" type="primary" :loading="saving" :disabled="!dirty" @click="handleSave">保存</a-button>
                </template>
                <a-button v-else type="link" size="small" class="row-edit-btn" :disabled="loading || !!editingKey" @click="startEdit(row.key)">
                  <EditOutlined /> 修改
                </a-button>
              </div>
            </div>
          </dl>
        </a-form>
      </section>

      <!-- 所属组织 -->
      <section class="settings-card">
        <div class="card-head">
          <h3 class="card-title">所属组织</h3>
          <span class="card-count">{{ organizations.length }}</span>
        </div>
        <a-empty v-if="!organizations.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无所属组织" />
        <ul v-else class="org-list">
          <li v-for="org in organizations" :key="org.id" class="org-item">
            <div class="org-logo">{{ (org.organizationName || '组').slice(0, 1) }}</div>
            <div class="org-main">
              <div class="org-name">{{ org.organizationName || '-' }}</div>
              <div v-if="org.pathName" class="org-path">{{ org.pathName }}</div>
            </div>
            <a-tag v-if="org.status === 0" class="hero-tag">已停用</a-tag>
          </li>
        </ul>
      </section>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Empty, type FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { MailOutlined, ApartmentOutlined, EditOutlined } from '@ant-design/icons-vue'
import { getCurrentUser, updatePersonalCenter, type CurrentUserProfile, type PersonalCenterUpdate } from '@/api/faiz'
import { getLoginUsername, setAuthUser, setLoginUsername, setRealName, useAuth } from '@/utils/auth'

const { realName } = useAuth()
const loading = ref(false)
/** 姓名 / 邮箱：接口未返回时用登录时保存的信息兜底 */
const profile = ref<CurrentUserProfile>({ realName: realName.value, email: getLoginUsername() })

const displayName = computed(() => profile.value.realName || profile.value.coAccount || profile.value.email || '用户')
const initials = computed(() => displayName.value.slice(-2).toUpperCase())
const organizations = computed(() => profile.value.organizations || [])

type EditableKey = keyof Required<PersonalCenterUpdate>
interface InfoRow {
  label: string
  value?: string
  /** 可编辑字段：编辑态渲染为输入框 */
  key?: EditableKey
  placeholder?: string
  maxlength?: number
}

const infoRows = computed<InfoRow[]>(() => [
  { label: '姓名', value: profile.value.realName, key: 'realName', placeholder: '请输入姓名', maxlength: 32 },
  { label: '工号', value: profile.value.coAccount },
  { label: '英文名', value: profile.value.userEnName, key: 'userEnName', placeholder: '例如 Allen Shen', maxlength: 64 },
  { label: '登录邮箱', value: profile.value.email, key: 'email', placeholder: '请输入登录邮箱', maxlength: 128 },
  { label: '部门', value: profile.value.deptInfo },
  { label: '成员 ID', value: profile.value.memberId },
])

// ---- 编辑 ----
const formRef = ref<FormInstance>()
/** 当前正在修改的字段（同一时间只编辑一行） */
const editingKey = ref<EditableKey | null>(null)
const saving = ref(false)
const form = reactive<Record<EditableKey, string>>({ realName: '', userEnName: '', email: '' })
const EDITABLE_KEYS = Object.keys(form) as EditableKey[]

const rules: Record<string, Rule[]> = {
  realName: [{ required: true, whitespace: true, message: '请输入姓名' }],
  email: [
    { required: true, whitespace: true, message: '请输入登录邮箱' },
    { type: 'email', message: '邮箱格式不正确' },
  ],
  userEnName: [{ whitespace: true, message: '英文名不能只包含空格' }],
}

const dirty = computed(() => {
  const k = editingKey.value
  return !!k && form[k].trim() !== (profile.value[k] ?? '')
})

function startEdit(key: EditableKey) {
  EDITABLE_KEYS.forEach((k) => { form[k] = profile.value[k] ?? '' })
  editingKey.value = key
}

function cancelEdit() {
  formRef.value?.clearValidate()
  editingKey.value = null
}

async function handleSave() {
  const key = editingKey.value
  if (!key || !dirty.value || saving.value) return
  try {
    await formRef.value?.validateFields([key])
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = Object.fromEntries(EDITABLE_KEYS.map(k => [k, form[k].trim()])) as PersonalCenterUpdate
    const res = await updatePersonalCenter(payload)
    if (res?.success) {
      profile.value = { ...profile.value, ...payload }
      editingKey.value = null
      // 更新成功后重新查询，以服务端最新数据为准
      await loadProfile()
      // 同步登录态：顶栏姓名、登录账号
      if (profile.value.realName) setRealName(profile.value.realName)
      if (profile.value.email) setLoginUsername(profile.value.email)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

async function loadProfile() {
  loading.value = true
  try {
    const res = await getCurrentUser()
    if (res?.success && res.data) {
      profile.value = {
        ...res.data,
        realName: res.data.realName || profile.value.realName,
        email: res.data.email || profile.value.email,
      }
      // 同步顶栏头像 / 姓名 / 部门
      setAuthUser({
        realName: profile.value.realName,
        email: profile.value.email,
        userEnName: profile.value.userEnName,
        avatarUrl: profile.value.avatarUrl,
        deptInfo: profile.value.deptInfo,
      })
    }
  } catch {
    // 请求层已统一提示，页面仍展示登录时保存的信息
  } finally {
    loading.value = false
  }
}

onMounted(loadProfile)
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

.profile-hero {
  display: flex;
  align-items: center;
  gap: 20px;
}

.hero-avatar {
  flex-shrink: 0;
  font-size: 24px;
  font-weight: 600;
  background: linear-gradient(135deg, #0a84ff, #5e5ce6);
}

.hero-main {
  min-width: 0;
}

.hero-name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
  line-height: 1.4;
}

.hero-en {
  font-size: 14px;
  font-weight: 400;
  color: #86868b;
}

.hero-email {
  margin-top: 4px;
  font-size: 13px;
  color: #6e6e73;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hero-tags {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hero-tags:empty {
  display: none;
}

.hero-tag {
  margin: 0;
  border-radius: 6px;
}

.hero-status {
  font-size: 12px;
  font-weight: 400;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
}

.card-count {
  padding: 0 8px;
  font-size: 12px;
  line-height: 20px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 10px;
}

.info-grid {
  margin: 0;
}

.info-row {
  display: flex;
  align-items: center;
  min-height: 45px;
  padding: 6px 0;
  border-bottom: 1px solid #f2f2f5;
  font-size: 13px;
}

.info-row dt {
  width: 96px;
  flex-shrink: 0;
  color: #86868b;
}

.info-row dd {
  flex: 1;
  margin: 0;
  min-width: 0;
  color: #1d1d1f;
  word-break: break-all;
}

.row-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
}

.row-edit-btn {
  padding: 0 4px;
  height: auto;
  font-size: 13px;
}

.info-form-item {
  margin-bottom: 0;
}

.org-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.org-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
}

.org-logo {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: 600;
  color: #fff;
  background: #0a84ff;
}

.org-main {
  flex: 1;
  min-width: 0;
}

.org-name {
  font-size: 14px;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.org-path {
  margin-top: 2px;
  font-size: 12px;
  color: #86868b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 576px) {
  .profile-hero {
    flex-direction: column;
    text-align: center;
  }

  .hero-name,
  .hero-email,
  .hero-tags {
    justify-content: center;
  }
}
</style>
