<template>
  <div class="h5-page">
    <section class="me-hero">
      <UserAvatar :user="profile" :size="60" />
      <div class="me-info">
        <div class="me-name" data-no-i18n>{{ profile?.realName || realName || '未登录' }}</div>
        <div class="me-sub h5-ellipsis" data-no-i18n>{{ profile?.email || '' }}</div>
        <div v-if="profile?.deptInfo" class="me-sub h5-ellipsis" data-no-i18n>{{ profile.deptInfo }}</div>
      </div>
    </section>

    <!-- 个人信息：姓名 / 英文名 / 登录邮箱可修改（与网页版「个人中心」同一接口），工号只读 -->
    <van-cell-group inset class="me-group me-info-group">
      <van-cell
        v-for="f in EDIT_FIELDS"
        :key="f.key"
        :title="f.label"
        is-link
        @click="openEdit(f.key)"
      >
        <template #value>
          <span class="me-value h5-ellipsis" :class="{ 'h5-muted': !profileText(f.key) }" data-no-i18n>{{ profileText(f.key) || '未填写' }}</span>
        </template>
      </van-cell>
      <van-cell title="工号">
        <template #value>
          <span class="me-value" data-no-i18n>{{ String(profile?.coAccount || '—') }}</span>
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group inset class="me-group">
      <van-cell title="语言" is-link :value="locale === 'en' ? 'English' : '中文'" @click="langOpen = true" />
      <van-cell title="修改密码" is-link to="/password" />
    </van-cell-group>

    <div class="me-logout">
      <van-button block round :loading="loggingOut" @click="confirmLogout">退出登录</van-button>
    </div>

    <!-- 修改个人信息 -->
    <van-popup v-model:show="editOpen" position="bottom" round closeable safe-area-inset-bottom class="me-edit-sheet">
      <div class="me-edit-title">修改{{ editingField?.label }}</div>
      <van-cell-group inset class="me-edit-group">
        <van-field
          v-model="editValue"
          :type="editingKey === 'email' ? 'email' : 'text'"
          :placeholder="editingField?.placeholder"
          :maxlength="editingField?.maxlength"
          clearable
          autofocus
          data-no-i18n
        />
      </van-cell-group>
      <p v-if="editingKey === 'email'" class="me-edit-tip h5-muted">登录邮箱即登录账号，修改后请用新邮箱登录</p>
      <div class="me-edit-foot">
        <van-button type="primary" block round :disabled="!dirty" :loading="saving" @click="saveEdit">保存</van-button>
      </div>
    </van-popup>

    <van-action-sheet
      v-model:show="langOpen"
      :actions="LANG_ACTIONS"
      cancel-text="取消"
      close-on-click-action
      @select="onLangSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { getCurrentUser, logout, updatePersonalCenter, type CurrentUserProfile } from '@/api/faiz'
import { setAuthUser, setLoginUsername, setRealName, useAuth } from '@/utils/auth'
import { useLocale } from '@/i18n'
import UserAvatar from '../components/UserAvatar.vue'

const router = useRouter()
const { locale, setLocale } = useLocale()
const auth = useAuth()
const { realName, user } = auth

const profile = ref<CurrentUserProfile | Record<string, unknown> | null>((user.value as Record<string, unknown> | null) || null)
const langOpen = ref(false)
const loggingOut = ref(false)

async function loadProfile() {
  try {
    const res = await getCurrentUser()
    if (res?.success && res.data) {
      profile.value = res.data
      setAuthUser({
        realName: res.data.realName,
        email: res.data.email,
        userEnName: res.data.userEnName,
        avatarUrl: res.data.avatarUrl,
        deptInfo: res.data.deptInfo,
      } as never)
    }
  } catch {
    // 请求层已统一提示；先用本地登录信息
  }
}
onMounted(loadProfile)

