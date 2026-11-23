<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <div>
        <h2 class="mgmt-title">菜单管理</h2>
        <p class="mgmt-subtitle">
          维护管理后台全部菜单与按钮权限点：启停后对应的前端菜单 / 按钮与后端接口立即生效；
          权限编码由代码约定，分配到角色请在「角色管理」中操作
          <template v-if="isEnterprise">（企业后台仅查看）</template>
        </p>
      </div>
      <a-tooltip title="刷新">
        <button class="mgmt-icon-btn" :disabled="loading" @click="loadPermissions"><ReloadOutlined /></button>
      </a-tooltip>
    </header>

    <section class="mgmt-card">
      <div class="mgmt-toolbar">
        <a-input
          v-model:value="keyword"
          placeholder="搜索菜单 / 按钮名称或编码"
          allow-clear
          class="mgmt-search"
        >
          <template #prefix><SearchOutlined class="mgmt-search-icon" /></template>
        </a-input>
        <a-segmented v-model:value="statusFilter" :options="STATUS_FILTERS" />
      </div>

      <!-- 首次加载：骨架占位，数据回来后渲染表格 -->
      <div v-if="!initialized" class="page-skeleton">
        <a-skeleton active :paragraph="{ rows: 10 }" />
      </div>
      <a-table
        v-else
        :columns="columns"
        :data-source="treeData"
        :loading="loading"
        row-key="id"
        :pagination="false"
        :scroll="{ x: 860 }"
        class="mgmt-table"
        :expand-row-by-click="true"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="perm-cell">
              <span :class="['perm-badge', record.permType === 'menu' ? 'perm-badge-menu' : 'perm-badge-button']">
                <component :is="record.permType === 'menu' ? AppstoreOutlined : ApiOutlined" />
              </span>
              <div class="perm-name-wrap">
                <span class="perm-name">{{ record.permName }}</span>
                <span class="perm-meta">
                  <span class="code-chip">{{ record.permCode }}</span>
                  <span v-if="record.permType === 'menu' && MENU_ROUTES[record.permCode]" class="perm-route">
                    {{ MENU_ROUTES[record.permCode] }}
                  </span>
                </span>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'type'">
            <a-tag :color="record.permType === 'menu' ? 'purple' : 'blue'" class="type-tag">
              {{ record.permType === 'menu' ? (record.permCode.startsWith('menu:') ? '模块' : '菜单') : '按钮' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'apis'">
            <div class="api-list">
              <span v-for="api in API_MAP[record.permCode] || []" :key="api" class="api-chip">{{ api }}</span>
              <span v-if="!(API_MAP[record.permCode] || []).length" class="text-muted">-</span>
            </div>
          </template>
          <template v-else-if="column.key === 'sortOrder'">
            <span class="text-muted">{{ record.sort ?? 0 }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-switch
              v-if="!isEnterprise"
              size="small"
              :checked="record.status === 1"
              :loading="togglingId === record.id"
              @change="(v: boolean) => toggleStatus(record as PermissionItem, v)"
            />
            <a-tag v-else :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <div v-if="!isEnterprise" class="row-actions">
              <a-tooltip title="编辑（名称 / 排序 / 备注）">
                <span class="row-action" @click.stop="openEdit(record as PermissionItem)"><EditOutlined /></span>
              </a-tooltip>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 编辑权限点：名称 / 排序 / 备注（编码与类型由代码约定不可改） -->
    <a-modal
      v-model:open="modalOpen"
      title="编辑权限点"
      :width="520"
      centered
      destroy-on-close
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="handleSubmit"
    >
      <a-form layout="vertical">
        <a-form-item label="编码">
          <a-input :value="editing?.permCode" disabled />
        </a-form-item>
        <a-form-item label="名称" required>
          <a-input v-model:value="form.permName" :maxlength="32" placeholder="如 删除空间" />
        </a-form-item>
        <a-form-item label="排序">
          <a-input-number v-model:value="form.sort" :min="0" :max="999" placeholder="默认 0" style="width: 100%" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" :maxlength="200" placeholder="选填" />
        </a-form-item>
        <p class="edit-hint">
          接口权限映射：
          <template v-if="(API_MAP[editing?.permCode || ''] || []).length">{{ (API_MAP[editing?.permCode || ''] || []).join('、') }}</template>
          <template v-else>无</template>
        </p>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  ApiOutlined,
  AppstoreOutlined,
  EditOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { listMenuPermissions, updateMenuPermission, type PermissionItem } from '@/api/faiz'
import { invalidateEnabledMenus, loadEnabledMenus } from '@/utils/enabled-menus'
import { useEnterpriseScope } from '@/utils/enterprise-scope'

/** 企业后台（/enterprise/menus）共用本组件：无管理后台权限体系，仅查看 */
const { isEnterprise } = useEnterpriseScope()

const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]

const columns = [
  { title: '权限点', key: 'name', width: 260, fixed: 'left' as const },
  { title: '类型', key: 'type', width: 80 },
  { title: '接口权限', key: 'apis', ellipsis: true },
  { title: '排序', key: 'sortOrder', width: 70 },
  { title: '启用', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 70, fixed: 'right' as const },
]

/** 菜单权限点对应页面路由（展示用；admin: 为管理后台页面，menu: 为主应用一级模块） */
const MENU_ROUTES: Record<string, string> = {
  'menu:workspace': '/workbench/board',
  'menu:docs': '/docs',
  'menu:space': '/space',
  'menu:enterprise': '/enterprise/users',
  'menu:admin': '/admin/users',
  'admin:user': '/admin/users',
  'admin:role': '/admin/roles',
  'admin:position': '/admin/positions',
  'admin:organization': '/admin/organization',
  'admin:space': '/admin/space',
  'admin:system-field': '/admin/system-field',
  'admin:init-config': '/admin/init-config',
  'admin:i18n': '/admin/i18n',
  'admin:menu': '/admin/menus',
}

/**
 * 权限点 → 后端接口权限映射（展示用，与后端 @RequirePermission 注解保持同步）。
 * 标注「共用登录」的接口同时被工作台 / 企业后台等业务场景使用，仅要求登录；
 * 其余接口均已挂后端权限注解，无权限调用返回 403。
 */
const API_MAP: Record<string, string[]> = {
  'admin:user': ['POST /user/query（共用登录）', 'POST /enterprise/user/query'],
  'admin:user:create': ['POST /user/create', 'POST /enterprise/user/create'],
  'admin:user:update': ['POST /user/update', 'POST /enterprise/user/update'],
  'admin:user:delete': ['POST /user/delete', 'POST /enterprise/user/delete'],
  'admin:user:reset-password': ['POST /user/reset-password', 'POST /enterprise/user/reset-password'],
  'admin:role': ['POST /role/query（共用登录）'],
  'admin:role:create': ['POST /role/create'],
  'admin:role:update': ['POST /role/update'],
  'admin:role:delete': ['POST /role/delete'],
  'admin:role:assign-permission': ['POST /role/permission/save'],
  'admin:position': ['POST /position/query（共用登录）', 'POST /enterprise/position/query'],
  'admin:position:create': ['POST /position/create', 'POST /enterprise/position/create'],
  'admin:position:update': ['POST /position/update', 'POST /enterprise/position/update'],
  'admin:position:delete': ['POST /position/delete', 'POST /enterprise/position/delete'],
  'admin:organization': ['POST /organization/list（共用登录）', 'POST /enterprise/organization/tree'],
  'admin:organization:create': ['POST /organization/create', 'POST /enterprise/organization/create'],
  'admin:organization:update': ['POST /organization/update', 'POST /enterprise/organization/update'],
  'admin:organization:delete': ['POST /organization/delete', 'POST /enterprise/organization/delete'],
  'admin:space': ['POST /admin/space/query', 'POST /admin/space/detail'],
  'admin:space:create': ['POST /admin/space/create', 'POST /admin/space/copy'],
  'admin:space:update': ['POST /admin/space/update'],
  'admin:space:delete': ['POST /admin/space/delete'],
  'admin:system-field': ['POST /systemField/query'],
  'admin:system-field:create': ['POST /systemField'],
  'admin:system-field:update': ['PUT /systemField/{id}'],
  'admin:system-field:delete': ['DELETE /systemField/systemField/batch'],
  'admin:init-config': ['/admin/init-config/**（全部接口）'],
  'admin:i18n': ['POST /i18n/query（共用登录）'],
  'admin:i18n:create': ['POST /i18n/create'],
  'admin:i18n:update': ['POST /i18n/update'],
  'admin:i18n:delete': ['POST /i18n/delete'],
  'admin:i18n:import': ['POST /i18n/import'],
  'admin:menu': ['POST /menu/list', 'POST /menu/update'],
  // 主应用一级模块（全局开关）：入口显隐控制，接口均为业务共用登录接口，无独立权限点
  'menu:workspace': ['模块入口开关（业务接口共用登录）'],
  'menu:docs': ['模块入口开关（业务接口共用登录）'],
  'menu:space': ['模块入口开关（业务接口共用登录）'],
  'menu:enterprise': ['模块入口开关（业务接口共用登录）'],
  'menu:admin': ['模块入口开关（业务接口共用登录）'],
  // 业务模块按钮权限（需求管控平台 / 云文档，用户授权页按模块勾选）
  'workspace:issue:create': ['POST /issue/create'],
  'workspace:issue:update': ['PUT /issue/{id}', 'PATCH /issue/{issueKey}'],
  'workspace:issue:delete': ['DELETE /issue/{id}'],
  'docs:doc:create': ['POST /docs/create', 'POST /docs/folder/create', 'POST /docs/library/create'],
  'docs:doc:update': ['PUT /docs/{id}/content', 'POST /docs/rename', 'POST /docs/move', 'POST /docs/folder/rename', 'POST /docs/library/update'],
  'docs:doc:delete': ['POST /docs/trash', 'POST /docs/delete', 'POST /docs/trash/empty', 'POST /docs/folder/delete', 'POST /docs/library/delete'],
}

// ---- 数据加载 ----
const loading = ref(false)
const initialized = ref(false)
const perms = ref<PermissionItem[]>([])

async function loadPermissions() {
  loading.value = true
  try {
    const res = await listMenuPermissions()
    if (res?.success) perms.value = res.data || []
  } catch {
    // 请求层已统一提示
  } finally {
    loading.value = false
    initialized.value = true
  }
}

/** 菜单 → 按钮树形数据（含搜索与状态筛选） */
const treeData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const statusOk = (p: PermissionItem) =>
    statusFilter.value === 'all' || String(p.status) === statusFilter.value
  const match = (p: PermissionItem) =>
    !kw || p.permName.toLowerCase().includes(kw) || p.permCode.toLowerCase().includes(kw)

  const menus = perms.value.filter((p) => p.permType === 'menu')
  const buttons = perms.value.filter((p) => p.permType === 'button')
  return menus
    .map((m) => {
      const children = buttons.filter((b) => b.menuCode === m.permCode)
      const hitSelf = match(m) && statusOk(m)
      const hitChildren = children.some((b) => match(b) && statusOk(b))
      if (!hitSelf && !hitChildren) return null
      const filteredChildren = children.filter((b) => (hitSelf && !kw ? statusOk(b) : match(b) && statusOk(b)))
      return filteredChildren.length ? { ...m, children: filteredChildren } : { ...m }
    })
    .filter(Boolean) as (PermissionItem & { children?: PermissionItem[] })[]
})

