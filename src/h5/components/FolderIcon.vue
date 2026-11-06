<template>
  <!-- 文件夹图标（Vant 图标库没有 folder，内联 SVG，颜色跟随 currentColor） -->
  <svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6c.6 0 1.2.25 1.6.7l1.2 1.3h6.6A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" fill="currentColor" opacity=".9" />
  </svg>
</template>

<style scoped>
.folder-icon {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
}
</style>
