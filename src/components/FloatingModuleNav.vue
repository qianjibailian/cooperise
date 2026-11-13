<template>
  <!-- 右侧贴边的模块切换悬浮条（参考淘宝 / 京东客服条）：图标 + 文字竖排，可收起 -->
  <div class="module-rail" :class="{ 'is-hidden': hidden }" role="menu" aria-label="切换模块">
    <button
      v-for="item in NAV_ITEMS"
      :key="item.key"
      type="button"
      role="menuitem"
      class="mr-item"
      :class="{ active: isActiveNav(item.key) }"
      :title="item.label"
      @click="goNav(item)"
    >
      <component :is="item.icon" class="mr-icon" />
      <span class="mr-label">{{ item.label }}</span>
    </button>

    <!-- 收起：滑到右侧只留一个小把手 -->
    <button type="button" class="mr-item mr-toggle" title="收起菜单" @click="setHidden(true)">
      <RightOutlined class="mr-icon" />
      <span class="mr-label">收起</span>
    </button>
  </div>

  <!-- 收起后贴边的小把手：点击重新展开 -->
  <button
    type="button"
    class="mr-handle"
    :class="{ 'is-visible': hidden }"
    title="展开菜单"
    aria-label="展开菜单"
    @click="setHidden(false)"
  >
    <LeftOutlined />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AppstoreOutlined,
  FileTextOutlined,
  HomeOutlined,
  LeftOutlined,
  RightOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'

/** 一级模块（原顶栏「菜单」里的四个入口） */
const NAV_ITEMS = [
  { key: 'workspace', label: '工作台', icon: HomeOutlined, path: '/workbench/board' },
  { key: 'docs', label: '云文档', icon: FileTextOutlined, path: '/docs' },
  { key: 'space', label: '空间', icon: AppstoreOutlined, path: '/space' },
  { key: 'admin', label: '管理后台', icon: ToolOutlined, path: '/admin/users' },
]

const route = useRoute()
const router = useRouter()

const HIDDEN_KEY = 'cooperise.moduleRail.hidden'
function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}
/** 收起状态：记住用户选择（只影响当前浏览器） */
const hidden = ref(readHidden())
function setHidden(value: boolean) {
  hidden.value = value
  try {
    if (value) localStorage.setItem(HIDDEN_KEY, '1')
    else localStorage.removeItem(HIDDEN_KEY)
  } catch {
    // 存储不可用：只在本次会话生效
  }
}

function goNav(item: (typeof NAV_ITEMS)[number]) {
  router.push(item.path)
}

function isActiveNav(key: string): boolean {
  if (key === 'workspace') return route.path.startsWith('/workbench')
  return route.path.startsWith(`/${key}`)
}
</script>

<style scoped>
.module-rail {
  position: fixed;
  right: 0;
  bottom: 32px;
  z-index: 900;
  display: flex;
  flex-direction: column;
  width: 60px;
  padding: 2px 0;
  background: #ffffff;
  /* 左圆角、右侧贴边，阴影只往左投影，和淘宝 / 京东客服条一致 */
  border: 1px solid #f0f0f2;
  border-right: none;
  border-radius: 10px 0 0 10px;
  box-shadow: -2px 0 12px rgba(15, 23, 42, 0.1), 0 4px 16px rgba(15, 23, 42, 0.06);
  /* 让条目的高亮 / 分隔线被圆角裁切，四角干净 */
  overflow: hidden;
  transition: transform 0.22s ease, opacity 0.22s ease;
}

.module-rail.is-hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(100% + 12px));
}

.mr-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  height: 56px;
  padding: 6px 0;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

/* 条目之间的细分隔线 */
.mr-item + .mr-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 1px;
  background: #f2f2f4;
}

.mr-item:hover {
  background: #f7f8fa;
}

.mr-item:hover .mr-icon,
.mr-item:hover .mr-label {
  color: var(--c-primary);
}

.mr-item.active {
  background: var(--c-primary-bg);
}

/* 选中态左侧主色小竖条 */
.mr-item.active::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 22px;
  border-radius: 0 2px 2px 0;
  background: var(--c-primary);
  transform: translateY(-50%);
}

.mr-toggle {
  height: 44px;
  gap: 4px;
}

.mr-icon {
  font-size: 19px;
  line-height: 1;
  color: #5c5f66;
  transition: color 0.15s;
}

.mr-label {
  font-size: 11px;
  line-height: 1;
  color: #5c5f66;
  white-space: nowrap;
  transition: color 0.15s;
}

.mr-item.active .mr-icon,
.mr-item.active .mr-label {
  color: var(--c-primary);
}

.mr-item.active .mr-label {
  font-weight: 600;
}

/* 收起后的贴边把手 */
.mr-handle {
  position: fixed;
  right: 0;
  bottom: 32px;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 52px;
  padding: 0;
  font-size: 11px;
  color: #5c5f66;
  background: #ffffff;
  border: 1px solid #f0f0f2;
  border-right: none;
  border-radius: 10px 0 0 10px;
  box-shadow: -2px 0 12px rgba(15, 23, 42, 0.1);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translateX(100%);
  transition: transform 0.22s ease, opacity 0.22s ease, color 0.15s;
}

.mr-handle.is-visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.mr-handle:hover {
  color: var(--c-primary);
  background: #f7f8fa;
}

@media (max-width: 767px) {
  .module-rail {
    bottom: 16px;
    width: 54px;
  }
  .mr-item {
    height: 50px;
    gap: 4px;
  }
  .mr-toggle {
    height: 42px;
  }
  .mr-icon {
    font-size: 17px;
  }
  .mr-label {
    font-size: 10px;
  }
  .mr-handle {
    bottom: 16px;
    height: 48px;
  }
}
</style>
