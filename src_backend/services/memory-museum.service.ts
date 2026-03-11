/**
 * 记忆博物馆服务
 * 
 * 功能：展示用户与AI的所有重要记忆
 * 目的：展示长期价值，增强迁移成本
 */

import { supabase } from '../api/index.js'

export interface Memory {
  id: string
  userId: string
  type: 'first' | 'emotional' | 'important' | 'deep' | 'shared'
  typeLabel: string
  content: string
  date: Date
  dialogueId?: string
  tags: string[]
}

export interface MemoryStats {
  total: number
  byType: Record<string, number>
  byMonth: { month: string; count: number }[]
  oldestDate: Date | null
  newestDate: Date | null
}

export interface MemoryTimeline {
  year: number
  months: {
    month: number
    memories: Memory[]
  }[]
}

// 记忆类型标签
export const MEMORY_TYPE_LABELS = {
  first: { label: '初次记忆', emoji: '🌱', color: '#10B981' },
  emotional: { label: '情感记忆', emoji: '💜', color: '#A78BFA' },
  important: { label: '重要事件', emoji: '⭐', color: '#F59E0B' },
  deep: { label: '深度记忆', emoji: '💎', color: '#EC4899' },
  shared: { label: '共同经历', emoji: '🤝', color: '#60A5FA' }
}

/**
 * 创建记忆
 */
export async function createMemory(params: {
  userId: string
  type: Memory['type']
  content: string
  dialogueId?: string
  tags?: string[]
}): Promise<Memory> {
  const { userId, type, content, dialogueId, tags = [] } = params

  const { data, error } = await supabase
    .from('ai_memories')
    .insert({
      user_id: userId,
      type,
      content,
      dialogue_id: dialogueId,
      tags,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Create memory error:', error)
    throw error
  }

  return {
    id: data.id,
    userId: data.user_id,
    type: data.type,
    typeLabel: MEMORY_TYPE_LABELS[type as keyof typeof MEMORY_TYPE_LABELS]?.label || type,
    content: data.content,
    date: new Date(data.created_at),
    dialogueId: data.dialogue_id,
    tags: data.tags || []
  }
}

/**
 * 获取用户所有记忆
 */
export async function getMemories(
  userId: string,
  options?: {
    type?: Memory['type']
    limit?: number
    offset?: number
    search?: string
  }
): Promise<Memory[]> {
  let query = supabase
    .from('ai_memories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (options?.type) {
    query = query.eq('type', options.type)
  }

  if (options?.search) {
    query = query.ilike('content', `%${options.search}%`)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Get memories error:', error)
    return []
  }

  return (data || []).map(d => ({
    id: d.id,
    userId: d.user_id,
    type: d.type,
    typeLabel: MEMORY_TYPE_LABELS[d.type as keyof typeof MEMORY_TYPE_LABELS]?.label || d.type,
    content: d.content,
    date: new Date(d.created_at),
    dialogueId: d.dialogue_id,
    tags: d.tags || []
  }))
}

/**
 * 获取记忆统计
 */
export async function getMemoryStats(userId: string): Promise<MemoryStats> {
  const { data: memories } = await supabase
    .from('ai_memories')
    .select('type, created_at')
    .eq('user_id', userId)

  if (!memories || memories.length === 0) {
    return {
      total: 0,
      byType: {},
      byMonth: [],
      oldestDate: null,
      newestDate: null
    }
  }

  // 按类型统计
  const byType: Record<string, number> = {}
  for (const m of memories) {
    byType[m.type] = (byType[m.type] || 0) + 1
  }

  // 按月统计
  const byMonthMap: Record<string, number> = {}
  for (const m of memories) {
    const month = new Date(m.created_at).toISOString().slice(0, 7) // YYYY-MM
    byMonthMap[month] = (byMonthMap[month] || 0) + 1
  }

  const byMonth = Object.entries(byMonthMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // 日期范围
  const dates = memories.map(m => new Date(m.created_at))
  const oldestDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const newestDate = new Date(Math.max(...dates.map(d => d.getTime())))

  return {
    total: memories.length,
    byType,
    byMonth,
    oldestDate,
    newestDate
  }
}

/**
 * 获取时间轴视图
 */
export async function getMemoryTimeline(userId: string): Promise<MemoryTimeline[]> {
  const memories = await getMemories(userId, { limit: 100 })

  // 按年月分组
  const timeline: Record<number, Record<number, Memory[]>> = {}

  for (const memory of memories) {
    const year = memory.date.getFullYear()
    const month = memory.date.getMonth() + 1

    if (!timeline[year]) {
      timeline[year] = {}
    }
    if (!timeline[year][month]) {
      timeline[year][month] = []
    }
    timeline[year][month].push(memory)
  }

  // 转换为数组格式
  return Object.entries(timeline)
    .map(([year, months]) => ({
      year: parseInt(year),
      months: Object.entries(months)
        .map(([month, memories]) => ({
          month: parseInt(month),
          memories
        }))
        .sort((a, b) => b.month - a.month)
    }))
    .sort((a, b) => b.year - a.year)
}

/**
 * 搜索记忆
 */
export async function searchMemories(
  userId: string,
  query: string
): Promise<Memory[]> {
  return getMemories(userId, { search: query, limit: 20 })
}

/**
 * 获取特定日期的记忆
 */
export async function getMemoriesByDate(
  userId: string,
  date: Date
): Promise<Memory[]> {
  const dateStr = date.toISOString().split('T')[0]

  const { data } = await supabase
    .from('ai_memories')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dateStr)
    .lt('created_at', `${dateStr}T23:59:59`)
    .order('created_at', { ascending: false })

  return (data || []).map(d => ({
    id: d.id,
    userId: d.user_id,
    type: d.type,
    typeLabel: MEMORY_TYPE_LABELS[d.type as keyof typeof MEMORY_TYPE_LABELS]?.label || d.type,
    content: d.content,
    date: new Date(d.created_at),
    dialogueId: d.dialogue_id,
    tags: d.tags || []
  }))
}

/**
 * 获取纪念日（一年前的今天）
 */
export async function getAnniversaryMemories(userId: string): Promise<Memory[]> {
  const today = new Date()
  const lastYear = new Date(today)
  lastYear.setFullYear(lastYear.getFullYear() - 1)

  return getMemoriesByDate(userId, lastYear)
}

/**
 * 生成记忆分享卡片
 */
export async function generateMemoryShareCard(memory: Memory): Promise<{
  title: string
  content: string
  hashtags: string[]
}> {
  const typeInfo = MEMORY_TYPE_LABELS[memory.type as keyof typeof MEMORY_TYPE_LABELS]

  return {
    title: `${typeInfo.emoji} ${typeInfo.label}`,
    content: memory.content.slice(0, 100) + (memory.content.length > 100 ? '...' : ''),
    hashtags: ['#大同世界', '#AI记忆', `#${typeInfo.label}`]
  }
}

/**
 * 删除记忆
 */
export async function deleteMemory(memoryId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_memories')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId)

  return !error
}

export default {
  createMemory,
  getMemories,
  getMemoryStats,
  getMemoryTimeline,
  searchMemories,
  getMemoriesByDate,
  getAnniversaryMemories,
  generateMemoryShareCard,
  deleteMemory,
  MEMORY_TYPE_LABELS
}