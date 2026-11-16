<template>
  <a-drawer
    :open="open"
    placement="right"
    root-class-name="issue-detail-drawer"
    :width="drawerWidth"
    :content-wrapper-style="{ '--drawer-min-width': '860px' }"
    :body-style="{ padding: 0, height: '100vh', overflow: 'hidden' }"
    :header-style="{ display: 'none' }"
    :mask-style="{ background: 'transparent' }"
    @close="handleClose"
  >
    <div class="drawer-inner">
      <!-- ========== 顶部工具栏（单号区域，固定） ========== -->
      <header v-if="!loading && detailData" class="top-bar">
        <div class="top-bar-left">
          <div class="tb-crumb-icon" :style="issueTypeIconStyle" :title="issueTypeLabel || undefined">
            <component :is="issueTypeIcon" />
          </div>
          <span class="tb-project">{{ projectLabel || '未命名项目' }}</span>
          <span class="tb-divider">/</span>
          <span class="tb-key">{{ issueKey }}</span>
          <div class="tb-inline-actions">
            <div class="tb-icon-btn" title="复制单号"><component :is="CopyOutlined" /></div>
            <div class="tb-icon-btn" title="收藏"><component :is="StarOutlined" /></div>
            <div class="tb-icon-btn" title="复制链接" @click="copyIssueLink"><component :is="LinkOutlined" /></div>
            <div class="tb-icon-btn" title="打开链接" @click="openIssueInNew"><component :is="ExportOutlined" /></div>
          </div>
        </div>
        <div class="top-bar-right">
          <div class="tb-icon-btn" title="分享"><component :is="ShareAltOutlined" /></div>
          <div class="tb-icon-btn tb-close" title="关闭" @click="handleClose">
            <component :is="CloseOutlined" />
          </div>
        </div>
      </header>

      <!-- Loading（Skeleton 骨架屏） -->
      <div v-if="loading" class="detail-skeleton">
        <header class="top-bar top-bar-skeleton">
          <div class="top-bar-left">
            <a-skeleton-input :size="'small'" style="width: 120px" />
          </div>
          <div class="top-bar-right">
            <a-skeleton-button :size="'small'" shape="circle" />
            <a-skeleton-button :size="'small'" shape="circle" />
          </div>
        </header>
        <div class="detail-body">
          <section class="title-section">
            <div class="title-accent" />
            <a-skeleton :paragraph="{ rows: 1 }" :title="false" style="width: 85%" />
          </section>

          <section class="attr-card">
            <div class="attr-row-line">
              <div v-for="n in 3" :key="n" class="attr-item">
                <a-skeleton :paragraph="{ rows: 1, width: ['48px', '100%'] }" :avatar="false" :title="false" />
              </div>
            </div>
          </section>

          <section class="action-bar">
            <a-skeleton-button size="small" style="width: 72px; margin-right: 8px" />
            <a-skeleton-button size="small" style="width: 72px; margin-right: 8px" />
            <a-skeleton-button size="small" style="width: 96px" />
          </section>

          <section class="panel-collapse">
            <a-skeleton :paragraph="{ rows: 3, width: ['100%', '70%', '85%'] }" :title="true" :avatar="false" />
          </section>
          <section class="panel-collapse">
            <a-skeleton :paragraph="{ rows: 2, width: ['100%', '65%'] }" :title="true" :avatar="false" />
          </section>
          <section class="panel-collapse">
            <a-skeleton :paragraph="{ rows: 4, width: ['100%', '80%', '60%', '90%'] }" :title="true" :avatar="true" />
          </section>
          <section class="panel-collapse">
            <a-skeleton :paragraph="{ rows: 3, width: ['100%', '75%', '60%'] }" :title="true" :avatar="true" />
          </section>
          <section class="panel-collapse">
            <a-skeleton :paragraph="{ rows: 2, width: ['100%', '80%'] }" :title="true" :avatar="false" />
          </section>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="!detailData" class="detail-empty">
        <div class="empty-illustration">
          <component :is="FileUnknownOutlined" />
        </div>
        <div class="empty-title">未找到数据</div>
        <div class="empty-desc">请尝试刷新页面或重新打开</div>
      </div>

      <!-- Content（从单号区域下面开始滚动） -->
      <div v-else class="detail-body">
        <!-- ========== 标题区（概要字段，可编辑） ========== -->
        <section class="title-section">
          <div class="title-accent" />
          <div v-if="editingSummary" class="summary-edit-wrap">
            <a-input
              ref="summaryInputRef"
              v-model:value="summaryDraft"
              class="summary-input"
              placeholder="请输入概要"
              maxlength="200"
              @pressEnter="saveSummary"
              @blur="saveSummary"
            />
          </div>
          <template v-else>
            <div v-if="!heroSummary" class="summary-empty-wrap" @click="startEditSummary">
              <span class="summary-label">概要</span>
              <span class="summary-empty-tip">未填写概要，点击填写</span>
            </div>
            <h1 v-else class="issue-title" @click="startEditSummary">
              {{ heroSummary }}
            </h1>
          </template>
        </section>

        <!-- ========== 内联属性卡：基础信息（SUBJECT）组字段，按接口返回渲染，不写死 ========== -->
        <section v-if="issueTypeField || statusField || priorityField || filteredSummaryGrid.length" class="attr-card">
          <div class="attr-row-line">
            <div v-if="issueTypeField" class="attr-item">
              <span class="attr-label">{{ issueTypeField.name || '问题类型' }}</span>
              <span class="attr-value-block">
                <span v-if="issueTypeLabel" class="attr-type-icon" :style="{ background: issueTypeColor || DEFAULT_TYPE_COLOR }"><component :is="issueTypeIcon" /></span>
                <span class="attr-value">{{ issueTypeLabel || '—' }}</span>
              </span>
            </div>

            <div v-if="statusField" class="attr-item">
              <span class="attr-label">{{ statusField.name || '状态' }}</span>
              <span class="attr-value-block">
                <a-tag
                  v-if="statusLabel"
                  :color="statusTagColor"
                  :bordered="false"
                  class="attr-tag"
                >
                  <span class="attr-dot" :style="{ background: statusDotColor }" />
                  {{ statusLabel }}
                </a-tag>
                <span v-else class="attr-empty">—</span>
                <a class="attr-wf-link" @click="workflowViewOpen = true">工作流</a>
              </span>
            </div>

            <div v-if="priorityField" class="attr-item">
              <span class="attr-label">{{ priorityField.name || '优先级' }}</span>
              <span class="attr-value-block">
                <span class="priority-text" :style="{ color: priorityColorHex }">
                  <span class="priority-dot" :style="{ background: priorityColorHex }"></span>
                  <span class="priority-label">{{ priorityLabel || '—' }}</span>
                </span>
              </span>
            </div>

            <!-- 基础信息（SUBJECT）组的其余字段：按接口返回顺序展示（如 Sprint / 版本），不写死 -->
            <div v-for="f in filteredSummaryGrid" :key="f.id" class="attr-item">
              <span class="attr-label" :title="f.name">{{ f.name }}</span>
              <span class="attr-value-block">
                <RichTextField v-if="isRichText(f)" :field="f" :issue-key="issueKey" @saved="onFieldSaved(f, $event)" />
                <FieldValueEditor
                  v-else-if="editingFieldId === f.id"
                  :field="f"
                  :issue-key="issueKey"
                  @saved="onFieldSaved(f, $event)"
                  @cancel="editingFieldId = null"
                />
                <template v-else>
                  <ValueWithBadge :field="f" />
                  <span v-if="canEditField(f)" class="field-edit-icon" title="编辑" @click="editingFieldId = f.id">
                    <component :is="EditOutlined" />
                  </span>
                </template>
              </span>
            </div>


          </div>
        </section>

        <!-- ========== 操作按钮栏 ========== -->
        <section class="action-bar">
          <div class="action-bar-left">
            <IssueActionButtons :issue-key="issueKey" :active="open" @changed="handleButtonsChanged" />
          </div>
          <div class="action-bar-right">
            <a-switch v-model:checked="onlyShowValued" size="small" />
            <span class="switch-label">仅展示有值字段</span>
          </div>
        </section>

        <!-- ========== 主体内容 ========== -->
        <main class="detail-scroll">
          <div class="scroll-inner">

            <!-- 团队管理字段（折叠面板） -->
            <a-collapse
              v-if="hasSummaryPanel"
              v-model:activeKey="teamCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse team-collapse"
            >
              <a-collapse-panel key="team">
                <template #header>
                  <div class="collapse-header-inner">

                    <span class="pch-title">团队管理字段</span>
                  </div>
                </template>
                <div class="panel-card-body">
                  <template
                    v-if="customFieldTabGroup && customFieldTabGroup.structureType === 'TAB_CONTAINER' && customFieldTabGroup.tabItems.length > 0"
                  >
                    <a-tabs
                      v-model:active-key="activeTab"
                      class="panel-tabs"
                      size="small"
                    >
                      <a-tab-pane
                        v-for="tab in customFieldTabGroup.tabItems"
                        :key="tab.title"
                        :tab="tab.title"
                      >
                        <div
                          v-if="filteredFields(tab.issueFields).length > 0"
                          class="kv-list"
                        >
                          <template v-for="(f, i) in filteredFields(tab.issueFields)" :key="f.id">
                            <div class="kv-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                              <div class="kv-label">
                                <span class="kv-label-inner">{{ f.name }}</span>
                              </div>
                              <div class="kv-value">
                                <RichTextField v-if="isRichText(f)" :field="f" :issue-key="issueKey" @saved="onFieldSaved(f, $event)" />
                                <template v-else-if="editingFieldId === f.id">
                                  <FieldValueEditor
                                    :field="f"
                                    :issue-key="issueKey"
                                    @saved="onFieldSaved(f, $event)"
                                    @cancel="editingFieldId = null"
                                  />
                                </template>
                                <template v-else>
                                  <UserAvatar v-if="isUserField(f)" :user="f.value" />
                                  <ValueWithBadge v-else :field="f" />
                                  <span
                                    v-if="canEditField(f)"
                                    class="field-edit-icon"
                                    title="编辑"
                                    @click="editingFieldId = f.id"
                                  >
                                    <component :is="EditOutlined" />
                                  </span>
                                </template>
                              </div>
                            </div>
                          </template>
                        </div>
                        <MiniEmpty v-else text="暂无该分类下数据" />
                      </a-tab-pane>
                    </a-tabs>
                  </template>

                  <template v-else>
                    <div
                      v-if="customFieldPlain && customFieldPlain.fields.length > 0 && filteredFields(customFieldPlain.fields).length > 0"
                      class="kv-list kv-list-extra"
                    >
                      <div class="kv-subtitle">
                        <component :is="AppstoreOutlined" /> 自定义字段
                      </div>
                      <template v-for="(f, i) in filteredFields(customFieldPlain.fields)" :key="f.id">
                        <div class="kv-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                          <div class="kv-label">
                            <span class="kv-label-inner">{{ f.name }}</span>
                          </div>
                          <div class="kv-value">
                            <RichTextField v-if="isRichText(f)" :field="f" :issue-key="issueKey" @saved="onFieldSaved(f, $event)" />
                            <UserAvatar v-else-if="isUserField(f)" :user="f.value" />
                            <ValueWithBadge v-else :field="f" />
                          </div>
                        </div>
                      </template>
                    </div>
                  </template>
                </div>
              </a-collapse-panel>
            </a-collapse>

            <!-- ========== 暂时注释：研发活动（折叠板） ==========
            <a-collapse
              v-model:activeKey="rdCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="rd">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">研发活动</span>
                    </div>
                    <div class="collapse-header-right">
                      <div class="pch-meta dim">
                        <component :is="CodeOutlined" />
                      </div>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <MiniEmpty text="暂无提交记录 / 分支 / MR" />
                </div>
              </a-collapse-panel>
            </a-collapse>
            ========== /暂时注释：研发活动 ========== -->

            <!-- 描述（折叠板） -->
            <a-collapse
              v-if="!onlyShowValued ? true : descriptionFields.length > 0"
              v-model:activeKey="descCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="desc">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">描述</span>
                    </div>
                    <div class="collapse-header-right">
                      <div class="pch-action-btn" title="全屏查看">
                        <component :is="FullscreenOutlined" />
                      </div>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <template v-if="descriptionFields.length > 0">
                    <div
                      v-for="f in descriptionFields"
                      :key="`desc-${f.id}-${richEditorVersion}`"
                      :class="['desc-rich-wrap', { 'is-editing': richEditing[f.id] }]"
                    >
                      <!-- 编辑 / 保存 / 取消 -->
                      <div v-if="f.editable" class="desc-rich-actions">
                        <a-tooltip v-if="!richEditing[f.id]" title="编辑描述">
                          <a-button type="text" size="small" class="desc-act-btn" @click="startRichEdit(f.id)"><EditOutlined /></a-button>
                        </a-tooltip>
                        <template v-else>
                          <a-tooltip title="取消">
                            <a-button type="text" size="small" class="desc-act-btn" :disabled="richSaving[f.id]" @click="cancelRichEdit(f.id)"><CloseOutlined /></a-button>
                          </a-tooltip>
                          <a-tooltip title="保存">
                            <a-button type="text" size="small" class="desc-act-btn is-save" :loading="richSaving[f.id]" @click="saveRichText(f.id)">
                              <CheckOutlined v-if="!richSaving[f.id]" />
                            </a-button>
                          </a-tooltip>
                        </template>
                      </div>
                      <!-- 编辑态：富文本编辑器 -->
                      <template v-if="richEditing[f.id]">
                        <Toolbar
                          :editor="richEditorInstances[f.id] || null"
                          :default-config="richToolbarConfig"
                          mode="default"
                          class="desc-rich-toolbar"
                        />
                        <Editor
                          v-model="richTextModels[f.id]"
                          :default-config="richEditorConfig"
                          mode="default"
                          class="desc-rich-editor"
                          @onCreated="(editor: IDomEditor) => handleRichEditorCreated(f.id, editor)"
                        />
                      </template>
                      <!-- 非编辑态：只读渲染，双击进入编辑 -->
                      <div v-else class="desc-rich-view" @dblclick="f.editable && startRichEdit(f.id)">
                        <div v-if="hasRichContent(richTextModels[f.id])" class="desc-rich-html" v-html="sanitizeHtml(richTextModels[f.id])" />
                        <span v-else class="desc-rich-empty">暂无描述{{ f.editable ? '，点击右上角编辑' : '' }}</span>
                      </div>
                    </div>
                  </template>
                  <MiniEmpty v-else text="还没有填写描述" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <!-- ========== 暂时隐藏：研发活动（折叠板，位于描述下方）：需求文档 / 应用名称 / 代码分支 / 测试计划 / 缺陷管理 / 线上故障 ==========
            <a-collapse
              v-model:activeKey="rdCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="rd">
                <template #header>
                  <div class="collapse-header-inner">
                    <span class="pch-title">研发活动</span>
                  </div>
                </template>
                <div class="panel-card-body">
                  <IssueRdActivity :issue-key="issueKey" />
                </div>
              </a-collapse-panel>
            </a-collapse>
            ========== /暂时隐藏：研发活动 ========== -->

            <!-- ========== 暂时注释：关联 OKR（折叠板） ==========
            <a-collapse
              v-model:activeKey="okrCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="okr">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">关联的 OKR</span>
                    </div>
                    <div class="collapse-header-right">
                      <a class="pch-add" @click.stop>
                        <component :is="PlusOutlined" />
                        <span>添加关联</span>
                      </a>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <MiniEmpty text="暂无关联 OKR，点击右上角添加" />
                </div>
              </a-collapse-panel>
            </a-collapse>
            ========== /暂时注释：关联 OKR ========== -->

            <!-- 人员信息（折叠板） -->
            <a-collapse
              v-model:activeKey="userCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="user">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">人员信息</span>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <div v-if="filteredUserFields.length > 0" class="kv-list">
                    <template v-for="(f, i) in filteredUserFields" :key="f.id">
                      <div class="kv-row user-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                        <div class="kv-label">
                          <span class="kv-label-inner">{{ f.name }}</span>
                        </div>
                        <div class="kv-value">
                          <RichTextField v-if="isRichText(f)" :field="f" :issue-key="issueKey" @saved="onFieldSaved(f, $event)" />
                          <template v-else-if="editingFieldId === f.id">
                            <FieldValueEditor
                              :field="f"
                              :issue-key="issueKey"
                              @saved="onFieldSaved(f, $event)"
                              @cancel="editingFieldId = null"
                            />
                          </template>
                          <template v-else>
                            <div class="user-cell-pretty">
                              <UserAvatar :user="f.value" :size="26" />
                              <span
                                v-if="canEditField(f)"
                                class="field-edit-icon"
                                title="编辑"
                                @click="editingFieldId = f.id"
                              >
                                <component :is="EditOutlined" />
                              </span>
                              <div class="ucp-share" title="转派给其他人">
                                <component :is="ShareAltOutlined" />
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                  <MiniEmpty v-else text="暂无人员信息" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <!-- 时间信息（折叠板） -->
            <a-collapse
              v-model:activeKey="timeCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="time">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">时间信息</span>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <div v-if="filteredTimeFields.length > 0" class="kv-list">
                    <template v-for="(f, i) in filteredTimeFields" :key="f.id">
                      <div class="kv-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                        <div class="kv-label">
                          <span class="kv-label-inner">{{ f.name }}</span>
                        </div>
                        <div class="kv-value">
                          <RichTextField v-if="isRichText(f)" :field="f" :issue-key="issueKey" @saved="onFieldSaved(f, $event)" />
                          <template v-else-if="editingFieldId === f.id">
                            <FieldValueEditor
                              :field="f"
                              :issue-key="issueKey"
                              @saved="onFieldSaved(f, $event)"
                              @cancel="editingFieldId = null"
                            />
                          </template>
                          <template v-else>
                            {{ formatFieldValue(f) }}
                            <span
                              v-if="canEditField(f)"
                              class="field-edit-icon"
                              title="编辑"
                              @click="editingFieldId = f.id"
                            >
                              <component :is="EditOutlined" />
                            </span>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                  <MiniEmpty v-else text="暂无时间信息" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <!-- 研发活动（折叠板，定制）：仅问题类型 TYPE10001 展示，位于补充信息上方 -->
            <a-collapse
              v-if="showRdActivity"
              v-model:activeKey="rdCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="rd">
                <template #header>
                  <div class="collapse-header-inner">
                    <span class="pch-title">研发活动</span>
                  </div>
                </template>
                <div class="panel-card-body">
                  <IssueRdActivity :issue-key="issueKey" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <!-- 补充信息（折叠板）：字段分组为「补充信息」的字段 -->
            <a-collapse
              v-model:activeKey="supplementCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="supplement">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">
                      <span class="pch-title">补充信息</span>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <div v-if="filteredSupplementFields.length > 0" class="kv-list">
                    <template v-for="(f, i) in filteredSupplementFields" :key="f.id">
                      <div class="kv-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                        <div class="kv-label">
                          <span class="kv-label-inner">{{ f.name }}</span>
                        </div>
                        <div class="kv-value">
                          <RichTextField v-if="isRichText(f)" :field="f" :issue-key="issueKey" @saved="onFieldSaved(f, $event)" />
                          <template v-else-if="editingFieldId === f.id">
                            <FieldValueEditor
                              :field="f"
                              :issue-key="issueKey"
                              @saved="onFieldSaved(f, $event)"
                              @cancel="editingFieldId = null"
                            />
                          </template>
                          <template v-else>
                            {{ formatFieldValue(f) }}
                            <span
                              v-if="canEditField(f)"
                              class="field-edit-icon"
                              title="编辑"
                              @click="editingFieldId = f.id"
                            >
                              <component :is="EditOutlined" />
                            </span>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                  <MiniEmpty v-else text="暂无补充信息" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <!-- 相关文档（折叠板）：从云文档选择关联的文档 -->
            <a-collapse
              v-model:activeKey="docCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="doc">
                <template #header>
                  <div class="collapse-header-inner">
                    <span class="pch-title">相关文档</span>
                  </div>
                </template>
                <div class="panel-card-body">
                  <IssueRelatedDocs :issue-key="issueKey" :reload-trigger="detailData" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <!-- 关联工单（折叠板）：父工单 / 子工单 / 同级工单 -->
            <a-collapse
              v-model:activeKey="relationCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="relation">
                <template #header>
                  <div class="collapse-header-inner">
                    <span class="pch-title">关联工单</span>
                  </div>
                </template>
                <div class="panel-card-body">
                  <!-- 抽屉内点击关联事项在新标签页打开详情，不打断当前列表 -->
                  <IssueParentChild
                    :issue-key="issueKey"
                    :reload-trigger="detailData"
                    open-mode="tab"
                    @changed="emit('changed')"
                  />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <!-- ========== 暂时注释：附件 / 父级工单 / 子级工单 / 同级工单 / 依赖关系 ==========
            <a-collapse
              v-model:activeKey="attachmentCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="attachment">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">附件</span>
                    </div>
                    <div class="collapse-header-right">
                      <a class="pch-add" @click.stop>
                        <component :is="PlusOutlined" />
                        <span>上传附件</span>
                      </a>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <MiniEmpty text="暂无附件" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <a-collapse
              v-model:activeKey="parentCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="parent">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">父级工单</span>
                    </div>
                    <div class="collapse-header-right">
                      <a class="pch-add" @click.stop>
                        <component :is="PlusOutlined" />
                        <span>添加</span>
                      </a>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <MiniEmpty text="暂无父级工单" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <a-collapse
              v-model:activeKey="childCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="child">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">子级工单</span>
                    </div>
                    <div class="collapse-header-right">
                      <a class="pch-add" @click.stop>
                        <component :is="PlusOutlined" />
                        <span>添加</span>
                      </a>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <MiniEmpty text="暂无子级工单" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <a-collapse
              v-model:activeKey="siblingCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="sibling">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">同级工单</span>
                    </div>
                    <div class="collapse-header-right">
                      <a class="pch-add" @click.stop>
                        <component :is="PlusOutlined" />
                        <span>添加</span>
                      </a>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <MiniEmpty text="暂无同级工单" />
                </div>
              </a-collapse-panel>
            </a-collapse>

            <a-collapse
              v-model:activeKey="dependencyCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse"
            >
              <a-collapse-panel key="dependency">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">依赖关系</span>
                    </div>
                    <div class="collapse-header-right">
                      <a class="pch-add" @click.stop>
                        <component :is="PlusOutlined" />
                        <span>添加</span>
                      </a>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <MiniEmpty text="暂无依赖关系" />
                </div>
              </a-collapse-panel>
            </a-collapse>
            ========== /暂时注释：附件等五个板块 ========== -->

            <!-- 活动日志 -->
            <a-collapse
              v-model:activeKey="activityCollapseKeys"
              ghost
              :bordered="false"
              class="panel-collapse panel-collapse-last"
            >
              <a-collapse-panel key="activity">
                <template #header>
                  <div class="collapse-header-inner collapse-header-with-actions">
                    <div class="collapse-header-left">

                      <span class="pch-title">活动日志</span>
                    </div>
                  </div>
                </template>
                <div class="panel-card-body">
                  <a-tabs size="small" class="nn-activity-tabs">
                    <a-tab-pane key="change" tab="变更记录">
                      <a-spin :spinning="changeLogsLoading">
                        <a-timeline v-if="changeLogs.length" class="nn-activity-log">
                          <a-timeline-item
                            v-for="log in pagedChangeLogs"
                            :key="log.id"
                            :color="log.changeType === 'CREATE' ? 'green' : 'blue'"
                          >
                            <div class="nn-activity-item">
                              <div class="nn-activity-meta">
                                <UserAvatar v-if="log.operator" :user="log.operator" :size="20" />
                                <span v-else class="nn-activity-name">系统</span>
                                <span class="nn-activity-status">{{ log.changeType === 'CREATE' ? '创建' : '修改' }}</span>
                                <span class="nn-activity-time">{{ formatChangeTime(log.changeTime) }}</span>
                              </div>
                              <div class="nn-activity-node">
                                <template v-if="log.changeType === 'CREATE'">
                                  创建了事项<template v-if="log.newValue">（{{ log.newValue }}）</template>
                                </template>
                                <template v-else>
                                  修改了「{{ log.fieldName }}」：
                                  <span class="nn-change-old">{{ log.oldValue || '空' }}</span>
                                  →
                                  <span class="nn-change-new">{{ log.newValue || '空' }}</span>
                                </template>
                              </div>
                            </div>
                          </a-timeline-item>
                        </a-timeline>
                        <MiniEmpty v-else text="暂无变更记录" />
                        <a-pagination
                          v-if="changeLogs.length > CHANGE_LOG_PAGE_SIZE"
                          v-model:current="changeLogPage"
                          :page-size="CHANGE_LOG_PAGE_SIZE"
                          :total="changeLogs.length"
                          size="small"
                          :show-size-changer="false"
                          :show-total="(t: number) => `共 ${t} 条`"
                          class="nn-activity-pager"
                        />
                      </a-spin>
                    </a-tab-pane>
                    <a-tab-pane key="comment" tab="评论">
                      <IssueComments ref="issueCommentsRef" :issue-key="issueKey" />
                    </a-tab-pane>
                  </a-tabs>
                </div>
              </a-collapse-panel>
            </a-collapse>

            <div class="footer-spacer" />
          </div>
        </main>
      </div>
    </div>

    <!-- 状态字段右侧「工作流」：完整工作流弹窗 -->
    <WorkflowViewModal
      v-model:open="workflowViewOpen"
      :issue-key="issueKey"
    />
  </a-drawer>
