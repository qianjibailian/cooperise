<template>
  <div class="user-auth-page">
    <header class="auth-header">
      <button type="button" class="back-btn" @click="router.back()">
        <LeftOutlined />
      </button>
      <div class="auth-header-body">
        <h1 class="auth-title">用户授权</h1>
      </div>
    </header>

    <section class="perm-card">
      <!-- 首次加载占位 -->
      <div v-if="!initialized" class="page-skeleton">
        <a-skeleton active :paragraph="{ rows: 8 }" />
      </div>

      <template v-else>
        <div v-if="!permGroups.length" class="empty-tip">暂无可分配的权限点（菜单管理中未配置启用中的权限）</div>

        <!-- 业务模块：需求管控平台 / 云文档（模块入口 + 组内按钮权限） -->
        <div v-for="m in moduleGroups" :key="m.code" class="perm-group module-item">
          <div class="perm-group-head">
            <a-checkbox
              :checked="m.checked"
              @change="(e: any) => toggleModuleMenu(m, e.target.checked)"
            >{{ m.name }}</a-checkbox>
          </div>
          <a-checkbox-group
            v-if="m.buttons.length"
            v-model:value="m.checkedButtons"
            :options="m.buttons"
            class="perm-options"
            @change="() => onModuleButtonsChange(m)"
          />
        </div>

        <div class="perm-parent">
          <div class="perm-parent-head">
            <a-checkbox
              :checked="parentChecked"
              :indeterminate="parentIndeterminate"
              @change="(e: any) => toggleParent(e.target.checked)"
            >后台管理</a-checkbox>
            <span class="perm-parent-hint">用户 / 角色 / 岗位 / 组织管理</span>
          </div>
          <div class="perm-groups">
            <div v-for="g in permGroups" :key="g.menuCode" class="perm-group">
              <div class="perm-group-head">
                <a-checkbox
                  :checked="g.menuChecked"
                  @change="(e: any) => toggleGroupMenu(g, e.target.checked)"
                >{{ g.menuName }}</a-checkbox>
              </div>
              <a-checkbox-group
                v-if="g.buttons.length"
                v-model:value="g.checked"
                :options="g.buttons"
                class="perm-options"
                @change="() => onGroupButtonsChange(g)"
              />
            </div>
          </div>
        </div>

        <footer class="perm-footer">
          <span class="perm-count">已选 {{ selectedCount }} 项</span>
          <div class="perm-footer-actions">
            <a-button class="cancel-btn" @click="router.back()">取消</a-button>
            <a-button type="primary" class="save-btn" :loading="saving" @click="handleSave">保存</a-button>
          </div>
        </footer>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LeftOutlined } from '@ant-design/icons-vue'
import { listMenuPermissions, type PermissionItem } from '@/api/faiz'
import { listUserDirectPermissions, saveUserDirectPermissions } from '@/api/enterprise'

/**
 * 用户授权页（企业后台 · 用户管理行内「授权」进入）：
 * 维护 sys_user_permission 用户级直接授权，按菜单分组勾选（菜单 + 按钮权限点）。
 */
const route = useRoute()
const router = useRouter()

const memberId = typeof route.params.memberId === 'string' ? route.params.memberId : ''

const initialized = ref(false)
const saving = ref(false)
const permGroups = ref<PermGroup[]>([])
/** 业务模块分组（需求管控平台 / 云文档）：模块入口 + 组内按钮权限 */
const moduleGroups = ref<ModuleGroup[]>([])

interface ModuleGroup {
  code: string
  name: string
  checked: boolean
  /** 组内按钮权限选项 */
  buttons: { label: string; value: string }[]
  /** 已勾选按钮权限编码 */
  checkedButtons: string[]
}

interface PermGroup {
  menuCode: string
  menuName: string
  /** 组内按钮权限选项 */
  buttons: { label: string; value: string }[]
  menuChecked: boolean
  /** 已勾选按钮权限编码 */
  checked: string[]
}

