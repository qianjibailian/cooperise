<template>
  <router-view v-slot="{ Component, route: r }">
    <!-- 标签页框架整体保活（切标签不重建）；详情等二级页按地址区分，换一条事项就重新加载 -->
    <keep-alive include="H5TabLayout">
      <component :is="Component" :key="r.matched[0]?.path === '/' ? 'tabs' : r.fullPath" />
    </keep-alive>
  </router-view>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const { isLoggedIn } = useAuth()

// 登录态失效（接口 401 / 主动退出）时回到登录页
watch(isLoggedIn, (loggedIn) => {
  if (!loggedIn && !route.meta.public) router.replace({ name: 'H5Login', query: { redirect: route.fullPath } })
})
</script>