</template>

<script setup lang="ts">
import { h, ref, computed, watch, reactive, nextTick, onBeforeUnmount } from 'vue'
import { personLabel, personAvatar, personInitial, isPersonLike } from '@/utils/person'
import dayjs from 'dayjs'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import {
  StarOutlined,
  LinkOutlined,
  ShareAltOutlined,
  FullscreenOutlined,
  CloseOutlined,
  FileUnknownOutlined,
  AppstoreOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  EditOutlined,
  CheckOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { openIssueLink } from '@/utils/issue-link'
import { isDesktop } from '@/utils/desktop'
import { queryDetail, patchIssue, queryChangeLogs } from '@/api/faiz'
import IssueComments from '@/components/IssueComments.vue'
import { message } from 'ant-design-vue'
import type { DetailData, DetailField, DetailLayoutGroup, IssueChangeLog } from '@/types/faiz'
import { FIELD_TYPE } from '@/types/fieldType'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import { issueTypeIconOf } from '@/utils/issueTypeIcons'
import IssueRdActivity from '@/components/IssueRdActivity.vue'
import { issueTypeCodeOf, RD_ACTIVITY_TYPE_CODES } from '@/utils/issue-view'
import FieldValueEditor from '@/components/FieldValueEditor.vue'
import RichTextField from '@/components/RichTextField.vue'
import WorkflowViewModal from '@/components/WorkflowViewModal.vue'
import IssueActionButtons from '@/components/IssueActionButtons.vue'
import IssueParentChild from '@/components/IssueParentChild.vue'
import IssueRelatedDocs from '@/components/IssueRelatedDocs.vue'

// ============================================================
// 子组件：MiniEmpty 小型空状态
// ============================================================
const MiniEmpty = {
  name: 'MiniEmpty',
  props: {
    text: { type: String, default: '暂无数据' },
  },
  setup(props: { text: string }) {
    return () => h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '24px 16px',
        color: '#8c8c8c',
        fontSize: '12px',
        background: 'linear-gradient(180deg, #fafbfc 0%, #fff 100%)',
        borderRadius: '6px',
        border: '1px dashed #e6e8eb',
      },
    }, [
      h(ExclamationCircleOutlined, { style: { fontSize: '14px', opacity: 0.6 } }),
      h('span', props.text),
    ])
  },
}