// ---------------- 修改个人信息 ----------------
type EditKey = 'realName' | 'userEnName' | 'email'
const EDIT_FIELDS: { key: EditKey; label: string; placeholder: string; maxlength: number }[] = [
  { key: 'realName', label: '姓名', placeholder: '请输入姓名', maxlength: 32 },
  { key: 'userEnName', label: '英文名', placeholder: '例如 Allen Shen', maxlength: 64 },
  { key: 'email', label: '登录邮箱', placeholder: '请输入登录邮箱', maxlength: 128 },
]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const profileText = (k: EditKey) => String((profile.value as Record<string, unknown> | null)?.[k] ?? '').trim()

const editOpen = ref(false)
const editingKey = ref<EditKey | null>(null)
const editingField = computed(() => EDIT_FIELDS.find((f) => f.key === editingKey.value))
const editValue = ref('')
const saving = ref(false)
const dirty = computed(() => !!editingKey.value && editValue.value.trim() !== profileText(editingKey.value))

function openEdit(k: EditKey) {
  editingKey.value = k
  editValue.value = profileText(k)
  editOpen.value = true
}

async function saveEdit() {
  const k = editingKey.value
  if (!k || !dirty.value) return
  const v = editValue.value.trim()
  // 校验规则与网页版个人中心一致
  if (k === 'realName' && !v) return void showToast('请输入姓名')
  if (k === 'email' && !v) return void showToast('请输入登录邮箱')
  if (k === 'email' && !EMAIL_RE.test(v)) return void showToast('邮箱格式不正确')
  saving.value = true
  try {
    // 接口按整份提交：没改的字段原样带上
    const payload = { realName: profileText('realName'), userEnName: profileText('userEnName'), email: profileText('email'), [k]: v }
    const res = await updatePersonalCenter(payload)
    if (res?.success) {
      editOpen.value = false
      // 以服务端最新数据为准，并同步登录态（顶部姓名、登录账号）
      await loadProfile()
      const p = profile.value as Record<string, unknown> | null
      if (p?.realName) setRealName(String(p.realName))
      if (p?.email) setLoginUsername(String(p.email))
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

const LANG_ACTIONS = [{ name: '中文' }, { name: 'English' }]
function onLangSelect(a: { name: string }) {
  setLocale(a.name === 'English' ? 'en' : 'zh')
}

async function confirmLogout() {
  try {
    await showConfirmDialog({ title: '退出登录', message: '确定退出当前账号？' })
  } catch {
    return
  }
  loggingOut.value = true
  try {
    await logout()
  } catch {
    // 接口失败也清除本地登录态
  } finally {
    auth.logout()
    loggingOut.value = false
    router.replace({ name: 'H5Login' })
  }
}
</script>

<style scoped>
.me-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: calc(env(safe-area-inset-top, 0px) + 28px) var(--h5-gutter) 20px;
}

.me-info {
  min-width: 0;
}

.me-name {
  font-size: 20px;
  font-weight: 600;
}

.me-sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--h5-text-2);
}

.me-group {
  margin-top: 12px;
}

/* 标签按内容宽，值占剩余空间（长邮箱尽量显示全） */
.me-info-group :deep(.van-cell__title) {
  flex: 0 0 auto;
  margin-right: 16px;
}

.me-info-group :deep(.van-cell__value) {
  flex: 1;
  min-width: 0;
}

.me-value {
  display: inline-block;
  max-width: 100%;
  color: var(--h5-text-2);
}

.me-edit-sheet {
  padding-top: 8px;
}

.me-edit-title {
  padding: 12px 48px 8px 16px;
  font-size: 16px;
  font-weight: 600;
}

.me-edit-group {
  margin-top: 4px;
  background: var(--h5-fill);
  box-shadow: none;
}

.me-edit-group :deep(.van-cell) {
  background: var(--h5-fill);
}

.me-edit-tip {
  margin: 10px 32px 0;
  font-size: 12px;
}

.me-edit-foot {
  padding: 16px;
}

.me-logout {
  margin: 28px var(--h5-gutter) 0;
}

.me-logout :deep(.van-button) {
  color: #ee0a24;
}
</style>
