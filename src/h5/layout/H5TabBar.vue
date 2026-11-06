<template>
  <!--
    底部标签栏：挂在 App 根部，除登录页外始终显示，不随路由切换而出现 / 消失。
    高亮跟随当前所在模块（详情页算「事项」、视图 / 看板面板算「看板」、改密码算「我的」）
  -->
  <van-tabbar :model-value="active" fixed placeholder safe-area-inset-bottom class="h5-tabbar">
    <van-tabbar-item name="boards" icon="apps-o" @click="go('/boards')">看板</van-tabbar-item>
    <van-tabbar-item name="issues" icon="todo-list-o" @click="go('/issues')">事项</van-tabbar-item>
    <!-- 新建：中间渐变按钮，进入新建事项页 -->
    <van-tabbar-item name="create" class="h5-tab-create" @click="go('/create')">
      <template #icon>
        <span class="h5-create-btn"><van-icon name="plus" /></span>
      </template>
      新建
    </van-tabbar-item>
    <van-tabbar-item name="spaces" icon="cluster-o" @click="go('/spaces')">空间</van-tabbar-item>
    <van-tabbar-item name="me" icon="user-o" @click="go('/me')">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

/** 当前路由属于哪个标签 */
const active = computed(() => {
  const p = route.path
  if (p.startsWith('/boards') || p.startsWith('/board/') || p.startsWith('/view/')) return 'boards'
  if (p.startsWith('/issues') || p.startsWith('/jira/browse/')) return 'issues'
  if (p.startsWith('/create')) return 'create'
  if (p.startsWith('/spaces')) return 'spaces'
  if (p.startsWith('/me') || p.startsWith('/password')) return 'me'
  return ''
})

/** 点标签：已在该页就不重复跳转；从详情等二级页点回模块首页（列表页保活，筛选和滚动位置都在） */
function go(path: string) {
  if (route.path === path) return
  router.push(path)
}
</script>

<style scoped>
/*
 * 标签栏：毛玻璃 + 顶部 0.5px 细线（iOS Tab Bar）
 * 注意：开了 placeholder 时 class 落在外层占位 div 上，真正 fixed 的是里面的 .van-tabbar。
 * backdrop-filter 必须加在里层：加在外层会让外层成为 fixed 的参照，标签栏就跟着页面底部跑、不再贴屏幕底部
 */
.h5-tabbar :deep(.van-tabbar) {
  background: rgba(249, 249, 251, 0.86);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  backdrop-filter: saturate(180%) blur(20px);
}

.h5-tabbar :deep(.van-tabbar::after) {
  border-top-width: 0.5px;
  border-color: var(--h5-border);
}

.h5-tabbar :deep(.van-tabbar-item__text) {
  font-weight: 500;
}

.h5-tabbar :deep(.van-tabbar-item__icon) {
  transition: transform 0.2s var(--h5-ease);
}

/* 选中的标签图标轻微放大 */
.h5-tabbar :deep(.van-tabbar-item--active .van-tabbar-item__icon) {
  transform: scale(1.06);
}

/* 新建：圆角方形渐变按钮，带同色柔和投影 */
.h5-create-btn {
  width: 40px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--h5-primary) 88%, #fff), var(--h5-primary));
  color: #fff;
  font-size: 20px;
  box-shadow: 0 6px 14px -4px color-mix(in srgb, var(--h5-primary) 60%, transparent);
  transition: transform 0.2s var(--h5-ease);
}

.h5-tab-create:active .h5-create-btn {
  transform: scale(0.92);
}

/* 新建按钮本身已经很醒目，选中时文字不变色 */
.h5-tab-create :deep(.van-tabbar-item__text) {
  color: var(--van-tabbar-item-text-color);
}
</style>
