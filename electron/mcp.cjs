/**
 * 客户端内置 MCP 服务（Model Context Protocol，Streamable HTTP 传输，无状态 JSON 响应）。
 *
 * 让 Claude Code / Cursor 等 AI 工具以「当前在客户端登录的用户」身份查询 Cooperise 的事项：
 *   - 只读：搜索事项、我的事项、事项详情 / 评论 / 变更记录 / 关联工单、空间、人员、当前用户
 *   - 写：仅「发表评论」
 * 后端权限与网页端一致（用登录 token 调后端），AI 看不到当前用户看不到的数据。
 *
 * 安全：
 *   - 只监听 127.0.0.1，局域网其他机器访问不到
 *   - 必须带 Authorization: Bearer <访问密钥>（客户端设置里可复制 / 重置）
 *   - 拒绝带 Origin 的请求：浏览器里的网页不能借本机服务读数据（防 DNS rebinding / CSRF）
 *
 * 不依赖 @modelcontextprotocol/sdk：打包时不带 node_modules，这里按协议手写最小实现
 * （initialize / ping / tools/list / tools/call，POST 返回 application/json，不开 SSE 流）。
 */
const http = require('http')
const https = require('https')
const crypto = require('crypto')

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MCP_PATH = '/mcp'
const MAX_BODY = 1024 * 1024

// ---------------- 后端调用 ----------------

/**
 * 以当前登录用户身份调后端（与前端 request.ts 一致：Bearer token，业务结构 { success, code, message, data }）
 * @returns {Promise<any>} 后端 data；失败抛 Error（message 为可读原因）
 */
function callBackend(ctx, method, apiPath, body) {
  const token = ctx.getToken()
  if (!token) return Promise.reject(new Error('客户端未登录：请先在 Cooperise 客户端里登录，再让 AI 调用。'))
  let target
  try {
    target = new URL(ctx.getApiTarget())
  } catch {
    return Promise.reject(new Error(`客户端后端地址配置错误：${ctx.getApiTarget()}`))
  }
  const client = target.protocol === 'https:' ? https : http
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body))
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  if (payload) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = payload.length
  }
  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        method,
        path: target.pathname.replace(/\/$/, '') + apiPath,
        headers,
        timeout: 30000,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8')
          let json = null
          try {
            json = JSON.parse(text)
          } catch {
            // 非 JSON
          }
          const status = res.statusCode || 0
          const code = Number(json?.code)
          if (status === 401 || code === 401) return reject(new Error('客户端登录已失效：请在客户端重新登录。'))
          if (status >= 400) return reject(new Error(json?.message || `后端返回 HTTP ${status}`))
          if (json && typeof json === 'object' && json.success === false) return reject(new Error(json.message || '后端返回失败'))
          resolve(json && typeof json === 'object' && 'data' in json ? json.data : json)
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error('请求后端超时')))
    req.on('error', (e) => reject(new Error(`无法连接后端 ${ctx.getApiTarget()}：${e.message}`)))
    if (payload) req.write(payload)
    req.end()
  })
}

// ---------------- 字段值 → 文本（与前端 utils/issue-view.ts fieldText 同口径，简化版） ----------------
const DATE_TYPES = new Set(['DATE_PICKER', 'TIME_PICKER', 'DATE_TIME_PICKER'])
const USER_TYPES = new Set(['SELECT_USER_SINGLE', 'SELECT_USER_MULTI'])

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v)

function personText(u) {
  if (!isObj(u)) return u == null ? '' : String(u)
  const name = u.realName || u.name || u.displayName || ''
  const account = u.coAccount || u.userCoAccount || u.userEnName || ''
  if (name && account && name !== account) return `${name}（${account}）`
  return String(name || account || u.memberId || '')
}

function objText(o) {
  const v = o.name ?? o.pname ?? o.optionName ?? o.label ?? o.realName ?? o.coAccount ?? o.userEnName ?? o.value ?? o.id
  return v == null ? '' : String(v)
}

