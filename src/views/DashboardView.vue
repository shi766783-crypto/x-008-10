<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>财务看板</h2>
        <p class="page-sub">{{ monthLabel(currentMonth) }} 收支概览</p>
      </div>
    </div>

    <div class="kpis">
      <div class="card kpi">
        <span class="kpi-label">本月总收入</span>
        <b class="kpi-value income">¥{{ money(income) }}</b>
      </div>
      <div class="card kpi">
        <span class="kpi-label">本月总支出</span>
        <b class="kpi-value expense">¥{{ money(expense) }}</b>
      </div>
      <div class="card kpi">
        <span class="kpi-label">本月结余</span>
        <b class="kpi-value" :class="{ neg: balance < 0 }">¥{{ money(balance) }}</b>
      </div>
      <div class="card kpi">
        <span class="kpi-label">储蓄率</span>
        <b class="kpi-value accent">{{ savingsRate }}%</b>
      </div>
    </div>

    <div class="card health-card">
      <div class="health-head">
        <h3 class="card-title">财务健康度评估</h3>
        <span class="health-sub">{{ monthLabel(health.month) }} · 综合储蓄率、预算超支与连续记账</span>
      </div>

      <div v-if="health.available" class="health-body">
        <div class="health-score">
          <svg width="132" height="132" viewBox="0 0 132 132" class="health-ring">
            <circle cx="66" cy="66" :r="RING_RADIUS" fill="none" stroke="var(--bg-elevated)" :stroke-width="RING_STROKE" />
            <circle
              class="health-ring-progress"
              cx="66"
              cy="66"
              :r="RING_RADIUS"
              fill="none"
              :stroke="health.grade.color"
              :stroke-width="RING_STROKE"
              stroke-linecap="round"
              :stroke-dasharray="ringCirc"
              :stroke-dashoffset="ringCirc * (1 - health.score / 100)"
              transform="rotate(-90 66 66)"
            />
            <text x="66" y="63" text-anchor="middle" font-size="32" font-weight="800" :fill="health.grade.color">{{ health.score }}</text>
            <text x="66" y="84" text-anchor="middle" font-size="12" fill="var(--text-secondary)">综合分</text>
          </svg>
          <span class="grade-pill" :style="{ background: health.grade.color + '22', color: health.grade.color }">{{ health.grade.label }}</span>
        </div>

        <div class="health-factors">
          <div v-for="f in factorList" :key="f.key" class="factor">
            <div class="factor-head">
              <span class="factor-name">
                <em class="factor-dot" :style="{ background: f.available ? factorColor(f.score) : 'var(--border-color)' }"></em>
                {{ f.label }}
              </span>
              <b :style="{ color: f.available ? factorColor(f.score) : 'var(--text-secondary)' }">
                {{ f.available ? f.score + ' 分' : '数据不足' }}
              </b>
            </div>
            <div class="bar-track">
              <div
                class="bar"
                :style="{ width: (f.available ? f.score : 0) + '%', background: f.available ? factorColor(f.score) : 'var(--border-color)' }"
              ></div>
            </div>
            <div class="factor-hint" :class="{ muted: !f.available }">{{ f.hint }}</div>
          </div>
          <p class="health-tip">💡 {{ health.grade.tip }}</p>
        </div>
      </div>

      <div v-else class="health-empty">
        <div class="health-empty-icon">📊</div>
        <p class="health-empty-msg">{{ health.message }}</p>
        <div class="factor-mini-list">
          <div v-for="f in factorList" :key="f.key" class="factor-mini">
            <span class="factor-mini-state">{{ f.available ? '✓' : '○' }}</span>
            <span class="factor-mini-name">{{ f.label }}</span>
            <span class="factor-mini-hint">{{ f.hint }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card chart-card">
        <h3 class="card-title">各类别支出占比</h3>
        <div class="pie-layout">
          <PieChart :data="pieData" center-text="支出占比" />
          <div class="legend">
            <div v-for="(d, i) in pieData" :key="d.category" class="legend-row">
              <span class="legend-dot" :style="{ background: palette[i % palette.length] }"></span>
              <span class="legend-name">{{ d.category }}</span>
              <span class="legend-val">{{ d.percent }}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card chart-card">
        <h3 class="card-title">近 6 个月收支趋势</h3>
        <div class="chart-scroll">
          <BarChart :items="trendData" />
        </div>
        <div class="chart-legend">
          <span class="legend-dot income-dot"></span>收入
          <span class="legend-dot expense-dot"></span>支出
        </div>
      </div>
    </div>

    <div class="card empty" v-if="pieData.length === 0">
      <p>本月还没有支出记录，去「记账」页面记一笔吧。</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore, controllersApi } from '../data/store.js'
