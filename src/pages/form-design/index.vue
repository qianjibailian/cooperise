<template>
  <div class="form-design-page">
    <vxe-form-design ref="formDesignRef" :widgets="formDesignWidgets" :form-render="{name: 'MyDesignForm'}" height="100%">
      <template #extra>
        <a-button danger @click="clearEvent">清空</a-button>
        <a-button type="primary" @click="saveEvent">保存</a-button>
        <a-button @click="previewEvent">预览</a-button>
        <a-button type="primary" @click="addRecordEvent">新增</a-button>
      </template>
    </vxe-form-design>

    <!-- 预览弹窗 -->
    <a-modal v-model:open="previewVisible" title="表单预览" width="800px" :footer="null" destroy-on-close>
      <div class="preview-container">
        <vxe-form-view v-if="previewFormConfig" :config="previewFormConfig" v-model="previewFormData" />
        <div v-else class="empty-preview">暂无表单配置，请先在左侧设计表单</div>
      </div>
    </a-modal>

    <!-- 新增弹窗 -->
    <a-modal v-model:open="addVisible" title="新增记录" width="600px" @ok="handleAddOk" @cancel="handleAddCancel" destroy-on-close>
      <div class="add-container">
        <a-form v-if="widgetList.length > 0" :model="addFormData" layout="vertical">
          <template v-for="item in widgetList" :key="item.field">
            <a-form-item v-if="item.visible !== false" :label="item.title" :required="item.required" :name="item.field">
              <a-input v-if="item.name === 'InputWidget'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" />
              <a-textarea v-else-if="item.name === 'TextareaWidget'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" :rows="item.options?.minRows || 2" />
              <a-input-number v-else-if="item.name === 'NumberInputWidget'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" :min="item.options?.min" :max="item.options?.max" :step="item.options?.step" style="width: 100%" />
              <a-input-number v-else-if="item.name === 'AmountInputWidget'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" :min="item.options?.min" :max="item.options?.max" :step="item.options?.step" style="width: 100%" />
              <a-date-picker v-else-if="item.name === 'DateDatePickerWidget'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" style="width: 100%" />
              <a-select v-else-if="item.name === 'SelectWidget'" v-model:value="addFormData[item.field]" :placeholder="item.options?.placeholder" style="width: 100%">
                <a-select-option v-for="opt in item.options?.options" :key="opt.value" :value="opt.value">{{ opt.label }}</a-select-option>
              </a-select>
              <a-upload v-else-if="item.name === 'UploadFileWidget'" :file-list="addFormData[item.field]" :before-upload="() => false" :multiple="item.options?.multiple" :max-count="item.options?.limitCount">
                <a-button>点击上传</a-button>
              </a-upload>
              <a-upload v-else-if="item.name === 'UploadImageWidget'" :file-list="addFormData[item.field]" list-type="picture-card" :before-upload="() => false" :multiple="item.options?.multiple" :max-count="item.options?.limitCount">
                <div>
                  <plus-outlined />
                  <div style="margin-top: 8px">上传图片</div>
                </div>
              </a-upload>
              <a-textarea v-else-if="item.name === 'WangEditorWidget'" v-model:value="addFormData[item.field]" placeholder="请输入富文本内容" :rows="6" />
              <a-input v-else :placeholder="item.options?.placeholder" v-model:value="addFormData[item.field]" />
            </a-form-item>
          </template>
        </a-form>
        <div v-else class="empty-preview">暂无表单配置，请先在左侧设计表单</div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { VxeUI } from 'vxe-pc-ui'
import { PlusOutlined } from '@ant-design/icons-vue'
import { getTemplate, updateTemplate } from '@/api/faiz'
import type { VxeFormDesignInstance, VxeFormDesignPropTypes } from 'vxe-design'

const formDesignRef = ref<VxeFormDesignInstance>()

const previewVisible = ref(false)
const addVisible = ref(false)

const previewFormConfig = ref<any>(null)
const addFormData = reactive<Record<string, any>>({})

const LAYOUT_WIDGETS = ['title', 'row', 'subtable', 'TabWidget']
const SYSTEM_WIDGETS = ['CreateByWidget', 'UpdateByWidget', 'CreateTimeWidget', 'UpdateTimeWidget']

const collectWidgetFields = (widgets: any[], result: any[]) => {
  widgets.forEach((w: any) => {
    if (LAYOUT_WIDGETS.includes(w.name)) {
      if (w.children) {
        collectWidgetFields(w.children, result)
      }
    } else if (SYSTEM_WIDGETS.includes(w.name)) {
      // skip system widgets
    } else if (w.field && w.visible !== false) {
      result.push(w)
    }
  })
}