function fieldText(f) {
  if (!f) return ''
  const type = String(f.type ?? '').toUpperCase()
  const ev = f.exportValue
  if (DATE_TYPES.has(type)) {
    const raw = ev ?? f.value
    return raw == null ? '' : String(raw)
  }
  if (USER_TYPES.has(type)) {
    const text = (Array.isArray(f.value) ? f.value : [f.value]).filter(isObj).map(personText).filter(Boolean).join('、')
    if (text) return text
  }
  if (ev != null && ev !== '' && typeof ev !== 'object') return String(ev)
  const v = f.value
  if (v == null) return ''
  if (Array.isArray(v)) return v.map((it) => (isObj(it) ? objText(it) : String(it ?? ''))).filter(Boolean).join('、')
  return isObj(v) ? objText(v) : String(v)
}

/** 富文本描述 → 纯文本（AI 读起来更省 token） */
function htmlToText(s) {
  if (typeof s !== 'string' || !/[<&]/.test(s)) return s
  return s
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, '[图片 $1]')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** /issue/query 的一条记录 → { 字段名: 文本 } */
function flattenRecord(rec) {
  const out = {}
  for (const f of rec?.issueField || []) {
    const text = fieldText(f)
    if (text !== '') out[f.name || f.id] = text
  }
  return out
}

/** queryDetail 的 layoutGroup → { 字段名: 文本 }（含 Tab 容器里的字段） */
function flattenDetail(data) {
  const out = {}
  const add = (f) => {
    if (!f || !f.id) return
    let text = fieldText(f)
    if (String(f.type).toUpperCase().includes('RICH') || f.id === 'description') text = htmlToText(text)
    if (text !== '' && text != null) out[f.name || f.id] = text
  }
  for (const g of data?.layoutGroup || []) {
    const s = g?.fieldGroupStructure
    if (!s) continue
    if (Array.isArray(s.data)) s.data.forEach(add)
    else if (s.data && Array.isArray(s.data.tabItems)) s.data.tabItems.forEach((t) => (t.issueFields || []).forEach(add))
    if (Array.isArray(s.issueFields)) s.issueFields.forEach(add)
  }
  return out
}

function relationItem(it) {
  if (!it) return null
  return {
    issueKey: it.issueKey,
    summary: it.summary,
    space: it.spaceName,
    issueType: it.issueTypeName,
    status: it.statusName,
    done: !!it.done,
    assignee: it.assigneeName,
    planEndDate: it.planEndDate || undefined,
  }
}

// ---------------- 筛选条件（与前端 utils/issueFilter.ts buildGlobalFilter 一致） ----------------
function condition(field, operator, values) {
  return {
    isGroupModule: false,
    condition: {
      conditionValueList: values.map((v) => ({
        value: v,
        userSpecialIdentifier: v === 'CURRENT_USER' ? 'CURRENT_USER' : '',
        timeOperationDirectionTypeCode: null,
        timeFormatTypeCode: null,
        comparedField: null,
      })),
      field: { id: field, datasourceId: 0 },
      operationType: operator,
      conditionGroup: null,
      dateScopeType: null,
      comparedTypeCode: null,
      disable: null,
      includeObsolete: null,
    },
  }
}

function globalFilter(groups) {
  return {
    filter: {
      logicType: 'AND',
      isGroupModule: false,
      condition: null,
      disable: null,
      includeObsolete: null,
      isPass: null,
      associatedConditions: [],
      matchAllLinks: false,
      isDevActivity: null,
      isSprintBlock: null,
      isVersionBlock: null,
      isCustomColumnBlock: null,
      childConditionGroupList: groups,
    },
    isOnlyShowAssociation: false,
  }
}

const LIST_FIELDS = ['issuekey', 'summary', 'issuetype', 'status', 'priority', 'assignee', 'space', 'createtime', 'updatetime']
const MY_TODO_VIEW_CODE = 'MY_TODO21941'

const clampInt = (v, def, min, max) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}
const requireStr = (args, key) => {
  const v = typeof args?.[key] === 'string' ? args[key].trim() : ''
  if (!v) throw new Error(`缺少参数 ${key}`)
  return v
}

