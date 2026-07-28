import { createRouter, createWebHistory, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
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
import FormDesign from '@/pages/form-design/index.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/workbench',
    children: [
      { path: 'workbench', redirect: '/workbench/todo', name: 'Workbench' },
      { path: 'workbench/todo', component: Todo, name: 'Todo', meta: { title: '我的事项' } },
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
      { path: 'settings/form-design', component: FormDesign, name: 'FormDesign', meta: { title: '表单设计' } },
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

