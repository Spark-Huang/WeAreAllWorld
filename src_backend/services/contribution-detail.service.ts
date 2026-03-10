/**
 * 贡献值详情展示服务
 * 
 * 功能：展示每次对话获得的贡献值和数据评级
 * 目的：让用户看到自己数据的价值
 */

import { supabase } from '../api/config/supabase.js'

export interface ContributionDetail {
  dialogueId: string
  userId: string
  points: number
  rating: DataRating
  reason: string
  keywords: string[]
  emotion?: string
  keyInfo?: string
  createdAt: Date
}

export type DataRating = 
  | 'common'      // 普通数据 - 日常问候
  | 'active'      // 活跃数据 - 日常对话
  | 'rare'        // 稀有·真实情感图谱
  | 'precious'    // 珍贵·人类行为样本
  | 'collection'  // 典藏级·人类独有思维特征
  | 'legendary'   // 绝版·专属生命记忆

export interface RatingInfo {
  name: string
  nameEn: string
  color: string
  emoji: string
  description: string
  pointsRange: [number, number]
}

/**
 * 数据评级信息
 */
export const RATING_INFO: Record<DataRating, RatingInfo> = {
  common: {
    name: '普通数据',
    nameEn: 'Common Data',
    color: '#9CA3AF',
    emoji: '📝',
    description: '日常问候',
    pointsRange: [1, 1]
  },
  active: {
    name: '活跃数据',
    nameEn: 'Active Data',
    color: '#60A5FA',
    emoji: '💬',
    description: '日常对话',
    pointsRange: [2, 2]
  },
  rare: {
    name: '稀有·真实情感图谱',
    nameEn: 'Rare · Real Emotion Map',
    color: '#A78BFA',
    emoji: '💜',
    description: '情感表达',
    pointsRange: [3, 3]
  },
  precious: {
    name: '珍贵·人类行为样本',
    nameEn: 'Precious · Human Behavior Sample',
    color: '#F59E0B',
    emoji: '🧡',
    description: '分享经历',
    pointsRange: [4, 4]
  },
  collection: {
    name: '典藏级·人类独有思维特征',
    nameEn: 'Collection · Unique Human Thinking',
    color: '#EF4444',
    emoji: '❤️',
    description: '深度思考',
    pointsRange: [5, 5]
  },
  legendary: {
    name: '绝版·专属生命记忆',
    nameEn: 'Legendary · Exclusive Life Memory',
    color: '#EC4899',
    emoji: '💎',
    description: '特殊回忆',
    pointsRange: [6, 8]
  }
}

/**
 * 分析对话并计算贡献值
 */
export function analyzeDialogue(message: string): {
  points: number
  rating: DataRating
  reason: string
  keywords: string[]
  emotion?: string
} {
  // 关键词检测
  const keywords: string[] = []
  let emotion: string | undefined
  let rating: DataRating = 'common'
  let points = 1
  let reason = '日常问候'

  // 情感关键词
  const emotionKeywords = {
    happy: ['开心', '高兴', '快乐', '幸福', '太好了', '棒', 'happy', 'glad', 'joy'],
    sad: ['难过', '伤心', '不开心', '郁闷', 'sad', 'upset', 'depressed'],
    angry: ['生气', '愤怒', '烦', '讨厌', 'angry', 'mad', 'annoyed'],
    worried: ['担心', '焦虑', '紧张', '害怕', 'worried', 'anxious', 'scared'],
    tired: ['累', '疲惫', '困', 'tired', 'exhausted']
  }

  // 检测情感
  for (const [emo, words] of Object.entries(emotionKeywords)) {
    if (words.some(w => message.includes(w))) {
      emotion = emo
      keywords.push(`情感:${emo}`)
      break
    }
  }

  // 深度思考关键词
  const deepThinkingKeywords = [
    '我觉得', '我认为', '我想', '我的观点', '在我看来',
    'i think', 'i believe', 'in my opinion', 'my view',
    '为什么', '意义', '价值', '未来', '人生', '梦想', '目标'
  ]

  // 特殊回忆关键词
  const specialMemoryKeywords = [
    '小时候', '童年', '记得', '回忆', '那时候', '曾经',
    '第一次', '最', '永远记得', '难忘',
    'childhood', 'remember', 'memory', 'when i was young'
  ]

  // 经历分享关键词
  const experienceKeywords = [
    '今天', '昨天', '刚才', '发生了', '经历了',
    'today', 'yesterday', 'happened', 'experienced'
  ]

  // 判断评级
  if (specialMemoryKeywords.some(k => message.includes(k))) {
    rating = 'legendary'
    points = message.length > 100 ? 8 : message.length > 50 ? 7 : 6
    reason = '你分享了珍贵的生命记忆'
    keywords.push('特殊回忆')
  } else if (deepThinkingKeywords.some(k => message.includes(k))) {
    rating = 'collection'
    points = 5
    reason = '你分享了深度思考和观点'
    keywords.push('深度思考')
  } else if (experienceKeywords.some(k => message.includes(k))) {
    rating = 'precious'
    points = 4
    reason = '你分享了今天的经历'
    keywords.push('经历分享')
  } else if (emotion) {
    rating = 'rare'
    points = 3
    reason = '你表达了真实的情感'
  } else if (message.length > 20) {
    rating = 'active'
    points = 2
    reason = '日常对话'
  } else {
    rating = 'common'
    points = 1
    reason = '日常问候'
  }

  return {
    points,
    rating,
    reason,
    keywords,
    emotion
  }
}