const widgetList = computed(() => {
  if (previewFormConfig.value && previewFormConfig.value.widgetData) {
    const result: any[] = []
    collectWidgetFields(previewFormConfig.value.widgetData, result)
    return result
  }
  return []
})

const previewFormData = ref<Record<string, any>>({})

const formDesignWidgets = ref<VxeFormDesignPropTypes.Widgets>([
  {
    group: 'layout',
    children: [
      'row',
    ]
  },
  {
    group: 'base',
    children: [
      'InputWidget', 'TextareaWidget', 'NumberInputWidget',
      'DateDatePickerWidget',
      'SelectWidget',
      'UploadFileWidget', 'UploadImageWidget'
    ]
  },
  {
    group: 'system',
    children: [
      'CreateByWidget', 'UpdateByWidget',
      'CreateTimeWidget', 'UpdateTimeWidget'
    ]
  },
  {
    group: 'advanced',
    children: [
      'WangEditorWidget'
    ]
  },
  {
    customGroup: '更多控件',
    children: [
    ]
  }
])

onMounted(() => {
  const $formDesign = formDesignRef.value
  if ($formDesign) {
    const defData = localStorage.getItem('DATA_FormDesignEdit')
    let defJson = { formConfig: { title: '', pcVisible: true, pcVertical: true, pcTitleBold: true, pcTitleColon: false, pcTitleAlign: '', pcTitleWidth: '', pcTitleWidthUnit: '', mobileVisible: false, mobileVertical: true, mobileTitleBold: true, mobileTitleColon: false, mobileTitleAlign: '', mobileTitleWidth: '', mobileTitleWidthUnit: '' }, widgetData: [] }
    if (defData) {
      try {
        defJson = JSON.parse(defData)
      } catch (e) {
        console.error(e)
      }
    }
    $formDesign.loadConfig(defJson)
  }
})

const clearEvent = () => {
  const $formDesign = formDesignRef.value
  if ($formDesign) {
    $formDesign.clearConfig()
  }
  localStorage.removeItem('DATA_FormDesignEdit')
}

const countWidgets = (widgets: any[]): number => {
  let count = 0
  widgets.forEach((w: any) => {
    count++
    if (w.children && w.children.length > 0) {
      count += countWidgets(w.children)
    }
  })
  return count
}

const generateId = (): string => {
  return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6)
}

const formatNow = (): string => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

// ---- 本地存储工具函数 ----
const STORAGE_KEY = 'TEMPLATE_LIST'

const syncLocalTemplateList = (flag: { templateId: string | number; tabId: string | number; tabIdx: number }, config: any) => {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY)
    const templateList = existingData ? JSON.parse(existingData) : []
    const now = formatNow()
    if (flag.templateId && flag.templateId !== 'NEW') {
      const tpl = templateList.find((t: any) => t.id === flag.templateId)
      if (tpl) {
        const tab = tpl.tabs?.find((tb: any) => tb.id === flag.tabId)
        if (tab) {
          tab.formConfig = config.formConfig
          tab.widgetData = config.widgetData
          tab.name = tab.name || config.formConfig?.title || `表单 ${flag.tabIdx + 1}`
          tpl.updatedAt = now
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templateList))
      }
    }
  } catch (e) {
    console.error('同步 localStorage 失败:', e)
  }
}

const syncNewTemplateToLocal = (config: any) => {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY)
    const templateList = existingData ? JSON.parse(existingData) : []
    const now = formatNow()
    const tabId = generateId()
    templateList.push({
      id: generateId(),
      templateName: config.formConfig?.title || '未命名模板',
      description: '',
      category: 'other',
      status: true,
      tabs: [{ id: tabId, name: config.formConfig?.title || '未命名表单', formConfig: config.formConfig, widgetData: config.widgetData }],
      createdAt: now,
      updatedAt: now,
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templateList))
  } catch (e) {
    console.error('创建本地模板失败:', e)
  }
}