/** 企业后台拥有的菜单（用户管理 / 角色管理 / 岗位管理 / 组织管理 / 菜单管理）：用户授权只展示这些分组，管理后台专属菜单不展示 */
const ENTERPRISE_MENU_CODES = new Set([
  'admin:user',
  'admin:role',
  'admin:position',
  'admin:organization',
  'admin:menu',
])

/** 用户授权可配置的业务模块（需求管控平台 / 云文档），模块入口开关 */
const MODULE_MENU_CODES = ['menu:workspace', 'menu:docs']

const selectedCount = computed(() =>
  permGroups.value.reduce((acc, g) => acc + (g.menuChecked ? 1 : 0) + g.checked.length, 0)
    + moduleGroups.value.reduce((acc, m) => acc + (m.checked ? 1 : 0) + m.checkedButtons.length, 0),
)

/** 父级「后台管理」下辖的全部权限码（菜单 + 按钮） */
const allPermCodes = computed(() =>
  permGroups.value.flatMap((g) => [g.menuCode, ...g.buttons.map((b) => b.value)]),
)
const checkedCodes = computed(() => new Set(collectPermCodes()))
/** 全部勾选时父级选中；部分勾选时半选（indeterminate） */
const parentChecked = computed(() =>
  allPermCodes.value.length > 0 && allPermCodes.value.every((c) => checkedCodes.value.has(c)),
)
const parentIndeterminate = computed(() =>
  !parentChecked.value && allPermCodes.value.some((c) => checkedCodes.value.has(c)),
)

/** 勾 / 取消「后台管理」：全选或清空下辖四组的全部权限 */
function toggleParent(checked: boolean) {
  permGroups.value.forEach((g) => {
    g.menuChecked = checked
    g.checked = checked ? g.buttons.map((b) => b.value) : []
  })
}

async function loadPermissions() {
  try {
    const res = await listMenuPermissions()
    if (!res?.success) return
    const perms: PermissionItem[] = (res.data || []).filter((p) => p.status === 1)
    const menus = perms.filter((p) => p.permType === 'menu' && ENTERPRISE_MENU_CODES.has(p.permCode))
    const menuCodeSet = new Set(menus.map((m) => m.permCode))
    // 仅保留归属菜单仍展示的按钮权限（管理后台菜单的按钮一并隐藏）
    const buttons = perms.filter((p) => p.permType === 'button' && p.menuCode && menuCodeSet.has(p.menuCode))
    permGroups.value = menus.map((m) => ({
      menuCode: m.permCode,
      menuName: m.permName,
      buttons: buttons
        .filter((b) => b.menuCode === m.permCode)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .map((b) => ({ label: b.permName, value: b.permCode })),
      menuChecked: false,
      checked: [],
    }))
    // 业务模块分组（需求管控平台 / 云文档）：按菜单管理中的名称展示，组内按钮按归属菜单关联
    moduleGroups.value = perms
      .filter((p) => p.permType === 'menu' && MODULE_MENU_CODES.includes(p.permCode))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((m) => ({
        code: m.permCode,
        name: m.permName,
        checked: false,
        buttons: buttons
          .filter((b) => b.menuCode === m.permCode)
          .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
          .map((b) => ({ label: b.permName, value: b.permCode })),
        checkedButtons: [],
      }))
  } catch {
    // 请求层已统一提示
  }
}

/** 按已授权编码回填勾选状态 */
function applyPermCodes(codes: string[]) {
  const set = new Set(codes)
  permGroups.value.forEach((g) => {
    g.menuChecked = set.has(g.menuCode)
    g.checked = g.buttons.filter((b) => set.has(b.value)).map((b) => b.value)
    if (g.checked.length && !g.menuChecked) g.menuChecked = true
  })
  moduleGroups.value.forEach((m) => {
    m.checked = set.has(m.code)
    m.checkedButtons = m.buttons.filter((b) => set.has(b.value)).map((b) => b.value)
    // 有按钮权限但模块入口未勾时补上（模块不可达则按钮无意义）
    if (m.checkedButtons.length && !m.checked) m.checked = true
  })
}

async function loadUserPermissions() {
  if (!memberId) return
  try {
    const res = await listUserDirectPermissions(memberId)
    if (res?.success) applyPermCodes(res.data || [])
  } catch {
    // 请求层已统一提示
  }
}

