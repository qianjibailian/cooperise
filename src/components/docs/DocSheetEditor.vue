<script setup lang="ts">
import { computed } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'

/**
 * 简易表格编辑器（类 Excel）
 * 数据直接修改传入的 rows，变更时 emit change 供父级触发保存。
 */
const props = defineProps<{
  rows: string[][]
}>()

const emit = defineEmits<{
  (e: 'change'): void
}>()

const colCount = computed(() => Math.max(1, ...props.rows.map((r) => r.length)))

function colName(i: number): string {
  return String.fromCharCode(65 + (i % 26))
}

function addRow() {
  props.rows.push(new Array(colCount.value).fill(''))
  emit('change')
}

function addCol() {
  props.rows.forEach((r) => r.push(''))
  emit('change')
}

function setCell(row: string[], ci: number, e: Event) {
  row[ci] = (e.target as HTMLInputElement).value
  emit('change')
}
</script>

<template>
  <div class="sheet-editor">
    <div class="sheet-toolbar">
      <button type="button" class="sheet-tool" @click="addRow"><PlusOutlined /> 添加行</button>
      <button type="button" class="sheet-tool" @click="addCol"><PlusOutlined /> 添加列</button>
      <span class="sheet-hint">{{ rows.length }} 行 × {{ colCount }} 列</span>
    </div>

    <div class="sheet-scroll">
      <table class="sheet-table">
        <thead>
          <tr>
            <th class="sheet-corner" />
            <th v-for="i in colCount" :key="i" class="sheet-col-head">{{ colName(i - 1) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in rows" :key="ri">
            <th class="sheet-row-no">{{ ri + 1 }}</th>
            <td v-for="ci in colCount" :key="ci" class="sheet-cell">
              <input
                :value="row[ci - 1] || ''"
                class="sheet-input"
                @input="setCell(row, ci - 1, $event)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.sheet-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sheet-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sheet-tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  color: #646a73;
  background: #f7f8fa;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.sheet-tool:hover {
  color: #1f2329;
  background: #eef0f2;
}
.sheet-hint {
  margin-left: auto;
  font-size: 12px;
  color: #8f959e;
}
.sheet-scroll {
  overflow: auto;
  border: 1px solid #eff0f2;
  border-radius: 10px;
}
.sheet-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}
.sheet-table th,
.sheet-table td {
  border-right: 1px solid #eff0f2;
  border-bottom: 1px solid #eff0f2;
}
.sheet-table tr:last-child td,
.sheet-table tr:last-child th {
  border-bottom: none;
}
.sheet-table th:last-child,
.sheet-table td:last-child {
  border-right: none;
}
.sheet-corner,
.sheet-row-no,
.sheet-col-head {
  width: 44px;
  min-width: 44px;
  height: 30px;
  font-size: 12px;
  font-weight: 500;
  color: #8f959e;
  text-align: center;
  background: #f7f8fa;
}
.sheet-col-head {
  width: auto;
}
.sheet-cell {
  padding: 0;
  background: #fff;
}
.sheet-input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  color: #1f2329;
  background: transparent;
  border: none;
  outline: none;
}
.sheet-input:focus {
  background: #f5f9ff;
  box-shadow: inset 0 0 0 2px var(--c-primary);
}
</style>
