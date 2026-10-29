<template>
  <div class="issue-page">
    <!-- ========== 顶部统一 Header（icon + 单号 + 标题 + 操作） ========== -->
    <header v-if="!loading && detailData" class="detail-header">
      <div class="dh-icon">
        <component :is="FolderOutlined" />
      </div>
      <div class="dh-content">
        <div class="dh-row">
          <span class="dh-project">{{ projectLabel || '未命名项目' }}</span>
          <span class="dh-divider">/</span>
          <span class="dh-key">{{ issueKey }}</span>
          <div class="dh-inline-actions">
            <div class="dh-icon-btn" title="复制单号"><component :is="CopyOutlined" /></div>
            <div class="dh-icon-btn" title="收藏"><component :is="StarOutlined" /></div>
            <div class="dh-icon-btn" title="复制链接" @click="copyIssueLink"><component :is="LinkOutlined" /></div>
          </div>
        </div>
        <div v-if="editingSummary" class="dh-title-edit">
          <a-input
            ref="summaryInputRef"
            v-model:value="summaryDraft"
            class="dh-summary-input"
            placeholder="请输入概要"
            maxlength="200"
            @pressEnter="saveSummary"
            @blur="saveSummary"
          />
        </div>
        <div v-else-if="!heroSummary" class="dh-title-empty" @click="startEditSummary">
          <span class="dh-summary-label">概要</span>
          <span class="dh-summary-empty-tip">未填写概要，点击填写</span>
        </div>
        <h1 v-else class="dh-title" @click="startEditSummary">{{ heroSummary }}</h1>
      </div>
    </header>

    <!-- Skeleton Loading -->
    <div v-if="loading" class="detail-skeleton">
      <!-- Header skeleton -->
      <header class="detail-header detail-header-skeleton">
        <div class="dh-icon">
          <a-skeleton-button shape="circle" size="small" />
        </div>
        <div class="dh-content">
          <div class="dh-row">
            <a-skeleton-input size="small" style="width: 160px" />
          </div>
          <a-skeleton :paragraph="{ rows: 1 }" :title="false" style="width: 92%; margin-top: 14px" />
        </div>
      </header>

      <div class="detail-body">
        <!-- Attribute card skeleton -->
        <section class="attr-card">
          <div class="attr-row-line">
            <div v-for="n in 5" :key="n" class="attr-item">
              <a-skeleton :paragraph="{ rows: 1, width: ['48px', '100%'] }" :avatar="false" :title="false" />
            </div>
          </div>
        </section>

        <!-- Action bar skeleton -->
        <section class="action-bar">
          <a-skeleton-button size="small" style="width: 72px; margin-right: 8px" />
          <a-skeleton-button size="small" style="width: 72px; margin-right: 8px" />
          <a-skeleton-button size="small" style="width: 96px; margin-right: 8px" />
          <a-skeleton-button size="small" type="primary" style="width: 96px; margin-right: 8px" />
          <a-skeleton-button size="small" style="width: 120px" />
        </section>

        <!-- Body skeleton（左右两栏） -->
        <section class="scroll-wrap">
          <div class="scroll-inner">
            <div class="scroll-left">
              <section class="panel-collapse-skel">
                <a-skeleton :paragraph="{ rows: 3, width: ['100%', '70%', '85%'] }" :title="true" :avatar="false" />
              </section>
              <section class="panel-collapse-skel">
                <a-skeleton :paragraph="{ rows: 2, width: ['100%', '65%'] }" :title="true" :avatar="false" />
              </section>
              <section class="panel-collapse-skel">
                <a-skeleton :paragraph="{ rows: 4, width: ['100%', '80%', '60%', '90%'] }" :title="true" :avatar="false" />
              </section>
              <section class="panel-collapse-skel">
                <a-skeleton :paragraph="{ rows: 2, width: ['100%', '80%'] }" :title="true" :avatar="false" />
              </section>
            </div>
            <div class="scroll-right">
              <section class="panel-collapse-skel">
                <a-skeleton :paragraph="{ rows: 3, width: ['100%', '75%', '60%'] }" :title="true" :avatar="true" />
              </section>
              <section class="panel-collapse-skel">
                <a-skeleton :paragraph="{ rows: 3, width: ['100%', '75%', '60%'] }" :title="true" :avatar="true" />
              </section>
              <section class="panel-collapse-skel">
                <a-skeleton :paragraph="{ rows: 2, width: ['100%', '80%'] }" :title="true" :avatar="false" />
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Empty: ticket not found -->
    <div v-else-if="notFound" class="detail-not-found">
      <a-empty>
        <template #image>
          <component :is="FileUnknownOutlined" class="nf-icon" />
        </template>
        <template #description>
          <div class="nf-desc">
            <div class="nf-title">该工单已被删除或不存在</div>
            <div class="nf-key">Key：{{ issueKey }}</div>
          </div>
        </template>
      </a-empty>
    </div>

    <!-- Empty: generic -->
    <div v-else-if="!detailData" class="detail-empty">
      <div class="empty-illustration">
        <component :is="FileUnknownOutlined" />
      </div>
      <div class="empty-title">未找到数据</div>
      <div class="empty-desc">请尝试刷新页面或重新打开</div>
    </div>

    <!-- Content（从 header 下面开始滚动） -->
    <div v-else class="detail-body">
      <!-- ========== 内联属性卡（5 个属性在同一行） ========== -->
      <section class="attr-card">
        <div class="attr-row-line">
          <div class="attr-item">
            <span class="attr-label">问题类型</span>
            <span class="attr-value-block">
              <component v-if="issueTypeLabel" :is="CheckSquareFilled" class="attr-check" />
              <span class="attr-value">{{ issueTypeLabel || '—' }}</span>
            </span>
          </div>

          <div class="attr-item">
            <span class="attr-label">状态</span>
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
            </span>
          </div>

          <div class="attr-item">
            <span class="attr-label">优先级</span>
            <span class="attr-value-block">
              <span class="priority-text" :style="{ color: priorityColorHex }">
                <span class="priority-dot" :style="{ background: priorityColorHex }"></span>
                <span class="priority-label">{{ priorityLabel || '—' }}</span>
              </span>
            </span>
          </div>

          <div class="attr-item">
            <span class="attr-label">版本</span>
            <span class="attr-value-block">
              <span class="attr-empty">—</span>
            </span>
          </div>

          <div class="attr-item">
            <span class="attr-label">Sprint</span>
            <span class="attr-value-block">
              <span class="attr-empty">—</span>
            </span>
          </div>
        </div>
      </section>

      <!-- ========== 操作按钮栏 ========== -->
      <section class="action-bar">
        <div class="action-bar-left">
          <a-button size="small" class="action-btn">
            编辑
          </a-button>
          <a-button size="small" class="action-btn">
            分配
          </a-button>
          <a-dropdown>
            <a-button size="small" class="action-btn">
              更多操作
              <component :is="DownOutlined" class="action-caret" />
            </a-button>
            <template #overlay>
              <a-menu class="action-menu">
                <a-menu-item key="copy">
                  <span>复制</span>
                </a-menu-item>
                <a-menu-item key="rollback">
                  <span>回滚</span>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <div class="action-divider"></div>

          <a-button type="primary" size="small" class="action-btn action-primary">
            开始处理
          </a-button>
          <a-button size="small" class="action-btn">取消</a-button>
          <a-button size="small" class="action-btn">暂停</a-button>
        </div>
        <div class="action-bar-right">
          <a-switch v-model:checked="onlyShowValued" size="small" />
          <span class="switch-label">仅展示有值字段</span>
        </div>
      </section>

      <!-- ========== 主体内容 ========== -->
      <main class="detail-scroll">
        <div class="scroll-inner">
          <div class="scroll-left">

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
                              <UserAvatar v-if="isUserField(f)" :user="f.value" />
                              <ValueWithBadge v-else :field="f" />
                            </div>
                          </div>
                        </template>
                      </div>
                      <MiniEmpty v-else text="暂无该分类下数据" />
                    </a-tab-pane>
                  </a-tabs>
                </template>

                <template v-else>
                  <div v-if="filteredSummaryGrid.length > 0" class="kv-list">
                    <template v-for="(f, i) in filteredSummaryGrid" :key="f.id">
                      <div class="kv-row" :class="{ 'kv-row-alt': i % 2 === 1 }">
                        <div class="kv-label">
                          <span class="kv-label-inner">{{ f.name }}</span>
                        </div>
                        <div class="kv-value">
                          <template v-if="editingFieldId === f.id">
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
                          <template v-if="editingFieldId === f.id">
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
                <div class="collapse-header-inner">
                  <span class="pch-title">研发活动</span>
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
                <div class="collapse-header-inner">
                  <span class="pch-title">描述</span>
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

          <!-- 研发活动（折叠板，位于描述下方）：需求文档 / 应用名称 / 代码分支 / 测试计划 / 缺陷管理 / 线上故障 -->
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

          <!-- ========== 暂时注释：关联 OKR（折叠板） ==========
          <a-collapse
            v-model:activeKey="okrCollapseKeys"
            ghost
            :bordered="false"
            class="panel-collapse"
          >
            <a-collapse-panel key="okr">
              <template #header>
                <div class="collapse-header-inner">
                  <span class="pch-title">关联的 OKR</span>
                </div>
              </template>
              <div class="panel-card-body">
                <MiniEmpty text="暂无关联 OKR，点击右上角添加" />
              </div>
            </a-collapse-panel>
          </a-collapse>
          ========== /暂时注释：关联 OKR ========== -->

          <!-- ========== 暂时注释：附件 / 父级工单 / 子级工单 / 同级工单 / 依赖关系 ==========
          <a-collapse
            v-model:activeKey="attachmentCollapseKeys"
            ghost
            :bordered="false"
            class="panel-collapse"
          >
            <a-collapse-panel key="attachment">
              <template #header>
                <div class="collapse-header-inner">
                  <span class="pch-title">附件</span>
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
                <div class="collapse-header-inner">
                  <span class="pch-title">父级工单</span>
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
                <div class="collapse-header-inner">
                  <span class="pch-title">子级工单</span>
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
                <div class="collapse-header-inner">
                  <span class="pch-title">同级工单</span>
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
                <div class="collapse-header-inner">
                  <span class="pch-title">依赖关系</span>
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
                <div class="collapse-header-inner">
                  <span class="pch-title">活动日志</span>
                </div>
              </template>
              <div class="panel-card-body">
                <a-tabs size="small" class="nn-activity-tabs">
                  <a-tab-pane key="change" tab="变更记录">
                    <MiniEmpty text="暂无变更记录" />
                  </a-tab-pane>
                </a-tabs>
              </div>
            </a-collapse-panel>
          </a-collapse>

          <div class="footer-spacer"></div>

          </div><!-- end scroll-left -->
          <div class="scroll-right">

          <!-- 人员信息（折叠板） -->
          <a-collapse
            v-model:activeKey="userCollapseKeys"
            ghost
            :bordered="false"
            class="panel-collapse"
          >
            <a-collapse-panel key="user">
              <template #header>
                <div class="collapse-header-inner">
                  <span class="pch-title">人员信息</span>
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
                        <template v-if="editingFieldId === f.id">
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
            class="panel-collapse panel-collapse-last"
          >
            <a-collapse-panel key="time">
              <template #header>
                <div class="collapse-header-inner">
                  <span class="pch-title">时间信息</span>
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
                        <template v-if="editingFieldId === f.id">
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

          </div><!-- end scroll-right -->
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, watch, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import {
  FolderOutlined,
  StarOutlined,
  LinkOutlined,
  ShareAltOutlined,
  CheckSquareFilled,
  FileUnknownOutlined,
  DownOutlined,
  AppstoreOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { queryDetail, patchIssue } from '@/api/faiz'
import { message } from 'ant-design-vue'
import type { DetailData, DetailField, DetailLayoutGroup } from '@/types/faiz'
import FieldValueEditor from '@/components/FieldValueEditor.vue'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import IssueRdActivity from '@/components/IssueRdActivity.vue'

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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '32px 16px',
        color: '#8c8c8c',
        fontSize: '13px',
        background: '#f5f7fa',
        borderRadius: '4px',
        minHeight: '80px',
      },
    }, [
      h(ExclamationCircleOutlined, { style: { fontSize: '20px', opacity: 0.5, color: '#1677ff' } }),
      h('span', { style: { color: '#595959', fontWeight: 500 } }, props.text),
      h('span', { style: { color: '#8c8c8c', fontSize: '12px' } }, '暂无数据'),
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
      const name = String(obj.coAccount ?? obj.userCoAccount ?? obj.userEnName ?? obj.displayName ?? obj.name ?? '')
      // 括号内容取用户工号 userNo
      const idPart = obj.userNo ? String(obj.userNo) : ''
      const firstLetter = (name || '?').trim().charAt(0).toUpperCase()
      const avatar = String(obj.avatarUrl ?? obj.userAvatar ?? '')
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
      props.field.type.startsWith('SELECT_LIST_SINGLE') &&
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
        const name = String(obj.name ?? obj.optionName ?? obj.coAccount ?? obj.userCoAccount ?? obj.userEnName ?? obj.displayName ?? '')
        if (!name) return null
        return {
          name,
          avatar: String(obj.avatarUrl ?? obj.userAvatar ?? obj.iconUrl ?? ''),
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

const route = useRoute()
const issueKey = computed(() => route.params.issueKey as string)

const loading = ref(false)
const notFound = ref(false)
const detailData = ref<DetailData | null>(null)
const activeTab = ref<string>('')
const teamCollapseKeys = ref<string[]>(['team'])
const descCollapseKeys = ref<string[]>(['desc'])
const userCollapseKeys = ref<string[]>(['user'])
const rdCollapseKeys = ref<string[]>(['rd'])
const okrCollapseKeys = ref<string[]>([])
const timeCollapseKeys = ref<string[]>(['time'])
const attachmentCollapseKeys = ref<string[]>(['attachment'])
const parentCollapseKeys = ref<string[]>(['parent'])
const childCollapseKeys = ref<string[]>([])
const siblingCollapseKeys = ref<string[]>([])
const dependencyCollapseKeys = ref<string[]>([])
const activityCollapseKeys = ref<string[]>(['activity'])
const onlyShowValued = ref(true)
/** 活动日志：该事项的任务历史记录 */

// ======================= 描述区富文本组件（WangEditor 可编辑） =======================
const richTextModels = reactive<Record<string, string>>({})
const richEditorInstances = reactive<Record<string, IDomEditor | null>>({})
const richEditorVersion = ref(0)
const richSaving = reactive<Record<string, boolean>>({})
/** 富文本上次保存的内容：判断是否有改动、取消编辑时恢复 */
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
    const res = await patchIssue(issueKey.value, [{ fieldId, fieldValue: html }])
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
    const res = await patchIssue(issueKey.value, [{ fieldId: 'summary', fieldValue: val }])
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
  const key = issueKey.value
  if (!key) return
  const link = `${window.location.origin}/jira/browse/${key}`
  try {
    await navigator.clipboard.writeText(link)
    message.success('链接已复制')
  } catch {}
}

// ======================= 字段内联编辑 =======================
/** 当前处于编辑态的字段 id（同一时间只编辑一个字段） */
const editingFieldId = ref<string | null>(null)

/** 字段是否可编辑：editable 为 true 且非富文本（描述有独立编辑器） */
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

/** 轻量刷新：重新请求详情数据，不重置折叠面板/标签页状态 */
async function refreshDetail() {
  try {
    const res = await queryDetail({ key: issueKey.value })
    if (res?.success && res.data) {
      detailData.value = res.data
    }
  } catch {
    // 静默失败，保持已有数据
  }
}

const projectLabel = computed<string>(() => {
  const f = findField('project')
  if (!f?.value) return ''
  const v = f.value as Record<string, unknown>
  return String(v.name ?? v.key ?? '')
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
const issueTypeLabel = computed(() => {
  const v = issueTypeValue.value
  if (typeof v === 'object' && v !== null) {
    return String((v as Record<string, unknown>).name ?? '')
  }
  return ''
})

// ======================= Summary / Custom / User 分组 =======================

const SUMMARY_EXCLUDED_IDS = new Set(['summary', 'status', 'priority', 'issuetype', 'project'])

function isUserField(f: DetailField): boolean {
  if (!f) return false
  const t = f.type || ''
  if (t === 'SELECT_USER_SINGLE' || t === 'SELECT_USER_MULTIPLE') return true
  if (f.id === 'assignee' || f.id === 'reporter' || f.id === 'creator') return true
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

// 人员字段：优先取独立的 PERSON 组（创建人/更新人），
// 兼容旧结构回退 SUBJECT 组内 PERSON tab / summary 全字段过滤；再补充自定义字段中的用户字段
const allUserFields = computed<DetailField[]>(() => {
  const fromPerson: DetailField[] = []
  const fromSummary: DetailField[] = []
  if (detailData.value) {
    const personGroup = (detailData.value.layoutGroup ?? []).find((x) => x && x.type === 'PERSON')
    if (personGroup) {
      fromPerson.push(...flattenGroupFields(personGroup.fieldGroupStructure).filter(isUserField))
    } else {
      const g = (detailData.value.layoutGroup ?? []).find((x) => x && x.type === 'SUBJECT')
      const s = g?.fieldGroupStructure
      if (s && s.type === 'TAB_CONTAINER') {
        const d = s.data as { tabItems: Array<{ title: string; sequence: number; issueFields: DetailField[] }> }
        const tab = d.tabItems?.find((t) => t.title === 'PERSON')
        if (tab?.issueFields) fromPerson.push(...tab.issueFields.filter(isUserField))
        else fromSummary.push(...allSummaryFields.value.filter(isUserField))
      } else {
        fromSummary.push(...allSummaryFields.value.filter(isUserField))
      }
    }
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
  if (filteredSummaryGrid.value.length > 0) return true
  if (customFieldPlain.value && filteredFields(customFieldPlain.value.fields).length > 0) return true
  return !onlyShowValued.value
})

// ======================= lifecycle =======================

async function fetchDetail() {
  loading.value = true
  notFound.value = false
  detailData.value = null
  activeTab.value = ''
  // 恢复折叠板默认展开状态
  teamCollapseKeys.value = ['team']
  descCollapseKeys.value = ['desc']
  userCollapseKeys.value = ['user']
  rdCollapseKeys.value = ['rd']
  okrCollapseKeys.value = []
  timeCollapseKeys.value = ['time']
  attachmentCollapseKeys.value = ['attachment']
  parentCollapseKeys.value = ['parent']
  childCollapseKeys.value = []
  siblingCollapseKeys.value = []
  dependencyCollapseKeys.value = []
  activityCollapseKeys.value = ['activity']
  try {
    const res = await queryDetail({ key: issueKey.value })
    if (res?.success && res.data) {
      detailData.value = res.data
      notFound.value = false
      if (customFieldTabGroup.value && customFieldTabGroup.value.tabItems.length > 0) {
        activeTab.value = customFieldTabGroup.value.tabItems[0].title
      }
    } else {
      notFound.value = true
    }
  } catch {
    notFound.value = true
    detailData.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (issueKey.value) {
    fetchDetail()
  }
})

// ======================= value formatting =======================

function formatFieldValue(field: DetailField): string {
  const { type, value } = field
  if (!hasValue(field)) return '—'
  switch (type) {
    case 'TEXT_BOX_SINGLE_LINE':
    case 'TEXT_BOX_MULTI_LINE':
    case 'NUMERIC_FIELD':
      return String(value)
    case 'SELECT_LIST_SINGLE':
    case 'SELECT_LIST_SINGLE_PROJECT':
    case 'SELECT_LIST_SINGLE_ISSUETYPE':
    case 'SELECT_LIST_SINGLE_PRIORITY':
    case 'SECURITY_FIELD':
    case 'SPRINT_FIELD':
      return formatObject(value)
    case 'DATE_PICKER':
    case 'TIME_PICKER': {
      const fmt = type === 'TIME_PICKER' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
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
      return String(value)
    }
    case 'SELECT_USER_SINGLE':
      return formatUser(value)
    case 'VIEW_WATCH_FIELD': {
      const obj = (value ?? {}) as Record<string, unknown>
      const n = obj.numWatchers ?? 0
      return `关注者 ${n} 人`
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
    if (obj.coAccount || obj.userCoAccount || obj.userEnName || obj.displayName) {
      return String(obj.coAccount ?? obj.userCoAccount ?? obj.userEnName ?? obj.displayName)
    }
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
    const s = obj.coAccount ?? obj.userCoAccount ?? obj.userEnName ?? obj.displayName ?? obj.name
    if (s) return String(s)
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
.issue-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
  border-radius: 4px;
}

/* ============ Skeleton Loading ============ */
.detail-skeleton {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  overflow: auto;
}
.detail-header-skeleton {
  border-bottom: 1px solid #f0f0f0;
}
.detail-skeleton .action-bar {
  padding: 10px 24px;
  border-bottom: 1px solid #f0f0f0;
}
.scroll-wrap {
  flex: 1;
  min-height: 0;
  background: #ffffff;
  padding: 0;
}
.panel-collapse-skel {
  padding: 12px 24px 20px;
  border-bottom: 1px solid #f0f0f0;
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
    radial-gradient(circle at 50% 0%, #f0f5ff 0%, transparent 60%),
    #ffffff;
}
.empty-illustration {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f0f5ff 0%, #f9f0ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  font-size: 40px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px rgba(22, 119, 255, 0.08);
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

/* ============ Not Found ============ */
.detail-not-found {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex: 1;
  padding: 40px;
  background: #fff;
}

.nf-icon {
  font-size: 64px !important;
  color: #d9d9d9;
}

.nf-desc {
  text-align: center;
}

.nf-title {
  font-size: 15px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 6px;
}

.nf-key {
  font-size: 13px;
  color: #8c8c8c;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

/* ============ Body ============ */
.detail-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

/* ============ Detail Header（icon + 单号 + 标题 + 操作 统一区域） ============ */
.detail-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 24px;
  flex-shrink: 0;
  background: #ffffff;
  position: relative;
}
.detail-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: #f0f0f0;
}
.dh-icon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.2);
  flex-shrink: 0;
}
.dh-icon :deep(.anticon) {
  font-size: inherit;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dh-icon :deep(.anticon svg) {
  width: 100%;
  height: 100%;
}
.dh-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dh-row {
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
}
.dh-project {
  color: #595959;
  font-weight: 500;
  font-size: 13px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dh-divider {
  color: #bfbfbf;
  margin: 0 6px;
  font-weight: 300;
  font-size: 13px;
}
.dh-key {
  color: #1a1a1a;
  font-weight: 600;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
}
.dh-inline-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 8px;
}
.dh-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.4;
  color: #1a1a1a;
  font-weight: 700;
  word-break: break-word;
  letter-spacing: -0.1px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  cursor: text;
  border-radius: 4px;
  transition: background 0.2s, box-shadow 0.2s;
}
.dh-title:hover {
  background: rgba(22, 119, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.25);
}
.dh-title-empty {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: text;
  transition: border-color 0.2s, background 0.2s;
}
.dh-title-empty:hover {
  border-color: #1677ff;
  background: rgba(22, 119, 255, 0.04);
}
.dh-summary-label {
  flex-shrink: 0;
  font-size: 13px;
  color: #8c8c8c;
}
.dh-summary-empty-tip {
  font-size: 14px;
  color: #bfbfbf;
}
.dh-title-edit {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
}
.dh-summary-input {
  max-width: 420px;
}
.dh-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.dh-icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #595959;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(.4,0,.2,1);
  font-size: 14px;
}
.dh-icon-btn:hover {
  background: #f5f5f5;
  color: #1677ff;
}

/* ============ 属性卡（5 列一行） ============ */
.attr-card {
  padding: 16px 26px 14px;
  flex-shrink: 0;
  background:
    linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}
.attr-row-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) repeat(3, minmax(0, 1fr));
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
  font-weight: 500;
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
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%) !important;
  box-shadow: 0 2px 6px rgba(22, 119, 255, 0.28) !important;
  border-color: transparent !important;
}
.action-primary:hover {
  box-shadow: 0 3px 10px rgba(22, 119, 255, 0.38) !important;
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

/* ============ Scroll area ============ */
.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #ffffff;
}
.scroll-inner {
  display: flex;
  gap: 0;
  padding: 0;
  max-width: 100%;
  min-height: 100%;
}
.scroll-left {
  flex: 3;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.scroll-right {
  flex: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ============ 通用折叠板 ============ */
.panel-collapse {
  background: #ffffff;
  border-radius: 0 !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  box-shadow: none !important;
  transition: all 0.2s cubic-bezier(.4,0,.2,1);
}
.panel-collapse:hover {
  box-shadow: none;
  transform: none;
}
.panel-collapse :deep(.ant-collapse-item) {
  margin: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  padding: 0 !important;
  border: none !important;
}
.panel-collapse :deep(.ant-collapse-item:first-child) {
  margin-top: 0 !important;
  border-top: none !important;
}
.panel-collapse :deep(.ant-collapse-item:last-child) {
  margin-bottom: 0 !important;
  border-bottom: none !important;
}
.panel-collapse :deep(.ant-collapse-header) {
  padding: 14px 16px !important;
  margin: 0 !important;
  margin-top: 0 !important;
  align-items: center !important;
  border: none !important;
  border-top: none !important;
}
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
.panel-collapse :deep(.ant-collapse-content-box) {
  padding: 0 16px 18px !important;
  margin: 0 !important;
}
.panel-collapse :deep(.ant-collapse-content) {
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
}
.panel-collapse-last {
  border-bottom: none;
}
.panel-collapse.team-collapse {
  margin-top: 0 !important;
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
/* 卡片体 */
.panel-card-body {
  padding: 14px 16px 16px;
}

/* ============ 活动日志 ============ */
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
  background: #e6f4ff;
  color: #1677ff;
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
  color: #1677ff !important;
}
.panel-tabs :deep(.ant-tabs-tab-active) {
  color: #1677ff !important;
  font-weight: 600 !important;
}
.panel-tabs :deep(.ant-tabs-ink-bar) {
  background: linear-gradient(90deg, #1677ff 0%, #9254de 100%) !important;
  height: 2.5px !important;
  border-radius: 2px;
}

/* KV 列表 */
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
  color: #1677ff;
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
  color: #1677ff;
  background: #e6f4ff;
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
  color: #1677ff;
}
.desc-act-btn.is-save {
  color: #1677ff;
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
  color: #1677ff;
  text-decoration: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(22, 119, 255, 0.06);
  transition: background 0.15s;
}
.desc-rich-wrap :deep(a:hover) {
  background: rgba(22, 119, 255, 0.12);
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

.footer-spacer { height: 28px; }

/* Scrollbar */
.detail-scroll {
  scrollbar-width: thin;
  scrollbar-color: #cfd3d8 transparent;
}
.detail-scroll::-webkit-scrollbar { width: 8px; }
.detail-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #d9dde1, #cfd3d8);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.detail-scroll::-webkit-scrollbar-thumb:hover {
  background: #a8b0b8;
  background-clip: content-box;
  border: 2px solid transparent;
}
</style>
