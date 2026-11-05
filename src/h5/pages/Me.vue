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

    <van-cell-group inset class="me-group">
      <van-cell title="工号" :value="String(profile?.coAccount || '—')" />
      <van-cell title="英文名" :value="String(profile?.userEnName || '—')" />
    </van-cell-group>

    <van-cell-group inset class="me-group">
      <van-cell title="语言" is-link :value="locale === 'en' ? 'English' : '中文'" @click="langOpen = true" />
      <van-cell title="修改密码" is-link to="/password" />
      <van-cell title="电脑版" label="在手机上打开网页版" is-link @click="openPc" />
    </van-cell-group>

    <div class="me-logout">
      <van-button block round :loading="loggingOut" @click="confirmLogout">退出登录</van-button>
    </div>

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
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { getCurrentUser, logout, type CurrentUserProfile } from '@/api/faiz'
import { setAuthUser, useAuth } from '@/utils/auth'
import { useLocale } from '@/i18n'
import UserAvatar from '../components/UserAvatar.vue'

const router = useRouter()
const { locale, setLocale } = useLocale()
const auth = useAuth()
const { realName, user } = auth

const profile = ref<CurrentUserProfile | Record<string, unknown> | null>((user.value as Record<string, unknown> | null) || null)
const langOpen = ref(false)
const loggingOut = ref(false)

onMounted(async () => {
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
})

const LANG_ACTIONS = [{ name: '中文' }, { name: 'English' }]
function onLangSelect(a: { name: string }) {
  setLocale(a.name === 'English' ? 'en' : 'zh')
}

/** 手机上坚持用网页版（本次会话不再自动跳回 H5） */
function openPc() {
  location.href = '/workbench?pc=1'
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

.me-logout {
  margin: 28px var(--h5-gutter) 0;
}

.me-logout :deep(.van-button) {
  color: #ee0a24;
}
</style>
