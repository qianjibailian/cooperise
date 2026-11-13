<template>
  <!-- 通用页面布局：个人中心 / 事项详情 / 历史页面等不属于四大模块的页面，只有顶栏和内容区 -->
  <a-layout class="layout-container" :style="{ '--sider-w': '0px' }">
    <AppHeader :hide-sidebar-toggle="true" />
    <a-layout class="main-layout">
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import '@/layout/module-layout.css'
</script>
