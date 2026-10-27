<template>
  <router-view />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const { isLoggedIn } = useAuth()

// 登录态失效（接口 401 / 主动退出）时跳转登录页
watch(isLoggedIn, (loggedIn) => {
  if (!loggedIn && !route.meta.public) {
    router.replace({ name: 'Login', query: { redirect: route.fullPath } })
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
}

html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

:root {
  --ant-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>