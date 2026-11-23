<template>
  <div class="auth-page">
    <!-- 默认：左上角 logo + 品牌名；logoAboveCard 时隐藏，改放到表单上方 -->
    <header v-if="!logoAboveCard" class="auth-header">
      <AuthLogo :size="28" />
      <span class="auth-brand">Cooperise</span>
    </header>

    <div class="auth-body" :class="{ 'no-header': logoAboveCard, 'no-visual': noVisual }">
      <!-- 左侧：看板墙插画 -->
      <section v-if="!noVisual" class="auth-visual" aria-hidden="true">
        <span class="glow g1" />
        <span class="glow g2" />

        <div class="wall">
          <div v-for="col in columns" :key="col.key" class="wall-col">
            <div class="col-title">
              {{ col.title }}
              <span class="col-count">{{ col.cards.length }}</span>
            </div>
            <TransitionGroup name="card" tag="div" class="col-cards" @before-leave="pinLeaving">
              <div
                v-for="card in col.cards"
                :key="card.id"
                class="wall-card"
                :class="{ done: col.key === 'done' }"
                :style="{ '--r': card.rotate + 'deg' }"
              >
                <span class="card-tag" :style="{ background: card.color }" />
                <span class="card-line" :style="{ width: card.w1 + '%' }" />
                <span class="card-line short" :style="{ width: card.w2 + '%' }" />
                <div class="card-foot">
                  <span class="card-avatar" :style="{ background: card.color }" />
                  <span class="card-bar"><i :style="{ width: card.progress + '%', background: card.color }" /></span>
                </div>
                <span v-if="col.key === 'done'" class="card-check">✓</span>
              </div>
            </TransitionGroup>
          </div>

          <div class="sticky s1">上线前<br />回归测试</div>
          <div class="sticky s2">需求评审<br />周三 10:00</div>
          <div class="sticky s3">Sprint 19<br />冲刺目标</div>
        </div>
      </section>

      <!-- 右侧：标题 + 表单卡片 -->
      <section class="auth-left">
        <!-- 表单上方的品牌标识（登录页用） -->
        <div v-if="logoAboveCard" class="auth-logo-card">
          <AuthLogo :size="56" />
          <span class="auth-brand auth-brand-lg">Cooperise</span>
        </div>

        <h1 v-if="title || highlight" class="auth-title">
          {{ title }}<span v-if="highlight" class="auth-highlight">{{ highlight }}</span>
        </h1>
        <p v-if="subtitle" class="auth-subtitle">{{ subtitle }}</p>

        <div class="auth-card">
          <slot />
        </div>

        <!-- 中英文切换：放在表单卡片下方，不随窗口宽度压到插画上（客户端窗口较窄） -->
        <div v-if="!hideLang" class="auth-lang" data-no-i18n>
          <button type="button" :class="{ active: locale === 'zh' }" @click="setLocale('zh')">中文</button>
          <span class="auth-lang-sep">/</span>
          <button type="button" :class="{ active: locale === 'en' }" @click="setLocale('en')">English</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import AuthLogo from './AuthLogo.vue'
import { useLocale } from '@/i18n'

const { locale, setLocale } = useLocale()

const props = defineProps<{
  /** true：不渲染右侧插画，表单区域居中铺满 */
  noVisual?: boolean
  /** true：不渲染底部中英文切换 */
  hideLang?: boolean
  /** 标题（不传则不渲染） */
  title?: string
  /** 标题末尾的强调词，渐变色显示 */
  highlight?: string
  /** 副标题（不传则不渲染） */
  subtitle?: string
  /** true：不渲染左上角 header，logo 改到表单卡片上方 */
  logoAboveCard?: boolean
}>()

// ---------- 右侧插画：一块"会动"的看板 ----------
// 卡片按 待处理 → 进行中 → 已完成 循环流转，进行中的进度条持续增长

interface WallCard {
  id: number
  color: string
  w1: number
  w2: number
  progress: number
  rotate: number
}

const COLORS = ['#2F78E6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899']
const LIMIT = { todo: 3, doing: 2, done: 3 }

