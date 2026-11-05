<template>
  <div class="h5-page">
    <van-nav-bar title="修改密码" left-arrow fixed placeholder @click-left="goBack" />
    <van-form class="cp-form" @submit="submit">
      <van-cell-group inset>
        <van-field
          v-model="oldPassword"
          type="password"
          label="原密码"
          placeholder="请输入原密码"
          autocomplete="current-password"
          :rules="[{ required: true, message: '请输入原密码' }]"
        />
        <van-field
          v-model="newPassword"
          type="password"
          label="新密码"
          placeholder="6-32 位"
          autocomplete="new-password"
          :rules="[
            { required: true, message: '请输入新密码' },
            { validator: (v: string) => v.length >= 6 && v.length <= 32, message: '密码长度需为 6-32 位' },
            { validator: (v: string) => v !== oldPassword, message: '新密码不能与原密码相同' },
          ]"
        />
        <van-field
          v-model="confirmPassword"
          type="password"
          label="确认密码"
          placeholder="再次输入新密码"
          autocomplete="new-password"
          :rules="[{ validator: (v: string) => v === newPassword, message: '两次输入的密码不一致' }]"
        />
      </van-cell-group>
      <p class="cp-tip h5-muted">修改后需使用新密码重新登录</p>
      <div class="cp-submit">
        <van-button type="primary" block round native-type="submit" :loading="saving">确认修改</van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { changePassword } from '@/api/faiz'
import { useAuth } from '@/utils/auth'

const router = useRouter()
const auth = useAuth()

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)

async function submit() {
  saving.value = true
  try {
    const res = await changePassword({ oldPassword: oldPassword.value, newPassword: newPassword.value })
    if (res?.success) {
      // 与网页版一致：改完密码退出，用新密码重新登录
      auth.logout()
      router.replace({ name: 'H5Login' })
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/me')
}
</script>

<style scoped>
.cp-form {
  margin-top: 12px;
}

.cp-tip {
  margin: 12px 32px 0;
  font-size: 13px;
}

.cp-submit {
  margin: 24px var(--h5-gutter) 0;
}
</style>