// ============================================================
// 子组件：UserAvatar 用户头像+名字
// ============================================================
const UserAvatar = {
  name: 'UserAvatar',
  props: {
    user: { type: null, default: null },
    size: { type: Number, default: 22 },
  },
  setup(props: { user: unknown; size?: number }) {
    const info = computed(() => {
      const v = props.user
      if (!v || typeof v !== 'object') return { name: '', id: '', firstLetter: '?', color: '#d9d9d9', textColor: '#595959' }
      const obj = v as Record<string, unknown>
      // 人员统一展示：头像 + realName（coAccount）
      const name = personLabel(obj)
      const idPart = ''
      const firstLetter = personInitial(obj)
      const avatar = personAvatar(obj)
      const palette = [
        { bg: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)', solid: '#1677ff' },
        { bg: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)', solid: '#52c41a' },
        { bg: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)', solid: '#fa8c16' },
        { bg: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)', solid: '#722ed1' },
        { bg: 'linear-gradient(135deg, #eb2f96 0%, #f759ab 100%)', solid: '#eb2f96' },
        { bg: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)', solid: '#13c2c2' },
        { bg: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)', solid: '#faad14' },
        { bg: 'linear-gradient(135deg, #2f54eb 0%, #597ef7 100%)', solid: '#2f54eb' },
      ]
      const item = name ? palette[name.charCodeAt(0) % palette.length] : palette[0]
      return {
        name: name || '—',
        id: idPart,
        firstLetter,
        avatar,
        bg: item.bg,
        solid: item.solid,
      }
    })
    const size = computed(() => props.size ?? 22)
    return () => {
      const { name, id, firstLetter, bg, avatar } = info.value
      const s = size.value
      const wrap = h('div', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          maxWidth: '100%',
        },
      }, [
        // 头像：有 avatarUrl 显示真实头像，否则渐变首字母
        avatar
          ? h('img', {
              src: avatar,
              style: {
                width: `${s}px`,
                height: `${s}px`,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.06)',
              },
            })
          : h('span', {
              style: {
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: `${s}px`,
                height: `${s}px`,
                borderRadius: '50%',
                background: bg,
                color: '#fff',
                fontSize: `${Math.max(10, Math.round(s * 0.5))}px`,
                fontWeight: 700,
                letterSpacing: '-0.2px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.06)',
                flexShrink: 0,
                userSelect: 'none',
              },
            }, firstLetter),
        // 名字 + 工号
        h('span', {
          style: {
            color: '#1f1f1f',
            fontSize: '13px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: '0 1 auto',
            minWidth: 0,
          },
        }, `${name}${id ? `（${id}）` : ''}`),
      ].filter(Boolean))
      return wrap
    }
  },
}

// ============================================================
// 子组件：ValueWithBadge 字段值 + 数字绿标
// ============================================================

