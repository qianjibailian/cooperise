<template>
  <div class="auth-page">
    <header class="auth-header">
      <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="auth-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0052D9" />
            <stop offset="100%" stop-color="#60A8FF" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill="url(#auth-logo-grad)" />
        <g transform="translate(24,24)">
          <path d="M14 0 A14 14 0 1 1 -14 0" stroke="#fff" stroke-width="4.5" stroke-linecap="round" fill="none" />
          <circle cx="6" cy="-6" r="3.2" fill="#FF9CCF" />
        </g>
      </svg>
      <span class="auth-brand">需求管控平台</span>
    </header>

    <div class="auth-body">
      <!-- 左侧：标题 + 表单卡片 -->
      <section class="auth-left">
        <h1 class="auth-title">
          {{ title }}<span v-if="highlight" class="auth-highlight">{{ highlight }}</span>
        </h1>
        <p class="auth-subtitle">{{ subtitle }}</p>

        <div class="auth-card">
          <slot />
        </div>
      </section>

      <!-- 右侧：看板墙插画 -->
      <section class="auth-visual" aria-hidden="true">
        <div class="wall">
          <div v-for="col in columns" :key="col.title" class="wall-col">
            <div class="col-title">{{ col.title }}</div>
            <div
              v-for="(card, i) in col.cards"
              :key="i"
              class="wall-card"
              :style="{ transform: `rotate(${card.rotate}deg)` }"
            >
              <span class="card-tag" :style="{ background: card.color }" />
              <span class="card-line" :style="{ width: card.w1 + '%' }" />
              <span class="card-line short" :style="{ width: card.w2 + '%' }" />
              <div class="card-foot">
                <span class="card-avatar" :style="{ background: card.color }" />
                <span class="card-bar"><i :style="{ width: card.progress + '%', background: card.color }" /></span>
              </div>
            </div>
          </div>

          <div class="sticky s1">上线前<br />回归测试</div>
          <div class="sticky s2">需求评审<br />周三 10:00</div>
          <div class="sticky s3">Sprint 19<br />冲刺目标</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  /** 标题末尾的强调词，渐变色显示 */
  highlight?: string
  subtitle: string
}>()

const columns = [
  {
    title: '待处理',
    cards: [
      { color: '#2F78E6', w1: 82, w2: 54, progress: 10, rotate: -1.2 },
      { color: '#8B5CF6', w1: 70, w2: 40, progress: 0, rotate: 0.8 },
      { color: '#F59E0B', w1: 88, w2: 60, progress: 5, rotate: -0.4 },
    ],
  },
  {
    title: '进行中',
    cards: [
      { color: '#10B981', w1: 76, w2: 48, progress: 55, rotate: 1.1 },
      { color: '#2F78E6', w1: 90, w2: 36, progress: 70, rotate: -0.9 },
    ],
  },
  {
    title: '已完成',
    cards: [
      { color: '#EC4899', w1: 68, w2: 52, progress: 100, rotate: -1.5 },
      { color: '#10B981', w1: 84, w2: 44, progress: 100, rotate: 0.6 },
      { color: '#8B5CF6', w1: 72, w2: 58, progress: 100, rotate: 1.3 },
    ],
  },
]
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

.auth-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: clamp(14px, 2vw, 24px) clamp(16px, 3vw, 40px);
}

.auth-brand {
  font-size: clamp(17px, 1.4vw, 20px);
  font-weight: 600;
  letter-spacing: 0.2px;
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


/* ========== 右侧插画 ========== */
.auth-visual {
  flex: 1 1 0;
  min-width: 0;
  max-width: 880px;
  border-radius: clamp(16px, 2vw, 28px);
  overflow: hidden;
  background:
    radial-gradient(circle at 80% 85%, rgba(255, 196, 140, 0.45), transparent 45%),
    radial-gradient(circle at 15% 10%, rgba(180, 205, 245, 0.55), transparent 50%),
    linear-gradient(160deg, #eef0f3 0%, #e4e2dc 100%);
}

.wall {
  position: relative;
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
  font-size: 13px;
  font-weight: 600;
  color: #55534e;
}

.wall-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: clamp(10px, 1vw, 14px);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(60, 50, 40, 0.1);
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
}

.sticky {
  position: absolute;
  padding: clamp(10px, 1.1vw, 16px) clamp(12px, 1.2vw, 18px);
  font-size: clamp(12px, 1vw, 14px);
  line-height: 1.5;
  color: #4a4335;
  white-space: nowrap;
  box-shadow: 0 10px 24px rgba(60, 50, 40, 0.16);
}

.sticky.s1 {
  right: 8%;
  bottom: 8%;
  background: #fde68a;
  transform: rotate(4deg);
}

.sticky.s2 {
  left: 34%;
  bottom: 16%;
  background: #fbcfe8;
  transform: rotate(-5deg);
}

.sticky.s3 {
  right: 9%;
  top: 4%;
  background: #bfdbfe;
  transform: rotate(-3deg);
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
