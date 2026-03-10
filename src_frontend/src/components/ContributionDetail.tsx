/**
 * 贡献值详情组件
 * 展示每次对话获得的贡献值和数据评级
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// 数据评级配置
const RATING_CONFIG = {
  common: {
    name: '普通数据',
    nameEn: 'Common Data',
    color: '#9CA3AF',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    emoji: '📝',
    description: '日常问候'
  },
  active: {
    name: '活跃数据',
    nameEn: 'Active Data',
    color: '#60A5FA',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    emoji: '💬',
    description: '日常对话'
  },
  rare: {
    name: '稀有·真实情感图谱',
    nameEn: 'Rare · Real Emotion Map',
    color: '#A78BFA',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    emoji: '💜',
    description: '情感表达'
  },
  precious: {
    name: '珍贵·人类行为样本',
    nameEn: 'Precious · Human Behavior Sample',
    color: '#F59E0B',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-600',
    emoji: '🧡',
    description: '分享经历'
  },
  collection: {
    name: '典藏级·人类独有思维特征',
    nameEn: 'Collection · Unique Human Thinking',
    color: '#EF4444',
    bgColor: 'bg-red-50',
    textColor: 'text-red-600',
    emoji: '❤️',
    description: '深度思考'
  },
  legendary: {
    name: '绝版·专属生命记忆',
    nameEn: 'Legendary · Exclusive Life Memory',
    color: '#EC4899',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    emoji: '💎',
    description: '特殊回忆'
  }
}

interface ContributionDetail {
  points: number
  rating: keyof typeof RATING_CONFIG
  reason: string
  keywords?: string[]
  emotion?: string
}

interface ContributionDetailPopupProps {
  detail: ContributionDetail | null
  onClose: () => void
}

/**
 * 贡献值详情弹窗
 */
export function ContributionDetailPopup({ detail, onClose }: ContributionDetailPopupProps) {
  if (!detail) return null

  const config = RATING_CONFIG[detail.rating]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <div className={`${config.bgColor} rounded-2xl shadow-lg p-4 max-w-sm`}>
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>

          {/* 评级图标和名称 */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{config.emoji}</span>
            <div>
              <div className={`font-bold ${config.textColor}`}>
                {config.name}
              </div>
              <div className="text-xs text-gray-500">
                {config.nameEn}
              </div>
            </div>
          </div>

          {/* 贡献值 */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-bold" style={{ color: config.color }}>
              +{detail.points}
            </span>
            <span className="text-gray-600">贡献值</span>
          </div>

          {/* 原因 */}
          <div className="text-sm text-gray-600 mb-2">
            📝 {detail.reason}
          </div>

          {/* 关键词 */}
          {detail.keywords && detail.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {detail.keywords.map((keyword, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-white rounded-full text-xs text-gray-600"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}

          {/* 数据价值说明 */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              💡 你提供的数据正在帮助 AI 成长
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * 贡献值详情卡片（用于历史记录）
 */
export function ContributionDetailCard({ detail }: { detail: ContributionDetail & { createdAt: Date } }) {
  const config = RATING_CONFIG[detail.rating]

  return (
    <div className={`${config.bgColor} rounded-xl p-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.emoji}</span>
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.name}
          </span>
        </div>
        <span className="font-bold" style={{ color: config.color }}>
          +{detail.points}
        </span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        {detail.reason}
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {detail.createdAt.toLocaleString('zh-CN')}
      </div>
    </div>
  )
}

/**
 * 贡献值统计卡片
 */
export function ContributionStatsCard({ stats }: {
  stats: {
    total: number
    byRating: Record<keyof typeof RATING_CONFIG, number>
    recentPoints: number
    streak: number
  }
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-bold text-gray-800 mb-4">📊 贡献值统计</h3>
      
      {/* 总贡献值 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-600">总贡献值</span>
        <span className="text-2xl font-bold text-purple-600">{stats.total}</span>
      </div>

      {/* 本周贡献 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-600">本周获得</span>
        <span className="text-lg font-semibold text-blue-600">+{stats.recentPoints}</span>
      </div>

      {/* 连续签到 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-600">连续签到</span>
        <span className="text-lg font-semibold text-orange-600">{stats.streak} 天</span>
      </div>

      {/* 各评级分布 */}
      <div className="space-y-2">
        <div className="text-sm text-gray-500 mb-2">数据评级分布</div>
        {(Object.entries(RATING_CONFIG) as [keyof typeof RATING_CONFIG, typeof RATING_CONFIG.common][]).map(([key, config]) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{config.emoji}</span>
              <span className="text-xs text-gray-600">{config.name}</span>
            </div>
            <span className="text-sm font-medium" style={{ color: config.color }}>
              {stats.byRating[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default {
  ContributionDetailPopup,
  ContributionDetailCard,
  ContributionStatsCard,
  RATING_CONFIG
}