// 枚举值头像取色板（无 iconUrl 时按名称/ID 稳定取色）
const ENUM_AVATAR_PALETTE = [
  'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
  'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
  'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)',
  'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
  'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)',
  'linear-gradient(135deg, #eb2f96 0%, #f759ab 100%)',
]
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const ValueWithBadge = {
  name: 'ValueWithBadge',
  props: {
    field: { type: Object as () => DetailField, required: true },
  },
  setup(props: { field: DetailField }) {
    const displayValue = computed(() => formatFieldValue(props.field))
    const badgeId = computed(() => {
      const v = props.field.value
      if (v == null) return ''
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>
        if (obj.id && typeof obj.id === 'number') return String(obj.id)
      }
      return ''
    })
    const shouldShowBadge = computed(() =>
      !!badgeId.value &&
      !!props.field.type &&
      props.field.type === FIELD_TYPE.SELECT_LIST_SINGLE &&
      /^\d{5,}$/.test(badgeId.value),
    )
    // 枚举值（下拉/级联等）带头像渲染：value 结构 { iconUrl, id, name } 或用户枚举 { avatarUrl/userAvatar, coAccount/userNo, ... }
    const enumMetas = computed(() => {
      const type = String(props.field.type ?? '')
      if (!type.startsWith('SELECT_LIST') && !type.startsWith('CASCADER') && !type.startsWith('RADIO')) return []
      const v = props.field.value
      if (v == null) return []
      const norm = (o: unknown): { name: string; avatar: string; id: string; color: string } | null => {
        if (o == null || typeof o !== 'object') return null
        const obj = o as Record<string, unknown>
        // 人员枚举：realName（coAccount）；其余取选项名
        const person = !obj.optionName && isPersonLike(obj)
        const name = person ? personLabel(obj) : String(obj.name ?? obj.optionName ?? '')
        if (!name) return null
        return {
          name,
          avatar: person ? personAvatar(obj) : String(obj.avatarUrl ?? obj.userAvatar ?? obj.iconUrl ?? ''),
          id: String(obj.id ?? obj.optionId ?? obj.userNo ?? ''),
          color: typeof obj.color === 'string' ? obj.color : '',
        }
      }
      const arr = Array.isArray(v) ? v.map(norm) : [norm(v)]
      return arr.filter((x): x is NonNullable<typeof x> => !!x)
    })
    return () => {
      const txt = displayValue.value
      const textSpan = h('span', {
        style: {
          color: '#1f1f1f',
          fontSize: '13px',
          lineHeight: '22px',
          wordBreak: 'break-word',
        },
      }, txt)
      const badgeSpan = shouldShowBadge.value
        ? h('span', {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 7px',
              height: '18px',
              lineHeight: '18px',
              background: 'linear-gradient(135deg, #f6ffed 0%, #eafce0 100%)',
              color: '#389e0d',
              border: '1px solid #b7eb8f',
              borderRadius: '10px',
              fontSize: '10.5px',
              fontWeight: 600,
              fontFamily: "'SF Mono', Menlo, Consolas, monospace",
              letterSpacing: '0.2px',
              boxShadow: 'inset 0 -1px 0 rgba(0, 0, 0, 0.02)',
            },
          }, badgeId.value)
        : null
      const avatarSpans = enumMetas.value.map((m, idx) => {
        const letter = (m.name || '?').trim().charAt(0).toUpperCase()
        const bg = m.color || ENUM_AVATAR_PALETTE[hashStr(m.id || m.name) % ENUM_AVATAR_PALETTE.length]
        return h('span', {
          key: idx,
          style: {
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 600,
            color: '#fff',
            flex: '0 0 auto',
            background: m.avatar ? `url("${m.avatar}") center / cover no-repeat` : bg,
          },
        }, m.avatar ? undefined : letter)
      })
      const rowStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        maxWidth: '100%',
        flexWrap: 'wrap',
      }
      if (!avatarSpans.length) {
        return badgeSpan ? h('div', { style: rowStyle }, [textSpan, badgeSpan]) : textSpan
      }
      return h('div', { style: rowStyle }, [...avatarSpans, textSpan, ...(badgeSpan ? [badgeSpan] : [])])
    }
  },
}

const props = defineProps<{
  open: boolean
  issueKey: string
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  /** 操作按钮执行后事项已变化（流转 / 编辑保存），列表需刷新 */
  (e: 'changed'): void
}>()

const loading = ref(false)
const detailData = ref<DetailData | null>(null)
const activeTab = ref<string>('')
const teamCollapseKeys = ref<string[]>(['team'])
const descCollapseKeys = ref<string[]>(['desc'])
const userCollapseKeys = ref<string[]>(['user'])
const rdCollapseKeys = ref<string[]>(['rd'])
const okrCollapseKeys = ref<string[]>([])
const timeCollapseKeys = ref<string[]>(['time'])
const supplementCollapseKeys = ref<string[]>(['supplement'])
const docCollapseKeys = ref<string[]>(['doc'])
const relationCollapseKeys = ref<string[]>(['relation'])
const attachmentCollapseKeys = ref<string[]>(['attachment'])
const parentCollapseKeys = ref<string[]>(['parent'])
const childCollapseKeys = ref<string[]>([])
const siblingCollapseKeys = ref<string[]>([])
const dependencyCollapseKeys = ref<string[]>([])
const activityCollapseKeys = ref<string[]>(['activity'])
const onlyShowValued = ref(true)
/** 活动日志：该事项的变更记录（创建、字段修改、状态流转），按时间倒序 */
const changeLogs = ref<IssueChangeLog[]>([])
const changeLogsLoading = ref(false)
/** 变更记录前端分页：接口一次返回该事项全部记录，按时间倒序，每页 10 条 */
const CHANGE_LOG_PAGE_SIZE = 10
const changeLogPage = ref(1)
const pagedChangeLogs = computed(() =>
  changeLogs.value.slice((changeLogPage.value - 1) * CHANGE_LOG_PAGE_SIZE, changeLogPage.value * CHANGE_LOG_PAGE_SIZE))
/** 评论：抽屉关闭后组件不销毁，重新打开同一事项时需手动刷新 */
const issueCommentsRef = ref<InstanceType<typeof IssueComments> | null>(null)

async function fetchChangeLogs() {
  if (!props.issueKey) return
  changeLogsLoading.value = true
  try {
    const res = await queryChangeLogs({ key: props.issueKey })
    changeLogs.value = res?.success && Array.isArray(res.data) ? res.data : []
    changeLogPage.value = 1
  } catch {
    // 静默失败，保持已有记录
  } finally {
    changeLogsLoading.value = false
  }
}

function formatChangeTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : ''
}

// ======================= 描述区富文本组件（WangEditor 可编辑） =======================
const richTextModels = reactive<Record<string, string>>({})
const richEditorInstances = reactive<Record<string, IDomEditor | null>>({})
const richEditorVersion = ref(0)
const richSaving = reactive<Record<string, boolean>>({})
/** 编辑器初始内容基线：判断是否有改动，避免回退取值时一失焦就误保存 */
const richTextBaseline = reactive<Record<string, string>>({})

const richToolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: [
    'headerSelect',
    'blockquote',
    '|',
    'bold',
    'underline',
    'italic',
    'through',
    'code',
    '|',
    'color',
    'bgColor',
    '|',
    'bulletedList',
    'numberedList',
    '|',
    'insertLink',
    'insertImage',
    '|',
    'undo',
    'redo',
  ],
}

const richEditorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入描述…',
  scroll: false,
  MENU_CONF: {},
}

function handleRichEditorCreated(fieldId: string, editor: IDomEditor) {
  // 防止同字段残留旧实例（正常流程下 key 重建已销毁，此处兜底）
  const prev = richEditorInstances[fieldId]
  if (prev && prev !== editor) {
    prev.destroy()
  }
  richEditorInstances[fieldId] = editor
}

// ---------- 描述编辑态：默认只读，点击编辑进入，保存 / 取消退出 ----------
const richEditing = reactive<Record<string, boolean>>({})

function startRichEdit(fieldId: string) {
  richEditing[fieldId] = true
}

/** 退出编辑：先销毁编辑器实例，再卸载编辑器 DOM */
function stopRichEdit(fieldId: string) {
  const inst = richEditorInstances[fieldId]
  if (inst) inst.destroy()
  richEditorInstances[fieldId] = null
  richEditing[fieldId] = false
}

/** 取消：内容恢复为上次保存的值 */
function cancelRichEdit(fieldId: string) {
  richTextModels[fieldId] = richTextBaseline[fieldId] ?? ''
  stopRichEdit(fieldId)
}

/** 富文本是否有实际内容（空段落 / 纯空白视为无内容，图片算有内容） */
function hasRichContent(html?: string): boolean {
  if (!html) return false
  if (/<img\b/i.test(html)) return true
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== ''
}

/** 保存描述富文本：有改动才调用 patchIssue，保存成功或无改动时退出编辑 */
async function saveRichText(fieldId: string) {
  if (richSaving[fieldId]) return
  const html = (richTextModels[fieldId] ?? '').trim()
  const f = descriptionFields.value.find((x) => x.id === fieldId)
  if (!f || !f.editable) return
  if (html === (richTextBaseline[fieldId] ?? '').trim()) return stopRichEdit(fieldId)
  richSaving[fieldId] = true
  try {
    const res = await patchIssue(props.issueKey, [{ fieldId, fieldValue: html }])
    if (res?.success) {
      f.value = html
      f.exportValue = html
      richTextBaseline[fieldId] = html
      stopRichEdit(fieldId)
      message.success('描述已保存')
    }
  } catch {
    // 保存失败静默处理
  } finally {
    richSaving[fieldId] = false
  }
}

// 监听 detailData 变化：把 description 的富文本字符串塞进 richTextModels，
// 版本号变化会强制重建 Editor，保证以最新内容初始化
watch(
  () => detailData.value,
  (d) => {
    for (const k of Object.keys(richTextModels)) {
      delete richTextModels[k]
      delete richTextBaseline[k]
      delete richEditing[k]
    }
    destroyAllRichEditors()
    if (!d) return
    const g = (d.layoutGroup ?? []).find((x) => x && x.type === 'DESCRIPTION')
    if (!g) return
    const list = flattenGroupFields(g.fieldGroupStructure)
    // DESCRIPTION 组自身无值时，回退取其他分组里同名「描述」字段的值
    const fallback = findDescriptionValueElsewhere(d.layoutGroup ?? [])
    list.forEach((f) => {
      const html = formatRichText(isBlankValue(f.value) ? fallback : f.value)
      richTextModels[f.id] = html
      richTextBaseline[f.id] = html
    })
    richEditorVersion.value++
  },
  { immediate: true },
)

