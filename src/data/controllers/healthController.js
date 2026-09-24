import { loadTransactions } from './transactionController.js'
import { loadBudgets } from './budgetController.js'
import { TRANSACTION_TYPES } from '../../core/constants.js'
import { todayStr, monthStrOf } from '../../core/utils.js'

// 三个维度的权重：储蓄率 40% / 预算超支 30% / 连续记账 30%
export const HEALTH_WEIGHTS = { saving: 0.4, budget: 0.3, streak: 0.3 }
// 至少有 2 个维度可评估时才给出分数，避免数据太少硬算
const MIN_FACTORS = 2

export const HEALTH_GRADES = [
  { key: 'excellent', label: '优秀', color: '#57c785', tip: '储蓄、预算与记账习惯都很出色，继续保持！' },
  { key: 'good', label: '良好', color: '#4f8df9', tip: '整体财务状况不错，关注待提升的维度还能更进一步。' },
  { key: 'fair', label: '一般', color: '#f0c957', tip: '财务状况中规中矩，试着减少超支或提高储蓄率。' },
  { key: 'poor', label: '待改善', color: '#f45b69', tip: '当前财务压力较大，建议先从坚持记账和控制预算开始。' }
]

function clamp(n, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n))
}

function gradeOf(score) {
  if (score >= 85) return HEALTH_GRADES[0]
  if (score >= 70) return HEALTH_GRADES[1]
  if (score >= 60) return HEALTH_GRADES[2]
  return HEALTH_GRADES[3]
}

// 与 achievementController.computeCurrentStreak 同口径：从今天往前连续有记录的天数
function currentStreakOf(transactions) {
  const days = new Set(transactions.map((t) => t.date))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    if (days.has(todayStr(-i))) streak++
    else break
  }
  return streak
}

function savingFactor(rows, month) {
  let income = 0
  let expense = 0
  for (const t of rows) {
    if (t.type === TRANSACTION_TYPES.TRANSFER || !t.date.startsWith(month)) continue
    if (t.type === TRANSACTION_TYPES.INCOME) income += t.amount
    else expense += t.amount
  }
  if (income <= 0) {
    return {
      available: false,
      score: null,
      rate: null,
      weight: HEALTH_WEIGHTS.saving,
      label: '本月储蓄率',
      hint: '本月还没有收入记录，记一笔收入后即可评估储蓄率'
    }
  }
  const rate = (income - expense) / income
  const percent = Math.round(rate * 100)
  // 负储蓄率 0 分，30% 及以上满分，中间线性计算
  const score = clamp(Math.round((rate / 0.3) * 100))
  const hint = `本月储蓄率 ${percent}%（收入 ¥${income.toFixed(2)}，支出 ¥${expense.toFixed(2)}）`
  return { available: true, score, rate: percent, weight: HEALTH_WEIGHTS.saving, label: '本月储蓄率', hint }
}

function budgetFactor(rows, budgets, month) {
  const monthBudgets = budgets.filter((b) => b.month === month)
  if (monthBudgets.length === 0) {
    return {
      available: false,
      score: null,
      overspent: [],
      weight: HEALTH_WEIGHTS.budget,
      label: '预算超支',
      hint: '本月还没有设置预算，去「月度预算」设定类别上限'
    }
  }
  const usage = new Map()
  for (const t of rows) {
    if (t.type !== TRANSACTION_TYPES.EXPENSE || !t.date.startsWith(month)) continue
    usage.set(t.category, (usage.get(t.category) || 0) + t.amount)
  }
  const overspent = monthBudgets
    .filter((b) => (usage.get(b.category) || 0) > b.limit)
    .map((b) => b.category)
  const score = Math.round(((monthBudgets.length - overspent.length) / monthBudgets.length) * 100)
  const hint = overspent.length
    ? `${overspent.length} 个类别超支：${overspent.join('、')}`
    : `${monthBudgets.length} 个预算类别均未超支`
  return { available: true, score, overspent, weight: HEALTH_WEIGHTS.budget, label: '预算超支', hint }
}

function streakFactor(transactions, streak) {
  if (transactions.length === 0) {
    return {
      available: false,
      score: null,
      streak: 0,
      weight: HEALTH_WEIGHTS.streak,
      label: '连续记账',
      hint: '还没有记账记录，连续记账习惯将从第一笔开始累计'
    }
  }
  // 7 天 60 分、14 天 80 分、30 天满分
  const score = streak >= 30 ? 100 : streak >= 14 ? 80 : streak >= 7 ? 60 : streak >= 3 ? 30 : 10
  const hint = streak > 0 ? `已连续记账 ${streak} 天` : '今天还没有记账，连续记录已中断'
  return { available: true, score, streak, weight: HEALTH_WEIGHTS.streak, label: '连续记账', hint }
}

/**
 * 财务健康度评估。
 * 可传入 transactions / budgets（响应式数据），不传则从本地存储读取。
 * 数据太少（可评估维度 < 2）时返回 available:false 与说明，不硬算分数。
 */
export function financialHealth({ transactions = loadTransactions(), budgets = loadBudgets() } = {}) {
  const month = monthStrOf(todayStr())
  const rows = transactions || []
  const streak = currentStreakOf(rows)
  const factors = {
    saving: savingFactor(rows, month),
    budget: budgetFactor(rows, budgets || [], month),
    streak: streakFactor(rows, streak)
  }
  const availableFactors = Object.values(factors).filter((f) => f.available)

  if (rows.length === 0) {
    return {
      available: false,
      score: null,
      grade: null,
      month,
      factors,
      reasons: ['还没有任何记账记录'],
      message: '还没有任何记账记录，先去「记账」记一笔，之后这里会给出综合健康度评分。'
    }
  }

  if (availableFactors.length < MIN_FACTORS) {
    return {
      available: false,
      score: null,
      grade: null,
      month,
      factors,
      reasons: Object.values(factors).filter((f) => !f.available).map((f) => f.hint),
      message: `当前只有 ${availableFactors.length} 个维度可评估，数据太少暂不打分：${Object.values(factors)
        .filter((f) => !f.available)
        .map((f) => f.hint)
        .join('；')}。`
    }
  }

  const weightSum = availableFactors.reduce((s, f) => s + f.weight, 0)
  const score = Math.round(availableFactors.reduce((s, f) => s + f.score * f.weight, 0) / weightSum)
  return { available: true, score, grade: gradeOf(score), month, factors }
}
