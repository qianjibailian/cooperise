import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuth } from '@/utils/auth'
import TabLayout from './layout/TabLayout.vue'

/**
 * 手机 H5 路由（base /h5/）
 * - 带底部标签栏的主页面：看板 / 事项 / 新建 / 空间 / 我的
 * - 详情、视图、改密码等二级页面全屏展示，顶部导航栏带返回
 */
const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'H5Login', component: () => import('./pages/Login.vue'), meta: { title: '登录', public: true } },
  {
    path: '/',
    component: TabLayout,
    redirect: '/issues',
    children: [
      { path: 'issues', name: 'H5Issues', component: () => import('./pages/Issues.vue'), meta: { title: '我的事项', keepAlive: true } },
      { path: 'boards', name: 'H5Boards', component: () => import('./pages/Boards.vue'), meta: { title: '看板', keepAlive: true } },
      { path: 'spaces', name: 'H5Spaces', component: () => import('./pages/Spaces.vue'), meta: { title: '空间' } },
      { path: 'me', name: 'H5Me', component: () => import('./pages/Me.vue'), meta: { title: '我的' } },
    ],
  },
  { path: '/create', name: 'H5Create', component: () => import('./pages/CreateIssue.vue'), meta: { title: '新建事项' } },
  // 与网页版链接一致：/h5/jira/browse/KEY
  { path: '/jira/browse/:issueKey', name: 'H5IssueDetail', component: () => import('./pages/IssueDetail.vue'), meta: { title: '事项详情' } },
  { path: '/view/:filterCode', name: 'H5View', component: () => import('./pages/ViewIssues.vue'), meta: { title: '视图' } },
  { path: '/board/:panelId', name: 'H5Board', component: () => import('./pages/BoardPanel.vue'), meta: { title: '看板' } },
  { path: '/password', name: 'H5Password', component: () => import('./pages/ChangePassword.vue'), meta: { title: '修改密码' } },
  { path: '/:pathMatch(.*)*', redirect: '/issues' },
]

export function createH5Router() {
  const router = createRouter({
    history: createWebHistory('/h5/'),
    routes,
    // 返回时恢复列表滚动位置
    scrollBehavior: (_to, _from, saved) => saved || { top: 0 },
  })

  // 未登录 → 登录页（带回跳）；已登录访问登录页 → 首页
  router.beforeEach((to) => {
    const { isLoggedIn, refresh } = useAuth()
    refresh()
    if (to.meta.public) return isLoggedIn.value && to.name === 'H5Login' ? '/issues' : true
    if (!isLoggedIn.value) return { name: 'H5Login', query: { redirect: to.fullPath } }
    return true
  })

  router.afterEach((to) => {
    if (to.meta.title) document.title = `${to.meta.title as string} · Cooperise`
  })

  return router
}