// ---------------- 工具定义 ----------------
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const TOOLS = [
  {
    name: 'get_current_user',
    title: '当前登录用户',
    description: '获取当前在客户端登录的用户信息（姓名、账号、memberId、部门等）。AI 调用的所有工具都以该用户身份、按其数据权限执行。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
    async run(ctx) {
      const u = (await callBackend(ctx, 'GET', '/personal-center/info')) || {}
      return {
        memberId: u.memberId,
        name: u.realName,
        account: u.coAccount,
        enName: u.userEnName,
        email: u.email,
        dept: u.deptInfo || u.actualDept || u.organizationName,
      }
    },
  },
  {
    name: 'search_issues',
    title: '搜索事项',
    description:
      '按单号或标题模糊搜索事项（需求 / 任务 / 缺陷等）。keyword 形如 "RD-123" 时按单号匹配，否则按标题（概要）匹配。返回单号、标题、类型、状态等，详情用 get_issue。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '单号（如 RD-000042，可只写一部分）或标题关键字' },
        spaceCode: { type: 'string', description: '只在该空间内搜索（空间编码，见 list_spaces）；不传为全部空间' },
        page: { type: 'integer', minimum: 1, default: 1 },
      },
      required: ['keyword'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async run(ctx, args) {
      const keyword = requireStr(args, 'keyword')
      const byKey = /^[A-Za-z]{1,10}-\d*$/.test(keyword) || /^\d+$/.test(keyword)
      const data = await callBackend(ctx, 'POST', '/issue/fuzzy-query', {
        ...(byKey ? { issueKey: keyword } : { summary: keyword }),
        spaceCode: args?.spaceCode || undefined,
        page: clampInt(args?.page, 1, 1, 1000),
        pageSize: 10,
      })
      return {
        total: data?.total ?? 0,
        page: data?.currentPage ?? clampInt(args?.page, 1, 1, 1000),
        issues: (data?.list || []).map((it) => ({
          issueKey: it.issueKey,
          summary: it.summary,
          issueType: it.issueTypeName,
          status: it.statusName,
          createTime: it.createTime,
          updateTime: it.updateTime,
        })),
      }
    },
  },
  {
    name: 'list_my_issues',
    title: '我的事项',
    description: '列出经办人是当前登录用户的事项，默认只含未结束状态（即「我的待办」）。',
    inputSchema: {
      type: 'object',
      properties: {
        includeDone: { type: 'boolean', default: false, description: '是否包含已结束的事项' },
        spaceCode: { type: 'string', description: '只看该空间（空间编码，见 list_spaces）' },
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async run(ctx, args) {
      const groups = [condition('assignee', 'BELONG', ['CURRENT_USER'])]
      if (!args?.includeDone) groups.push(condition('status', 'BELONG', ['ALL_NOT_DONE']))
      if (args?.spaceCode) groups.push(condition('space', 'BELONG', [String(args.spaceCode)]))
      const data = await callBackend(ctx, 'POST', '/issue/query', {
        globalFilter: globalFilter(groups),
        group: { groupItemList: [], isFollowPreviousGroup: true },
        layered: { layeredItemList: [], layerType: 'FLAT' },
        page: clampInt(args?.page, 1, 1, 1000),
        pageSize: clampInt(args?.pageSize, 20, 1, 50),
        showField: { showFieldItemList: LIST_FIELDS },
        sort: { sortItemList: [{ field: { id: 'updatetime' }, sortTypeCode: 'DESC' }] },
        viewCode: MY_TODO_VIEW_CODE,
        needShowGroupValues: [],
        referencedFilter: { filter: null },
      })
      return {
        total: data?.total ?? 0,
        page: data?.currentPage,
        pageCount: data?.pageCount,
        issues: (data?.list || []).map(flattenRecord),
      }
    },
  },
  {
    name: 'get_issue',
    title: '事项详情',
    description: '获取事项详情：所有字段（标题、描述、状态、经办人、计划时间、自定义字段等）及所属空间。描述中的富文本已转为纯文本。',
    inputSchema: {
      type: 'object',
      properties: { issueKey: { type: 'string', description: '事项单号，如 RD-000042' } },
      required: ['issueKey'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async run(ctx, args) {
      const key = requireStr(args, 'issueKey')
      const data = await callBackend(ctx, 'POST', '/issue/queryDetail', { key })
      return {
        issueKey: data?.baseInfo?.issueKey || key,
        space: data?.baseInfo?.spaceName,
        spaceCode: data?.baseInfo?.spaceCode,
        workflow: data?.workflowName,
        fields: flattenDetail(data),
      }
    },
  },
  {
    name: 'get_issue_comments',
    title: '事项评论',
    description: '获取事项的评论列表（按时间倒序），含评论人、时间、引用的评论。',
    inputSchema: {
      type: 'object',
      properties: { issueKey: { type: 'string', description: '事项单号' } },
      required: ['issueKey'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async run(ctx, args) {
      const key = requireStr(args, 'issueKey')
      const list = await callBackend(ctx, 'POST', '/issue-comment/list', { key })
      return (list || []).map((c) => ({
        id: c.id,
        author: personText(c.author) || c.authorId,
        content: c.content,
        createTime: c.createTime,
        edited: !!c.edited || undefined,
        quote: c.quote ? (c.quote.deleted ? '（引用的评论已删除）' : { author: personText(c.quote.author), content: c.quote.content }) : undefined,
      }))
    },
  },
  {
    name: 'get_issue_change_logs',
    title: '事项变更记录',
    description: '获取事项的变更记录（创建、字段修改、状态流转），按时间倒序。',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: '事项单号' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: '最多返回条数' },
      },
      required: ['issueKey'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async run(ctx, args) {
      const key = requireStr(args, 'issueKey')
      const list = await callBackend(ctx, 'POST', '/issue/changeLogs', { key })
      return (list || []).slice(0, clampInt(args?.limit, 50, 1, 200)).map((l) => ({
        time: l.changeTime,
        operator: l.operatorId === 'system' ? '系统' : personText(l.operator) || l.operatorId,
        field: l.fieldName,
        from: l.oldValue ?? undefined,
        to: l.newValue ?? undefined,
      }))
    },
  },
  {
    name: 'get_issue_relations',
    title: '关联工单',
    description: '获取事项的父工单、子工单（及已完成数量）、同级工单。',
    inputSchema: {
      type: 'object',
      properties: { issueKey: { type: 'string', description: '事项单号' } },
      required: ['issueKey'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async run(ctx, args) {
      const issueKey = requireStr(args, 'issueKey')
      const r = await callBackend(ctx, 'POST', '/issue/relations', { issueKey })
      return {
        parent: relationItem(r?.parent),
        children: (r?.children || []).map(relationItem),
        childrenDone: r?.doneCount ?? 0,
        siblings: (r?.siblings || []).map(relationItem),
      }
    },
  },
  {
    name: 'list_spaces',
    title: '空间列表',
    description: '列出当前用户可见的空间（项目），含空间编码 spaceCode、单号前缀 spaceKey、所属组织。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
    async run(ctx) {
      const list = await callBackend(ctx, 'POST', '/space/options', {})
      return (list || []).map((s) => ({
        spaceCode: s.spaceCode,
        spaceName: s.spaceName,
        spaceKey: s.spaceKey,
        organization: s.organizationPathName || s.organizationName,
      }))
    },
  },
  {
    name: 'search_users',
    title: '搜索人员',
    description: '按姓名 / 账号 / 邮箱搜索人员，返回 memberId、姓名、账号、部门。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '姓名、账号或邮箱关键字' },
        pageSize: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      required: ['keyword'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    async run(ctx, args) {
      const data = await callBackend(ctx, 'POST', '/user/query', {
        keyword: requireStr(args, 'keyword'),
        isActive: 1,
        page: 1,
        pageSize: clampInt(args?.pageSize, 20, 1, 50),
      })
      return {
        total: data?.total ?? 0,
        users: (data?.list || []).map((u) => ({
          memberId: u.memberId || u.userNo,
          name: u.realName || u.name || u.displayName,
          account: u.coAccount || u.userCoAccount,
          email: u.email,
          dept: u.deptInfo || u.userDeptInfo,
        })),
      }
    },
  },
  {
    name: 'add_issue_comment',
    title: '发表评论',
    description: '以当前登录用户身份在事项下发表一条评论。会真实写入并通知相关人，请在用户明确要求时才调用。',
    inputSchema: {
      type: 'object',
      properties: {
        issueKey: { type: 'string', description: '事项单号' },
        content: { type: 'string', description: '评论内容（纯文本，换行会保留）' },
        quoteId: { type: 'integer', description: '引用的评论 ID（见 get_issue_comments），可选' },
      },
      required: ['issueKey', 'content'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async run(ctx, args) {
      const issueKey = requireStr(args, 'issueKey')
      const content = requireStr(args, 'content')
      if (content.length > 10000) throw new Error('评论内容过长（最多 10000 字）')
      // 评论为纯文本（与网页端 IssueComments 一致），换行原样保存
      const quoteId = Number.isInteger(args?.quoteId) ? args.quoteId : undefined
      const c = await callBackend(ctx, 'POST', '/issue-comment/create', { issueKey, content, ...(quoteId ? { quoteId } : {}) })
      return { ok: true, commentId: c?.id, issueKey }
    },
  },
]

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]))

// ---------------- JSON-RPC ----------------
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result })
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function handleRpc(ctx, msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid Request')
  }
  const isNotification = msg.id === undefined || msg.id === null
  const { method, params } = msg
  if (isNotification) return null // notifications/initialized 等：无需响应

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0]
      return rpcResult(msg.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'cooperise', title: 'Cooperise', version: ctx.version },
        instructions:
          'Cooperise 的事项数据：需求 / 任务 / 缺陷等统称「事项」，单号形如 RD-000042（前缀为空间标识）。' +
          '先用 search_issues / list_my_issues 找到单号，再用 get_issue 等工具查看详情。所有调用以客户端当前登录用户身份执行；' +
          'add_issue_comment 会真实发表评论，仅在用户明确要求时使用。',
      })
    }
    case 'ping':
      return rpcResult(msg.id, {})
    case 'tools/list':
      return rpcResult(msg.id, {
        tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
      })
    case 'tools/call': {
      const tool = TOOL_MAP.get(params?.name)
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool: ${params?.name}`)
      try {
        const data = await tool.run(ctx, params?.arguments || {})
        ctx.onToolCall?.(tool.name, true)
        return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(data ?? null, null, 2) }] })
      } catch (e) {
        ctx.onToolCall?.(tool.name, false)
        // 工具执行错误按 MCP 约定放在 result.isError，AI 能看到原因并调整
        return rpcResult(msg.id, { content: [{ type: 'text', text: String(e?.message || e) }], isError: true })
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${method}`)
  }
}