import { money, monthListFrom, monthLabel } from '../core/utils.js'
import PieChart from '../components/PieChart.vue'
import BarChart from '../components/BarChart.vue'

const store = useStore()
const { report } = controllersApi
const palette = ['#4f8df9', '#f9a54f', '#57c785', '#f45b69', '#936df0', '#f0c957', '#4fc3f7', '#ec6aa7', '#8bc34a']

const currentMonth = computed(() => new Date().toISOString().slice(0, 7))

const stats = computed(() => report.incomeAndExpense(currentMonth.value))
const income = computed(() => stats.value.income)
const expense = computed(() => stats.value.expense)
const balance = computed(() => stats.value.balance)
const savingsRate = computed(() => report.savingsRate(income.value, expense.value))

const pieData = computed(() => {
  const rows = report.expenseByCategory(currentMonth.value)
  const total = rows.reduce((s, r) => s + r.amount, 0) || 1
  return rows.map((r) => ({ ...r, percent: Math.round((r.amount / total) * 100) }))
})

const trendData = computed(() => {
  const months = monthListFrom(5)
  return report.monthlySeries(months).flatMap((m) => [
    { label: `${Number(m.month.slice(5))}月`, value: m.income },
    { label: '', value: m.expense }
  ])
})

// 依赖 store.transactions / store.budgets，记账或改预算后实时重新评估
const health = computed(() => controllersApi.health.financialHealth({
  transactions: store.transactions,
  budgets: store.budgets
}))
const factorList = computed(() => [
  { key: 'saving', ...health.value.factors.saving },
  { key: 'budget', ...health.value.factors.budget },
  { key: 'streak', ...health.value.factors.streak }
])

const RING_SIZE = 132
const RING_STROKE = 12
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const ringCirc = 2 * Math.PI * RING_RADIUS

const factorColor = (score) => (score >= 85 ? '#57c785' : score >= 70 ? '#4f8df9' : score >= 60 ? '#e0a41f' : '#f45b69')
</script>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 720px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
}
.kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kpi-label {
  font-size: 12px;
  color: var(--text-secondary);
}
.kpi-value {
  font-size: 24px;
  font-weight: 800;
}
.kpi-value.income { color: var(--income); }
.kpi-value.expense { color: var(--expense); }
.kpi-value.neg { color: var(--expense); }
.kpi-value.accent { color: var(--accent); }
.health-card {
  margin-bottom: 16px;
}
.health-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.health-head .card-title { margin: 0; }
.health-sub {
  font-size: 12px;
  color: var(--text-secondary);
}
.health-body {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}
.health-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.health-ring-progress {
  transition: stroke-dashoffset 0.4s ease, stroke 0.3s ease;
}
.grade-pill {
  font-size: 13px;
  font-weight: 800;
  padding: 3px 14px;
  border-radius: 999px;
}
.health-factors {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.factor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 5px;
}
.factor-name {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
}
.factor-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.factor-head b { font-size: 13px; }
.bar-track {
  height: 8px;
  background: var(--bg-elevated);
  border-radius: 999px;
  overflow: hidden;
}
.bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.35s ease, background 0.3s ease;
}
.factor-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.health-tip {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}
.health-empty {
  display: flex;
  gap: 18px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.health-empty-icon {
  font-size: 34px;
  line-height: 1;
  padding-top: 4px;
}
.health-empty-msg {
  margin: 0 0 12px;
  color: var(--text-secondary);
  font-size: 13px;
  max-width: 640px;
}
.factor-mini-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.factor-mini {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
}
.factor-mini-state { color: var(--text-secondary); width: 14px; flex-shrink: 0; }
.factor-mini-name { font-weight: 700; flex-shrink: 0; }
.factor-mini-hint { color: var(--text-secondary); }
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 860px) {
  .charts-grid { grid-template-columns: 1fr; }
}
.card-title {
  margin: 0 0 12px;
  font-size: 15px;
}
.pie-layout {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}
.legend {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.legend-name { flex: 1; color: var(--text-secondary); }
.legend-val { font-weight: 700; }
.chart-scroll {
  overflow-x: auto;
}
.chart-scroll > :deep(.chart-wrap) {
  min-width: 420px;
}
.chart-legend {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}
.income-dot { background: #4f8df9; }
.expense-dot { background: #f9a54f; }
</style>
