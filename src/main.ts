import { createApp } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import Layout from './layout/index.vue'
import Dashboard from './pages/dashboard/index.vue'
import Users from './pages/users/index.vue'
import Roles from './pages/roles/index.vue'
import Permissions from './pages/permissions/index.vue'
import Departments from './pages/departments/index.vue'
import Requirements from './pages/requirements/index.vue'
import Tasks from './pages/tasks/index.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: Dashboard, name: 'Dashboard', meta: { title: '仪表盘' } },
      { path: 'requirements', component: Requirements, name: 'Requirements', meta: { title: '需求管理' } },
      { path: 'requirements/create', component: Requirements, name: 'CreateRequirement', meta: { title: '创建需求' } },
      { path: 'tasks', component: Tasks, name: 'Tasks', meta: { title: '任务管理' } },
      { path: 'tasks/kanban', component: Tasks, name: 'TasksKanban', meta: { title: '看板视图' } },
      { path: 'users', component: Users, name: 'Users', meta: { title: '用户管理' } },
      { path: 'roles', component: Roles, name: 'Roles', meta: { title: '角色管理' } },
      { path: 'permissions', component: Permissions, name: 'Permissions', meta: { title: '权限管理' } },
      { path: 'departments', component: Departments, name: 'Departments', meta: { title: '部门管理' } },
    ],
  },
]

let appInstance: ReturnType<typeof createApp> | null = null
let routerInstance: ReturnType<typeof createRouter> | null = null

function render(props?: { container?: HTMLElement }) {
  const container = props?.container || document.getElementById('app')
  const base = (window as unknown as { __POWERED_BY_QIANKUN__?: boolean }).__POWERED_BY_QIANKUN__
    ? '/cooperise'
    : '/'
  
  routerInstance = createRouter({
    history: createWebHistory(base),
    routes,
  })
  
  appInstance = createApp(App)
  appInstance.use(routerInstance)
  appInstance.use(Antd)
  appInstance.mount(container as HTMLElement)
}

if (!(window as unknown as { __POWERED_BY_QIANKUN__?: boolean }).__POWERED_BY_QIANKUN__) {
  render()
}

export async function bootstrap() {}

export async function mount(props: { container?: HTMLElement }) {
  render(props)
}

export async function unmount() {
  if (appInstance) {
    appInstance.unmount()
    appInstance = null
  }
  if (routerInstance) {
    routerInstance = null
  }
}