let seq = 0
function makeCard(partial: Partial<WallCard> = {}): WallCard {
  return {
    id: ++seq,
    color: COLORS[seq % COLORS.length],
    w1: 66 + Math.round(Math.random() * 26),
    w2: 34 + Math.round(Math.random() * 26),
    progress: 0,
    rotate: +(Math.random() * 3 - 1.5).toFixed(1),
    ...partial,
  }
}

const columns = reactive([
  {
    key: 'todo' as const,
    title: '待处理',
    cards: [
      makeCard({ color: '#2F78E6', w1: 82, w2: 54, rotate: -1.2 }),
      makeCard({ color: '#8B5CF6', w1: 70, w2: 40, rotate: 0.8 }),
      makeCard({ color: '#F59E0B', w1: 88, w2: 60, rotate: -0.4 }),
    ],
  },
  {
    key: 'doing' as const,
    title: '进行中',
    cards: [
      makeCard({ color: '#10B981', w1: 76, w2: 48, progress: 55, rotate: 1.1 }),
      makeCard({ color: '#2F78E6', w1: 90, w2: 36, progress: 30, rotate: -0.9 }),
    ],
  },
  {
    key: 'done' as const,
    title: '已完成',
    cards: [
      makeCard({ color: '#EC4899', w1: 68, w2: 52, progress: 100, rotate: -1.5 }),
      makeCard({ color: '#10B981', w1: 84, w2: 44, progress: 100, rotate: 0.6 }),
      makeCard({ color: '#8B5CF6', w1: 72, w2: 58, progress: 100, rotate: 1.3 }),
    ],
  },
])

function tick() {
  if (document.hidden) return
  const [todo, doing, done] = columns

  // 1. 进行中的卡片推进进度
  doing.cards.forEach((c) => {
    c.progress = Math.min(100, c.progress + 18 + Math.round(Math.random() * 20))
  })

  // 2. 进度满的卡片挪到「已完成」顶部
  const finishedIdx = doing.cards.findIndex((c) => c.progress >= 100)
  if (finishedIdx >= 0) {
    const [card] = doing.cards.splice(finishedIdx, 1)
    done.cards.unshift(card)
    if (done.cards.length > LIMIT.done) done.cards.pop()
  }

  // 3. 「进行中」有空位时，从待处理领一张，并补一张新需求
  if (doing.cards.length < LIMIT.doing && todo.cards.length) {
    const card = todo.cards.shift()!
    card.progress = 6
    doing.cards.push(card)
    todo.cards.push(makeCard())
    if (todo.cards.length > LIMIT.todo) todo.cards.shift()
  }
}

/** 离场卡片脱离文档流前，钉住当前位置，避免跳到列顶 */
function pinLeaving(el: Element) {
  const node = el as HTMLElement
  node.style.top = `${node.offsetTop}px`
  node.style.left = `${node.offsetLeft}px`
  node.style.width = `${node.offsetWidth}px`
}

let timer: number | undefined
onMounted(() => {
  if (props.noVisual) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  timer = window.setInterval(tick, 2400)
})
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 中英文切换（表单卡片下方）：当前语言高亮 */
.auth-lang {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  font-size: 13px;
  color: #c7c7cc;
}

.auth-lang button {
  padding: 2px 4px;
  border: 0;
  background: none;
  color: #8e8e93;
  font: inherit;
  cursor: pointer;
  transition: color 0.15s;
}

.auth-lang button:hover {
  color: #1a1a1a;
}

.auth-lang button.active {
  color: #1a1a1a;
  font-weight: 600;
  cursor: default;
}

.auth-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: clamp(14px, 2vw, 24px) clamp(16px, 3vw, 40px);
}

/* 品牌字标：衬线展示体、混合大小写、字距收紧（颜色沿用原有文字色） */
.auth-brand {
  font-family: Georgia, "Times New Roman", "Songti SC", "SimSun", serif;
  font-size: clamp(17px, 1.4vw, 20px);
  font-weight: 700;
  font-style: italic;
  letter-spacing: -0.01em;
  line-height: 1.1;
  user-select: none;
}

