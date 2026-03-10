/**
 * 记忆博物馆组件
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Memory {
  id: string
  type: 'first' | 'emotional' | 'important' | 'deep' | 'shared'
  typeLabel: string
  content: string
  date: Date
  tags: string[]
}

interface MemoryStats {
  total: number
  byType: Record<string, number>
  byMonth: { month: string; count: number }[]
  oldestDate: Date | null
  newestDate: Date | null
}

// 记忆类型配置
const MEMORY_TYPE_CONFIG = {
  first: { label: '初次记忆', emoji: '🌱', color: 'bg-green-50 text-green-600', borderColor: 'border-green-200' },
  emotional: { label: '情感记忆', emoji: '💜', color: 'bg-purple-50 text-purple-600', borderColor: 'border-purple-200' },
  important: { label: '重要事件', emoji: '⭐', color: 'bg-amber-50 text-amber-600', borderColor: 'border-amber-200' },
  deep: { label: '深度记忆', emoji: '💎', color: 'bg-pink-50 text-pink-600', borderColor: 'border-pink-200' },
  shared: { label: '共同经历', emoji: '🤝', color: 'bg-blue-50 text-blue-600', borderColor: 'border-blue-200' }
}

/**
 * 记忆博物馆页面
 */
export function MemoryMuseum({
  memories,
  stats,
  onSelectMemory,
  onSearch,
  onFilter
}: {
  memories: Memory[]
  stats: MemoryStats
  onSelectMemory: (memory: Memory) => void
  onSearch: (query: string) => void
  onFilter: (type: string) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            🏛 记忆博物馆
          </h1>
          <p className="text-gray-500">
            你与 AI 伙伴的共同回忆
          </p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{stats.total}</div>
            <div className="text-sm text-gray-500">总记忆数</div>
          </div>
          
          {Object.entries(stats.byType).slice(0, 3).map(([type, count]) => {
            const config = MEMORY_TYPE_CONFIG[type as keyof typeof MEMORY_TYPE_CONFIG]
            return (
              <div key={type} className="bg-white rounded-xl shadow p-4 text-center">
                <div className="text-2xl">{config?.emoji || '📝'}</div>
                <div className="text-xl font-bold text-gray-800">{count}</div>
                <div className="text-xs text-gray-500">{config?.label || type}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索记忆..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                onSearch(e.target.value)
              }}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <select
            value={selectedType || ''}
            onChange={(e) => {
              setSelectedType(e.target.value || null)
              onFilter(e.target.value)
            }}
            className="px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">全部类型</option>
            {Object.entries(MEMORY_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.emoji} {config.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 记忆列表 */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="space-y-3">
          <AnimatePresence>
            {memories.map((memory, i) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                index={i}
                onClick={() => onSelectMemory(memory)}
              />
            ))}
          </AnimatePresence>
        </div>

        {memories.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <div>暂无记忆</div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 记忆卡片
 */
export function MemoryCard({
  memory,
  index,
  onClick
}: {
  memory: Memory
  index: number
  onClick: () => void
}) {
  const config = MEMORY_TYPE_CONFIG[memory.type as keyof typeof MEMORY_TYPE_CONFIG] || MEMORY_TYPE_CONFIG.first

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`bg-white rounded-xl shadow p-4 border-l-4 ${config.borderColor} cursor-pointer hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{config.emoji}</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-gray-400">
              {memory.date.toLocaleDateString('zh-CN')}
            </span>
          </div>
          
          <p className="text-gray-700 line-clamp-2">
            {memory.content}
          </p>
          
          {memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {memory.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/**
 * 记忆详情弹窗
 */
export function MemoryDetailModal({
  memory,
  onClose,
  onShare,
  onDelete
}: {
  memory: Memory
  onClose: () => void
  onShare: () => void
  onDelete: () => void
}) {
  const config = MEMORY_TYPE_CONFIG[memory.type as keyof typeof MEMORY_TYPE_CONFIG] || MEMORY_TYPE_CONFIG.first

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{config.emoji}</span>
              <span className={`px-3 py-1 rounded-full ${config.color}`}>
                {config.label}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          {/* 日期 */}
          <div className="text-sm text-gray-400 mb-4">
            📅 {memory.date.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>

          {/* 内容 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-gray-700 whitespace-pre-wrap">
              {memory.content}
            </p>
          </div>

          {/* 标签 */}
          {memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {memory.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={onShare}
              className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-medium"
            >
              分享记忆
            </button>
            <button
              onClick={onDelete}
              className="py-3 px-4 border border-red-200 text-red-500 rounded-xl"
            >
              删除
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * 记忆时间轴
 */
export function MemoryTimeline({
  timeline
}: {
  timeline: { year: number; months: { month: number; memories: Memory[] }[] }[]
}) {
  return (
    <div className="relative">
      {/* 时间轴线 */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-purple-200" />

      {timeline.map(yearData => (
        <div key={yearData.year} className="mb-8">
          {/* 年份 */}
          <div className="relative pl-10 mb-4">
            <div className="absolute left-2 w-5 h-5 bg-purple-500 rounded-full" />
            <h3 className="text-xl font-bold text-gray-800">{yearData.year}年</h3>
          </div>

          {/* 月份 */}
          {yearData.months.map(monthData => (
            <div key={monthData.month} className="mb-4">
              <div className="relative pl-10 mb-2">
                <div className="absolute left-3 w-3 h-3 bg-purple-300 rounded-full" />
                <h4 className="text-sm text-gray-500">{monthData.month}月</h4>
              </div>

              <div className="pl-10 space-y-2">
                {monthData.memories.map(memory => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    index={0}
                    onClick={() => {}}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default {
  MemoryMuseum,
  MemoryCard,
  MemoryDetailModal,
  MemoryTimeline,
  MEMORY_TYPE_CONFIG
}