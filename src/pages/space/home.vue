<template>
  <div class="space-home">
    <button type="button" class="back-link" @click="router.push({ name: 'Space' })"><LeftOutlined /> 空间</button>

    <a-spin :spinning="spaceLoading && !space">
      <a-result v-if="!space && !spaceLoading" status="404" title="空间不存在" sub-title="该空间可能已被删除，或编码有误">
        <template #extra>
          <a-button type="primary" @click="router.push({ name: 'Space' })">返回空间列表</a-button>
        </template>
      </a-result>

      <template v-else-if="space">
        <!-- 空间概览 -->
        <section class="hero-card">
          <span class="hero-avatar" :style="{ background: space.color || '#0A84FF' }">{{ spaceAvatarText(space.spaceName) }}</span>
          <div class="hero-main">
            <div class="hero-title-row">
              <h2 class="hero-title">{{ space.spaceName }}</h2>
              <span v-if="space.spaceKey" class="key-chip">{{ space.spaceKey }}</span>
              <span class="code-chip">{{ space.spaceCode }}</span>
              <span :class="['status-dot', space.status === 1 ? 'on' : 'off']">{{ space.status === 1 ? '启用' : '停用' }}</span>
            </div>
            <p class="hero-desc">{{ space.description || '暂无描述' }}</p>
            <div class="hero-meta">
              <span v-if="orgLabel" class="org-chip"><ApartmentOutlined /><span class="ellipsis">{{ orgLabel }}</span></span>
              <span class="meta-item">
                <span class="meta-label">负责人</span>
                <template v-if="space.ownerMemberId">
                  <a-avatar :size="20" class="user-avatar">{{ spaceAvatarText(space.ownerName || space.ownerMemberId) }}</a-avatar>
                  {{ space.ownerName || space.ownerMemberId }}
                </template>
                <span v-else class="text-muted">-</span>
              </span>
              <span v-if="space.updateTime" class="meta-item"><span class="meta-label">更新于</span>{{ formatTime(space.updateTime) }}</span>
            </div>
          </div>
        </section>

        <!-- 空间内管理：问题类型 / 模板 / 工作流（复用管理页，按当前空间过滤并固定归属） -->
        <section class="mgmt-card">
          <a-tabs v-model:activeKey="activeTab" class="home-tabs">
            <a-tab-pane key="issueType" tab="问题类型">
              <IssueTypePage :key="space.spaceCode" :space-code="space.spaceCode" />
            </a-tab-pane>
            <a-tab-pane key="template" tab="模板管理">
              <TemplateListPage :key="space.spaceCode" :space-code="space.spaceCode" />
            </a-tab-pane>
            <a-tab-pane key="workflow" tab="工作流">
              <WorkflowPage :key="space.spaceCode" :space-code="space.spaceCode" />
            </a-tab-pane>
          </a-tabs>
        </section>
      </template>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LeftOutlined, ApartmentOutlined } from '@ant-design/icons-vue'
import { getOrganizationTree, type OrganizationNode } from '@/api/faiz'
import { useSpaces, spaceAvatarText } from '@/utils/space-store'
import IssueTypePage from '@/pages/issue-type/index.vue'
import TemplateListPage from '@/pages/template-list/index.vue'
import WorkflowPage from '@/pages/workflow/index.vue'

const route = useRoute()
const router = useRouter()
const spaceCode = computed(() => String(route.params.spaceCode || ''))

// ---- 空间信息（共享缓存，进入时强制刷新） ----
const { ensureLoaded, findSpace, loading: spaceLoading } = useSpaces()
const space = computed(() => findSpace(spaceCode.value))

const orgTree = ref<OrganizationNode[]>([])
function orgNameOf(code?: string): string {
  if (!code) return ''
  const walk = (nodes: OrganizationNode[]): string => {
    for (const n of nodes) {
      if (n.organizationCode === code) return n.organizationName
      const hit = n.children?.length ? walk(n.children) : ''
      if (hit) return hit
    }
    return ''
  }
  return walk(orgTree.value)
}
const orgLabel = computed(() => space.value?.organizationName || orgNameOf(space.value?.organizationCode))

/** 后端 LocalDateTime（ISO 字符串）→ YYYY-MM-DD HH:mm */
function formatTime(v?: string | null): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 当前 Tab：记在 query 上，刷新 / 分享链接后保持 */
const TABS = ['issueType', 'template', 'workflow']
const activeTab = ref(TABS.includes(String(route.query.tab)) ? String(route.query.tab) : 'issueType')
watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})

async function loadOrgTree() {
  try {
    const res = await getOrganizationTree()
    if (res?.success) orgTree.value = res.data || []
  } catch {
    // 请求层已统一提示
  }
}

watch(spaceCode, (code) => {
  if (code) ensureLoaded(true)
}, { immediate: true })
loadOrgTree()
</script>

<style scoped>
.space-home {
  padding: 16px 24px 32px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  padding: 4px 8px 4px 4px;
  font-size: 13px;
  color: #6e6e73;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.back-link:hover {
  color: #1d1d1f;
  background: #f2f2f5;
}

.hero-card,
.mgmt-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.hero-card {
  display: flex;
  gap: 16px;
  padding: 20px;
}

.hero-avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
}

.hero-main {
  flex: 1;
  min-width: 0;
}

.hero-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.hero-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
}

.hero-desc {
  margin: 6px 0 10px;
  font-size: 13px;
  color: #6e6e73;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #1d1d1f;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.meta-label {
  color: #86868b;
}









.mgmt-card {
  margin-top: 12px;
  padding: 4px 16px 16px;
}






.key-chip {
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #0a84ff;
  background: #eef5ff;
  border-radius: 6px;
}

.code-chip {
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 6px;
}


.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #1d1d1f;
}

.status-dot::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.on::before {
  background: #34c759;
}

.status-dot.off {
  color: #86868b;
}

.status-dot.off::before {
  background: #c7c7cc;
}

.org-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 240px;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  color: #30b0c7;
  background: #e8f7fa;
  border-radius: 999px;
}

.org-chip .ellipsis {
  color: #1d1d1f;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-muted {
  color: #6e6e73;
}

.user-avatar {
  flex-shrink: 0;
  font-size: 11px;
  background: #0a84ff;
}

@media (max-width: 768px) {
  .space-home {
    padding: 12px 16px 24px;
  }

  .hero-card {
    flex-direction: column;
  }
}
</style>