/** 销毁全部富文本编辑器实例，并清空实例缓存 */
function destroyAllRichEditors() {
  for (const k of Object.keys(richEditorInstances)) {
    const inst = richEditorInstances[k]
    if (inst) {
      inst.destroy()
    }
    richEditorInstances[k] = null
  }
}

// 组件卸载时兜底销毁，避免编辑器/工具栏泄漏导致重复创建报错
onBeforeUnmount(destroyAllRichEditors)

// 抽屉宽度 = 视口宽度的 60%（用 vw 单位随视口自适应），最小 860px，窄屏时抽屉内横向滚动
const drawerWidth = ref('max(60vw, 860px)')

// ======================= helpers to get specific known fields =======================

// 过滤数组中的空元素（接口偶发返回 null 项，渲染前兜底）
function notNull<T>(v: T | null | undefined): v is T {
  return v != null
}

// 将 fieldGroupStructure 拍平为字段列表（兼容 COMMON_LIST 与 TAB_CONTAINER）
function flattenGroupFields(s: {
  type: string
  data: DetailField[] | { tabItems: Array<{ title: string; sequence: number; issueFields: DetailField[] }> }
} | null | undefined): DetailField[] {
  if (!s) return []
  if (s.type === 'COMMON_LIST') return ((s.data as DetailField[]) ?? []).filter(notNull)
  if (s.type === 'TAB_CONTAINER') {
    const d = s.data as { tabItems: Array<{ title: string; sequence: number; issueFields: DetailField[] }> }
    const list: DetailField[] = []
    if (!d) return list
    d.tabItems?.forEach((t) => (t.issueFields ?? []).forEach((f) => f && list.push(f)))
    return list
  }
  return []
}

const allSummaryFields = computed<DetailField[]>(() => {
  if (!detailData.value) return []
  const g = (detailData.value.layoutGroup ?? []).find((x) => x && x.type === 'SUBJECT')
  if (!g) return []
  return flattenGroupFields(g.fieldGroupStructure)
})

function findField(id: string): DetailField | undefined {
  return allSummaryFields.value.find((f) => f.id === id)
}

const heroSummary = computed<string>(() => {
  const f = findField('summary')
  if (!f) return ''
  // 用 || 而非 ??：exportValue 可能是空字符串 ''，此时应回退到 value
  const raw = f.exportValue || f.value
  return raw === null || raw === undefined ? '' : String(raw)
})

// ======================= 概要（summary）可编辑 =======================

const summaryField = computed<DetailField | undefined>(() => findField('summary'))
const editingSummary = ref(false)
const summaryDraft = ref('')
const summaryInputRef = ref<{ focus: () => void } | null>(null)

function startEditSummary() {
  if (!summaryField.value?.editable) return
  summaryDraft.value = heroSummary.value
  editingSummary.value = true
  nextTick(() => summaryInputRef.value?.focus?.())
}

async function saveSummary() {
  if (!editingSummary.value) return
  editingSummary.value = false
  const f = summaryField.value
  if (!f) return
  const val = (summaryDraft.value ?? '').trim()
  if (val === heroSummary.value) return
  try {
    const res = await patchIssue(props.issueKey, [{ fieldId: 'summary', fieldValue: val }])
    if (res?.success) {
      // 本地同步，无需重新拉取详情
      f.value = val
      f.exportValue = val
    }
  } catch {
    // 保存失败静默处理
  }
}

/** 复制事项链接（域名/jira/browse/{issueKey}）到剪贴板 */
async function copyIssueLink() {
  const key = props.issueKey
  if (!key) return
  const link = `${window.location.origin}/jira/browse/${key}`
  try {
    await navigator.clipboard.writeText(link)
    message.success('链接已复制')
  } catch {}
}

const router = useRouter()
/** 打开事项链接：浏览器新开页面；客户端新增页签（先关抽屉，避免遮住新页签内容） */
function openIssueInNew() {
  const key = props.issueKey
  if (!key) return
  if (isDesktop) handleClose()
  openIssueLink(key, router)
}

// ======================= 字段内联编辑 =======================
/** 当前处于编辑态的字段 id（同一时间只编辑一个字段） */
const editingFieldId = ref<string | null>(null)

/** 字段是否可编辑：editable 为 true 且非富文本（描述有独立编辑器） */
/** 富文本字段（type = RICH_TEXT）：用 RichTextField 渲染 HTML / 编辑，与「描述」一致 */
function isRichText(f: DetailField): boolean {
  return String(f?.type ?? '') === 'RICH_TEXT'
}

function canEditField(f: DetailField): boolean {
  if (!f) return false
  return !!f.editable && String(f.type ?? '') !== 'RICH_TEXT'
}

/** 字段保存成功后：退出编辑态并重新拉取接口数据 */
async function onFieldSaved(f: DetailField, payload: { value: unknown; exportValue: unknown }) {
  f.value = payload.value
  f.exportValue = payload.exportValue
  editingFieldId.value = null
  await refreshDetail()
}

/** 操作按钮执行后：刷新详情并通知外层列表 */
function handleButtonsChanged() {
  refreshDetail()
  emit('changed')
}

/** 轻量刷新：重新请求详情数据，不重置折叠面板/标签页状态 */
async function refreshDetail() {
  try {
    const res = await queryDetail({ key: props.issueKey })
    if (res?.success && res.data) {
      detailData.value = res.data
    }
  } catch {
    // 静默失败，保持已有数据
  }
  fetchChangeLogs()
}

const projectLabel = computed<string>(() => {
  // 顶部优先取 baseInfo 的空间名；没有时回退 SUBJECT 组里的 space / project 字段
  const name = detailData.value?.baseInfo?.spaceName
  if (name) return String(name)
  const f = findField('space') ?? findField('project')
  if (!f?.value) return ''
  const v = f.value as Record<string, unknown>
  return String(v.spaceName ?? v.name ?? v.key ?? v.spaceCode ?? '')
})

// status
const statusField = computed(() => findField('status'))
const statusValue = computed(() => statusField.value?.value)
const statusLabel = computed(() => {
  const v = statusValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).name ?? '')
  }
  return ''
})
/** 状态色：取后端下发的 statusColor（十六进制），无效值时回落默认蓝 */
const statusHexColor = computed(() => {
  const v = statusValue.value
  if (typeof v === 'object' && v !== null) {
    const c = (v as Record<string, unknown>).statusColor
    if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) return c
  }
  return ''
})
/** 状态标签颜色：a-tag color 直接吃十六进制，无有效值时用预设灰 */
const statusTagColor = computed(() => statusHexColor.value || 'default')
/** 状态圆点颜色（实际 CSS 色值） */
const statusDotColor = computed(() => statusHexColor.value || '#1677ff')

// priority
const priorityField = computed(() => findField('priority'))
const priorityValue = computed(() => priorityField.value?.value)
const priorityLabel = computed(() => {
  const v = priorityValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).pname ?? (v as Record<string, unknown>).name ?? '')
  }
  return ''
})
const priorityStatusColor = computed(() => {
  const v = priorityValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).statusColor ?? '')
  }
  return ''
})
const priorityColorHex = computed(() => {
  const c = priorityStatusColor.value
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c
  const map: Record<string, string> = { red: '#cf1322', orange: '#d46b08', yellow: '#d48806' }
  return map[c] ?? '#595959'
})

// issue type
const issueTypeField = computed(() => findField('issuetype'))
const issueTypeValue = computed(() => issueTypeField.value?.value)
/** 定制：问题类型为 TYPE10001 时在补充信息上方展示「研发活动」 */
const showRdActivity = computed(() => RD_ACTIVITY_TYPE_CODES.has(issueTypeCodeOf(issueTypeValue.value)))
/** 问题类型图标与颜色（接口 issuetype 值带 iconUri / issueTypeColor）：顶部图标、属性卡共用 */
const DEFAULT_TYPE_COLOR = '#8c8c8c'
const issueTypeIcon = computed(() => {
  const v = issueTypeValue.value
  return issueTypeIconOf(typeof v === 'object' && v !== null ? ((v as Record<string, unknown>).iconUri as string | null) : null)
})
const issueTypeColor = computed(() => {
  const v = issueTypeValue.value
  const c = typeof v === 'object' && v !== null ? (v as Record<string, unknown>).issueTypeColor : null
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : ''
})
/** 顶部图标底色：有类型颜色用类型颜色，否则保持主题色渐变 */
const issueTypeIconStyle = computed(() => (issueTypeColor.value
  ? { background: issueTypeColor.value, boxShadow: `0 2px 8px color-mix(in srgb, ${issueTypeColor.value} 28%, transparent)` }
  : undefined))
const issueTypeLabel = computed(() => {
  const v = issueTypeValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).name ?? '')
  }
  return ''
})

/** 状态字段右侧「工作流」：弹窗展示当前问题类型的完整工作流 */
const workflowViewOpen = ref(false)

// ======================= Summary / Custom / User 分组 =======================

// 已在其他位置展示的字段：概要在标题区，状态 / 优先级 / 问题类型有专门样式，所属空间（space / project）在顶部面包屑
const SUMMARY_EXCLUDED_IDS = new Set(['summary', 'status', 'priority', 'issuetype', 'project', 'space'])

function isUserField(f: DetailField): boolean {
  if (!f) return false
  const t = f.type || ''
  if (t === FIELD_TYPE.SELECT_USER_SINGLE || t === FIELD_TYPE.SELECT_USER_MULTI) return true
  if (f.id === 'assignee' || f.id === 'reporter' || f.id === 'creator' || f.id === 'updater') return true
  return false
}

/** DESCRIPTION 分组中的字段 id：只在描述区展示，其他区域（主信息 / 自定义字段）统一排除 */
const descriptionFieldIds = computed<Set<string>>(() => new Set(descriptionFields.value.map((f) => f.id)))

function notDescriptionField(f: DetailField | null | undefined): f is DetailField {
  if (!f || descriptionFieldIds.value.has(f.id)) return false
  // 有描述区时，同名「描述」字段不在其他区域重复展示（值已回填到描述区）
  return !(descriptionFieldIds.value.size > 0 && isDescriptionLike(f))
}

