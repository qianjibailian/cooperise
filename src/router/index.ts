import { defineComponent, h, markRaw, onMounted, ref, watch } from 'vue'
import { createRouter, createWebHistory, createWebHashHistory, useRoute, type RouteRecordRaw } from 'vue-router'
import { startGlobalLoading, stopGlobalLoading } from '@/utils/global-loading'
import WorkspaceLayout from '@/layout/WorkspaceLayout.vue'
import DocsLayout from '@/layout/DocsLayout.vue'
import SpaceLayout from '@/layout/SpaceLayout.vue'
import AdminLayout from '@/layout/AdminLayout.vue'
import PlainLayout from '@/layout/PlainLayout.vue'
import Todo from '@/pages/todo/index.vue'
import Docs from '@/pages/docs/index.vue'
import DocsLibrary from '@/pages/docs/library.vue'
import MyBoard from '@/pages/my-board/index.vue'
import Dashboard from '@/pages/dashboard/index.vue'
import Users from '@/pages/users/index.vue'
import Roles from '@/pages/roles/index.vue'
import InitConfig from '@/pages/init-config/index.vue'
import EnterpriseSettings from '@/pages/enterprise-settings/index.vue'
import MenuManage from '@/pages/menus/index.vue'
import Permissions from '@/pages/permissions/index.vue'
import Departments from '@/pages/departments/index.vue'
import Requirements from '@/pages/requirements/index.vue'
import Tasks from '@/pages/tasks/index.vue'
import EmptyContent from '@/pages/empty/index.vue'
import TemplateList from '@/pages/template-list/index.vue'
import AvailableField from '../pages/available-field/index.vue'
import SystemField from '../pages/system-field/index.vue'
import Workflow from '../pages/workflow/index.vue'
import Organization from '@/pages/organization/index.vue'
import Positions from '@/pages/positions/index.vue'
import IssueTypes from '@/pages/issue-type/index.vue'
import Profile from '@/pages/profile/index.vue'
import Space from '@/pages/space/index.vue'
import SpaceHome from '@/pages/space/home.vue'
import Account from '@/pages/account/index.vue'
import SprintBoard from '@/pages/sprint-board/index.vue'
import TestingCalendar from '@/pages/testing-calendar/index.vue'
import MemberGantt from '@/pages/member-gantt/index.vue'
import IssueDetail from '@/pages/issue-detail/index.vue'
import I18nPage from '@/pages/i18n/index.vue'
import ReleaseList from '@/pages/release-list/index.vue'
import Login from '@/pages/auth/Login.vue'
import Register from '@/pages/auth/Register.vue'
import RegisterPassword from '@/pages/auth/RegisterPassword.vue'
import InitWorkspace from '@/pages/auth/InitWorkspace.vue'
import InitProgress from '@/pages/auth/InitProgress.vue'
import Legal from '@/pages/auth/Legal.vue'
import { useViewStore } from '@/utils/view-store'
import { useAuth, hasPermission } from '@/utils/auth'