/**
 * 保存贡献值详情
 */
export async function saveContributionDetail(params: {
  dialogueId: string
  userId: string
  message: string
  aiResponse: string
}): Promise<ContributionDetail> {
  const { dialogueId, userId, message } = params

  // 分析对话
  const analysis = analyzeDialogue(message)

  // 保存到数据库
  const { data, error } = await supabase
    .from('contribution_details')
    .insert({
      dialogue_id: dialogueId,
      user_id: userId,
      points: analysis.points,
      rating: analysis.rating,
      reason: analysis.reason,
      keywords: analysis.keywords,
      emotion: analysis.emotion,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Save contribution detail error:', error)
    // 如果表不存在，返回默认值
    return {
      dialogueId,
      userId,
      points: analysis.points,
      rating: analysis.rating,
      reason: analysis.reason,
      keywords: analysis.keywords,
      emotion: analysis.emotion,
      createdAt: new Date()
    }
  }

  return {
    dialogueId: data.dialogue_id,
    userId: data.user_id,
    points: data.points,
    rating: data.rating,
    reason: data.reason,
    keywords: data.keywords || [],
    emotion: data.emotion,
    createdAt: new Date(data.created_at)
  }
}

/**
 * 获取用户贡献值历史
 */
export async function getContributionHistory(
  userId: string,
  limit: number = 20
): Promise<ContributionDetail[]> {
  const { data, error } = await supabase
    .from('contribution_details')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map(d => ({
    dialogueId: d.dialogue_id,
    userId: d.user_id,
    points: d.points,
    rating: d.rating,
    reason: d.reason,
    keywords: d.keywords || [],
    emotion: d.emotion,
    createdAt: new Date(d.created_at)
  }))
}

/**
 * 获取用户贡献值统计
 */
export async function getContributionStats(userId: string): Promise<{
  total: number
  byRating: Record<DataRating, number>
  recentPoints: number
  streak: number
}> {
  const { data: details } = await supabase
    .from('contribution_details')
    .select('points, rating, created_at')
    .eq('user_id', userId)

  const byRating: Record<DataRating, number> = {
    common: 0,
    active: 0,
    rare: 0,
    precious: 0,
    collection: 0,
    legendary: 0
  }

  let total = 0
  let recentPoints = 0
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  if (details) {
    for (const d of details) {
      total += d.points
      byRating[d.rating as DataRating]++
      if (new Date(d.created_at) > oneWeekAgo) {
        recentPoints += d.points
      }
    }
  }

  // 计算连续签到
  const { data: user } = await supabase
    .from('users')
    .select('checkin_streak')
    .eq('id', userId)
    .single()

  return {
    total,
    byRating,
    recentPoints,
    streak: user?.checkin_streak || 0
  }
}

/**
 * 格式化贡献值详情（用于展示）
 */
export function formatContributionDetail(detail: ContributionDetail): string {
  const ratingInfo = RATING_INFO[detail.rating]
  
  return `${ratingInfo.emoji} 贡献值：+${detail.points}
💎 数据评级：${ratingInfo.name}
📝 原因：${detail.reason}`
}

export default {
  analyzeDialogue,
  saveContributionDetail,
  getContributionHistory,
  getContributionStats,
  formatContributionDetail,
  RATING_INFO
}