// ---- 保存 ----
const saveEvent = async () => {
  const $formDesign = formDesignRef.value
  if (!$formDesign) return

  const config = $formDesign.getConfig()
  console.log('【保存模板】请求体:', JSON.stringify(config, null, 2))
  localStorage.setItem('DATA_FormDesignEdit', JSON.stringify(config))

  const flagData = localStorage.getItem('TEMPLATE_EDIT_FLAG')

  if (flagData) {
    const flag = JSON.parse(flagData)

    if (flag.templateId && flag.templateId !== 'NEW') {
      // 已有模板：调用后端接口更新
      try {
        const res = await getTemplate(flag.templateId)
        if (!res.success || !res.data) {
          VxeUI.modal.message({ content: res.message || '获取模板信息失败', status: 'error' })
          return
        }

        const template = res.data
        // 优先用 tabIdx 索引匹配，再用 tabId 兜底
        const tab = template.tabs?.[flag.tabIdx] ?? template.tabs?.find((tb: any) => String(tb.id) === String(flag.tabId))
        if (!tab) {
          console.error('Tab not found:', { templateId: flag.templateId, tabId: flag.tabId, tabIdx: flag.tabIdx, tabs: template.tabs })
          VxeUI.modal.message({ content: '未找到对应的表单 Tab', status: 'error' })
          return
        }

        // 更新当前 Tab 的配置
        tab.formConfig = JSON.stringify(config.formConfig)
        tab.widgetData = JSON.stringify(config.widgetData)
        if (config.formConfig?.title) {
          tab.name = config.formConfig.title
        }

        // 构造更新数据（与 template-list serializeTemplatePayload 格式一致）
        const data = {
          templateName: template.templateName,
          description: template.description,
          category: template.category,
          status: template.status,
          tabs: template.tabs.map((t: any, idx: number) => ({
            name: t.name,
            tabOrder: t.tabOrder ?? idx + 1,
            formConfig: typeof t.formConfig === 'string' ? t.formConfig : JSON.stringify(t.formConfig || {}),
            widgetData: typeof t.widgetData === 'string' ? t.widgetData : JSON.stringify(t.widgetData || []),
          })),
        }

        const updateRes = await updateTemplate(flag.templateId, data)
        if (updateRes.success) {
          VxeUI.modal.message({ content: '保存成功', status: 'success' })
        } else {
          VxeUI.modal.message({ content: updateRes.message || '保存失败', status: 'error' })
          return
        }
      } catch (e: any) {
        console.error('保存模板失败:', e)
        VxeUI.modal.message({ content: e?.message || '保存失败，请重试', status: 'error' })
        return
      }

      // 同步更新 localStorage
      syncLocalTemplateList(flag, config)
      localStorage.removeItem('TEMPLATE_EDIT_FLAG')
      return
    }

    // NEW 模板：暂存到 localStorage，等模板列表保存时提交后端
    syncLocalTemplateList(flag, config)
    localStorage.removeItem('TEMPLATE_EDIT_FLAG')
    VxeUI.modal.message({ content: '保存成功（请回到模板列表提交保存）', status: 'success' })
  } else {
    // 无 flag：新建模板到 localStorage
    syncNewTemplateToLocal(config)
    VxeUI.modal.message({ content: '保存成功（新建模板）', status: 'success' })
  }
}

const initFormData = (widgets: any[], data: Record<string, any>) => {
  widgets.forEach((w: any) => {
    if (w.children) {
      initFormData(w.children, data)
    } else if (w.field) {
      data[w.field] = null
    }
  })
}

const previewEvent = () => {
  const $formDesign = formDesignRef.value
  if ($formDesign) {
    const config = $formDesign.getConfig()
    if (config.widgetData && config.widgetData.length > 0) {
      previewFormConfig.value = config
      const data: Record<string, any> = {}
      initFormData(config.widgetData, data)
      previewFormData.value = data
      previewVisible.value = true
    } else {
      VxeUI.modal.message({
        content: '请先设计表单',
        status: 'warning'
      })
    }
  }
}

const addRecordEvent = () => {
  const $formDesign = formDesignRef.value
  if ($formDesign) {
    const config = $formDesign.getConfig()
    if (config.widgetData && config.widgetData.length > 0) {
      previewFormConfig.value = config
      Object.keys(addFormData).forEach(key => delete addFormData[key])
      const data: Record<string, any> = {}
      initFormData(config.widgetData, data)
      Object.assign(addFormData, data)
      addVisible.value = true
    } else {
      VxeUI.modal.message({
        content: '请先设计表单',
        status: 'warning'
      })
    }
  }
}

const handleAddOk = () => {
  console.log('表单数据：', addFormData)
  VxeUI.modal.message({
    content: '提交成功',
    status: 'success'
  })
  addVisible.value = false
}

const handleAddCancel = () => {
  addVisible.value = false
}
</script>

<style scoped>
.form-design-page {
  width: 100%;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.preview-container,
.add-container {
  max-height: 60vh;
  overflow-y: auto;
}

.empty-preview {
  text-align: center;
  color: #999;
  padding: 40px 0;
}
</style>
