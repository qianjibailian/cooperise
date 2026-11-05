<template>
  <!-- 带底部标签栏的主页面框架：看板 / 事项 / ＋新建 / 空间 / 我的 -->
  <div class="h5-tab-layout">
    <router-view v-slot="{ Component, route: r }">
      <keep-alive :include="['H5Issues', 'H5Boards']">
        <component :is="Component" :key="r.name" />
      </keep-alive>
    </router-view>

    <van-tabbar route fixed placeholder safe-area-inset-bottom class="h5-tabbar">
      <van-tabbar-item to="/boards" icon="apps-o">看板</van-tabbar-item>
      <van-tabbar-item to="/issues" icon="todo-list-o">事项</van-tabbar-item>
      <!-- 新建：中间突出的圆形按钮，进入全屏表单页 -->
      <van-tabbar-item class="h5-tab-create" @click="router.push('/create')">
        <template #icon>
          <span class="h5-create-btn"><van-icon name="plus" /></span>
        </template>
        新建
      </van-tabbar-item>
      <van-tabbar-item to="/spaces" icon="cluster-o">空间</van-tabbar-item>
      <van-tabbar-item to="/me" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

defineOptions({ name: 'H5TabLayout' })

const router = useRouter()
</script>

<style scoped>
.h5-tab-layout {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--h5-bg);
}

.h5-create-btn {
  width: 36px;
  height: 36px;
  margin-top: -10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--c-primary, #1677ff);
  color: #fff;
  font-size: 20px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--c-primary, #1677ff) 40%, transparent);
}

/* 新建不是一个「页面」，不需要选中态 */
.h5-tab-create :deep(.van-tabbar-item__text) {
  color: var(--van-tabbar-item-text-color);
}
</style>