/* 表单上方的品牌标识（logo + 名称），居中 */
.auth-logo-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: clamp(20px, 3vh, 32px);
}

/* 表单上方的品牌名比左上角那版更大 */
.auth-brand-lg {
  font-size: clamp(28px, 2.6vw, 36px);
  letter-spacing: -0.01em;
}

.auth-body {
  flex: 1;
  display: flex;
  gap: clamp(24px, 4vw, 64px);
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 0 clamp(16px, 3.5vw, 56px) clamp(16px, 3.5vw, 56px);
}

/* 没有顶部 header 时，给右侧插画留出与底部一致的上边距 */
.auth-body.no-header {
  padding-top: clamp(16px, 3.5vw, 56px);
}

/* 无插画：表单区域占满整个内容区，卡片居中 */
.auth-body.no-visual {
  max-width: 560px;
}

/* ========== 左侧 ========== */
.auth-left {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: clamp(8px, 3vh, 32px) 0;
}

.auth-title {
  margin: 0 0 clamp(10px, 1.8vh, 18px);
  font-size: clamp(36px, 4.4vw, 64px);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.5px;
  color: #1a1a1a;
  text-align: center;
}

.auth-highlight {
  background: linear-gradient(120deg, #0052d9 0%, #6c5ce7 55%, #ec4899 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.auth-subtitle {
  margin: 0 0 clamp(24px, 4.5vh, 44px);
  font-size: clamp(15px, 1.25vw, 18px);
  letter-spacing: 1px;
  color: #6b6a65;
  text-align: center;
}

.auth-card {
  width: 100%;
  max-width: 460px;
  padding: clamp(20px, 2.4vw, 32px) clamp(18px, 2.4vw, 32px) clamp(18px, 2vw, 24px);
  border: 1px solid #ececec;
  border-radius: clamp(20px, 2vw, 28px);
  background: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
}


/* ========== 左侧插画 ========== */
.auth-visual {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  max-width: 880px;
  border-radius: clamp(16px, 2vw, 28px);
  overflow: hidden;
  background: linear-gradient(160deg, #eef0f3 0%, #e4e2dc 100%);
}

/* 背景两团柔光缓慢漂移 */
.glow {
  position: absolute;
  width: 70%;
  aspect-ratio: 1;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(10px);
}

.glow.g1 {
  left: -20%;
  top: -25%;
  background: radial-gradient(circle, rgba(180, 205, 245, 0.75), transparent 65%);
  animation: drift-a 16s ease-in-out infinite alternate;
}

.glow.g2 {
  right: -25%;
  bottom: -30%;
  background: radial-gradient(circle, rgba(255, 196, 140, 0.6), transparent 65%);
  animation: drift-b 19s ease-in-out infinite alternate;
}

@keyframes drift-a {
  to { transform: translate(18%, 14%) scale(1.12); }
}

@keyframes drift-b {
  to { transform: translate(-16%, -12%) scale(1.1); }
}

.wall {
  position: relative;
  z-index: 1;
  height: 100%;
  min-height: 520px;
  display: flex;
  align-items: flex-start;
  gap: clamp(12px, 1.5vw, 20px);
  padding: clamp(40px, 7vh, 72px) clamp(20px, 3vw, 40px);
}

.wall-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.2vw, 16px);
  padding: clamp(10px, 1vw, 14px);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(4px);
}

.col-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #55534e;
}

.col-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: #77746d;
}

.col-cards {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 1.2vw, 16px);
}

.wall-card {
  --r: 0deg;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: clamp(10px, 1vw, 14px);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(60, 50, 40, 0.1);
  transform: rotate(var(--r));
}

.wall-card.done .card-line {
  opacity: 0.6;
}

.card-check {
  position: absolute;
  top: 8px;
  right: 10px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #10b981;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  animation: pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s both;
}

