import type { SheetData, SheetPage } from '@/types/docs'

/** 新建工作表的初始规模：200 行 × 20 列（A 到 T） */
export const SHEET_INIT_ROWS = 200
export const SHEET_INIT_COLS = 20

/** 新建一个空白工作表 */
export function createSheetPage(name: string): SheetPage {
  return { name, rows: Array.from({ length: SHEET_INIT_ROWS }, () => Array(SHEET_INIT_COLS).fill('')) }
}

/** 新建表格的默认数据：一个 Sheet1 */
export function defaultSheetData(): SheetData {
  return { sheets: [createSheetPage('Sheet1')], active: 0 }
}

/**
 * 兼容历史数据：早期表格是单表结构（data.rows / styles / frozenHeader），
 * 这里包装成 Sheet1；已经是多表结构的原样返回。
 */
export function normalizeSheetData(d: unknown): SheetData {
  const raw = d as (Partial<SheetData> & Partial<SheetPage>) | undefined
  if (raw?.sheets?.length) return raw as SheetData
  if (raw?.rows) {
    return {
      sheets: [{ name: 'Sheet1', rows: raw.rows, styles: raw.styles, frozenHeader: raw.frozenHeader }],
      active: 0,
    }
  }
  return defaultSheetData()
}

/** 生成不重名的工作表名：Sheet1、Sheet2… */
export function nextSheetName(sheets: SheetPage[]): string {
  const used = new Set(sheets.map((s) => s.name))
  let n = sheets.length + 1
  while (used.has(`Sheet${n}`)) n++
  return `Sheet${n}`
}
