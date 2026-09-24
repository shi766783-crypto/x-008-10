import { loadTransactions } from './transactionController.js'
import { loadBudgets } from './budgetController.js'
import { incomeAndExpense, budgetUsage } from './reportController.js'
import { computeCurrentStreak } from './achievementController.js'
import { todayStr } from '../../core/utils.js'

// 三个维度的权重，合计 100
const WEIGHTS = { savings: 45, budget: 30, streak: 25 }

// 综合健康度等级
const GRADES = [
  { min: 85, label: '优秀', tone: 'ok' },
  { min: 70, label: '良好', tone: 'ok' },
  { min: 50, label: '一般', tone: 'warn' },
  { min: 0, label: '待改善', tone: 'danger' }
]

// 连续记账天数的分档
const STREAK_STEPS = [
  { days: 30, score: 100, note: '已坚持 30 天以上' },
  { days: 14, score: 85, note: '已坚持 14 天以上' },
  { days: 7, score: 70, note: '已坚持 7 天以上' },
  { days: 3, score: 50, note: '已坚持 3 天以上' },
  { days: 1, score: 30, note: '刚刚开始' },
  { days: 0, score: 0, note: '今天还没记账' }
]

function rateScore(ratePct) {
  if (ratePct >= 50) return { score: 100, note: '储蓄率非常出色' }
  if (ratePct >= 30) return { score: 90, note: '储蓄率高于建议水平' }
  if (ratePct >= 20) return { score: 75, note: '达到 20% 的健康线' }
  if (ratePct >= 10) return { score: 55, note: '略有结余，仍有提升空间' }
  if (ratePct >= 0) return { score: 35, note: '接近月光，建议压缩支出' }
  return { score: 0, note: '本月入不敷出' }
}

function streakScore(streak) {
  return STREAK_STEPS.find((s) => streak >= s.days) || STREAK_STEPS[STREAK_STEPS.length - 1]
}

function budgetDimension(month) {
  const budgets = loadBudgets().filter((b) => b.month === month)
  if (budgets.length === 0) return null
  const usage = budgetUsage(month)
  const overspent = []
  const near = []
  for (const b of budgets) {
    const used = usage.get(b.category) || 0
    const percent = b.limit > 0 ? used / b.limit : 0
    if (percent > 1) overspent.push(b.category)
    else if (percent >= 0.8) near.push(b.category)
  }
  let score
  let note
  if (overspent.length === 0) {
    score = near.length === 0 ? 100 : 80
    note = near.length === 0 ? '所有类别均在预算内' : `临近上限：${near.join('、')}`
  } else {
    score = Math.max(0, 50 - (overspent.length - 1) * 20)
    note = `超支类别：${overspent.join('、')}`
  }
  return { score, note, overspent, near, budgetCount: budgets.length }
}

function buildSummary(dimensions, gradeLabel) {
  const tips = []
  if (dimensions.savings && dimensions.savings.rate < 0) tips.push('本月支出已超过收入，先止住赤字')
  else if (dimensions.savings && dimensions.savings.rate < 20) tips.push('争取把储蓄率提到 20%')
  if (dimensions.budget && dimensions.budget.overspent.length > 0) tips.push('收紧超支类别的消费')
  if (dimensions.streak && dimensions.streak.streak < 3) tips.push('保持每天记账，数据会更准')
  if (tips.length === 0) return `各项表现稳定，继续保持「${gradeLabel}」状态`
  return tips.slice(0, 2).join('；')
}

/**
 * 财务健康度评估
 * @param {string} [month] 评估月份，默认当月
 * @returns {{status: 'insufficient'|'ready', score, grade, tone, summary, dimensions, missing}}
 */
export function financialHealth(month = todayStr().slice(0, 7)) {
  const { income, expense } = incomeAndExpense(month)

  // 维度一：当月储蓄率（有收入或支出数据才可评估）
  let savings = null
  if (income > 0 || expense > 0) {
    const ratePct = income > 0 ? Math.round(((income - expense) / income) * 100) : -100
    savings = { rate: ratePct, income, expense, ...rateScore(ratePct) }
  }

  // 维度二：超支类别（本月设置了预算才可评估）
  const budget = budgetDimension(month)

  // 维度三：连续记账天数（有记账记录才可评估）
  const hasRecords = loadTransactions().length > 0
  const streak = hasRecords ? computeCurrentStreak() : 0
  const streakDim = hasRecords ? { streak, ...streakScore(streak) } : null

  const dimensions = { savings, budget, streak: streakDim }
  const available = Object.values(dimensions).filter(Boolean)
  const missing = [
    savings ? null : '本月还没有收支记录',
    budget ? null : '本月未设置类别预算',
    streakDim ? null : '还没有任何记账记录'
  ].filter(Boolean)

  // 数据维度不足 2 个时不硬算分数
  if (available.length < 2) {
    return {
      status: 'insufficient',
      score: null,
      grade: null,
      tone: null,
      dimensions,
      missing,
      message: missing.length >= 3
        ? '还没有任何财务数据，先记下本月第一笔收支吧。'
        : `数据还太少（${missing.join('；')}），再补一些数据就能生成健康度评分。`
    }
  }

  const dimensionKeys = Object.keys(dimensions).filter((key) => dimensions[key])
  const weightSum = dimensionKeys.reduce((sum, key) => sum + WEIGHTS[key], 0)
  const weighted = dimensionKeys.reduce((sum, key) => sum + dimensions[key].score * WEIGHTS[key], 0)
  const score = Math.round(weighted / weightSum)
  const grade = GRADES.find((g) => score >= g.min)

  return {
    status: 'ready',
    score,
    grade: grade.label,
    tone: grade.tone,
    dimensions,
    missing,
    summary: buildSummary(dimensions, grade.label)
  }
}
