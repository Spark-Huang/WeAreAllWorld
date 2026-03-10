/**
 * 连续登录奖励组件
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LoginReward {
  streak: number
  todayReward: number
  totalReward: number
  nextMilestone: number
  nextMilestoneReward: string
  isNewRecord: boolean
}

interface LoginStatus {
  streak: number
  maxStreak: number
  todayLoggedIn: boolean
  nextReward: number
  nextMilestone: { days: number; reward: string }
}

// 连续登录奖励配置
const STREAK_MILESTONES = [
  { days: 3, emoji: '🤝', title: '忠实伙伴' },
  { days: 7, emoji: '🌟', title: '周度伙伴' },
  { days: 14, emoji: '💎', title: '长期陪伴' },
  { days: 30, emoji: '🏆', title: '月度纪念' },
  { days: 100, emoji: '👑', title: '百日知己' },
  { days: 365, emoji: '💫', title: '年度灵魂伴侣' }
]

/**
 * 登录奖励弹窗
 */
export function LoginRewardPopup({
  reward,
  onClose
}: {
  reward: LoginReward
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <motion.div
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 20 }}
          className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-2xl p-6 max-w-sm w-full text-white"
        >
          {/* 标题 */}
          <div className="text-center mb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-5xl mb-2"
            >
              🎉
            </motion.div>
            <h2 className="text-xl font-bold">
              {reward.isNewRecord ? '新纪录！' : '欢迎回来！'}
            </h2>
          </div>

          {/* 连续登录天数 */}
          <div className="bg-white/20 rounded-xl p-4 mb-4">
            <div className="text-center">
              <div className="text-sm opacity-80">连续登录</div>
              <div className="text-4xl font-bold">{reward.streak} 天</div>
            </div>
          </div>

          {/* 奖励 */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
              <span>今日奖励</span>
              <span className="font-bold">+{reward.todayReward}</span>
            </div>
            {reward.totalReward > reward.todayReward && (
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span>里程碑奖励</span>
                <span className="font-bold">+{reward.totalReward - reward.todayReward}</span>
              </div>
            )}
            <div className="flex justify-between items-center bg-yellow-400/30 rounded-lg p-3">
              <span>总计获得</span>
              <span className="text-xl font-bold">+{reward.totalReward}</span>
            </div>
          </div>

          {/* 下一个里程碑 */}
          <div className="text-center text-sm opacity-80 mb-4">
            下一个里程碑：{reward.nextMilestone}天 - {reward.nextMilestoneReward}
          </div>

          {/* 按钮 */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-white text-purple-600 font-bold rounded-xl"
          >
            继续探索
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * 连续登录状态卡片
 */
export function StreakStatusCard({ status }: { status: LoginStatus }) {
  // 计算进度到下一个里程碑
  const nextMilestone = STREAK_MILESTONES.find(m => m.days > status.streak) || STREAK_MILESTONES[STREAK_MILESTONES.length - 1]
  const progress = status.streak / nextMilestone.days * 100

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">🔥 连续登录</h3>
        <span className="text-2xl font-bold text-purple-600">{status.streak}天</span>
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>下一个里程碑</span>
          <span>{nextMilestone.emoji} {nextMilestone.title}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
          />
        </div>
        <div className="text-right text-xs text-gray-400 mt-1">
          还需 {nextMilestone.days - status.streak} 天
        </div>
      </div>

      {/* 里程碑列表 */}
      <div className="flex justify-between">
        {STREAK_MILESTONES.slice(0, 5).map(milestone => (
          <div
            key={milestone.days}
            className={`text-center ${
              status.streak >= milestone.days ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <div className={`text-lg ${status.streak >= milestone.days ? '' : 'grayscale'}`}>
              {milestone.emoji}
            </div>
            <div className="text-xs text-gray-500">{milestone.days}天</div>
          </div>
        ))}
      </div>

      {/* 今日状态 */}
      <div className={`mt-4 p-2 rounded-lg text-center text-sm ${
        status.todayLoggedIn 
          ? 'bg-green-50 text-green-600' 
          : 'bg-orange-50 text-orange-600'
      }`}>
        {status.todayLoggedIn ? '✓ 今日已登录' : '今日尚未登录'}
      </div>

      {/* 最高纪录 */}
      <div className="mt-2 text-center text-xs text-gray-400">
        最高纪录：{status.maxStreak}天
      </div>
    </div>
  )
}

/**
 * 连续登录日历
 */
export function StreakCalendar({
  history,
  streak
}: {
  history: { date: string; streak: number }[]
  streak: number
}) {
  // 生成最近30天的日历
  const days = []
  const today = new Date()
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const logged = history.some(h => h.date === dateStr)
    
    days.push({
      date: dateStr,
      logged,
      isToday: i === 0
    })
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-bold text-gray-800 mb-4">📅 登录日历</h3>
      
      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map(day => (
          <div key={day} className="text-center text-xs text-gray-400 py-1">
            {day}
          </div>
        ))}
        
        {days.map((day, i) => (
          <div
            key={i}
            className={`aspect-square rounded flex items-center justify-center text-xs ${
              day.isToday
                ? 'bg-purple-500 text-white font-bold'
                : day.logged
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-gray-50 text-gray-300'
            }`}
          >
            {new Date(day.date).getDate()}
          </div>
        ))}
      </div>
      
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span>今日</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-100" />
          <span>已登录</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-50" />
          <span>未登录</span>
        </div>
      </div>
    </div>
  )
}

export default {
  LoginRewardPopup,
  StreakStatusCard,
  StreakCalendar,
  STREAK_MILESTONES
}