/** 勾 / 取消菜单权限：取消时清空组内按钮 */
function toggleGroupMenu(g: PermGroup, checked: boolean) {
  g.menuChecked = checked
  if (!checked) g.checked = []
}

/** 勾 / 取消模块入口：取消时清空组内按钮 */
function toggleModuleMenu(m: ModuleGroup, checked: boolean) {
  m.checked = checked
  if (!checked) m.checkedButtons = []
}

/** 勾选任一模块按钮时自动带上模块入口 */
function onModuleButtonsChange(m: ModuleGroup) {
  if (m.checkedButtons.length && !m.checked) m.checked = true
}

/** 勾选任一按钮权限时自动带上菜单权限（页面入口） */
function onGroupButtonsChange(g: PermGroup) {
  if (g.checked.length && !g.menuChecked) g.menuChecked = true
}

/** 收集全部已勾选权限编码（后台菜单 + 按钮 + 业务模块及其按钮） */
function collectPermCodes(): string[] {
  return [
    ...permGroups.value.flatMap((g) => (g.menuChecked ? [g.menuCode, ...g.checked] : [])),
    ...moduleGroups.value.flatMap((m) => (m.checked ? [m.code, ...m.checkedButtons] : [])),
  ]
}

async function handleSave() {
  if (!memberId) {
    message.error('缺少用户标识，无法保存')
    return
  }
  saving.value = true
  try {
    const res = await saveUserDirectPermissions(memberId, collectPermCodes())
    if (res?.success) {
      message.success('授权已保存，用户重新登录后菜单生效')
      router.replace('/enterprise/users')
    }
  } catch {
    // 请求层已统一提示
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadPermissions()
  await loadUserPermissions()
  initialized.value = true
})
</script>

<style scoped>
/* Teambition 风格：浅灰底、轻量卡片、分组勾选 */
.user-auth-page {
  padding: 20px 24px 32px;
}

.auth-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.back-btn {
  width: 32px;
  height: 32px;
  margin-top: 2px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #646a73;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.back-btn:hover {
  color: #1f2329;
  background: #f0f1f3;
}

.auth-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2329;
  letter-spacing: -0.2px;
}

.auth-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: #8f959e;
}

.perm-card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 10px;
  padding: 20px;
}

.page-skeleton {
  min-height: 360px;
  padding: 12px 0;
}

.empty-tip {
  padding: 40px 0;
  text-align: center;
  font-size: 13px;
  color: #8f959e;
}

/* 父级分组「后台管理」：头部全选 + 子菜单卡片缩进 */
.perm-parent {
  border: 1px solid #e8eaed;
  border-radius: 10px;
  padding: 16px;
}

.perm-parent-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid #f0f1f3;
}

.perm-parent-head :deep(.ant-checkbox-wrapper) {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.perm-parent-hint {
  font-size: 12px;
  color: #8f959e;
}

.perm-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 16px;
}

.perm-group {
  padding: 14px 16px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  transition: border-color 0.15s;
}

.perm-group:hover {
  border-color: #d8dadd;
}

.perm-group-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.perm-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 10px;
  padding-left: 24px;
}

.perm-options :deep(.ant-checkbox-wrapper) {
  font-size: 13px;
  color: #646a73;
}

/* 业务模块卡片：与子菜单卡片同款式（排在「后台管理」父级之前） */
.module-item {
  margin-bottom: 10px;
}

.module-item + .module-item {
  margin-top: 10px;
}

.module-item .perm-group-head :deep(.ant-checkbox-wrapper) {
  font-size: 14px;
  font-weight: 500;
  color: #1f2329;
}

.perm-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f1f3;
}

.perm-count {
  font-size: 13px;
  color: #8f959e;
}

.perm-footer-actions {
  display: flex;
  gap: 10px;
}

.cancel-btn {
  border-radius: 8px;
}

.save-btn {
  border-radius: 8px;
}

@media (max-width: 768px) {
  .user-auth-page {
    padding: 16px;
  }
}
</style>