@keyframes pop {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

/* 卡片流转：进场从上方落下，离场缩小淡出，其余卡片平滑让位 */
.card-move,
.card-enter-active {
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease;
}

.card-leave-active {
  position: absolute;
  transition: transform 0.4s ease, opacity 0.4s ease;
}

.card-enter-from {
  opacity: 0;
  transform: translateY(-16px) scale(0.94) rotate(var(--r));
}

.card-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.92) rotate(var(--r));
}

.card-tag {
  width: 32px;
  height: 6px;
  border-radius: 3px;
}

.card-line {
  height: 8px;
  border-radius: 4px;
  background: #e6e4df;
}

.card-line.short {
  background: #efede9;
}

.card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.card-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  opacity: 0.8;
  flex-shrink: 0;
}

.card-bar {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: #f0eeea;
  overflow: hidden;
}

.card-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 便签：保留各自倾角，轻微上下浮动 */
.sticky {
  --r: 0deg;
  position: absolute;
  z-index: 2;
  transform: rotate(var(--r));
  animation: float 6s ease-in-out infinite;
  padding: clamp(10px, 1.1vw, 16px) clamp(12px, 1.2vw, 18px);
  font-size: clamp(12px, 1vw, 14px);
  line-height: 1.5;
  color: #4a4335;
  white-space: nowrap;
  box-shadow: 0 10px 24px rgba(60, 50, 40, 0.16);
}

.sticky.s1 {
  --r: 4deg;
  right: 8%;
  bottom: 8%;
  background: #fde68a;
}

.sticky.s2 {
  --r: -5deg;
  left: 34%;
  bottom: 16%;
  background: #fbcfe8;
  animation-duration: 7s;
  animation-delay: -2s;
}

.sticky.s3 {
  --r: -3deg;
  right: 9%;
  top: 4%;
  background: #bfdbfe;
  animation-duration: 8s;
  animation-delay: -4s;
}

@keyframes float {
  0%,
  100% { transform: translateY(0) rotate(var(--r)); }
  50% { transform: translateY(-8px) rotate(calc(var(--r) + 1.5deg)); }
}

/* 系统开启「减少动态效果」时关闭所有动画 */
@media (prefers-reduced-motion: reduce) {
  .glow,
  .sticky,
  .card-check {
    animation: none;
  }
}

/* 笔记本小屏：插画收窄，只保留两列 */
@media (max-width: 1280px) {
  .auth-visual {
    flex-basis: 0;
    flex-grow: 0.8;
  }

  .wall-col:nth-child(3),
  .sticky.s2 {
    display: none;
  }
}

/* 平板及以下：隐藏插画，表单居中 */
@media (max-width: 1024px) {
  .auth-visual {
    display: none;
  }
}

/* 手机：卡片去边框阴影，贴近原生 */
@media (max-width: 560px) {
  .auth-body {
    padding-bottom: 24px;
  }

  .auth-left {
    justify-content: flex-start;
    padding-top: 6vh;
  }

  .auth-card {
    padding: 4px 0 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}

/* 窗口高度较矮（横屏手机、小窗口）：压缩纵向留白 */
@media (max-height: 720px) and (min-width: 561px) {
  .auth-left {
    justify-content: flex-start;
  }

  .auth-title {
    font-size: clamp(30px, 3.4vw, 44px);
  }

  .wall {
    min-height: 0;
  }
}
</style>

<style>
/* 登录 / 注册页通用 */
.auth-btn {
  width: 100%;
  height: clamp(44px, 5vh, 48px);
  margin-top: 20px;
  border: none;
  border-radius: 10px;
  background: #1a1a1a;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.auth-btn:hover:not(:disabled) {
  background: #000;
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.auth-terms {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6b6a65;
}

.auth-terms a {
  color: #2c5aa0;
}

.auth-switch {
  margin: 16px 0 0;
  padding-top: 16px;
  border-top: 1px solid #f0f0ef;
  font-size: 14px;
  color: #6b6a65;
  text-align: center;
}

.auth-switch a {
  margin-left: 4px;
  color: #1a1a1a;
  font-weight: 500;
}

.auth-switch a:hover {
  color: #0052d9;
}
</style>