// ---------------- HTTP 服务 ----------------
function sendJson(res, status, body, extraHeaders) {
  const buf = Buffer.from(JSON.stringify(body))
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': buf.length, ...extraHeaders })
  res.end(buf)
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/**
 * @param {object} ctx
 * @param {() => string} ctx.getToken       当前登录 token（未登录为空串）
 * @param {() => string} ctx.getApiTarget   后端地址
 * @param {() => string} ctx.getAccessKey   访问密钥
 * @param {string} ctx.version
 * @param {number} port
 * @returns {Promise<import('http').Server>}
 */
function startMcpServer(ctx, port) {
  const server = http.createServer((req, res) => {
    const url = (req.url || '').split('?')[0]
    if (url !== MCP_PATH) return sendJson(res, 404, { error: 'Not Found，MCP 地址为 ' + MCP_PATH })

    // 浏览器页面发起的请求一律拒绝（MCP 客户端不带 Origin）
    if (req.headers.origin) return sendJson(res, 403, rpcError(null, -32000, 'Forbidden origin'))

    const auth = String(req.headers.authorization || '')
    const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!key || !safeEqual(key, ctx.getAccessKey())) {
      return sendJson(res, 401, rpcError(null, -32001, '访问密钥错误：请在客户端「客户端设置 → MCP 服务」复制最新配置'), {
        'WWW-Authenticate': 'Bearer',
      })
    }

    // 无状态服务：不提供 GET 的 SSE 流，也没有会话可删除
    if (req.method !== 'POST') return sendJson(res, 405, rpcError(null, -32000, 'Method Not Allowed'), { Allow: 'POST' })

    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) req.destroy()
      else chunks.push(c)
    })
    req.on('end', async () => {
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
      } catch {
        return sendJson(res, 400, rpcError(null, -32700, 'Parse error'))
      }
      const batch = Array.isArray(body)
      const msgs = batch ? body : [body]
      const responses = (await Promise.all(msgs.map((m) => handleRpc(ctx, m)))).filter(Boolean)
      if (!responses.length) {
        res.writeHead(202)
        return res.end()
      }
      sendJson(res, 200, batch ? responses : responses[0])
    })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve(server)
    })
  })
}

module.exports = { startMcpServer, TOOLS }
