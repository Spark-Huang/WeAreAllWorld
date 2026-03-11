/**
 * 连续登录奖励服务
 * 
 * 功能：连续登录获得递增奖励
 * 目的：提高用户留存
 */

import { supabase } from '../api/index.js'

export interface LoginReward {
  userId: string
  streak: number
  todayReward: number
  totalReward: number
  nextMilestone: number
  nextMilestoneReward: string
  isNewRecord: boolean
}

// 连续登录奖励配置
export const STREAK_REWARDS = {
  // 每日基础奖励
  daily: [15, 18, 21, 24, 27, 30, 50], // 第1-7天
  
  // 里程碑奖励
  milestones: {
    3: { points: 10, title: '忠实伙伴', emoji: '🤝', reward: 'AI表情包：友谊套' },
    7: { points: 30, title: '周度伙伴', emoji: '🌟', reward: 'AI外观：纪念套装' },
    14: { points: 50, title: '长期陪伴', emoji: '💎', reward: 'AI外观：稀有套装 + 实用能力+5%' },
    30: { points: 100, title: '月度纪念', emoji: '🏆', reward: 'AI外观：传说套装 + 实用能力+10%' },
    100: { points: 300, title: '百日知己', emoji: '👑', reward: 'AI外观：传奇套装 + 实用能力+15%' },
    365: { points: 1000, title: '年度灵魂伴侣', emoji: '💫', reward: 'AI外观：不朽套装 + 实用能力+25%' }
  }
}

/**
 * 处理每日登录
 */
export async function processDailyLogin(userId: string): Promise<LoginReward> {
  // 获取用户信息
  const { data: user } = await supabase
    .from('users')
    .select('last_login, login_streak, max_streak, contribution')
    .eq('id', userId)
    .single()

  if (!user) {
    throw new Error('User not found')
  }

  const today = new Date().toISOString().split('T')[0]
  const lastLogin = user.last_login ? new Date(user.last_login).toISOString().split('T')[0] : null
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  let newStreak = 1
  let isNewRecord = false

  // 计算连续登录天数
  if (lastLogin === yesterday) {
    newStreak = (user.login_streak || 0) + 1
  } else if (lastLogin === today) {
    // 今天已经登录过
    newStreak = user.login_streak || 1
  } else {
    // 断签，重新开始
    newStreak = 1
  }

  // 检查是否破纪录
  if (newStreak > (user.max_streak || 0)) {
    isNewRecord = true
  }

  // 计算今日奖励
  const dayOfWeek = ((newStreak - 1) % 7)
  const todayReward = STREAK_REWARDS.daily[dayOfWeek]

  // 计算里程碑奖励
  let milestonePoints = 0
  let milestoneReward = ''
  
  for (const [days, reward] of Object.entries(STREAK_REWARDS.milestones)) {
    if (parseInt(days) === newStreak) {
      milestonePoints = reward.points
      milestoneReward = `${reward.emoji} ${reward.title}: ${reward.reward}`
      break
    }
  }

  const totalReward = todayReward + milestonePoints

  // 更新用户数据
  await supabase
    .from('users')
    .update({
      last_login: new Date().toISOString(),
      login_streak: newStreak,
      max_streak: Math.max(newStreak, user.max_streak || 0),
      contribution: (user.contribution || 0) + totalReward
    })
    .eq('id', userId)

  // 记录登录日志
  await supabase
    .from('login_records')
    .insert({
      user_id: userId,
      login_date: today,
      streak_at_login: newStreak,
      points_earned: totalReward
    })

  // 更新 AI 伙伴贡献值
  await supabase.rpc('update_contribution', {
    p_user_id: userId,
    p_points: totalReward,
    p_reason: `连续登录${newStreak}天`
  })

  // 找下一个里程碑
  const nextMilestone = findNextMilestone(newStreak)

  return {
    userId,
    streak: newStreak,
    todayReward,
    totalReward,
    nextMilestone: nextMilestone.days,
    nextMilestoneReward: nextMilestone.reward,
    isNewRecord
  }
}

/**
 * 找下一个里程碑
 */
function findNextMilestone(currentStreak: number): { days: number; reward: string } {
  const milestoneDays = Object.keys(STREAK_REWARDS.milestones).map(Number).sort((a, b) => a - b)
  
  for (const days of milestoneDays) {
    if (days > currentStreak) {
      const reward = STREAK_REWARDS.milestones[days]
      return {
        days,
        reward: `${reward.emoji} ${reward.title}`
      }
    }
  }

  // 已达最高里程碑
  return {
    days: 365,
    reward: '已达成所有里程碑！'
  }
}

/**
 * 获取登录状态
 */
export async function getLoginStatus(userId: string): Promise<{
  streak: number
  maxStreak: number
  todayLoggedIn: boolean
  nextReward: number
  nextMilestone: { days: number; reward: string }
}> {
  const { data: user } = await supabase
    .from('users')
    .select('last_login, login_streak, max_streak')
    .eq('id', userId)
    .single()

  if (!user) {
    return {
      streak: 0,
      maxStreak: 0,
      todayLoggedIn: false,
      nextReward: STREAK_REWARDS.daily[0],
      nextMilestone: { days: 3, reward: '🤝 忠实伙伴' }
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const lastLogin = user.last_login ? new Date(user.last_login).toISOString().split('T')[0] : null
  const todayLoggedIn = lastLogin === today

  const streak = user.login_streak || 0
  const nextDay = (streak % 7)
  const nextReward = todayLoggedIn 
    ? STREAK_REWARDS.daily[(nextDay + 1) % 7]
    : STREAK_REWARDS.daily[nextDay]

  const nextMilestone = findNextMilestone(streak)

  return {
    streak,
    maxStreak: user.max_streak || 0,
    todayLoggedIn,
    nextReward,
    nextMilestone
  }
}

/**
 * 获取登录历史
 */
export async function getLoginHistory(userId: string, days: number = 30): Promise<{
  date: string
  streak: number
  points: number
}[]> {
  const { data } = await supabase
    .from('login_records')
    .select('login_date, streak_at_login, points_earned')
    .eq('user_id', userId)
    .order('login_date', { ascending: false })
    .limit(days)

  return (data || []).map(d => ({
    date: d.login_date,
    streak: d.streak_at_login,
    points: d.points_earned
  }))
}

/**
 * 获取排行榜
 */
export async function getStreakLeaderboard(limit: number = 10): Promise<{
  rank: number
  userId: string
  streak: number
}[]> {
  const { data } = await supabase
    .from('users')
    .select('id, login_streak')
    .order('login_streak', { ascending: false })
    .limit(limit)

  return (data || []).map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    streak: u.login_streak || 0
  }))
}

export default {
  processDailyLogin,
  getLoginStatus,
  getLoginHistory,
  getStreakLeaderboard,
  STREAK_REWARDS
}