const keyword = ref('')
const statusFilter = ref('all')

// ---- 启停 ----
const togglingId = ref<number | null>(null)
async function toggleStatus(p: PermissionItem, checked: boolean) {
  togglingId.value = p.id
  try {
    const res = await updateMenuPermission(p.id, { status: checked ? 1 : 0 })
    if (res?.success) {
      p.status = checked ? 1 : 0
      // 模块 / 菜单启停立即刷新全局导航缓存
      invalidateEnabledMenus()
      loadEnabledMenus()
      message.success(checked ? `已启用「${p.permName}」` : `已停用「${p.permName}」，对应菜单 / 按钮 / 接口立即失效`)
    }
  } catch {
    // 请求层已统一提示
  } finally {
    togglingId.value = null
  }
}

// ---- 编辑 ----
const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<PermissionItem | null>(null)
/** 排序默认清空（不填提交时按 0 处理） */
const form = reactive({ permName: '', sort: null as number | null, remark: '' })

function openEdit(p: PermissionItem) {
  editing.value = p
  Object.assign(form, { permName: p.permName, sort: p.sort ?? null, remark: p.remark ?? '' })
  modalOpen.value = true
}

async function handleSubmit() {
  if (!editing.value) return
  if (!form.permName.trim()) {
    message.warning('请输入权限点名称')
    return
  }
  saving.value = true
  try {
    const res = await updateMenuPermission(editing.value.id, {
      permName: form.permName.trim(),
      sort: form.sort ?? 0,
      remark: form.remark.trim() || undefined,
    })

    if (res?.success) {
      modalOpen.value = false
      loadPermissions()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

onMounted(loadPermissions)
</script>

<style scoped>
.page-skeleton {
  min-height: 360px;
  padding: 12px 0;
}

.mgmt-page {
  padding: 20px 24px 32px;
}

.mgmt-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.mgmt-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
}

.mgmt-subtitle {
  margin: 6px 0 0;
  max-width: 640px;
  font-size: 12px;
  line-height: 1.7;
  color: #86868b;
}

.mgmt-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.mgmt-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mgmt-search {
  width: 300px;
  height: 34px;
  border-radius: 10px;
  background: #f5f5f7;
  border-color: transparent;
}

.mgmt-search:hover,
.mgmt-search:focus-within {
  background: #fff;
  border-color: #d2d2d7;
}

.mgmt-search :deep(.ant-input) {
  background: transparent;
}

.mgmt-search-icon {
  color: #aeaeb2;
}

.mgmt-icon-btn {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6e6e73;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.mgmt-icon-btn:hover:not(:disabled) {
  background: #f2f2f5;
}

.mgmt-table :deep(.ant-table-thead > tr > th) {
  font-size: 12px;
  font-weight: 500;
  color: #86868b;
  background: #fafafc;
}

.mgmt-table :deep(.ant-table-tbody > tr > td) {
  font-size: 13px;
}

.perm-cell {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.perm-badge {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
}

.perm-badge-menu {
  background: #5e5ce6;
}

.perm-badge-button {
  background: #0a84ff;
}

.perm-name-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.perm-name {
  font-weight: 500;
  color: #1d1d1f;
}

.perm-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.perm-route {
  font-size: 12px;
  color: #86868b;
}

.code-chip {
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6e6e73;
  background: #f2f2f5;
  border-radius: 6px;
}

.type-tag {
  margin: 0;
}

.api-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}

.api-chip {
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #34c759;
  background: rgba(52, 199, 89, 0.1);
  border-radius: 6px;
}

.text-muted {
  color: #6e6e73;
}

.row-actions {
  display: inline-flex;
  gap: 2px;
}

.row-action {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #6e6e73;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.row-action:hover {
  color: #1d1d1f;
  background: #e9e9ee;
}

.edit-hint {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #6e6e73;
  background: #f5f5f7;
  border-radius: 8px;
  word-break: break-all;
}

@media (max-width: 768px) {
  .mgmt-page {
    padding: 16px;
  }

  .mgmt-toolbar {
    flex-wrap: wrap;
  }

  .mgmt-search {
    flex: 1 1 100%;
    width: auto;
  }
}
</style>