/** 是否为「描述」字段（DESCRIPTION 组外可能以自定义字段形式重复下发，按 id / 名称识别） */
function isDescriptionLike(f: DetailField): boolean {
  return f.id === 'description' || String(f.name ?? '').trim() === '描述'
}

function isBlankValue(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.trim() === '')
}

/** 在 DESCRIPTION 以外的分组中查找「描述」字段的值（优先 exportValue） */
function findDescriptionValueElsewhere(groups: DetailLayoutGroup[]): unknown {
  for (const g of groups) {
    if (!g || g.type === 'DESCRIPTION') continue
    for (const f of flattenGroupFields(g.fieldGroupStructure)) {
      if (!isDescriptionLike(f)) continue
      const v = isBlankValue(f.exportValue) ? f.value : f.exportValue
      if (!isBlankValue(v)) return v
    }
  }
  return null
}

const rawSummaryGrid = computed<DetailField[]>(() =>
  allSummaryFields.value.filter((f) => notDescriptionField(f) && !SUMMARY_EXCLUDED_IDS.has(f.id) && !isUserField(f)),
)

interface CustomFieldGroup {
  structureType: string
  tabItems: Array<{ title: string; sequence: number; issueFields: DetailField[] }>
  fields: DetailField[]
}

function mapTabTitle(title: string): string {
  if (title === '必填') return '团队自定义信息'
  if (title === '选填') return '公司标准信息'
  return title
}

const customFieldGroups = computed<CustomFieldGroup[]>(() => {
  if (!detailData.value) return []
  const groups: CustomFieldGroup[] = []
  for (const g of (detailData.value.layoutGroup ?? [])) {
    if (!g) continue
    if (g.type !== 'CUSTOM_FIELD') continue
    const s = g.fieldGroupStructure
    if (!s) continue
    if (s.type === 'TAB_CONTAINER') {
      const d = s.data as { tabItems: Array<{ title: string; sequence: number; issueFields: DetailField[] }> }
      if (d?.tabItems && d.tabItems.length > 0) {
        groups.push({
          structureType: 'TAB_CONTAINER',
          tabItems: d.tabItems
            .filter((t) => t.title !== 'C端专用字段')
            .map((t) => ({ ...t, title: mapTabTitle(t.title), issueFields: (t.issueFields ?? []).filter(notDescriptionField) })),
          fields: [],
        })
      }
    } else if (s.type === 'COMMON_LIST') {
      groups.push({ structureType: 'COMMON_LIST', tabItems: [], fields: ((s.data as DetailField[]) ?? []).filter(notDescriptionField) })
    }
  }
  return groups
})

const customFieldTabGroup = computed<CustomFieldGroup | null>(() =>
  customFieldGroups.value.find((g) => g.structureType === 'TAB_CONTAINER') ?? null,
)

const customFieldPlain = computed<CustomFieldGroup | null>(() =>
  customFieldGroups.value.find((g) => g.structureType === 'COMMON_LIST') ?? null,
)

const descriptionFields = computed<DetailField[]>(() => {
  if (!detailData.value) return []
  const g = (detailData.value.layoutGroup ?? []).find((x) => x && x.type === 'DESCRIPTION')
  if (!g) return []
  return flattenGroupFields(g.fieldGroupStructure)
})

// 人员字段：优先取独立的 PERSON 组（创建人/更新人），兼容旧结构回退 summary 过滤；再补充自定义字段中的用户字段
const allUserFields = computed<DetailField[]>(() => {
  const fromPerson: DetailField[] = []
  const fromSummary: DetailField[] = []
  if (detailData.value) {
    const personGroup = (detailData.value.layoutGroup ?? []).find((x) => x && x.type === 'PERSON')
    if (personGroup) fromPerson.push(...flattenGroupFields(personGroup.fieldGroupStructure).filter(isUserField))
    else fromSummary.push(...allSummaryFields.value.filter(isUserField))
  }
  const fromCustom: DetailField[] = []
  customFieldGroups.value.forEach((g) => {
    g.tabItems?.forEach((t) => (t.issueFields ?? []).forEach((f) => f && isUserField(f) && fromCustom.push(f)))
    g.fields?.forEach((f) => f && isUserField(f) && fromCustom.push(f))
  })
  return [...fromPerson, ...fromSummary, ...fromCustom]
})

const filteredUserFields = computed(() => {
  return onlyShowValued.value ? allUserFields.value.filter(hasValue) : allUserFields.value
})

// 时间信息字段：取 TIME 组（计划开始/完成日期等）
const allTimeFields = computed<DetailField[]>(() => {
  if (!detailData.value) return []
  const g = (detailData.value.layoutGroup ?? []).find((x) => x && x.type === 'TIME')
  if (!g) return []
  return flattenGroupFields(g.fieldGroupStructure)
})

const filteredTimeFields = computed(() => {
  return onlyShowValued.value ? allTimeFields.value.filter(hasValue) : allTimeFields.value
})

// 补充信息字段：取 SUPPLEMENT 组（字段分组选「补充信息」的字段）
const allSupplementFields = computed<DetailField[]>(() => {
  if (!detailData.value) return []
  const g = (detailData.value.layoutGroup ?? []).find((x) => x && x.type === 'SUPPLEMENT')
  if (!g) return []
  return flattenGroupFields(g.fieldGroupStructure)
})

const filteredSupplementFields = computed(() => {
  return onlyShowValued.value ? allSupplementFields.value.filter(hasValue) : allSupplementFields.value
})

// 仅展示有值字段过滤
function hasValue(f: DetailField): boolean {
  if (!f) return false
  const v = f.value
  if (v === null || v === undefined) return false
  if (typeof v === 'string' && v.trim() === '') return false
  if (Array.isArray(v) && v.length === 0) return false
  if (typeof v === 'object' && v !== null) {
    const keys = Object.keys(v)
    if (keys.length === 0) return false
  }
  return true
}

function filteredFields(fields: DetailField[] | null | undefined): DetailField[] {
  const userFiltered = (fields ?? []).filter((f) => f && !isUserField(f))
  return onlyShowValued.value ? userFiltered.filter(hasValue) : userFiltered
}

const filteredSummaryGrid = computed(() => filteredFields(rawSummaryGrid.value))

const hasSummaryPanel = computed(() => {
  if (customFieldTabGroup.value) return true
  if (customFieldPlain.value && filteredFields(customFieldPlain.value.fields).length > 0) return true
  return !onlyShowValued.value
})

// ======================= lifecycle =======================

watch(
  () => props.open,
  (val) => {
    if (val && props.issueKey) {
      fetchDetail()
    }
  },
)

async function fetchDetail() {
  loading.value = true
  detailData.value = null
  activeTab.value = ''
  // 恢复折叠板默认展开状态
  teamCollapseKeys.value = ['team']
  descCollapseKeys.value = ['desc']
  userCollapseKeys.value = ['user']
  rdCollapseKeys.value = ['rd']
  okrCollapseKeys.value = []
  timeCollapseKeys.value = ['time']
  supplementCollapseKeys.value = ['supplement']
  attachmentCollapseKeys.value = ['attachment']
  parentCollapseKeys.value = ['parent']
  childCollapseKeys.value = []
  siblingCollapseKeys.value = []
  dependencyCollapseKeys.value = []
  activityCollapseKeys.value = ['activity']
  changeLogs.value = []
  fetchChangeLogs()
  issueCommentsRef.value?.reload()
  try {
    const res = await queryDetail({ key: props.issueKey })
    if (res?.success && res.data) {
      detailData.value = res.data
      if (customFieldTabGroup.value && customFieldTabGroup.value.tabItems.length > 0) {
        activeTab.value = customFieldTabGroup.value.tabItems[0].title
      }
    }
  } catch {
    detailData.value = null
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:open', false)
}

// ======================= value formatting =======================

function formatFieldValue(field: DetailField): string {
  const { value } = field
  const type = String(field.type ?? '')
  if (!hasValue(field)) return '—'
  switch (type) {
    case FIELD_TYPE.TEXT_BOX_SINGLE_LINE:
    case FIELD_TYPE.TEXT_BOX_NUMBER:
    case FIELD_TYPE.LABEL:
      return String(value)
    case FIELD_TYPE.DATE_PICKER:
    case FIELD_TYPE.TIME_PICKER: {
      const fmt = type === FIELD_TYPE.TIME_PICKER ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
      // 字符串也可能是 ISO 时间串，统一走 dayjs 格式化
      if (typeof value === 'string') {
        try {
          return dayjs(value).format(fmt)
        } catch {
          return value
        }
      }
      if (value && typeof (value as { format?: unknown }).format === 'function') {
        return (value as { format: (fmt: string) => string }).format(fmt)
      }
      try {
        return dayjs(value as string | number).format(fmt)
      } catch {
        return String(value)
      }
    }
    case FIELD_TYPE.SELECT_LIST_SINGLE:
    case FIELD_TYPE.CASCADER_SINGLE:
      return formatObject(value)
    case FIELD_TYPE.SELECT_USER_SINGLE:
    case FIELD_TYPE.SELECT_USER_MULTI:
      return formatUser(value)
    case FIELD_TYPE.SELECT_LIST_MULTI: {
      if (Array.isArray(value)) {
        return (value as unknown[]).map(v => formatObject(v)).filter(Boolean).join('、')
      }
      return formatObject(value)
    }
    case 'RICH_TEXT':
      return stripHtml(value)
    default:
      if (typeof value === 'string') return value
      return formatObject(value)
  }
}

function formatObject(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v || '—'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if (obj.optionName) return String(obj.optionName)
    if (isPersonLike(obj)) return personLabel(obj) || '—'
    if (obj.pname) return String(obj.pname)
    if (obj.key && obj.name) return `${obj.key} - ${obj.name}`
    if (obj.name) return String(obj.name)
    if (obj.label) return String(obj.label)
  }
  return '—'
}

function formatUser(v: unknown): string {
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>
    const s = personLabel(obj)
    if (s) return s
  }
  return '—'
}

function stripHtml(v: unknown): string {
  if (typeof v !== 'string') return v == null ? '—' : String(v)
  return v.replace(/<[^>]*>/g, '').trim() || '—'
}

