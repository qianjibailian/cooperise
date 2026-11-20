<template>
  <!-- 通用页面布局：个人中心 / 事项详情 / 历史页面等不属于四大模块的页面，只有顶栏和内容区 -->
  <a-layout class="layout-container" :style="{ '--sider-w': '0px' }">
    <!-- 事项详情（/jira）顶栏左上角展示 logo 和系统名称 -->
    <AppHeader
      :hide-sidebar-toggle="true"
      :show-logo="isJiraPage"
      :module-title="isJiraPage ? '需求管控平台' : ''"
    />
    <a-layout class="main-layout">
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import '@/layout/module-layout.css'

const route = useRoute()
const isJiraPage = computed(() => route.path.startsWith('/jira/'))
</script>