/** viewType → 渲染组件 & 标题映射 */
const VIEW_TYPE_PAGE: Record<string, { component: unknown; title: string }> = {
  list: { component: Todo, title: '我的事项' },
  KAN_BAN: { component: SprintBoard, title: '看板' },
  gantt: { component: MemberGantt, title: '甘特图' },
  CALENDAR_VIEW: { component: TestingCalendar, title: '测试平台需求日历' },
  RELEASE_LIST: { component: ReleaseList, title: '上线清单' },
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
  { path: '/login', component: Login, name: 'Login', meta: { title: '登录', public: true } },
  { path: '/register', component: Register, name: 'Register', meta: { title: '注册', public: true } },
  { path: '/register/password', component: RegisterPassword, name: 'RegisterPassword', meta: { title: '设置密码', public: true } },
  // 注册成功后的初始化（需已登录，不设 public）
  { path: '/init', component: InitWorkspace, name: 'InitWorkspace', meta: { title: '初始化' } },
  { path: '/init/progress', component: InitProgress, name: 'InitProgress', meta: { title: '初始化空间' } },
  { path: '/terms', component: Legal, name: 'Terms', meta: { title: '服务协议', public: true, doc: 'terms' } },
  { path: '/privacy', component: Legal, name: 'Privacy', meta: { title: '隐私政策', public: true, doc: 'privacy' } },

  // ============ 工作台（独立布局：自己的顶栏 + 工作台侧栏） ============
  {
    path: '/workbench',
    component: WorkspaceLayout,
    children: [
      { path: '', redirect: '/workbench/board', name: 'Workbench' },
      { path: 'board', component: MyBoard, name: 'MyBoard', meta: { title: '我的看板' } },
      { path: 'todo', component: Todo, name: 'Todo', meta: { title: '我的事项' } },
      // 兼容旧链接
      { path: 'docs', redirect: '/docs' },
      { path: 'view/:filterCode', component: ViewEntry, name: 'ViewEntry', meta: { title: '视图' } },
      // 「新筛选器」菜单已下线：旧链接回到我的事项
      { path: 'filters', redirect: '/workbench/todo' },
      { path: ':pathMatch(.*)*', component: EmptyContent, name: 'WorkbenchDynamic' },
    ],
  },

  // ============ 云文档（独立布局：自己的顶栏 + 文档页自带的左侧菜单） ============
  {
    path: '/docs',
    component: DocsLayout,
    children: [
      { path: '', redirect: '/docs/drive/home' },
      // 回收站：独立路由 /docs/trash
      { path: 'trash', component: Docs, name: 'DocsTrash', meta: { title: '回收站' } },
      // 主页
      { path: 'drive/home', component: Docs, name: 'DocsHome', meta: { title: '云文档' } },
      // 知识库
      { path: 'wiki', component: Docs, name: 'DocsWiki', meta: { title: '知识库' } },
      // 文档详情：参考飞书 /docs/wiki/{docId}
      { path: 'wiki/:docId', component: Docs, name: 'WikiDoc', meta: { title: '云文档' } },
      // 知识库内的文档：/docs/library/wiki/{docId}（所属知识库以详情接口为准）
      { path: 'library/wiki/:docId', component: Docs, name: 'LibraryWikiDoc', meta: { title: '云文档' } },
      // 知识库详情：独立页面（自己的左侧菜单 + 主内容）
      { path: 'library/:libraryId', component: DocsLibrary, name: 'DocsLibrary', meta: { title: '知识库' } },
    ],
  },
  // 旧地址 /wiki/{docId} → /docs/wiki/{docId}，保留兼容
  { path: '/wiki', redirect: '/docs' },
  { path: '/wiki/:docId', redirect: (to) => `/docs/wiki/${String(to.params.docId)}` },

  // ============ 空间（独立布局：自己的顶栏 + 空间侧栏） ============
  {
    path: '/space',
    component: SpaceLayout,
    children: [
      { path: '', component: Space, name: 'Space', meta: { title: '空间' } },
      { path: ':spaceCode', component: SpaceHome, name: 'SpaceHome', meta: { title: '空间' } },
    ],
  },

  // ============ 管理后台（独立布局：自己的顶栏 + 管理侧栏） ============
  {
    path: '/admin',
    component: AdminLayout,
    children: [
      { path: '', redirect: '/admin/users' },
      { path: 'users', component: Users, name: 'AdminUsers', meta: { title: '用户管理', permission: 'admin:user' } },
      { path: 'roles', component: Roles, name: 'AdminRoles', meta: { title: '角色管理', permission: 'admin:role' } },
      { path: 'init-config', component: InitConfig, name: 'AdminInitConfig', meta: { title: '初始化配置', permission: 'admin:init-config' } },
      { path: 'menus', component: MenuManage, name: 'AdminMenus', meta: { title: '菜单管理' } },
      { path: 'positions', component: Positions, name: 'AdminPositions', meta: { title: '岗位管理', permission: 'admin:position' } },
      { path: 'organization', component: Organization, name: 'Organization', meta: { title: '组织管理', permission: 'admin:organization' } },
      { path: 'space', component: Space, name: 'AdminSpace', meta: { title: '空间管理', permission: 'admin:space' }, props: { admin: true } },
      // 问题类型 / 模板 / 工作流暂无独立权限点，仅要求登录
      { path: 'issue-type', component: IssueTypes, name: 'AdminIssueTypes', meta: { title: '问题类型' } },
      { path: 'system-field', component: SystemField, name: 'SystemField', meta: { title: '系统字段', permission: 'admin:system-field' } },
      { path: 'i18n', component: I18nPage, name: 'AdminI18n', meta: { title: '国际化翻译', permission: 'admin:i18n' } },
      { path: 'template-list', component: TemplateList, name: 'TemplateList', meta: { title: '模板管理' } },
      { path: 'workflow', component: Workflow, name: 'Workflow', meta: { title: '工作流' } },
    ],
  },

  // ============ 企业后台（与管理后台同一布局，菜单为：用户 / 岗位 / 授权 / 组织 / 菜单） ============
  {
    path: '/enterprise',
    component: AdminLayout,
    children: [
      { path: '', redirect: '/enterprise/users' },
      { path: 'users', component: Users, name: 'EnterpriseUsers', meta: { title: '用户管理' } },
      { path: 'positions', component: Positions, name: 'EnterprisePositions', meta: { title: '岗位管理' } },
      { path: 'permissions', component: Permissions, name: 'EnterprisePermissions', meta: { title: '授权管理' } },
      { path: 'settings', component: EnterpriseSettings, name: 'EnterpriseSettings', meta: { title: '设置管理' } },
      { path: 'organization', component: Organization, name: 'EnterpriseOrganization', meta: { title: '组织管理' } },
      { path: 'menus', component: MenuManage, name: 'EnterpriseMenus', meta: { title: '菜单' } },
    ],
  },

  // ============ 通用页面（个人中心 / 事项详情 / 历史页面）：只有顶栏 ============
  {
    path: '/settings',
    component: PlainLayout,
    children: [
      { path: '', redirect: '/settings/profile' },
      { path: 'template-list', redirect: '/admin/template-list' },
      { path: 'available-field', component: AvailableField, name: 'AvailableField', meta: { title: '自定义字段' } },
      { path: 'workflow', redirect: '/admin/workflow' },
      { path: 'space', redirect: '/space' },
      { path: 'profile', component: Profile, name: 'Profile', meta: { title: '个人中心' } },
      { path: 'account', component: Account, name: 'Account', meta: { title: '账户设置' } },
      { path: ':pathMatch(.*)*', component: EmptyContent, name: 'SettingsDynamic' },
    ],
  },
  {
    path: '/jira',
    component: PlainLayout,
    children: [
      { path: 'browse/:issueKey', component: IssueDetail, name: 'IssueDetail', meta: { title: '事项详情' } },
    ],
  },
  {
    path: '/',
    component: PlainLayout,
    children: [
      { path: '', redirect: '/workbench' },
      { path: 'dashboard', component: Dashboard, name: 'Dashboard', meta: { title: '仪表盘' } },
      { path: 'requirements', component: Requirements, name: 'Requirements', meta: { title: '需求管理' } },
      { path: 'requirements/create', component: Requirements, name: 'CreateRequirement', meta: { title: '创建需求' } },
      { path: 'tasks', component: Tasks, name: 'Tasks', meta: { title: '任务管理' } },
      { path: 'tasks/kanban', component: Tasks, name: 'TasksKanban', meta: { title: '看板视图' } },
      { path: 'users', component: Users, name: 'Users', meta: { title: '用户管理' } },
      { path: 'roles', component: Roles, name: 'Roles', meta: { title: '角色管理' } },
      { path: 'permissions', component: Permissions, name: 'Permissions', meta: { title: '权限管理' } },
      { path: 'departments', component: Departments, name: 'Departments', meta: { title: '部门管理' } },
      { path: ':pathMatch(.*)*', component: EmptyContent, name: 'NotFound' },
    ],
  },
]

