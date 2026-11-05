<template>
  <div class="h5-page">
    <van-nav-bar :title="title" left-arrow fixed placeholder @click-left="goBack" />
    <van-pull-refresh v-model="refreshing" @refresh="load">
      <van-skeleton v-if="loading && !list.length" :row="6" class="bp-skeleton" />
      <van-empty v-else-if="!list.length" image-size="72" description="暂无事项" />
      <IssueCard v-for="it in cards" :key="it.key" :issue="it" />
      <div v-if="total > list.length" class="h5-muted bp-more">共 {{ total }} 条，这里展示前 {{ list.length }} 条</div>
      <div class="h5-safe-bottom" />
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { queryMyBoardPanelData, type MyBoardIssue } from '@/api/faiz'
import { hexOr } from '@/utils/issue-view'
import IssueCard from '../components/IssueCard.vue'
import { formatRelative } from '../utils'

const route = useRoute()
const router = useRouter()
const panelId = computed(() => Number(route.params.panelId))
const title = computed(() => String(route.query.title || '看板'))

const list = ref<MyBoardIssue[]>([])
const total = ref(0)
const loading = ref(false)
const refreshing = ref(false)

/** 面板数据是扁平结构，转成卡片需要的字段 */
const cards = computed(() => list.value.map((it) => ({
  key: it.issueKey,
  summary: it.summary || '（无概要）',
  statusName: it.statusName || '',
  statusColor: hexOr(it.statusColor, '#8a919c'),
  typeName: it.issueTypeName || '',
  typeColor: hexOr(it.issueTypeColor, '#8b6fc0'),
  updated: formatRelative(it.updateTime),
  assignee: null,
})))

async function load() {
  loading.value = true
  try {
    const res = await queryMyBoardPanelData(panelId.value)
    if (res?.success) {
      list.value = res.data?.list || []
      total.value = Number(res.data?.total || list.value.length)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace('/boards')
}

onMounted(load)
</script>

<style scoped>
.bp-skeleton {
  padding-top: 16px;
}

.bp-more {
  padding: 16px 0 4px;
  text-align: center;
  font-size: 12px;
}
</style>