function formatRichText(v: unknown): string {
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return ''
    if (!s.includes('<')) {
      return `<p style="margin:0">${s.replace(/\n/g, '<br/>')}</p>`
    }
    return s
  }
  if (v == null) return ''
  return String(v)
}
</script>

<style scoped>
/* ============ Root ============ */
.drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #f5f7fa;
}

/* ============ Loading Skeleton ============ */
.detail-skeleton {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  background: #ffffff;
}
.top-bar-skeleton {
  padding: 16px 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
}
.top-bar-skeleton .top-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ============ Empty ============ */
.detail-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 14px;
  flex: 1;
  padding: 0 40px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 0%, var(--c-primary-bg) 0%, transparent 60%),
    #ffffff;
}
.empty-illustration {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-primary-bg) 0%, #f9f0ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  font-size: 40px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px color-mix(in srgb, var(--c-primary) 8%, transparent);
}
.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}
.empty-desc {
  font-size: 12px;
  color: #8c8c8c;
}

/* ============ Body ============ */
.detail-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: #f5f7fa;
}

/* ============ Top bar（单号区域，白色） ============ */
.top-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  height: 48px;
  flex-shrink: 0;
  background: #ffffff;
  border-bottom: 1px solid #e6e8ec;
}
.top-bar::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--c-primary) 50%, transparent 100%);
  opacity: 0.12;
  pointer-events: none;
}
.top-bar-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  max-width: 65%;
}
.tb-crumb-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-hover) 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  box-shadow: 0 2px 6px transparent;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--c-primary) 25%, transparent);
  flex-shrink: 0;
}
.tb-project {
  color: #262626;
  font-weight: 600;
  font-size: 13px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb-divider { color: #bfbfbf; margin: 0 2px; font-weight: 300; }
.tb-key {
  color: #1a1a1a;
  font-weight: 700;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 2px 8px;
  background: #ffffff;
  border-radius: 10px;
}
.tb-inline-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 6px;
}

.top-bar-right {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.tb-icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #595959;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(.4,0,.2,1);
  font-size: 13px;
}
.tb-icon-btn:hover {
  background: #ffffff;
  color: var(--c-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.tb-vdiv {
  width: 1px;
  height: 16px;
  background: #e0e0e0;
  margin: 0 4px;
}
.tb-close:hover {
  background: #fff1f0 !important;
  color: #ff4d4f !important;
}

/* ============ Title 区 ============ */
.title-section {
  position: relative;
  padding: 20px 26px 14px;
  flex-shrink: 0;
  background: #ffffff;
  overflow: hidden;
}
.title-section::before {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 240px; height: 100%;
  background: radial-gradient(ellipse at right top, transparent, transparent 60%);
  background: radial-gradient(ellipse at right top, color-mix(in srgb, var(--c-primary) 5%, transparent), transparent 60%);
  pointer-events: none;
}
.title-accent {
  width: 3px;
  height: 20px;
  background: linear-gradient(180deg, var(--c-primary) 0%, #9254de 100%);
  border-radius: 2px;
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
}
.issue-title {
  position: relative;
  margin: 0 0 0 6px;
  font-size: 22px;
  line-height: 1.35;
  color: #1a1a1a;
  font-weight: 700;
  word-break: break-word;
  letter-spacing: -0.2px;
  padding-right: 8px;
  cursor: text;
  border-radius: 4px;
  transition: box-shadow 0.2s, background 0.2s;
}
.issue-title:hover {
  background: transparent;
  background: color-mix(in srgb, var(--c-primary) 6%, transparent);
  box-shadow: inset 0 0 0 1px transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-primary) 25%, transparent);
}
.summary-empty-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 6px;
  padding: 6px 10px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: text;
  transition: border-color 0.2s, background 0.2s;
}
.summary-empty-wrap:hover {
  border-color: var(--c-primary);
  background: transparent;
  background: color-mix(in srgb, var(--c-primary) 4%, transparent);
}
.summary-label {
  flex-shrink: 0;
  font-size: 13px;
  color: #8c8c8c;
}
.summary-empty-tip {
  font-size: 14px;
  color: #bfbfbf;
}
.summary-edit-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 6px;
}
.summary-input {
  flex: 1;
  max-width: 420px;
}

/* ============ 属性卡（5 列一行） ============ */
.attr-card {
  padding: 12px 26px 14px;
  flex-shrink: 0;
  background:
    linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}
.attr-row-line {
  display: grid;
  /* 字段数量由接口决定：按宽度自动换行 */
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px 14px;
  align-items: stretch;
}
.attr-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.attr-label {
  font-size: 13px;
  color: #8c8c8c;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}
.attr-value-block {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
}
.attr-value {
  font-size: 15px;
  color: #1a1a1a;
  font-weight: 600;
}
.attr-empty {
  color: #bfbfbf;
  font-size: 13px;
  font-style: italic;
}
.attr-wf-link {
  margin-left: 8px;
  font-size: 12px;
  color: #722ed1;
  white-space: nowrap;
  cursor: pointer;
}
.attr-wf-link:hover {
  color: #9254de;
  text-decoration: underline;
}
.attr-type-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  color: #fff;
  border-radius: 5px;
}
.attr-check {
  color: #52c41a;
  font-size: 14px;
  filter: drop-shadow(0 1px 1px rgba(82, 196, 26, 0.2));
}
.attr-tag {
  display: inline-flex !important;
  align-items: center;
  gap: 5px;
  padding: 2px 10px !important;
  height: 22px !important;
  line-height: 18px !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  border-radius: 11px !important;
  margin: 0 !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  min-width: 0;
  flex-shrink: 1;
}
.attr-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
}
/* Priority 圆点 + 文字（只改文字颜色） */
.priority-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}
.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ============ Action bar ============ */
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 26px 12px;
  background: #ffffff;
  flex-shrink: 0;
  gap: 10px;
}
.action-bar-left {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.action-btn {
  height: 32px !important;
  padding: 0 14px !important;
  font-size: 14px !important;
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  border-radius: 6px !important;
  border: none !important;
  background: #f5f5f5 !important;
  font-weight: 500;
  transition: all 0.18s cubic-bezier(.4,0,.2,1) !important;
}
.action-btn:hover {
  transform: translateY(-1px);
}
.action-caret {
  font-size: 10px;
  margin-left: 2px;
  opacity: 0.6;
}
.action-menu :deep(.ant-menu-item) {
  display: flex !important;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 8px 16px !important;
  min-width: 140px;
}
.action-menu :deep(.ant-menu-item .anticon) {
  font-size: 14px;
  color: #595959;
}
.action-divider {
  width: 1px;
  height: 16px;
  background: #e8e8e8;
  margin: 0 6px;
}
.action-primary {
  height: 28px !important;
  font-weight: 600 !important;
  background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-hover) 100%) !important;
  box-shadow: 0 2px 6px transparent !important;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--c-primary) 28%, transparent) !important;
  border-color: transparent !important;
}
.action-primary:hover {
  box-shadow: 0 3px 10px transparent !important;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--c-primary) 38%, transparent) !important;
}
.action-groupchat {
  height: 28px !important;
  margin-left: 4px;
  background: linear-gradient(135deg, var(--c-primary-bg) 0%, #f0e6ff 100%) !important;
  color: var(--c-primary) !important;
  border-color: transparent !important;
  border-color: color-mix(in srgb, var(--c-primary) 20%, transparent) !important;
  font-weight: 500 !important;
}

.action-bar-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.switch-label {
  font-size: 12px;
  color: #595959;
  user-select: none;
}

/* ============ Scroll area（已并入 detail-body 滚动容器，这里只是内边距容器） ============ */
/* 内容不多时也撑满抽屉高度：滚动区占满剩余空间，最后一块（活动日志）向下拉伸到底，不留灰色空白 */
.detail-scroll {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}
.scroll-inner {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 0;
  max-width: 100%;
}
.scroll-inner > .panel-collapse-last {
  flex: 1 0 auto;
}

/* ============ 通用折叠板（描述 / 人员 / 研发 / OKR / 团队管理） ============ */
.panel-collapse {
  background: #ffffff;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: none;
  margin-left: -20px;
  margin-right: -20px;
  padding: 0;
  width: calc(100% + 40px);
  transition: all 0.2s cubic-bezier(.4,0,.2,1);
}
.panel-collapse:hover {
  box-shadow: none;
  transform: none;
}
.panel-collapse :deep(.ant-collapse-header) {
  padding: 14px 20px !important;
  align-items: center !important;
}
.panel-collapse :deep(.ant-collapse-content-box) {
  padding: 0 20px 18px !important;
}
/* ============ 折叠箭头实心三角（与详情页箭头样式保持一致） ============ */
.panel-collapse :deep(.ant-collapse-arrow) {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 16px !important;
  height: 16px !important;
  margin-right: 2px !important;
  transition: transform 0.2s ease !important;
  color: #8c8c8c !important;
  font-size: 12px !important;
  position: relative;
}
.panel-collapse :deep(.ant-collapse-arrow svg) {
  display: none !important;
}
.panel-collapse :deep(.ant-collapse-arrow::before) {
  content: '';
  display: inline-block;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid #8c8c8c;
  margin-left: 2px;
}
.panel-collapse :deep(.ant-collapse-item-active .ant-collapse-arrow) {
  transform: rotate(90deg) !important;
}
.panel-collapse-last {
  border-bottom: none;
}
.panel-collapse.team-collapse {
  margin-top: -16px;
}

.collapse-header-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  flex: 1;
}
.collapse-header-inner .pch-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}
.collapse-header-with-actions {
  justify-content: space-between;
}
.collapse-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.collapse-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ============ Panel card 面板卡片 ============ */
.panel-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e9ecf0;
  margin-bottom: 14px;
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    0 2px 8px rgba(0, 0, 0, 0.025);
  transition:
    box-shadow 0.2s cubic-bezier(.4,0,.2,1),
    transform 0.2s cubic-bezier(.4,0,.2,1),
    border-color 0.2s;
}
.panel-card:hover {
  border-color: #d9e0e8;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.03),
    0 8px 24px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}