export function setupRouter() {
  const isPoweredByQiankun = (window as unknown as { __POWERED_BY_QIANKUN__?: boolean }).__POWERED_BY_QIANKUN__

  const router = createRouter({
    history: isPoweredByQiankun ? createWebHashHistory() : createWebHistory('/'),
    routes,
  })

  // 未登录访问业务页 → 登录页（带回跳地址）；已登录访问登录页 → 首页
  router.beforeEach((to) => {
    const { isLoggedIn, refresh } = useAuth()
    refresh()
    if (to.meta.public) {
      return isLoggedIn.value ? '/' : true
    }
    if (!isLoggedIn.value) {
      return { name: 'Login', query: { redirect: to.fullPath } }
    }
    // 管理后台菜单权限：路由 meta.permission 校验（超管恒过；旧会话无权限快照时放行，后端鉴权兜底）
    const perm = to.meta.permission as string | undefined
    if (perm && !hasPermission(perm)) {
      return { path: '/workbench' }
    }
    return true
  })

  // 文档路由切换时显示全局加载（与 afterEach 成对；导航被重定向 / 失败时 afterEach 同样会触发）
  router.beforeEach((to) => {
    if (to.path.startsWith('/docs')) startGlobalLoading()
  })
  router.afterEach((to) => {
    if (to.path.startsWith('/docs')) stopGlobalLoading()
  })

  return router
}

