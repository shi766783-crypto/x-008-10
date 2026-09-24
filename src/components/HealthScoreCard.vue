<template>
  <div class="card health-card">
    <div class="health-head">
      <h3 class="card-title">财务健康度</h3>
      <span class="health-sub">综合储蓄率 · 预算执行 · 记账习惯</span>
    </div>

    <div v-if="health.status === 'insufficient'" class="health-empty">
      <div class="health-gauge gauge-pending">
        <span class="gauge-num">—</span>
      </div>
      <div class="health-empty-body">
        <b>数据不足，暂不评分</b>
        <p>{{ health.message }}</p>
      </div>
    </div>

    <div v-else class="health-body">
      <div class="gauge-wrap" :class="health.tone">
        <svg width="120" height="120" class="gauge-svg">
          <circle cx="60" cy="60" :r="radius" fill="none" stroke="var(--bg-elevated)" stroke-width="12" />
          <circle
            cx="60"
            cy="60"
            :r="radius"
            fill="none"
            :stroke="gaugeColor"
            stroke-width="12"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
        <div class="gauge-center">
          <b class="gauge-num">{{ health.score }}</b>
          <span class="gauge-grade">{{ health.grade }}</span>
        </div>
      </div>

      <div class="dim-list">
        <div v-for="d in dimensionRows" :key="d.key" class="dim-row" :class="{ muted: !d.value }">
          <div class="dim-top">
            <span class="dim-name">{{ d.name }}</span>
            <span v-if="d.value" class="dim-raw">{{ d.raw }}</span>
            <span v-else class="dim-tag">待补充</span>
          </div>
          <div class="bar-track">
            <div class="bar" :class="barClass(d)" :style="{ width: (d.value ? d.value.score : 0) + '%' }"></div>
          </div>
          <div class="dim-note">{{ d.value ? d.value.note : d.emptyText }}</div>
        </div>
      </div>

      <p class="health-summary">{{ health.summary }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  health: { type: Object, required: true }
})

const radius = 54
const circumference = 2 * Math.PI * radius
const dashOffset = computed(() => circumference * (1 - Math.min(100, Math.max(0, props.health.score || 0)) / 100))
const gaugeColor = computed(() => {
  if (props.health.tone === 'danger') return '#f45b69'
  if (props.health.tone === 'warn') return '#f0c957'
  return '#57c785'
})

const dimensionRows = computed(() => {
  const dims = props.health.dimensions
  return [
    {
      key: 'savings',
      name: '当月储蓄率',
      value: dims.savings,
      raw: dims.savings ? `${dims.savings.rate}%` : '',
      emptyText: '记一笔收支后可评估'
    },
    {
      key: 'budget',
      name: '预算执行',
      value: dims.budget,
      raw: dims.budget ? `${dims.budget.score} 分` : '',
      emptyText: '设置本月类别预算后可评估'
    },
    {
      key: 'streak',
      name: '连续记账',
      value: dims.streak,
      raw: dims.streak ? `${dims.streak.streak} 天` : '',
      emptyText: '开始记账后可评估'
    }
  ]
})

const barClass = (d) => {
  if (!d.value) return ''
  return d.value.score >= 75 ? 'ok' : d.value.score >= 50 ? 'warn' : 'danger'
}
</script>

<style scoped>
.health-card {
  margin-bottom: 16px;
}
.health-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}
.card-title {
  margin: 0;
  font-size: 15px;
}
.health-sub {
  font-size: 12px;
  color: var(--text-secondary);
}
.health-empty {
  display: flex;
  align-items: center;
  gap: 18px;
}
.gauge-pending {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 12px solid var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.gauge-pending .gauge-num {
  font-size: 30px;
  font-weight: 800;
  color: var(--text-secondary);
}
.health-empty-body b { font-size: 15px; }
.health-empty-body p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}
.health-body {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 20px;
  align-items: center;
}
.gauge-wrap {
  position: relative;
  width: 120px;
  height: 120px;
}
.gauge-svg {
  display: block;
  transform: rotate(-90deg);
}
.gauge-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.gauge-num {
  font-size: 30px;
  font-weight: 800;
  line-height: 1.1;
}
.gauge-grade {
  font-size: 12px;
  font-weight: 700;
  margin-top: 2px;
}
.gauge-wrap.ok .gauge-num,
.gauge-wrap.ok .gauge-grade { color: var(--income); }
.gauge-wrap.warn .gauge-num,
.gauge-wrap.warn .gauge-grade { color: var(--warn); }
.gauge-wrap.danger .gauge-num,
.gauge-wrap.danger .gauge-grade { color: var(--expense); }
.dim-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dim-row { min-width: 0; }
.dim-row.muted { opacity: 0.75; }
.dim-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.dim-name { font-size: 13px; font-weight: 600; }
.dim-raw { font-size: 13px; font-weight: 800; }
.dim-tag {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  padding: 1px 8px;
  border-radius: 999px;
}
.bar-track {
  height: 8px;
  background: var(--bg-elevated);
  border-radius: 999px;
  overflow: hidden;
}
.bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}
.bar.ok { background: linear-gradient(90deg, #57c785, #3aa66f); }
.bar.warn { background: linear-gradient(90deg, #f0c957, #e0a41f); }
.bar.danger { background: linear-gradient(90deg, #f45b69, #d63a4a); }
.dim-note {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
}
.health-summary {
  grid-column: 1 / -1;
  margin: 2px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-primary);
}
@media (max-width: 640px) {
  .health-body { grid-template-columns: 1fr; justify-items: center; }
  .dim-list { width: 100%; }
}
</style>