.panel-card-dim {
  opacity: 0.92;
  background: linear-gradient(180deg, #ffffff 0%, #fcfcfd 100%);
}

/* 卡片头部 */
.panel-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background:
    linear-gradient(180deg, #fafbfc 0%, #ffffff 100%);
  border-bottom: 1px solid #f0f2f5;
}
.pch-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: 0.2px;
}
.pch-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}
.pch-dot-blue   { background: linear-gradient(135deg, var(--c-primary), var(--c-primary-hover)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 12%, transparent); }
.pch-dot-green  { background: linear-gradient(135deg, #52c41a, #73d13d); box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.12); }
.pch-dot-purple { background: linear-gradient(135deg, #722ed1, #9254de); box-shadow: 0 0 0 3px rgba(114, 46, 209, 0.12); }
.pch-dot-orange { background: linear-gradient(135deg, #fa8c16, #ffa940); box-shadow: 0 0 0 3px rgba(250, 140, 22, 0.12); }
.pch-dot-cyan   { background: linear-gradient(135deg, #13c2c2, #36cfc9); box-shadow: 0 0 0 3px rgba(19, 194, 194, 0.12); }
.pch-dot-teal   { background: linear-gradient(135deg, #0d9488, #2dd4bf); box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12); }
.pch-dot-indigo { background: linear-gradient(135deg, #4f46e5, #818cf8); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12); }
.pch-dot-pink   { background: linear-gradient(135deg, #eb2f96, #f759ab); box-shadow: 0 0 0 3px rgba(235, 47, 150, 0.12); }
.pch-dot-amber  { background: linear-gradient(135deg, #f59e0b, #fbbf24); box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12); }
.pch-dot-violet { background: linear-gradient(135deg, #8b5cf6, #a78bfa); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.12); }
.pch-dot-slate  { background: linear-gradient(135deg, #64748b, #94a3b8); box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.12); }

.pch-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}
.pch-meta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: #8c8c8c;
  background: #f5f6f8;
  font-size: 13px;
  transition: all 0.15s;
  cursor: default;
}
.pch-meta:hover { color: var(--c-primary); background: var(--c-primary-bg); }
.pch-meta.dim { opacity: 0.55; }
.pch-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pch-action-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
}
.pch-action-btn:hover {
  background: var(--c-primary-bg);
  color: var(--c-primary);
}
.pch-add {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--c-primary);
  background: linear-gradient(135deg, var(--c-primary-bg) 0%, #f0e6ff 100%);
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}
.pch-add:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px transparent;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--c-primary) 15%, transparent);
}

/* 卡片体 */
.panel-card-body {
  padding: 14px 16px 16px;
}

/* ============ 活动日志 ============ */
.nn-activity-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.nn-activity-log {
  margin: 4px 0 0;
  padding-left: 2px;
}
.nn-activity-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-bottom: 2px;
}
.nn-activity-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nn-activity-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}
.nn-activity-status {
  font-size: 11px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--c-primary-bg);
  color: var(--c-primary);
  white-space: nowrap;
}
.nn-activity-node {
  font-size: 12px;
  color: #6b7280;
}
.nn-activity-time {
  font-size: 11px;
  color: #9ca3af;
}
.nn-change-old {
  color: #9ca3af;
  text-decoration: line-through;
  word-break: break-all;
}
.nn-change-new {
  color: #1f2937;
  word-break: break-all;
}

/* Tabs inside panel */
.panel-tabs {
  margin-top: -4px;
}
.panel-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 14px !important;
  padding: 0 !important;
  border-bottom: 1px solid #f0f2f5 !important;
  background: transparent !important;
}
.panel-tabs :deep(.ant-tabs-tab) {
  padding: 8px 16px !important;
  font-size: 13px !important;
  color: #595959 !important;
  font-weight: 500 !important;
  transition: all 0.15s !important;
}
.panel-tabs :deep(.ant-tabs-tab:hover) {
  color: var(--c-primary) !important;
}
.panel-tabs :deep(.ant-tabs-tab-active) {
  color: var(--c-primary) !important;
  font-weight: 600 !important;
}
.panel-tabs :deep(.ant-tabs-ink-bar) {
  background: linear-gradient(90deg, var(--c-primary) 0%, #9254de 100%) !important;
  height: 2.5px !important;
  border-radius: 2px;
}

/* KV 列表（散列，无表格） */
.kv-list {
  display: flex;
  flex-direction: column;
  gap: 10px 0;
}
.kv-list-extra {
  margin-top: 12px;
}
.kv-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: #8c8c8c;
  padding: 4px 0 8px;
  margin-bottom: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px dashed #f0f0f0;
}
.kv-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 4px;
  align-items: start;
  padding: 0;
  background: transparent;
}
.kv-row:hover {
  background: transparent;
}
/* 人员信息行：label 列宽随内容收缩，让 label 与值水平贴紧 */
.user-row {
  grid-template-columns: auto 1fr;
  gap: 8px;
}
.kv-label {
  display: flex;
  align-items: flex-start;
  padding-top: 1px;
}
.kv-label-inner {
  font-size: 12.5px;
  color: #6b7280;
  font-weight: 500;
  line-height: 22px;
}
.kv-value {
  font-size: 13px;
  line-height: 22px;
  color: #1a1a1a;
  min-height: 22px;
  word-break: break-word;
  min-width: 0;
  display: flex;
  align-items: center;
}

/* 富文本字段：占满值列，内容多行时顶部对齐 */
.kv-value > .rtf,
.attr-value-block > .rtf {
  flex: 1;
  align-self: flex-start;
}
.attr-value-block:has(> .rtf) {
  display: flex;
  overflow: visible;
}

/* User row */
.user-row .kv-value { min-height: 28px; }
/* 字段编辑 icon：hover 行时出现 */
.field-edit-icon {
  margin-left: 6px;
  font-size: 13px;
  color: #bfbfbf;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  vertical-align: middle;
}
.kv-row:hover .field-edit-icon {
  opacity: 1;
  color: var(--c-primary);
}
.user-cell-pretty {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  gap: 0;
}
.ucp-share {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  justify-content: center;
  color: #bfbfbf;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
  flex-shrink: 0;
}
.ucp-share:hover {
  color: var(--c-primary);
  background: var(--c-primary-bg);
}

/* Description rich text（WangEditor 可编辑） */
.desc-rich-wrap {
  position: relative;
}
.desc-rich-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  display: flex;
  gap: 2px;
}
.desc-act-btn {
  color: #8c8c8c;
}
.desc-act-btn:hover {
  color: var(--c-primary);
}
.desc-act-btn.is-save {
  color: var(--c-primary);
}
/* 编辑态：按钮放在工具栏上方，避免遮挡工具栏按钮 */
.desc-rich-wrap.is-editing {
  padding-top: 30px;
}
.desc-rich-wrap.is-editing .desc-rich-actions {
  top: 0;
  right: 0;
}
.desc-rich-view {
  min-height: 44px;
  padding: 10px 44px 10px 14px;
  font-size: 13.5px;
  line-height: 1.75;
  color: #262626;
  word-break: break-word;
  border: 1px solid transparent;
  border-radius: 6px;
  transition: border-color 0.15s, background 0.15s;
}
.desc-rich-view:hover {
  background: #fafafa;
  border-color: #f0f0f0;
}
.desc-rich-html :deep(img) {
  max-width: 100%;
}
.desc-rich-empty {
  color: #bfbfbf;
}
.desc-rich-wrap + .desc-rich-wrap {
  margin-top: 10px;
}
.desc-rich-wrap :deep(.w-e-toolbar) {
  border: 1px solid #e8e8e8 !important;
  border-bottom: none !important;
  border-radius: 6px 6px 0 0 !important;
  background: #fafafa !important;
}
.desc-rich-wrap :deep(.w-e-text-container) {
  background: #fff !important;
  border: 1px solid #e8e8e8 !important;
  border-radius: 0 0 6px 6px !important;
  padding: 10px 14px !important;
  font-size: 13.5px !important;
  line-height: 1.75 !important;
  color: #262626 !important;
  word-break: break-word !important;
  min-height: 120px !important;
}
.desc-rich-wrap :deep(.w-e-scroll) {
  overflow-y: hidden !important;
  min-height: 120px !important;
}
.desc-rich-wrap :deep(.w-e-text-placeholder) {
  color: #bfbfbf !important;
}
.desc-rich-wrap :deep(p) { margin: 0 0 10px; }
.desc-rich-wrap :deep(p:last-child) { margin-bottom: 0; }
.desc-rich-wrap :deep(a) {
  color: var(--c-primary);
  text-decoration: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: transparent;
  background: color-mix(in srgb, var(--c-primary) 6%, transparent);
  transition: background 0.15s;
}
.desc-rich-wrap :deep(a:hover) {
  background: transparent;
  background: color-mix(in srgb, var(--c-primary) 12%, transparent);
  text-decoration: underline;
}
.desc-rich-wrap :deep(img) {
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid #e6e8eb;
}
.desc-rich-wrap :deep(h1),
.desc-rich-wrap :deep(h2),
.desc-rich-wrap :deep(h3) {
  margin: 14px 0 8px;
  color: #1f1f1f;
}
.desc-rich-wrap :deep(ul),
.desc-rich-wrap :deep(ol) { padding-left: 22px; margin: 0 0 10px; }
.desc-rich-wrap :deep(li) { margin: 3px 0; }
.desc-rich-wrap :deep(code) {
  background: #ffffff;
  border: 1px solid #e8e8e8;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  color: #cf1322;
}
.desc-rich-wrap :deep(pre) {
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
}
.desc-rich-wrap :deep(pre code) {
  background: transparent;
  border: none;
  color: inherit;
  padding: 0;
}
.desc-rich-wrap :deep(.w-e-bar),
.desc-rich-wrap :deep([data-slate-editor]) {
  outline: none !important;
  box-shadow: none !important;
}
.desc-rich-wrap :deep(.w-e-bar-item) {
  transition: background 0.15s;
}

/* 底部留白与最后一块同为白色、同样通栏，避免底部露出灰条 */
.footer-spacer { flex-shrink: 0; height: 28px; margin: 0 -20px; background: #ffffff; }

/* Scrollbar（从单号区域顶部开始） */
.detail-body {
  scrollbar-width: thin;
  scrollbar-color: #cfd3d8 transparent;
}
.detail-body::-webkit-scrollbar { width: 8px; }
.detail-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #d9dde1, #cfd3d8);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.detail-body::-webkit-scrollbar-thumb:hover {
  background: #a8b0b8;
  background-clip: content-box;
  border: 2px solid transparent;
}
</style>
