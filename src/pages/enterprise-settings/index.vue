<template>
  <div class="mgmt-page">
    <header class="mgmt-header">
      <h2 class="mgmt-title">设置管理</h2>
    </header>

    <section class="mgmt-card">
      <div class="row">
        <div class="row-label">企业名称</div>
        <div class="row-body">
          <a-input
            v-model:value="nameInput"
            :disabled="!isOwner"
            :maxlength="50"
            placeholder="企业名称"
            class="name-input"
          />
          <a-button type="primary" :disabled="!isOwner || !nameInput.trim()" :loading="renaming" @click="rename">保存</a-button>
        </div>
      </div>

      <div class="row">
        <div class="row-label">企业管理员</div>
        <div class="row-body">
          <span class="owner-name">{{ detail?.ownerName || detail?.ownerMemberId || '-' }}</span>
          <a-button :disabled="!isOwner" @click="openTransfer">转交管理员</a-button>
        </div>
      </div>

      <div class="row">
        <div class="row-label">成员数</div>
        <div class="row-body"><span class="muted">{{ detail?.memberCount ?? 0 }} 人</span></div>
      </div>

      <div class="row danger-row">
        <div class="row-label">退出企业</div>
        <div class="row-body">
          <span class="muted">{{ isOwner ? '管理员需先转交管理员，才能退出企业' : '退出后将不再能访问该企业的数据' }}</span>
          <a-button danger :disabled="isOwner" :loading="leaving" @click="confirmLeave">退出企业</a-button>
        </div>
      </div>
    </section>

    <a-modal
      v-model:open="transferOpen"
      title="转交管理员"
      ok-text="确认转交"
      cancel-text="取消"
      :confirm-loading="transferring"
      centered
      @ok="transfer"
    >
      <p class="muted">转交后，你将不再拥有改名、转交管理员的权限。转交对象必须是本企业成员。</p>
      <a-select
        v-model:value="transferTo"
        show-search
        :filter-option="filterMember"
        :options="memberOptions"
        :loading="membersLoading"
        placeholder="选择新的管理员"
        style="width: 100%"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message } from 'ant-design-vue'
import {
  enterpriseLeave,
  enterpriseQueryUsers,
  enterpriseRename,
  enterpriseSettingsDetail,
  enterpriseTransferOwner,
  getCurrentUser,
  type EnterpriseSettings,
} from '@/api/faiz'
import { setAuthUser } from '@/utils/auth'
import { setCurrentWorkspace } from '@/utils/workspace'
import { useEnterpriseScope } from '@/utils/enterprise-scope'

const router = useRouter()
const { rootOrganizationCode } = useEnterpriseScope()

const detail = ref<EnterpriseSettings | null>(null)
const nameInput = ref('')
const renaming = ref(false)
const leaving = ref(false)
const transferOpen = ref(false)
const transferring = ref(false)
const transferTo = ref<string | undefined>()
const membersLoading = ref(false)
const memberOptions = ref<{ value: string; label: string }[]>([])

const isOwner = computed(() => !!detail.value?.isOwner)

async function loadDetail() {
  if (!rootOrganizationCode.value) return
  try {
    const res = await enterpriseSettingsDetail(rootOrganizationCode.value)
    if (res?.success && res.data) {
      detail.value = res.data
      nameInput.value = res.data.organizationName || ''
    }
  } catch {
    // 请求层已统一提示
  }
}

/** 企业名称变化后刷新登录用户的组织列表，顶栏的企业名称同步更新 */
async function refreshOrganizations() {
  try {
    const profile = await getCurrentUser()
    if (profile?.success && profile.data) setAuthUser({ organizations: profile.data.organizations })
  } catch {
    // 请求层已统一提示
  }
}

async function rename() {
  const name = nameInput.value.trim()
  if (!name || !rootOrganizationCode.value) return
  renaming.value = true
  try {
    const res = await enterpriseRename(rootOrganizationCode.value, name)
    if (res?.success) {
      message.success('企业名称已更新')
      await refreshOrganizations()
      await loadDetail()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    renaming.value = false
  }
}

async function openTransfer() {
  transferTo.value = undefined
  transferOpen.value = true
  if (!rootOrganizationCode.value) return
  membersLoading.value = true
  try {
    const res = await enterpriseQueryUsers({
      keyword: '',
      isActive: 1,
      rootOrganizationCode: rootOrganizationCode.value,
      page: 1,
      pageSize: 200,
    })
    memberOptions.value = (res?.data?.list || [])
      .filter((u) => u.memberId !== detail.value?.ownerMemberId)
      .map((u) => ({ value: u.memberId ?? '', label: u.realName || u.coAccount || u.memberId || '' }))
  } catch {
    // 请求层已统一提示
  } finally {
    membersLoading.value = false
  }
}

function filterMember(input: string, option?: { label?: string }) {
  return String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
}

async function transfer() {
  if (!transferTo.value || !rootOrganizationCode.value) {
    message.warning('请选择新的管理员')
    return
  }
  transferring.value = true
  try {
    const res = await enterpriseTransferOwner(rootOrganizationCode.value, transferTo.value)
    if (res?.success) {
      message.success('已转交管理员')
      transferOpen.value = false
      await loadDetail()
    }
  } catch {
    // 请求层已统一提示
  } finally {
    transferring.value = false
  }
}

function confirmLeave() {
  Modal.confirm({
    title: `退出「${detail.value?.organizationName || '企业'}」？`,
    content: '退出后将不再能访问该企业的数据。',
    okText: '退出',
    okType: 'danger',
    cancelText: '取消',
    centered: true,
    async onOk() {
      if (!rootOrganizationCode.value) return
      leaving.value = true
      try {
        const res = await enterpriseLeave(rootOrganizationCode.value)
        if (res?.success) {
          await refreshOrganizations()
          setCurrentWorkspace('personal')
          router.replace('/')
        }
      } catch {
        // 请求层已统一提示
      } finally {
        leaving.value = false
      }
    },
  })
}

onMounted(loadDetail)
</script>

<style scoped>
.mgmt-page {
  padding: 20px 24px 32px;
  background: #fff;
}

.mgmt-header {
  margin-bottom: 16px;
}

.mgmt-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.2px;
  color: #1d1d1f;
}

.mgmt-card {
  max-width: 760px;
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 16px;
  padding: 8px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f3;
}

.row:last-child {
  border-bottom: none;
}

.row-label {
  width: 120px;
  flex-shrink: 0;
  font-size: 14px;
  color: #1d1d1f;
}

.row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.name-input {
  max-width: 360px;
}

.owner-name {
  font-size: 14px;
  color: #1d1d1f;
}

.muted {
  font-size: 13px;
  color: #6e6e73;
}

.danger-row .row-label {
  color: #ff3b30;
}

@media (max-width: 768px) {
  .mgmt-page {
    padding: 16px;
  }

  .row {
    flex-direction: column;
    align-items: flex-start;
  }

  .row-body {
    width: 100%;
  }
}
</style>
