/**
 * 人员统一展示：头像 + realName（coAccount）。
 * 兼容新旧接口字段：realName / coAccount（新）与 userCoAccount / userAvatar / userEnName / displayName（旧）。
 */

export type PersonLike = Record<string, unknown> | null | undefined

function str(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

/** 姓名：realName，缺省依次回退 displayName / name / userEnName */
export function personName(u: PersonLike): string {
  if (!u) return ''
  return str(u.realName) || str(u.displayName) || str(u.name) || str(u.userEnName)
}

/** 账号：coAccount，缺省依次回退 userCoAccount / userEnName / memberId / userNo */
export function personAccount(u: PersonLike): string {
  if (!u) return ''
  return str(u.coAccount) || str(u.userCoAccount) || str(u.userEnName) || str(u.memberId) || str(u.userNo)
}

/** 姓名 + 账号 → realName（coAccount）；缺一项时只展示另一项，两者相同时只展示一次 */
export function formatPersonLabel(realName: unknown, coAccount: unknown): string {
  const name = str(realName)
  const account = str(coAccount)
  if (name && account && name !== account) return `${name}（${account}）`
  return name || account
}

/** 人员展示文字：realName（coAccount） */
export function personLabel(u: PersonLike): string {
  return formatPersonLabel(personName(u), personAccount(u))
}

/** 头像地址 */
export function personAvatar(u: PersonLike): string {
  if (!u) return ''
  return str(u.avatarUrl) || str(u.userAvatar)
}

/** 无头像时的占位字：姓名首字，无姓名取账号首字（大写） */
export function personInitial(u: PersonLike): string {
  const s = personName(u) || personAccount(u)
  return s ? s.charAt(0).toUpperCase() : '?'
}

/** 是否像人员对象（含账号 / 姓名 / 头像等人员字段） */
export function isPersonLike(u: unknown): boolean {
  if (!u || typeof u !== 'object' || Array.isArray(u)) return false
  const o = u as Record<string, unknown>
  return ['coAccount', 'userCoAccount', 'realName', 'memberId', 'userEnName', 'userAvatar'].some((k) => o[k] != null && o[k] !== '')
}

/** 人员唯一键：新接口 memberId（userNo 已不再返回），兼容旧接口 userNo / id */
export function personKey(u: unknown): string {
  if (!u || typeof u !== 'object') return u == null ? '' : String(u)
  const o = u as Record<string, unknown>
  return str(o.memberId) || str(o.userNo) || str(o.id)
}
