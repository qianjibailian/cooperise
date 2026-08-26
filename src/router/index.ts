import { defineComponent, h, markRaw, onMounted, ref, watch } from 'vue'
import { createRouter, createWebHistory, createWebHashHistory, useRoute, type RouteRecordRaw } from 'vue-router'
import Layout from '@/layout/index.vue'
import Todo from '@/pages/todo/index.vue'
import Dashboard from '@/pages/dashboard/index.vue'
import Users from '@/pages/users/index.vue'
import Roles from '@/pages/roles/index.vue'
import Permissions from '@/pages/permissions/index.vue'
import Departments from '@/pages/departments/index.vue'
import Requirements from '@/pages/requirements/index.vue'
import Tasks from '@/pages/tasks/index.vue'
import EmptyContent from '@/pages/empty/index.vue'
import TemplateList from '@/pages/template-list/index.vue'
import AvailableField from '../pages/available-field/index.vue'
import SystemField from '../pages/system-field/index.vue'
import Workflow from '../pages/workflow/index.vue'
import SprintBoard from '@/pages/sprint-board/index.vue'
import TestingCalendar from '@/pages/testing-calendar/index.vue'
import MemberGantt from '@/pages/member-gantt/index.vue'
import IssueDetail from '@/pages/issue-detail/index.vue'
import { useViewStore } from '@/utils/view-store'

/** viewType → 渲染组件 & 标题映射 */
const VIEW_TYPE_PAGE: Record<string, { component: unknown; title: string }> = {
  list: { component: Todo, title: '我的事项' },
  KAN_BAN: { component: SprintBoard, title: 'Sprint 看板' },
  gantt: { component: MemberGantt, title: '甘特图' },
  CALENDAR_VIEW: { component: TestingCalendar, title: '测试平台需求日历' },
}

/** /workbench/view/:filterCode 分发组件：按 viewType 动态渲染对应页面（同步 setup，避免 Suspense 告警） */
const ViewEntry = defineComponent({
  name: 'ViewEntry',
  setup() {
    const route = useRoute()
    const { ensureLoaded, findViewItem, viewGroups } = useViewStore()

    function resolveComp() {
      const code = (route.params.filterCode as string) || ''
      const item = findViewItem(code)
      const page = item ? VIEW_TYPE_PAGE[item.viewType] : undefined
      return markRaw((page?.component || SprintBoard) as any)
    }
    const Comp = ref(resolveComp())

    onMounted(async () => {
      try { await ensureLoaded() } finally {
        Comp.value = resolveComp()
      }
    })
    // 视图切换或数据就绪时重新解析
    watch(
      () => route.params.filterCode,
      () => { Comp.value = resolveComp() }
    )
    watch(viewGroups, () => { Comp.value = resolveComp() }, { deep: true })

    return () => h(Comp.value)
  },
})

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/workbench',
    children: [
      { path: 'workbench', redirect: '/workbench/todo', name: 'Workbench' },
      { path: 'workbench/todo', component: Todo, name: 'Todo', meta: { title: '我的事项' } },
      { path: 'workbench/view/:filterCode', component: ViewEntry, name: 'ViewEntry', meta: { title: '视图' } },
      { path: 'jira/browse/:issueKey', component: IssueDetail, name: 'IssueDetail', meta: { title: '事项详情' } },
      { path: 'workbench/filters', component: EmptyContent, name: 'Filters', meta: { title: '新筛选器' } },
      { path: 'workbench/:pathMatch(.*)*', component: EmptyContent, name: 'WorkbenchDynamic' },
      { path: 'dashboard', component: Dashboard, name: 'Dashboard', meta: { title: '仪表盘' } },
      { path: 'requirements', component: Requirements, name: 'Requirements', meta: { title: '需求管理' } },
      { path: 'requirements/create', component: Requirements, name: 'CreateRequirement', meta: { title: '创建需求' } },
      { path: 'tasks', component: Tasks, name: 'Tasks', meta: { title: '任务管理' } },
      { path: 'tasks/kanban', component: Tasks, name: 'TasksKanban', meta: { title: '看板视图' } },
      { path: 'users', component: Users, name: 'Users', meta: { title: '用户管理' } },
      { path: 'roles', component: Roles, name: 'Roles', meta: { title: '角色管理' } },
      { path: 'permissions', component: Permissions, name: 'Permissions', meta: { title: '权限管理' } },
      { path: 'departments', component: Departments, name: 'Departments', meta: { title: '部门管理' } },
      { path: 'settings/template-list', component: TemplateList, name: 'TemplateList', meta: { title: '模板列表' } },
      { path: 'settings/available-field', component: AvailableField, name: 'AvailableField', meta: { title: '自定义字段' } },
      { path: 'settings/workflow', component: Workflow, name: 'Workflow', meta: { title: '工作流' } },
      { path: 'admin/system-field', component: SystemField, name: 'SystemField', meta: { title: '系统字段' } },
      { path: 'settings/:pathMatch(.*)*', component: EmptyContent, name: 'SettingsDynamic' },
      { path: ':pathMatch(.*)*', component: EmptyContent, name: 'NotFound' },
    ],
  },
]

export function setupRouter() {
  const isPoweredByQiankun = (window as unknown as { __POWERED_BY_QIANKUN__?: boolean }).__POWERED_BY_QIANKUN__

  return createRouter({
    history: isPoweredByQiankun ? createWebHashHistory() : createWebHistory('/'),
    routes,
  })
}

