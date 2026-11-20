<template>
  <!-- 左侧一级菜单（窄栏，参考 Jira 侧边导航）：工作台、空间 -->
  <aside class="wb-rail">
    <router-link to="/workbench/board" class="wb-rail-item" :class="{ 'is-active': isActive }" title="工作台">
      <HomeOutlined />
      <span>工作台</span>
    </router-link>
    <router-link to="/space" class="wb-rail-item" :class="{ 'is-active': isSpaceActive }" title="空间">
      <AppstoreOutlined />
      <span>空间</span>
    </router-link>
    <!-- 仅企业空间显示：个人空间没有企业后台 -->
    <router-link
      v-if="isEnterpriseWorkspace"
      to="/enterprise/users"
      class="wb-rail-item"
      :class="{ 'is-active': isAdminActive }"
      title="企业后台"
    >
      <ApartmentOutlined />
      <span>企业后台</span>
    </router-link>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ApartmentOutlined, AppstoreOutlined, HomeOutlined } from '@ant-design/icons-vue'
import { isEnterpriseWorkspace } from '@/utils/workspace'

const route = useRoute()
/** 企业后台页面（/admin/*）高亮 */
const isAdminActive = computed(() => route.path.startsWith('/enterprise') || route.path.startsWith('/admin'))
/** 工作台下的页面（我的看板 / 我的事项 / 事项详情等）：工作台菜单高亮 */
const isActive = computed(() => route.path.startsWith('/workbench') || route.path.startsWith('/jira/'))
/** 空间页面高亮 */
const isSpaceActive = computed(() => route.path.startsWith('/space'))
</script>

<style scoped>
.wb-rail {
  flex: 0 0 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 一级菜单项之间留出间距 */
  gap: 8px;
  padding: 12px 0;
  background: #ffffff;
  border-right: 1px solid #ebedf0;
  min-height: 100%;
}
.wb-rail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 60px;
  padding: 8px 0;
  font-size: 12px;
  color: #42526e;
  border-radius: 6px;
  text-decoration: none;
}
.wb-rail-item:hover {
  background: #e4e6eb;
  color: #172b4d;
}
.wb-rail-item.is-active {
  color: #0052cc;
  background: #deebff;
}
.wb-rail-item :deep(.anticon) {
  font-size: 18px;
}
</style>
